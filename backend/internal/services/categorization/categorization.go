package categorization

import (
	"fmt"
	"regexp"
	"sort"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

// App holds the PocketBase instance
var App *pocketbase.PocketBase

// Rule represents a categorization rule
type Rule struct {
	ID          string
	Name        string
	Pattern     string
	PatternType string // contains, regex, exact
	MatchField  string // description (default), counterparty_account, raw_description
	CategoryID  string
	MerchantID  string
	Priority    int
	compiled    *regexp.Regexp
}

// MerchantPattern represents a merchant with matching patterns
type MerchantPattern struct {
	MerchantID   string
	MerchantName string
	Patterns     []string
	CategoryID   string
	compiled     []*regexp.Regexp
}

// Engine handles auto-categorization
type Engine struct {
	rules     []Rule
	merchants []MerchantPattern
}

// CategorizationResult contains the result of categorization
type CategorizationResult struct {
	CategoryID   string
	CategoryName string
	MerchantID   string
	MerchantName string
	Confidence   float64 // 0-1 confidence score
	MatchedBy    string  // "merchant", "rule", "bank_category", "none"
}

// Suggestion represents a bulk categorization suggestion
type Suggestion struct {
	Pattern         string   `json:"pattern"`
	TransactionIDs  []string `json:"transaction_ids"`
	Count           int      `json:"count"`
	SampleDesc      string   `json:"sample_description"`
	SuggestedCatID  string   `json:"suggested_category_id,omitempty"`
	SuggestedCatName string  `json:"suggested_category_name,omitempty"`
	SuggestedMerchID string  `json:"suggested_merchant_id,omitempty"`
	SuggestedMerchName string `json:"suggested_merchant_name,omitempty"`
}

// NewEngine creates a new categorization engine
func NewEngine() *Engine {
	return &Engine{
		rules:     []Rule{},
		merchants: []MerchantPattern{},
	}
}

// LoadRules loads all active rules from the database
func (e *Engine) LoadRules(workspaceID string) error {
	if App == nil {
		return fmt.Errorf("PocketBase app not initialized")
	}

	// Load import rules
	filter := fmt.Sprintf("workspace = '%s' && active = true", workspaceID)
	records, err := App.FindRecordsByFilter("finance_import_rules", filter, "-priority", 1000, 0)
	if err != nil {
		// Collection might not exist yet
		return nil
	}

	e.rules = []Rule{}
	for _, r := range records {
		matchField := r.GetString("match_field")
		if matchField == "" {
			matchField = "description" // Default to description
		}

		rule := Rule{
			ID:          r.Id,
			Name:        r.GetString("name"),
			Pattern:     r.GetString("pattern"),
			PatternType: r.GetString("pattern_type"),
			MatchField:  matchField,
			CategoryID:  r.GetString("category"),
			MerchantID:  r.GetString("merchant"),
			Priority:    int(r.GetInt("priority")),
		}

		// Compile regex if needed
		if rule.PatternType == "regex" {
			rule.compiled, _ = regexp.Compile(rule.Pattern)
		}

		e.rules = append(e.rules, rule)
	}

	// Sort by priority (highest first)
	sort.Slice(e.rules, func(i, j int) bool {
		return e.rules[i].Priority > e.rules[j].Priority
	})

	return nil
}

// LoadMerchants loads all merchants with their patterns
func (e *Engine) LoadMerchants(workspaceID string) error {
	if App == nil {
		return fmt.Errorf("PocketBase app not initialized")
	}

	filter := fmt.Sprintf("workspace = '%s'", workspaceID)
	records, err := App.FindRecordsByFilter("finance_merchants", filter, "", 1000, 0)
	if err != nil {
		return nil
	}

	e.merchants = []MerchantPattern{}
	for _, r := range records {
		mp := MerchantPattern{
			MerchantID:   r.Id,
			MerchantName: r.GetString("display_name"),
			CategoryID:   r.GetString("category"),
		}

		if mp.MerchantName == "" {
			mp.MerchantName = r.GetString("name")
		}

		// Parse patterns from JSON
		patterns := r.Get("patterns")
		if patternList, ok := patterns.([]interface{}); ok {
			for _, p := range patternList {
				if ps, ok := p.(string); ok {
					mp.Patterns = append(mp.Patterns, ps)
					// Compile pattern as regex with wildcard support
					regexPattern := strings.ReplaceAll(ps, "*", ".*")
					if re, err := regexp.Compile("(?i)" + regexPattern); err == nil {
						mp.compiled = append(mp.compiled, re)
					}
				}
			}
		}

		e.merchants = append(e.merchants, mp)
	}

	return nil
}

// TransactionFields contains all matchable fields from a transaction
type TransactionFields struct {
	Description        string
	RawDescription     string
	CounterpartyAccount string
	BankCategory       string
}

// Categorize attempts to categorize a transaction based on its fields
func (e *Engine) Categorize(description string, bankCategory string) *CategorizationResult {
	return e.CategorizeWithFields(TransactionFields{
		Description:  description,
		BankCategory: bankCategory,
	})
}

// CategorizeWithFields categorizes using all available transaction fields
func (e *Engine) CategorizeWithFields(fields TransactionFields) *CategorizationResult {
	result := &CategorizationResult{
		Confidence: 0,
		MatchedBy:  "none",
	}

	upperDesc := strings.ToUpper(strings.TrimSpace(fields.Description))

	// 1. Try merchant pattern matching first (highest confidence)
	for _, mp := range e.merchants {
		for _, re := range mp.compiled {
			if re.MatchString(upperDesc) {
				result.MerchantID = mp.MerchantID
				result.MerchantName = mp.MerchantName
				result.CategoryID = mp.CategoryID
				result.Confidence = 0.9
				result.MatchedBy = "merchant"

				// Look up category name
				if result.CategoryID != "" {
					result.CategoryName = e.getCategoryName(result.CategoryID)
				}

				return result
			}
		}
	}

	// 2. Try import rules (medium-high confidence)
	for _, rule := range e.rules {
		// Get the field to match against based on rule's MatchField
		var fieldValue string
		switch rule.MatchField {
		case "counterparty_account":
			fieldValue = fields.CounterpartyAccount
		case "raw_description":
			fieldValue = fields.RawDescription
		default: // "description" or empty
			fieldValue = fields.Description
		}

		if fieldValue == "" {
			continue
		}

		upperField := strings.ToUpper(strings.TrimSpace(fieldValue))
		matched := false

		switch rule.PatternType {
		case "exact":
			matched = strings.EqualFold(fieldValue, rule.Pattern)
		case "regex":
			if rule.compiled != nil {
				matched = rule.compiled.MatchString(fieldValue)
			}
		default: // "contains"
			matched = strings.Contains(upperField, strings.ToUpper(rule.Pattern))
		}

		if matched {
			result.CategoryID = rule.CategoryID
			result.MerchantID = rule.MerchantID
			result.Confidence = 0.8
			result.MatchedBy = "rule"

			if result.CategoryID != "" {
				result.CategoryName = e.getCategoryName(result.CategoryID)
			}
			if result.MerchantID != "" {
				result.MerchantName = e.getMerchantName(result.MerchantID)
			}

			return result
		}
	}

	// 3. Use bank-provided category (lower confidence since it's external)
	if fields.BankCategory != "" {
		result.CategoryName = fields.BankCategory
		result.Confidence = 0.6
		result.MatchedBy = "bank_category"
		// CategoryID would need to be resolved by mapping
	}

	return result
}

// getCategoryName looks up category name by ID
func (e *Engine) getCategoryName(categoryID string) string {
	if App == nil {
		return ""
	}

	record, err := App.FindRecordById("finance_categories", categoryID)
	if err != nil {
		return ""
	}

	return record.GetString("name")
}

// getMerchantName looks up merchant name by ID
func (e *Engine) getMerchantName(merchantID string) string {
	if App == nil {
		return ""
	}

	record, err := App.FindRecordById("finance_merchants", merchantID)
	if err != nil {
		return ""
	}

	displayName := record.GetString("display_name")
	if displayName != "" {
		return displayName
	}
	return record.GetString("name")
}

// GetSuggestions analyzes uncategorized transactions and suggests bulk categorizations
func GetSuggestions(workspaceID string, accountID string) ([]Suggestion, error) {
	if App == nil {
		return nil, fmt.Errorf("PocketBase app not initialized")
	}

	// Find uncategorized transactions
	filter := fmt.Sprintf("workspace = '%s' && category_rel = ''", workspaceID)
	if accountID != "" {
		filter = fmt.Sprintf("workspace = '%s' && account = '%s' && category_rel = ''", workspaceID, accountID)
	}

	records, err := App.FindRecordsByFilter("finance_transactions", filter, "-date", 500, 0)
	if err != nil {
		return nil, err
	}

	// Group by similar patterns
	patterns := make(map[string][]string) // pattern -> transaction IDs
	samples := make(map[string]string)    // pattern -> sample description

	for _, r := range records {
		desc := r.GetString("description")
		rawDesc := r.GetString("raw_description")

		// Extract pattern from description
		pattern := extractPattern(desc)
		if pattern == "" {
			pattern = extractPattern(rawDesc)
		}

		if pattern != "" {
			patterns[pattern] = append(patterns[pattern], r.Id)
			if _, exists := samples[pattern]; !exists {
				samples[pattern] = desc
			}
		}
	}

	// Build suggestions for patterns with multiple matches
	var suggestions []Suggestion
	for pattern, txIDs := range patterns {
		if len(txIDs) >= 2 { // Only suggest for 2+ matches
			suggestions = append(suggestions, Suggestion{
				Pattern:        pattern,
				TransactionIDs: txIDs,
				Count:          len(txIDs),
				SampleDesc:     samples[pattern],
			})
		}
	}

	// Sort by count (highest first)
	sort.Slice(suggestions, func(i, j int) bool {
		return suggestions[i].Count > suggestions[j].Count
	})

	// Limit to top 20 suggestions
	if len(suggestions) > 20 {
		suggestions = suggestions[:20]
	}

	return suggestions, nil
}

// extractPattern extracts a normalized pattern from description
func extractPattern(description string) string {
	desc := strings.TrimSpace(description)
	if desc == "" {
		return ""
	}

	// Remove common noise
	desc = strings.ToUpper(desc)

	// Remove dates, numbers, and transaction IDs
	re := regexp.MustCompile(`\d{2}[./]\d{2}[./]\d{2,4}`) // dates
	desc = re.ReplaceAllString(desc, "")

	re = regexp.MustCompile(`\d+[.,]\d{2}`) // amounts
	desc = re.ReplaceAllString(desc, "")

	// Keep first meaningful word(s)
	words := strings.Fields(desc)
	if len(words) == 0 {
		return ""
	}

	// Use first 2-3 significant words as pattern
	var pattern []string
	for _, w := range words {
		if len(w) >= 3 && !isStopWord(w) {
			pattern = append(pattern, w)
			if len(pattern) >= 3 {
				break
			}
		}
	}

	return strings.Join(pattern, " ")
}

// isStopWord checks if word is a common stop word
func isStopWord(word string) bool {
	stopWords := map[string]bool{
		"THE": true, "AND": true, "FOR": true, "FROM": true,
		"CZK": true, "EUR": true, "USD": true,
		"PLATBA": true, "ÚHRADA": true, "TRANSAKCE": true,
	}
	return stopWords[word]
}

// ApplyBulkCategorization applies a category to multiple transactions
func ApplyBulkCategorization(transactionIDs []string, categoryID string, merchantID string) error {
	if App == nil {
		return fmt.Errorf("PocketBase app not initialized")
	}

	for _, txID := range transactionIDs {
		record, err := App.FindRecordById("finance_transactions", txID)
		if err != nil {
			continue
		}

		if categoryID != "" {
			record.Set("category_rel", categoryID)
		}
		if merchantID != "" {
			record.Set("merchant", merchantID)
		}

		if err := App.Save(record); err != nil {
			return err
		}
	}

	return nil
}

// CreateRuleFromCorrection creates a new import rule from user correction
func CreateRuleFromCorrection(workspaceID, pattern, categoryID, merchantID string) error {
	if App == nil {
		return fmt.Errorf("PocketBase app not initialized")
	}

	collection, err := App.FindCollectionByNameOrId("finance_import_rules")
	if err != nil {
		return err
	}

	record := core.NewRecord(collection)
	record.Set("name", "Auto-created from correction")
	record.Set("pattern", pattern)
	record.Set("pattern_type", "contains")
	record.Set("priority", 50) // Medium priority
	record.Set("workspace", workspaceID)
	record.Set("active", true)

	if categoryID != "" {
		record.Set("category", categoryID)
	}
	if merchantID != "" {
		record.Set("merchant", merchantID)
	}

	return App.Save(record)
}

// ApplyRulesToTransactions applies all active rules to transactions
// If overrideExisting is true, it will also update transactions that already have a category
func ApplyRulesToTransactions(workspaceID string, overrideExisting bool) (checked int, updated int, err error) {
	if App == nil {
		return 0, 0, fmt.Errorf("PocketBase app not initialized")
	}

	// Load rules and merchants
	engine := NewEngine()
	if err := engine.LoadRules(workspaceID); err != nil {
		return 0, 0, err
	}
	if err := engine.LoadMerchants(workspaceID); err != nil {
		return 0, 0, err
	}

	// Build filter based on override setting
	var filter string
	if overrideExisting {
		// Get all transactions in workspace
		filter = fmt.Sprintf("workspace = '%s'", workspaceID)
	} else {
		// Only get transactions without a category
		filter = fmt.Sprintf("workspace = '%s' && category_rel = ''", workspaceID)
	}

	records, err := App.FindRecordsByFilter("finance_transactions", filter, "-date", 0, 0)
	if err != nil {
		return 0, 0, err
	}

	checked = len(records)

	for _, r := range records {
		fields := TransactionFields{
			Description:         r.GetString("description"),
			RawDescription:      r.GetString("raw_description"),
			CounterpartyAccount: r.GetString("counterparty_account"),
			BankCategory:        r.GetString("category"),
		}

		// Try categorizing with all fields
		result := engine.CategorizeWithFields(fields)

		// Only update if we found a match via merchant or rule
		if result.MatchedBy == "merchant" || result.MatchedBy == "rule" {
			changed := false

			if result.CategoryID != "" && r.GetString("category_rel") != result.CategoryID {
				r.Set("category_rel", result.CategoryID)
				changed = true
			}
			if result.MerchantID != "" && r.GetString("merchant") != result.MerchantID {
				r.Set("merchant", result.MerchantID)
				changed = true
			}

			if changed {
				if err := App.Save(r); err == nil {
					updated++
				}
			}
		}
	}

	return checked, updated, nil
}

// MapBankCategory maps a bank-provided category to an internal category ID
func MapBankCategory(workspaceID, bankCategory string, categoryMapping map[string]string) string {
	if App == nil || bankCategory == "" {
		return ""
	}

	// Check mapping
	mappedName, ok := categoryMapping[bankCategory]
	if !ok {
		mappedName = bankCategory // Use as-is if no mapping
	}

	// Look up category by name
	filter := fmt.Sprintf("workspace = '%s' && name = '%s'", workspaceID, mappedName)
	records, err := App.FindRecordsByFilter("finance_categories", filter, "", 1, 0)
	if err != nil || len(records) == 0 {
		return ""
	}

	return records[0].Id
}
