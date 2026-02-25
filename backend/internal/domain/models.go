package domain

import "time"

// ItemType defines the categories of data LifeHub handles
type ItemType string

const (
	TypeTask          ItemType = "task"
	TypeFinance       ItemType = "finance"
	TypeCommunication ItemType = "communication"
	TypeCalendar      ItemType = "calendar"
)

// Task represents a type-safe TODO item
type Task struct {
	ID       string     `json:"id"`
	Content  string     `json:"content"`
	Priority string     `json:"priority"`
	Due      *time.Time `json:"due,omitempty"`
}

// FinancialRecord represents a type-safe transaction
type FinancialRecord struct {
	ID             string    `json:"id"`
	Description    string    `json:"description"`
	RawDescription string    `json:"raw_description,omitempty"`
	Amount         float64   `json:"amount"`
	Currency       string    `json:"currency"`
	IsExpense      bool      `json:"is_expense"`
	Date           time.Time `json:"date"`
	AccountID      string    `json:"account_id,omitempty"`
	AccountName    string    `json:"account_name,omitempty"`
	CategoryID     string    `json:"category_id,omitempty"`
	CategoryName   string    `json:"category_name,omitempty"`
	MerchantID     string    `json:"merchant_id,omitempty"`
	MerchantName   string    `json:"merchant_name,omitempty"`
	Tags           []string  `json:"tags,omitempty"`
	BalanceAfter   float64   `json:"balance_after,omitempty"`
	ExternalID     string    `json:"external_id,omitempty"`
}

// Account represents a bank account or cash account
type Account struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	BankName       string  `json:"bank_name,omitempty"`
	AccountNumber  string  `json:"account_number,omitempty"`
	Currency       string  `json:"currency"`
	AccountType    string  `json:"account_type"` // checking, savings, credit, cash
	Icon           string  `json:"icon,omitempty"`
	Color          string  `json:"color,omitempty"`
	InitialBalance float64 `json:"initial_balance"`
	CurrentBalance float64 `json:"current_balance"`
	IsActive       bool    `json:"is_active"`
}

// Category represents a spending/income category
type Category struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Icon     string `json:"icon,omitempty"`
	Color    string `json:"color,omitempty"`
	ParentID string `json:"parent_id,omitempty"`
	IsSystem bool   `json:"is_system"`
}

// Merchant represents a payee/vendor
type Merchant struct {
	ID             string   `json:"id"`
	Name           string   `json:"name"`
	DisplayName    string   `json:"display_name,omitempty"`
	Patterns       []string `json:"patterns"`
	CategoryID     string   `json:"category_id,omitempty"`
	CategoryName   string   `json:"category_name,omitempty"`
	IsSubscription bool     `json:"is_subscription"`
}

// RecurringPayment represents a subscription or recurring bill
type RecurringPayment struct {
	ID             string     `json:"id"`
	MerchantID     string     `json:"merchant_id"`
	MerchantName   string     `json:"merchant_name"`
	AccountID      string     `json:"account_id,omitempty"`
	AccountName    string     `json:"account_name,omitempty"`
	ExpectedAmount float64    `json:"expected_amount"`
	Frequency      string     `json:"frequency"` // weekly, monthly, yearly, custom
	FrequencyDays  int        `json:"frequency_days,omitempty"`
	NextDue        *time.Time `json:"next_due,omitempty"`
	LastPaid       *time.Time `json:"last_paid,omitempty"`
	Status         string     `json:"status"` // active, paused, cancelled
	Notes          string     `json:"notes,omitempty"`
}

// ImportRule defines auto-categorization logic
type ImportRule struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Pattern     string `json:"pattern"`
	PatternType string `json:"pattern_type"` // contains, regex, exact
	CategoryID  string `json:"category_id,omitempty"`
	MerchantID  string `json:"merchant_id,omitempty"`
	Priority    int    `json:"priority"`
	Active      bool   `json:"active"`
}

// BankTemplate defines a bank's CSV export format
type BankTemplate struct {
	ID                 string            `json:"id"`
	Name               string            `json:"name"`
	Code               string            `json:"code"` // csob, fio, generic
	Delimiter          string            `json:"delimiter"`
	Encoding           string            `json:"encoding"`
	SkipRows           int               `json:"skip_rows"`
	DateFormat         string            `json:"date_format"`
	FieldMapping       map[string]int    `json:"field_mapping"`
	CategoryMapping    map[string]string `json:"category_mapping,omitempty"`
	MerchantExtraction map[string]string `json:"merchant_extraction,omitempty"`
	IsSystem           bool              `json:"is_system"`
}

// ImportResult contains the result of a CSV import operation
type ImportResult struct {
	ImportID            string        `json:"import_id"`
	TransactionsTotal   int           `json:"transactions_total"`
	TransactionsImported int          `json:"transactions_imported"`
	TransactionsSkipped int           `json:"transactions_skipped"`
	DuplicatesFound     int           `json:"duplicates_found"`
	Errors              []ImportError `json:"errors,omitempty"`
}

// ImportError represents an error during import
type ImportError struct {
	Row     int    `json:"row"`
	Message string `json:"message"`
}

// CategorizationSuggestion for bulk categorization
type CategorizationSuggestion struct {
	Pattern        string   `json:"pattern"`
	TransactionIDs []string `json:"transaction_ids"`
	Count          int      `json:"count"`
	SuggestedCategory   *Category `json:"suggested_category,omitempty"`
	SuggestedMerchant   *Merchant `json:"suggested_merchant,omitempty"`
}

// FinanceStats holds computed statistics
type FinanceStats struct {
	TotalIncome     float64            `json:"total_income"`
	TotalExpenses   float64            `json:"total_expenses"`
	NetBalance      float64            `json:"net_balance"`
	ByCategory      map[string]float64 `json:"by_category"`
	ByCategoryTrend map[string][]TrendPoint `json:"by_category_trend,omitempty"`
	RecurringTotal  float64            `json:"recurring_total"`
	RecurringCount  int                `json:"recurring_count"`
	TopMerchants    []MerchantSpend    `json:"top_merchants"`
	AccountBalances []AccountBalance   `json:"account_balances,omitempty"`
}

// TrendPoint represents a point in time-series data
type TrendPoint struct {
	Date   string  `json:"date"`
	Amount float64 `json:"amount"`
}

// MerchantSpend tracks spending by merchant
type MerchantSpend struct {
	MerchantID   string  `json:"merchant_id"`
	MerchantName string  `json:"merchant_name"`
	TotalSpend   float64 `json:"total_spend"`
	Count        int     `json:"count"`
}

// AccountBalance for multi-account summary
type AccountBalance struct {
	AccountID   string  `json:"account_id"`
	AccountName string  `json:"account_name"`
	Balance     float64 `json:"balance"`
	Currency    string  `json:"currency"`
}

// IncomeSource represents a source of income (salary, freelance, etc.)
type IncomeSource struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	IncomeType   string  `json:"income_type"` // "fixed" or "hourly"
	Amount       float64 `json:"amount"`
	Currency     string  `json:"currency"`
	DefaultHours float64 `json:"default_hours,omitempty"`
	IsActive     bool    `json:"is_active"`
	Notes        string  `json:"notes,omitempty"`
}

// IncomeHours represents monthly hour overrides for hourly income sources
type IncomeHours struct {
	ID             string  `json:"id"`
	IncomeSourceID string  `json:"income_source_id"`
	Year           int     `json:"year"`
	Month          int     `json:"month"`
	Hours          float64 `json:"hours"`
}

// Budget represents a budget group (e.g., "Flat", "Investing")
type Budget struct {
	ID        string       `json:"id"`
	Name      string       `json:"name"`
	Icon      string       `json:"icon,omitempty"`
	Color     string       `json:"color,omitempty"`
	SortOrder int          `json:"sort_order"`
	IsActive  bool         `json:"is_active"`
	Items     []BudgetItem `json:"items,omitempty"`
}

// BudgetItem represents a line item within a budget
type BudgetItem struct {
	ID               string  `json:"id"`
	BudgetID         string  `json:"budget_id"`
	Name             string  `json:"name"`
	BudgetedAmount   float64 `json:"budgeted_amount"`
	Currency         string  `json:"currency"`
	Frequency        string  `json:"frequency"` // "monthly" or "yearly"
	MatchPattern     string  `json:"match_pattern,omitempty"`
	MatchPatternType string  `json:"match_pattern_type,omitempty"` // contains, regex, exact
	MatchField       string  `json:"match_field,omitempty"`        // description, raw_description, counterparty_account
	MatchCategoryID  string  `json:"match_category_id,omitempty"`
	MatchMerchantID  string  `json:"match_merchant_id,omitempty"`
	MatchAccountID   string  `json:"match_account_id,omitempty"`
	IsExpense        bool    `json:"is_expense"`
	SortOrder        int     `json:"sort_order"`
	IsActive         bool    `json:"is_active"`
	Notes            string  `json:"notes,omitempty"`
}

// BudgetItemStatus represents the computed status of a budget item against actual transactions
type BudgetItemStatus struct {
	BudgetItem          BudgetItem        `json:"budget_item"`
	NormalizedAmount    float64           `json:"normalized_amount"`
	ActualAmount        float64           `json:"actual_amount"`
	Difference          float64           `json:"difference"`
	MatchedTransactions []FinancialRecord `json:"matched_transactions"`
	Status              string            `json:"status"` // on_track, over_budget, under_budget, paid
}

// BudgetGroupStatus represents the computed status of an entire budget group
type BudgetGroupStatus struct {
	Budget        Budget             `json:"budget"`
	Items         []BudgetItemStatus `json:"items"`
	TotalBudgeted float64            `json:"total_budgeted"`
	TotalActual   float64            `json:"total_actual"`
}

// IncomeSourceStatus represents computed income for a period
type IncomeSourceStatus struct {
	IncomeSource     IncomeSource `json:"income_source"`
	CalculatedAmount float64      `json:"calculated_amount"`
	HoursThisMonth   float64      `json:"hours_this_month,omitempty"`
}

// BudgetSummary is the top-level budget status response
type BudgetSummary struct {
	TotalIncome       float64              `json:"total_income"`
	IncomeSources     []IncomeSourceStatus `json:"income_sources"`
	Budgets           []BudgetGroupStatus  `json:"budgets"`
	TotalBudgeted     float64              `json:"total_budgeted"`
	TotalActual       float64              `json:"total_actual"`
	Remaining         float64              `json:"remaining"`
	UnmatchedExpenses []FinancialRecord    `json:"unmatched_expenses"`
}

// CalendarEvent represents a calendar event (Google Calendar, Outlook, etc.)
type CalendarEvent struct {
	ID           string    `json:"id"`
	Title        string    `json:"title"`
	Description  string    `json:"description,omitempty"`
	Location     string    `json:"location,omitempty"`
	Start        time.Time `json:"start"`
	End          time.Time `json:"end"`
	AllDay       bool      `json:"all_day"`
	CalendarName string    `json:"calendar_name,omitempty"`
	MeetLink     string    `json:"meet_link,omitempty"`
	Status       string    `json:"status,omitempty"`
}

// Message represents a communication item (Slack, Email)
type Message struct {
	ID      string `json:"id"`
	Sender  string `json:"sender"`
	Preview string `json:"preview"`
	Channel string `json:"channel,omitempty"`
}

// Result is a type-safe container for any domain item
type Result struct {
	Type       ItemType    `json:"type"`
	SourceID   string      `json:"source_id"`
	SourceName string      `json:"source_name"`
	Items      interface{} `json:"items"` // Will be []Task, []FinancialRecord, etc.
}
