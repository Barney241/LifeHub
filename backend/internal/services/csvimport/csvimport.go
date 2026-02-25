package csvimport

import (
	"crypto/sha256"
	"encoding/csv"
	"encoding/hex"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

// App holds the PocketBase instance
var App *pocketbase.PocketBase

// FieldMapping defines how CSV columns map to transaction fields
type FieldMapping struct {
	Date               int    `json:"date"`
	Description        int    `json:"description"`
	Amount             int    `json:"amount"`
	Currency           int    `json:"currency,omitempty"`
	BalanceAfter       int    `json:"balance_after,omitempty"`
	CounterpartyName   int    `json:"counterparty_name,omitempty"`
	CounterpartyAccount int   `json:"counterparty_account,omitempty"`
	OperationType      int    `json:"operation_type,omitempty"`
	Message            int    `json:"message,omitempty"`
	Category           int    `json:"category,omitempty"`
	ExternalID         int    `json:"external_id,omitempty"`
}

// BankTemplate defines a bank's CSV export format
type BankTemplate struct {
	Code               string            `json:"code"`
	Name               string            `json:"name"`
	Delimiter          rune              `json:"delimiter"`
	Encoding           string            `json:"encoding"`
	SkipRows           int               `json:"skip_rows"`
	DateFormat         string            `json:"date_format"`
	FieldMapping       FieldMapping      `json:"field_mapping"`
	CategoryMapping    map[string]string `json:"category_mapping"`
	MerchantExtraction MerchantExtraction `json:"merchant_extraction"`
	AmountNegativeIsExpense bool         `json:"amount_negative_is_expense"`
	DecimalSeparator   string            `json:"decimal_separator"`
	// StateColumn and StateRequired filter rows: only rows where StateColumn == StateRequired are imported
	StateColumn        int               `json:"state_column,omitempty"`
	StateRequired      string            `json:"state_required,omitempty"`
}

// MerchantExtraction defines how to extract merchant from transaction
type MerchantExtraction struct {
	CardTransactionField   int    `json:"card_transaction_field"`
	CardTransactionPattern string `json:"card_transaction_pattern"`
	TransferField          int    `json:"transfer_field"`
}

// ParsedTransaction represents a single parsed row from CSV
type ParsedTransaction struct {
	Date               time.Time `json:"date"`
	Description        string    `json:"description"`
	RawDescription     string    `json:"raw_description"`
	Amount             float64   `json:"amount"`
	Currency           string    `json:"currency"`
	IsExpense          bool      `json:"is_expense"`
	BalanceAfter       float64   `json:"balance_after"`
	ExternalID         string    `json:"external_id"`
	BankCategory       string    `json:"bank_category"`
	MerchantName       string    `json:"merchant_name"`
	CounterpartyAccount string   `json:"counterparty_account"`
	RowNumber          int       `json:"row_number"`
}

// ImportResult contains the result of a CSV import operation
type ImportResult struct {
	TransactionsTotal    int           `json:"transactions_total"`
	TransactionsImported int           `json:"transactions_imported"`
	TransactionsSkipped  int           `json:"transactions_skipped"`
	DuplicatesFound      int           `json:"duplicates_found"`
	Errors               []ImportError `json:"errors"`
}

// ImportError represents an error during import
type ImportError struct {
	Row     int    `json:"row"`
	Message string `json:"message"`
}

// PreviewResult contains parsed transactions for preview
type PreviewResult struct {
	Transactions []ParsedTransaction `json:"transactions"`
	TotalRows    int                 `json:"total_rows"`
	Errors       []ImportError       `json:"errors"`
	DetectedTemplate string          `json:"detected_template,omitempty"`
}

// CSOBTemplate returns the CSOB bank template
func CSOBTemplate() BankTemplate {
	return BankTemplate{
		Code:      "csob",
		Name:      "CSOB",
		Delimiter: ';',
		Encoding:  "utf-8",
		SkipRows:  2,
		DateFormat: "02.01.2006", // DD.MM.YYYY in Go format
		FieldMapping: FieldMapping{
			Date:               1,
			Amount:             2,
			Currency:           3,
			BalanceAfter:       4,
			CounterpartyAccount: 5,
			CounterpartyName:   7,
			OperationType:      12,
			Message:            15,
			Category:           16,
			ExternalID:         23,
		},
		CategoryMapping: map[string]string{
			// Income
			"Příjem":                "Income",
			"Příchozí platba":       "Income",
			// Food
			"Restaurace":            "Food & Dining",
			"Potraviny":             "Groceries",
			"Jídlo a pití":          "Food & Dining",
			// Shopping
			"Nákupy a služby":       "Shopping",
			"Nákupy":                "Shopping",
			// Transportation
			"Doprava":               "Transportation",
			"Auto":                  "Transportation",
			// Housing
			"Bydlení":               "Housing",
			// Entertainment
			"Zábava":                "Entertainment",
			"Volný čas":             "Entertainment",
			// Healthcare
			"Zdraví":                "Healthcare",
			// Education
			"Vzdělání":              "Education",
			// Utilities
			"Energie":               "Utilities",
			// Subscriptions & Bills
			"Splátky":               "Subscriptions",
			"Předplatné":            "Subscriptions",
			// Banking
			"Bankovní transakce":    "Uncategorized",
			"Odchozí nezatříděná":   "Uncategorized",
			"Příchozí nezatříděná":  "Uncategorized",
			// Savings/Investments
			"Spoření a investice":   "Personal",
			"Spoření":               "Personal",
			"Investice":             "Personal",
		},
		MerchantExtraction: MerchantExtraction{
			CardTransactionField:   15, // message field
			CardTransactionPattern: `Místo:\s*([^,]+)`,
			TransferField:          7,  // counterparty_name
		},
		AmountNegativeIsExpense: true,
		DecimalSeparator:        ",",
	}
}

// GenericTemplate returns a generic CSV template
func GenericTemplate() BankTemplate {
	return BankTemplate{
		Code:      "generic",
		Name:      "Generic CSV",
		Delimiter: ',',
		Encoding:  "utf-8",
		SkipRows:  1,
		DateFormat: "2006-01-02", // YYYY-MM-DD
		FieldMapping: FieldMapping{
			Date:        0,
			Description: 1,
			Amount:      2,
		},
		AmountNegativeIsExpense: true,
		DecimalSeparator:        ".",
	}
}

// RevolutTemplate returns the Revolut bank template
func RevolutTemplate() BankTemplate {
	return BankTemplate{
		Code:      "revolut",
		Name:      "Revolut",
		Delimiter: ',',
		Encoding:  "utf-8",
		SkipRows:  1,
		DateFormat: "2006-01-02 15:04:05",
		FieldMapping: FieldMapping{
			Date:        3, // Completed Date
			Description: 4, // Description
			Amount:      5,
			Currency:    7,
			BalanceAfter: 9,
			OperationType: 0, // Type column (Transfer, Exchange, etc.)
		},
		CategoryMapping: map[string]string{
			"Transfer":     "Transfer",
			"Card Payment": "Shopping",
			"Deposit":      "Income",
			"Exchange":     "Exchange",
			"Topup":        "Income",
		},
		MerchantExtraction: MerchantExtraction{
			TransferField: 4, // Description field
		},
		AmountNegativeIsExpense: true,
		DecimalSeparator:        ".",
		StateColumn:             8, // State column
		StateRequired:           "COMPLETED",
	}
}

// GetTemplates returns all available templates
func GetTemplates() map[string]BankTemplate {
	return map[string]BankTemplate{
		"csob":    CSOBTemplate(),
		"revolut": RevolutTemplate(),
		"generic": GenericTemplate(),
	}
}

// ParseCSV parses CSV data using the specified template
func ParseCSV(data []byte, template BankTemplate) (*PreviewResult, error) {
	// Replace delimiter if needed and create reader
	content := string(data)
	reader := csv.NewReader(strings.NewReader(content))
	reader.Comma = template.Delimiter
	reader.LazyQuotes = true
	reader.FieldsPerRecord = -1 // Allow variable fields

	records, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("failed to parse CSV: %w", err)
	}

	result := &PreviewResult{
		Transactions: []ParsedTransaction{},
		TotalRows:    len(records) - template.SkipRows,
		Errors:       []ImportError{},
	}

	// Skip header rows
	dataRows := records[template.SkipRows:]

	for i, row := range dataRows {
		rowNum := i + template.SkipRows + 1 // 1-indexed row number

		tx, err := parseRow(row, template, rowNum)
		if err != nil {
			result.Errors = append(result.Errors, ImportError{
				Row:     rowNum,
				Message: err.Error(),
			})
			continue
		}

		result.Transactions = append(result.Transactions, *tx)
	}

	return result, nil
}

// parseRow parses a single CSV row into a transaction
func parseRow(row []string, template BankTemplate, rowNum int) (*ParsedTransaction, error) {
	fm := template.FieldMapping

	// Check if row has enough columns
	maxCol := maxColumn(fm)
	if template.StateColumn > maxCol {
		maxCol = template.StateColumn
	}
	if len(row) <= maxCol {
		return nil, fmt.Errorf("row has only %d columns, expected at least %d", len(row), maxCol+1)
	}

	// Filter by state if configured
	if template.StateRequired != "" && template.StateColumn > 0 {
		state := strings.TrimSpace(row[template.StateColumn])
		if state != template.StateRequired {
			return nil, fmt.Errorf("skipped: state is %q, required %q", state, template.StateRequired)
		}
	}

	// Parse date
	dateStr := strings.TrimSpace(row[fm.Date])
	date, err := parseDate(dateStr, template.DateFormat)
	if err != nil {
		return nil, fmt.Errorf("invalid date '%s': %w", dateStr, err)
	}

	// Parse amount
	amountStr := strings.TrimSpace(row[fm.Amount])
	amount, err := parseAmount(amountStr, template.DecimalSeparator)
	if err != nil {
		return nil, fmt.Errorf("invalid amount '%s': %w", amountStr, err)
	}

	// Determine if expense
	isExpense := false
	if template.AmountNegativeIsExpense {
		isExpense = amount < 0
		amount = abs(amount)
	}

	// Get currency
	currency := "CZK"
	if fm.Currency > 0 && fm.Currency < len(row) {
		currency = strings.TrimSpace(row[fm.Currency])
	}

	// Get balance after
	var balanceAfter float64
	if fm.BalanceAfter > 0 && fm.BalanceAfter < len(row) {
		balanceAfter, _ = parseAmount(row[fm.BalanceAfter], template.DecimalSeparator)
	}

	// Get external ID
	var externalID string
	if fm.ExternalID > 0 && fm.ExternalID < len(row) {
		externalID = strings.TrimSpace(row[fm.ExternalID])
	}

	// Get bank category
	var bankCategory string
	if fm.Category > 0 && fm.Category < len(row) {
		bankCategory = strings.TrimSpace(row[fm.Category])
	}

	// Get counterparty account
	var counterpartyAccount string
	if fm.CounterpartyAccount > 0 && fm.CounterpartyAccount < len(row) {
		counterpartyAccount = strings.TrimSpace(row[fm.CounterpartyAccount])
	}

	// Build description and extract merchant
	description, rawDescription, merchantName := buildDescription(row, template)

	tx := &ParsedTransaction{
		Date:               date,
		Description:        description,
		RawDescription:     rawDescription,
		Amount:             amount,
		Currency:           currency,
		IsExpense:          isExpense,
		BalanceAfter:       balanceAfter,
		ExternalID:         externalID,
		BankCategory:       bankCategory,
		MerchantName:       merchantName,
		CounterpartyAccount: counterpartyAccount,
		RowNumber:          rowNum,
	}

	// Generate external ID if not present
	if tx.ExternalID == "" {
		tx.ExternalID = GenerateTransactionHash(tx.Date, tx.RawDescription, tx.Amount, tx.IsExpense)
	}

	return tx, nil
}

// buildDescription constructs description and extracts merchant
func buildDescription(row []string, template BankTemplate) (description, rawDescription, merchantName string) {
	fm := template.FieldMapping
	me := template.MerchantExtraction

	// Build raw description from various fields
	var parts []string

	// Counterparty name
	if fm.CounterpartyName > 0 && fm.CounterpartyName < len(row) {
		if name := strings.TrimSpace(row[fm.CounterpartyName]); name != "" {
			parts = append(parts, name)
			merchantName = name // Default merchant from counterparty
		}
	}

	// Operation type
	if fm.OperationType > 0 && fm.OperationType < len(row) {
		if opType := strings.TrimSpace(row[fm.OperationType]); opType != "" {
			parts = append(parts, opType)
		}
	}

	// Message field - may contain merchant for card transactions
	if fm.Message > 0 && fm.Message < len(row) {
		if msg := strings.TrimSpace(row[fm.Message]); msg != "" {
			parts = append(parts, msg)

			// Try to extract merchant from card transaction
			if me.CardTransactionPattern != "" && me.CardTransactionField == fm.Message {
				re, err := regexp.Compile(me.CardTransactionPattern)
				if err == nil {
					matches := re.FindStringSubmatch(msg)
					if len(matches) > 1 {
						merchantName = strings.TrimSpace(matches[1])
					}
				}
			}
		}
	}

	// Description field (for generic templates)
	if fm.Description > 0 && fm.Description < len(row) {
		if desc := strings.TrimSpace(row[fm.Description]); desc != "" {
			if len(parts) == 0 {
				parts = append(parts, desc)
			}
		}
	}

	rawDescription = strings.Join(parts, " | ")

	// Clean up description for display
	if merchantName != "" {
		description = merchantName
	} else if len(parts) > 0 {
		description = parts[0]
	} else {
		description = "Unknown transaction"
	}

	return description, rawDescription, merchantName
}

// GenerateTransactionHash creates a unique hash for deduplication
func GenerateTransactionHash(date time.Time, description string, amount float64, isExpense bool) string {
	sign := "+"
	if isExpense {
		sign = "-"
	}
	data := fmt.Sprintf("%s|%s|%s%.2f", date.Format("2006-01-02"), description, sign, amount)
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:16])
}

// CheckDuplicate checks if a transaction already exists and returns the existing record
func CheckDuplicate(accountID, externalID string) (bool, *core.Record, error) {
	if App == nil {
		return false, nil, fmt.Errorf("PocketBase app not initialized")
	}

	filter := fmt.Sprintf("account = '%s' && external_id = '%s'", accountID, externalID)
	records, err := App.FindRecordsByFilter("finance_transactions", filter, "", 1, 0)
	if err != nil {
		// Collection might not exist or other error - assume not duplicate
		return false, nil, nil
	}

	if len(records) > 0 {
		return true, records[0], nil
	}
	return false, nil, nil
}

// ImportTransactions imports parsed transactions into the database
func ImportTransactions(
	transactions []ParsedTransaction,
	accountID string,
	workspaceID string,
	sourceID string,
	categoryResolver func(bankCategory string) string,
) (*ImportResult, error) {
	if App == nil {
		return nil, fmt.Errorf("PocketBase app not initialized")
	}

	result := &ImportResult{
		TransactionsTotal: len(transactions),
		Errors:            []ImportError{},
	}

	collection, err := App.FindCollectionByNameOrId("finance_transactions")
	if err != nil {
		return nil, fmt.Errorf("finance_transactions collection not found: %w", err)
	}

	for _, tx := range transactions {
		// Check for duplicate
		isDup, existingRecord, _ := CheckDuplicate(accountID, tx.ExternalID)
		if isDup {
			result.DuplicatesFound++

			// Update existing record with missing fields (like counterparty_account)
			updated := false
			if existingRecord != nil {
				if tx.CounterpartyAccount != "" && existingRecord.GetString("counterparty_account") == "" {
					existingRecord.Set("counterparty_account", tx.CounterpartyAccount)
					updated = true
				}
				if updated {
					App.Save(existingRecord)
				}
			}

			result.TransactionsSkipped++
			continue
		}

		// Create record
		record := core.NewRecord(collection)
		record.Set("description", tx.Description)
		record.Set("raw_description", tx.RawDescription)
		record.Set("amount", tx.Amount)
		record.Set("type", map[bool]string{true: "expense", false: "income"}[tx.IsExpense])
		record.Set("date", tx.Date)
		record.Set("account", accountID)
		record.Set("workspace", workspaceID)
		if sourceID != "" {
			record.Set("source", sourceID)
		}
		record.Set("external_id", tx.ExternalID)
		record.Set("balance_after", tx.BalanceAfter)
		if tx.CounterpartyAccount != "" {
			record.Set("counterparty_account", tx.CounterpartyAccount)
		}

		// Map bank category if resolver provided
		if categoryResolver != nil && tx.BankCategory != "" {
			if catID := categoryResolver(tx.BankCategory); catID != "" {
				record.Set("category_rel", catID)
			}
		}

		// Store bank category as text fallback
		if tx.BankCategory != "" {
			record.Set("category", tx.BankCategory)
		}

		if err := App.Save(record); err != nil {
			result.Errors = append(result.Errors, ImportError{
				Row:     tx.RowNumber,
				Message: err.Error(),
			})
			result.TransactionsSkipped++
			continue
		}

		result.TransactionsImported++
	}

	return result, nil
}

// Helper functions

func parseDate(dateStr, format string) (time.Time, error) {
	// Try primary format
	t, err := time.Parse(format, dateStr)
	if err == nil {
		return t, nil
	}

	// Try common alternative formats
	formats := []string{
		"02.01.2006",
		"2006-01-02",
		"01/02/2006",
		"02/01/2006",
		"2006/01/02",
	}

	for _, f := range formats {
		t, err = time.Parse(f, dateStr)
		if err == nil {
			return t, nil
		}
	}

	return time.Time{}, fmt.Errorf("could not parse date")
}

func parseAmount(amountStr, decimalSep string) (float64, error) {
	// Remove whitespace and thousand separators
	amountStr = strings.TrimSpace(amountStr)
	amountStr = strings.ReplaceAll(amountStr, " ", "")

	// Handle comma as decimal separator
	if decimalSep == "," {
		// Remove dots (thousand separator) and replace comma with dot
		amountStr = strings.ReplaceAll(amountStr, ".", "")
		amountStr = strings.ReplaceAll(amountStr, ",", ".")
	} else {
		// Remove commas (thousand separator)
		amountStr = strings.ReplaceAll(amountStr, ",", "")
	}

	return strconv.ParseFloat(amountStr, 64)
}

func abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}

func maxColumn(fm FieldMapping) int {
	max := fm.Date
	cols := []int{fm.Description, fm.Amount, fm.Currency, fm.BalanceAfter,
		fm.CounterpartyName, fm.OperationType, fm.Message, fm.Category, fm.ExternalID}
	for _, c := range cols {
		if c > max {
			max = c
		}
	}
	return max
}

// DetectTemplate attempts to detect the bank template from CSV content
func DetectTemplate(data []byte) string {
	content := string(data)

	// Check for CSOB markers
	if strings.Contains(content, "Pohyby na účtu") ||
	   strings.Contains(content, "číslo účtu;datum zaúčtování") ||
	   strings.Contains(content, "/0300") {
		return "csob"
	}

	// Check for Revolut markers
	if strings.Contains(content, "Type,Product,Started Date,Completed Date") {
		return "revolut"
	}

	// Default to generic
	return "generic"
}
