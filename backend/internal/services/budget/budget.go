package budget

import (
	"regexp"
	"strings"
	"time"

	"lifehub/backend/internal/domain"

	"github.com/pocketbase/pocketbase"
)

var App *pocketbase.PocketBase

// ComputeStatus calculates the full budget summary for a workspace over a date range.
func ComputeStatus(workspaceID string, startDate, endDate time.Time) (*domain.BudgetSummary, error) {
	// Calculate the number of months in the period for frequency normalization
	months := monthsBetween(startDate, endDate)
	if months < 1 {
		months = 1
	}

	// 1. Load active income sources
	incomeSources, err := loadIncomeSources(workspaceID)
	if err != nil {
		return nil, err
	}

	// 2. Compute income status
	incomeStatuses := []domain.IncomeSourceStatus{}
	var totalIncome float64
	for _, src := range incomeSources {
		status := computeIncomeStatus(workspaceID, src, startDate, endDate, months)
		incomeStatuses = append(incomeStatuses, status)
		totalIncome += status.CalculatedAmount
	}

	// 3. Load active budgets with items
	budgets, err := loadBudgets(workspaceID)
	if err != nil {
		return nil, err
	}

	// 4. Load all transactions in date range
	transactions, err := loadTransactions(workspaceID, startDate, endDate)
	if err != nil {
		return nil, err
	}

	// 5. Match transactions to budget items (single-claim, first match wins)
	claimed := make(map[string]bool) // transaction ID -> claimed
	budgetStatuses := []domain.BudgetGroupStatus{}

	for _, b := range budgets {
		groupStatus := domain.BudgetGroupStatus{
			Budget: b,
		}
		b.Items = sortByOrder(b.Items)

		for _, item := range b.Items {
			if !item.IsActive {
				continue
			}

			itemStatus := domain.BudgetItemStatus{
				BudgetItem: item,
			}

			// Normalize budgeted amount based on frequency
			normalized := item.BudgetedAmount
			if item.Frequency == "yearly" {
				normalized = item.BudgetedAmount / 12 * float64(months)
			} else {
				normalized = item.BudgetedAmount * float64(months)
			}
			itemStatus.NormalizedAmount = normalized

			// Match transactions
			var actualAmount float64
			for i := range transactions {
				tx := &transactions[i]
				if claimed[tx.ID] {
					continue
				}
				if matchesItem(item, *tx) {
					claimed[tx.ID] = true
					actualAmount += tx.Amount
					itemStatus.MatchedTransactions = append(itemStatus.MatchedTransactions, *tx)
				}
			}

			itemStatus.ActualAmount = actualAmount
			itemStatus.Difference = normalized - actualAmount

			// Determine status
			if actualAmount == 0 {
				itemStatus.Status = "pending"
			} else if actualAmount >= normalized*0.95 && actualAmount <= normalized*1.05 {
				itemStatus.Status = "paid"
			} else if actualAmount > normalized {
				itemStatus.Status = "over_budget"
			} else {
				itemStatus.Status = "under_budget"
			}

			groupStatus.Items = append(groupStatus.Items, itemStatus)
			groupStatus.TotalBudgeted += normalized
			groupStatus.TotalActual += actualAmount
		}

		budgetStatuses = append(budgetStatuses, groupStatus)
	}

	// 6. Collect unmatched expenses
	var unmatchedExpenses []domain.FinancialRecord
	var totalBudgeted, totalActual float64
	for _, gs := range budgetStatuses {
		totalBudgeted += gs.TotalBudgeted
		totalActual += gs.TotalActual
	}

	for _, tx := range transactions {
		if !claimed[tx.ID] && tx.IsExpense {
			unmatchedExpenses = append(unmatchedExpenses, tx)
		}
	}

	return &domain.BudgetSummary{
		TotalIncome:       totalIncome,
		IncomeSources:     incomeStatuses,
		Budgets:           budgetStatuses,
		TotalBudgeted:     totalBudgeted,
		TotalActual:       totalActual,
		Remaining:         totalIncome - totalActual,
		UnmatchedExpenses: unmatchedExpenses,
	}, nil
}

func loadIncomeSources(workspaceID string) ([]domain.IncomeSource, error) {
	filter := "workspace = '" + workspaceID + "' && is_active = true"
	records, err := App.FindRecordsByFilter("finance_income_sources", filter, "name", 100, 0)
	if err != nil {
		return []domain.IncomeSource{}, nil
	}

	var sources []domain.IncomeSource
	for _, r := range records {
		sources = append(sources, domain.IncomeSource{
			ID:           r.Id,
			Name:         r.GetString("name"),
			IncomeType:   r.GetString("income_type"),
			Amount:       r.GetFloat("amount"),
			Currency:     r.GetString("currency"),
			DefaultHours: r.GetFloat("default_hours"),
			IsActive:     r.GetBool("is_active"),
			Notes:        r.GetString("notes"),
		})
	}
	return sources, nil
}

func computeIncomeStatus(workspaceID string, src domain.IncomeSource, startDate, endDate time.Time, months float64) domain.IncomeSourceStatus {
	status := domain.IncomeSourceStatus{
		IncomeSource: src,
	}

	if src.IncomeType == "hourly" {
		// Check for hour overrides for each month in the range
		var totalHours float64
		current := time.Date(startDate.Year(), startDate.Month(), 1, 0, 0, 0, 0, time.UTC)
		end := time.Date(endDate.Year(), endDate.Month(), 1, 0, 0, 0, 0, time.UTC)

		for !current.After(end) {
			hours := getHoursForMonth(workspaceID, src.ID, current.Year(), int(current.Month()))
			if hours == 0 {
				hours = src.DefaultHours
			}
			totalHours += hours
			current = current.AddDate(0, 1, 0)
		}

		status.HoursThisMonth = totalHours
		status.CalculatedAmount = src.Amount * totalHours
	} else {
		status.CalculatedAmount = src.Amount * months
	}

	return status
}

func getHoursForMonth(workspaceID, incomeSourceID string, year, month int) float64 {
	filter := "workspace = '" + workspaceID + "' && income_source = '" + incomeSourceID + "' && year = " + itoa(year) + " && month = " + itoa(month)
	records, err := App.FindRecordsByFilter("finance_income_hours", filter, "", 1, 0)
	if err != nil || len(records) == 0 {
		return 0
	}
	return records[0].GetFloat("hours")
}

func loadBudgets(workspaceID string) ([]domain.Budget, error) {
	filter := "workspace = '" + workspaceID + "' && is_active = true"
	records, err := App.FindRecordsByFilter("finance_budgets", filter, "sort_order", 100, 0)
	if err != nil {
		return []domain.Budget{}, nil
	}

	var budgets []domain.Budget
	for _, r := range records {
		b := domain.Budget{
			ID:        r.Id,
			Name:      r.GetString("name"),
			Icon:      r.GetString("icon"),
			Color:     r.GetString("color"),
			SortOrder: int(r.GetFloat("sort_order")),
			IsActive:  r.GetBool("is_active"),
		}

		// Load items for this budget
		itemFilter := "budget = '" + r.Id + "' && workspace = '" + workspaceID + "'"
		itemRecords, err := App.FindRecordsByFilter("finance_budget_items", itemFilter, "sort_order", 100, 0)
		if err == nil {
			for _, ir := range itemRecords {
				b.Items = append(b.Items, domain.BudgetItem{
					ID:               ir.Id,
					BudgetID:         ir.GetString("budget"),
					Name:             ir.GetString("name"),
					BudgetedAmount:   ir.GetFloat("budgeted_amount"),
					Currency:         ir.GetString("currency"),
					Frequency:        ir.GetString("frequency"),
					MatchPattern:     ir.GetString("match_pattern"),
					MatchPatternType: ir.GetString("match_pattern_type"),
					MatchField:       ir.GetString("match_field"),
					MatchCategoryID:  ir.GetString("match_category"),
					MatchMerchantID:  ir.GetString("match_merchant"),
					MatchAccountID:   ir.GetString("match_account"),
					IsExpense:        ir.GetBool("is_expense"),
					SortOrder:        int(ir.GetFloat("sort_order")),
					IsActive:         ir.GetBool("is_active"),
					Notes:            ir.GetString("notes"),
				})
			}
		}

		budgets = append(budgets, b)
	}
	return budgets, nil
}

func loadTransactions(workspaceID string, startDate, endDate time.Time) ([]domain.FinancialRecord, error) {
	startStr := startDate.Format("2006-01-02")
	endStr := endDate.Format("2006-01-02")
	filter := "workspace = '" + workspaceID + "' && date >= '" + startStr + "' && date <= '" + endStr + "'"

	records, err := App.FindRecordsByFilter("finance_transactions", filter, "-date", 0, 0)
	if err != nil {
		return []domain.FinancialRecord{}, nil
	}

	var transactions []domain.FinancialRecord
	for _, r := range records {
		transactions = append(transactions, domain.FinancialRecord{
			ID:             r.Id,
			Description:    r.GetString("description"),
			RawDescription: r.GetString("raw_description"),
			Amount:         r.GetFloat("amount"),
			Currency:       r.GetString("currency"),
			IsExpense:      r.GetString("type") == "expense",
			Date:           r.GetDateTime("date").Time(),
			AccountID:      r.GetString("account"),
			CategoryID:     r.GetString("category_rel"),
			MerchantID:     r.GetString("merchant"),
			ExternalID:     r.GetString("external_id"),
		})
	}
	return transactions, nil
}

// matchesItem checks if a transaction matches a budget item's rules.
// Uses same pattern as categorization.go: pattern match + category/merchant/account filters.
func matchesItem(item domain.BudgetItem, tx domain.FinancialRecord) bool {
	// Account filter is an AND constraint - if set, tx must be from that account
	if item.MatchAccountID != "" && tx.AccountID != item.MatchAccountID {
		return false
	}

	// Category match
	if item.MatchCategoryID != "" {
		if tx.CategoryID != item.MatchCategoryID {
			return false
		}
		// If only category match is defined (no pattern, no merchant), category match is sufficient
		if item.MatchPattern == "" && item.MatchMerchantID == "" {
			return true
		}
	}

	// Merchant match
	if item.MatchMerchantID != "" {
		if tx.MerchantID != item.MatchMerchantID {
			return false
		}
		// If only merchant match (no pattern), merchant match is sufficient
		if item.MatchPattern == "" {
			return true
		}
	}

	// Pattern match
	if item.MatchPattern != "" {
		fieldValue := tx.Description
		switch item.MatchField {
		case "raw_description":
			fieldValue = tx.RawDescription
		case "counterparty_account":
			fieldValue = tx.ExternalID // counterparty_account maps to external_id in our model
		}

		if fieldValue == "" {
			return false
		}

		matched := false
		switch item.MatchPatternType {
		case "exact":
			matched = strings.EqualFold(fieldValue, item.MatchPattern)
		case "regex":
			re, err := regexp.Compile(item.MatchPattern)
			if err == nil {
				matched = re.MatchString(fieldValue)
			}
		default: // "contains"
			matched = strings.Contains(
				strings.ToUpper(strings.TrimSpace(fieldValue)),
				strings.ToUpper(item.MatchPattern),
			)
		}

		return matched
	}

	// No match criteria defined - never match
	return false
}

func sortByOrder(items []domain.BudgetItem) []domain.BudgetItem {
	// Items are already sorted by sort_order from DB query
	return items
}

func monthsBetween(start, end time.Time) float64 {
	years := end.Year() - start.Year()
	months := int(end.Month()) - int(start.Month())
	total := years*12 + months
	if total < 1 {
		return 1
	}
	return float64(total)
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	s := ""
	neg := false
	if n < 0 {
		neg = true
		n = -n
	}
	for n > 0 {
		s = string(rune('0'+n%10)) + s
		n /= 10
	}
	if neg {
		s = "-" + s
	}
	return s
}
