package recurring

import (
	"fmt"
	"math"
	"sort"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

// App holds the PocketBase instance
var App *pocketbase.PocketBase

// DetectionResult contains detected recurring payment info
type DetectionResult struct {
	MerchantID      string    `json:"merchant_id"`
	MerchantName    string    `json:"merchant_name"`
	AverageAmount   float64   `json:"average_amount"`
	Frequency       string    `json:"frequency"` // weekly, monthly, yearly
	FrequencyDays   int       `json:"frequency_days"`
	ConfidenceScore float64   `json:"confidence_score"` // 0-1
	LastOccurrence  time.Time `json:"last_occurrence"`
	NextPredicted   time.Time `json:"next_predicted"`
	Occurrences     int       `json:"occurrences"`
	AmountVariance  float64   `json:"amount_variance"`
}

// TransactionGroup represents transactions from same merchant
type TransactionGroup struct {
	MerchantID   string
	MerchantName string
	Transactions []Transaction
}

// Transaction simplified for analysis
type Transaction struct {
	ID        string
	Date      time.Time
	Amount    float64
	IsExpense bool
}

// DetectRecurring analyzes transactions to find recurring patterns
func DetectRecurring(workspaceID string, accountID string, minOccurrences int) ([]DetectionResult, error) {
	if App == nil {
		return nil, fmt.Errorf("PocketBase app not initialized")
	}

	if minOccurrences < 2 {
		minOccurrences = 3 // Default minimum
	}

	// Get transactions grouped by merchant
	groups, err := getTransactionsByMerchant(workspaceID, accountID)
	if err != nil {
		return nil, err
	}

	var results []DetectionResult

	for _, group := range groups {
		if len(group.Transactions) < minOccurrences {
			continue
		}

		result := analyzeGroup(group)
		if result != nil && result.ConfidenceScore >= 0.5 {
			results = append(results, *result)
		}
	}

	// Sort by confidence
	sort.Slice(results, func(i, j int) bool {
		return results[i].ConfidenceScore > results[j].ConfidenceScore
	})

	return results, nil
}

// getTransactionsByMerchant groups transactions by merchant
func getTransactionsByMerchant(workspaceID, accountID string) ([]TransactionGroup, error) {
	filter := fmt.Sprintf("workspace = '%s' && merchant != '' && type = 'expense'", workspaceID)
	if accountID != "" {
		filter = fmt.Sprintf("workspace = '%s' && account = '%s' && merchant != '' && type = 'expense'", workspaceID, accountID)
	}

	records, err := App.FindRecordsByFilter("finance_transactions", filter, "-date", 1000, 0)
	if err != nil {
		return nil, err
	}

	// Group by merchant
	groupMap := make(map[string]*TransactionGroup)

	for _, r := range records {
		merchantID := r.GetString("merchant")
		if merchantID == "" {
			continue
		}

		if _, exists := groupMap[merchantID]; !exists {
			// Get merchant name
			merchantName := ""
			if merchant, err := App.FindRecordById("finance_merchants", merchantID); err == nil {
				merchantName = merchant.GetString("display_name")
				if merchantName == "" {
					merchantName = merchant.GetString("name")
				}
			}

			groupMap[merchantID] = &TransactionGroup{
				MerchantID:   merchantID,
				MerchantName: merchantName,
				Transactions: []Transaction{},
			}
		}

		tx := Transaction{
			ID:        r.Id,
			Date:      r.GetDateTime("date").Time(),
			Amount:    r.GetFloat("amount"),
			IsExpense: r.GetString("type") == "expense",
		}

		groupMap[merchantID].Transactions = append(groupMap[merchantID].Transactions, tx)
	}

	// Convert to slice
	var groups []TransactionGroup
	for _, g := range groupMap {
		groups = append(groups, *g)
	}

	return groups, nil
}

// analyzeGroup analyzes a transaction group for recurring patterns
func analyzeGroup(group TransactionGroup) *DetectionResult {
	txs := group.Transactions
	if len(txs) < 2 {
		return nil
	}

	// Sort by date
	sort.Slice(txs, func(i, j int) bool {
		return txs[i].Date.Before(txs[j].Date)
	})

	// Calculate intervals between transactions
	var intervals []int
	for i := 1; i < len(txs); i++ {
		days := int(txs[i].Date.Sub(txs[i-1].Date).Hours() / 24)
		if days > 0 {
			intervals = append(intervals, days)
		}
	}

	if len(intervals) == 0 {
		return nil
	}

	// Detect frequency
	frequency, avgDays, consistency := detectFrequency(intervals)
	if frequency == "" {
		return nil
	}

	// Calculate amount statistics
	var amounts []float64
	for _, tx := range txs {
		amounts = append(amounts, tx.Amount)
	}
	avgAmount := mean(amounts)
	amountVariance := variance(amounts)

	// Calculate confidence score
	confidence := calculateConfidence(consistency, amountVariance, avgAmount, len(txs))

	// Predict next occurrence
	lastDate := txs[len(txs)-1].Date
	nextDate := predictNextDate(lastDate, frequency, avgDays)

	return &DetectionResult{
		MerchantID:      group.MerchantID,
		MerchantName:    group.MerchantName,
		AverageAmount:   math.Round(avgAmount*100) / 100,
		Frequency:       frequency,
		FrequencyDays:   avgDays,
		ConfidenceScore: confidence,
		LastOccurrence:  lastDate,
		NextPredicted:   nextDate,
		Occurrences:     len(txs),
		AmountVariance:  math.Round(amountVariance*100) / 100,
	}
}

// detectFrequency detects the frequency pattern from intervals
func detectFrequency(intervals []int) (string, int, float64) {
	if len(intervals) == 0 {
		return "", 0, 0
	}

	avgDays := int(mean(intToFloat(intervals)))

	// Check for known frequencies
	type freqPattern struct {
		name       string
		targetDays int
		tolerance  int
	}

	patterns := []freqPattern{
		{"weekly", 7, 2},
		{"biweekly", 14, 3},
		{"monthly", 30, 5},
		{"yearly", 365, 30},
	}

	for _, p := range patterns {
		matchCount := 0
		for _, interval := range intervals {
			if abs(interval-p.targetDays) <= p.tolerance {
				matchCount++
			}
		}

		consistency := float64(matchCount) / float64(len(intervals))
		if consistency >= 0.6 {
			return p.name, p.targetDays, consistency
		}
	}

	// Check for custom frequency (consistent but not standard)
	stdDev := standardDeviation(intToFloat(intervals))
	if stdDev < float64(avgDays)*0.3 { // 30% variance threshold
		return "custom", avgDays, 1.0 - (stdDev / float64(avgDays))
	}

	return "", avgDays, 0
}

// calculateConfidence computes overall confidence score
func calculateConfidence(intervalConsistency, amountVariance, avgAmount float64, count int) float64 {
	// Base confidence from interval consistency
	confidence := intervalConsistency * 0.5

	// Amount consistency factor
	if avgAmount > 0 {
		amountConsistency := 1.0 - math.Min(amountVariance/avgAmount, 1.0)
		confidence += amountConsistency * 0.3
	}

	// Occurrence count factor
	countFactor := math.Min(float64(count)/10.0, 1.0) // Max out at 10 occurrences
	confidence += countFactor * 0.2

	return math.Min(confidence, 1.0)
}

// predictNextDate predicts the next payment date
func predictNextDate(lastDate time.Time, frequency string, avgDays int) time.Time {
	switch frequency {
	case "weekly":
		return lastDate.AddDate(0, 0, 7)
	case "biweekly":
		return lastDate.AddDate(0, 0, 14)
	case "monthly":
		return lastDate.AddDate(0, 1, 0)
	case "yearly":
		return lastDate.AddDate(1, 0, 0)
	default:
		return lastDate.AddDate(0, 0, avgDays)
	}
}

// CreateRecurringPayment creates a new recurring payment record
func CreateRecurringPayment(result DetectionResult, workspaceID, accountID string) (string, error) {
	if App == nil {
		return "", fmt.Errorf("PocketBase app not initialized")
	}

	collection, err := App.FindCollectionByNameOrId("finance_recurring")
	if err != nil {
		return "", err
	}

	record := core.NewRecord(collection)
	record.Set("merchant", result.MerchantID)
	record.Set("expected_amount", result.AverageAmount)
	record.Set("frequency", result.Frequency)
	record.Set("frequency_days", result.FrequencyDays)
	record.Set("next_due", result.NextPredicted)
	record.Set("last_paid", result.LastOccurrence)
	record.Set("status", "active")
	record.Set("workspace", workspaceID)

	if accountID != "" {
		record.Set("account", accountID)
	}

	if err := App.Save(record); err != nil {
		return "", err
	}

	return record.Id, nil
}

// GetUpcomingPayments returns recurring payments due soon
func GetUpcomingPayments(workspaceID string, daysAhead int) ([]map[string]any, error) {
	if App == nil {
		return nil, fmt.Errorf("PocketBase app not initialized")
	}

	cutoff := time.Now().AddDate(0, 0, daysAhead)
	filter := fmt.Sprintf("workspace = '%s' && status = 'active' && next_due <= '%s'",
		workspaceID, cutoff.Format("2006-01-02 15:04:05"))

	records, err := App.FindRecordsByFilter("finance_recurring", filter, "next_due", 50, 0)
	if err != nil {
		return nil, err
	}

	var upcoming []map[string]any
	for _, r := range records {
		// Get merchant name
		merchantName := ""
		if merchantID := r.GetString("merchant"); merchantID != "" {
			if merchant, err := App.FindRecordById("finance_merchants", merchantID); err == nil {
				merchantName = merchant.GetString("display_name")
				if merchantName == "" {
					merchantName = merchant.GetString("name")
				}
			}
		}

		upcoming = append(upcoming, map[string]any{
			"id":              r.Id,
			"merchant_name":   merchantName,
			"expected_amount": r.GetFloat("expected_amount"),
			"frequency":       r.GetString("frequency"),
			"next_due":        r.GetDateTime("next_due").Time(),
			"days_until":      int(r.GetDateTime("next_due").Time().Sub(time.Now()).Hours() / 24),
		})
	}

	return upcoming, nil
}

// Helper functions

func mean(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	sum := 0.0
	for _, v := range values {
		sum += v
	}
	return sum / float64(len(values))
}

func variance(values []float64) float64 {
	if len(values) <= 1 {
		return 0
	}
	m := mean(values)
	sumSq := 0.0
	for _, v := range values {
		sumSq += (v - m) * (v - m)
	}
	return sumSq / float64(len(values))
}

func standardDeviation(values []float64) float64 {
	return math.Sqrt(variance(values))
}

func intToFloat(ints []int) []float64 {
	floats := make([]float64, len(ints))
	for i, v := range ints {
		floats[i] = float64(v)
	}
	return floats
}

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}
