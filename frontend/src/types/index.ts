export interface Task {
  id: string;
  content: string;
  priority: 'low' | 'medium' | 'high';
  due?: string;
}

export interface FinancialRecord {
  id: string;
  description: string;
  raw_description?: string;
  amount: number;
  currency?: string;
  is_expense: boolean;
  date: string;
  account_id?: string;
  account_name?: string;
  category_id?: string;
  category_name?: string;
  merchant_id?: string;
  merchant_name?: string;
  tags?: string[];
  balance_after?: number;
  external_id?: string;
  counterparty_account?: string;
}

export interface Account {
  id: string;
  name: string;
  bank_name?: string;
  account_number?: string;
  currency: string;
  account_type: 'checking' | 'savings' | 'credit' | 'cash';
  icon?: string;
  color?: string;
  initial_balance: number;
  current_balance: number;
  is_active: boolean;
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  parent_id?: string;
  is_system: boolean;
}

export interface Merchant {
  id: string;
  name: string;
  display_name?: string;
  patterns: string[];
  category_id?: string;
  category_name?: string;
  is_subscription: boolean;
}

export interface RecurringPayment {
  id: string;
  merchant_id: string;
  merchant_name: string;
  account_id?: string;
  account_name?: string;
  expected_amount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'yearly' | 'custom';
  frequency_days?: number;
  next_due?: string;
  last_paid?: string;
  status: 'active' | 'paused' | 'cancelled';
  notes?: string;
}

export interface ImportRule {
  id: string;
  name: string;
  pattern: string;
  pattern_type: 'contains' | 'regex' | 'exact';
  match_field?: 'description' | 'counterparty_account' | 'raw_description';
  category_id?: string;
  merchant_id?: string;
  priority: number;
  active: boolean;
}

export interface BankTemplate {
  id: string;
  name: string;
  code: string;
  delimiter: string;
  encoding: string;
  skip_rows: number;
  date_format: string;
  field_mapping: Record<string, number>;
  category_mapping?: Record<string, string>;
  is_system: boolean;
}

export interface ImportMapping {
  date: number;
  description: number;
  amount: number;
  currency?: number;
  balance_after?: number;
  counterparty_name?: number;
  operation_type?: number;
  message?: number;
  category?: number;
  external_id?: number;
}

export interface ImportPreview {
  transactions: ParsedTransaction[];
  total_rows: number;
  errors: ImportError[];
  detected_template?: string;
}

export interface ParsedTransaction {
  date: string;
  description: string;
  raw_description: string;
  amount: number;
  currency: string;
  is_expense: boolean;
  balance_after: number;
  external_id: string;
  bank_category: string;
  merchant_name: string;
  row_number: number;
}

export interface ImportResult {
  transactions_total: number;
  transactions_imported: number;
  transactions_skipped: number;
  duplicates_found: number;
  errors: ImportError[];
}

export interface ImportError {
  row: number;
  message: string;
}

export interface CategorizationSuggestion {
  pattern: string;
  transaction_ids: string[];
  count: number;
  sample_description: string;
  suggested_category_id?: string;
  suggested_category_name?: string;
  suggested_merchant_id?: string;
  suggested_merchant_name?: string;
}

export interface TrendPoint {
  date: string;
  amount: number;
}

export interface MerchantSpend {
  merchant_id: string;
  merchant_name: string;
  total_spend: number;
  count: number;
}

export interface AccountBalance {
  account_id: string;
  account_name: string;
  balance: number;
  currency: string;
}

export interface FinanceStats {
  total_income: number;
  total_expenses: number;
  net_balance: number;
  by_category: Record<string, number>;
  by_category_trend?: Record<string, TrendPoint[]>;
  recurring_total: number;
  recurring_count: number;
  top_merchants: MerchantSpend[];
  account_balances?: AccountBalance[];
}

export interface RecurringDetectionResult {
  merchant_id: string;
  merchant_name: string;
  average_amount: number;
  frequency: string;
  frequency_days: number;
  confidence_score: number;
  last_occurrence: string;
  next_predicted: string;
  occurrences: number;
  amount_variance: number;
}

export interface UpcomingPayment {
  id: string;
  merchant_name: string;
  expected_amount: number;
  frequency: string;
  next_due: string;
  days_until: number;
}

export interface Message {
  id: string;
  sender: string;
  preview: string;
  channel?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  all_day: boolean;
  calendar_name?: string;
  meet_link?: string;
  status?: string;
}

export interface InvestmentPortfolio {
  id: string;
  provider: string;
  name: string;
  contract_id?: string;
  currency: string;
  latest_snapshot?: {
    id: string;
    report_date: string;
    period_start: string;
    period_end: string;
    start_value: number;
    end_value: number;
    invested: number;
    gain_loss: number;
    fees: number;
  };
}

export interface InvestmentHolding {
  id: string;
  name: string;
  isin?: string;
  category?: string;
  units: number;
  price_per_unit: number;
  price_currency: string;
  total_value: number;
  value_currency: string;
}

export interface InvestmentSnapshot {
  id: string;
  report_date: string;
  period_start: string;
  period_end: string;
  start_value: number;
  end_value: number;
  invested: number;
  gain_loss: number;
  fees: number;
  holdings?: InvestmentHolding[];
}

export interface InvestmentImportResult {
  status: string;
  portfolio_id: string;
  snapshot_id: string;
  snapshot: {
    provider: string;
    portfolio_name: string;
    contract_id?: string;
    end_value: number;
    invested: number;
    gain_loss: number;
    fees: number;
    holdings?: InvestmentHolding[];
  };
  // Validation error fields (when status is error)
  error?: string;
  validation_errors?: string[];
}

export interface IncomeSource {
  id: string;
  name: string;
  income_type: 'fixed' | 'hourly';
  amount: number;
  currency: string;
  default_hours?: number;
  is_active: boolean;
  notes?: string;
}

export interface IncomeHours {
  id: string;
  income_source: string;
  year: number;
  month: number;
  hours: number;
}

export interface BudgetGroup {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  sort_order: number;
  is_active: boolean;
  items?: BudgetItem[];
}

export interface BudgetItem {
  id: string;
  budget_id: string;
  name: string;
  budgeted_amount: number;
  currency: string;
  frequency: 'monthly' | 'yearly';
  match_pattern?: string;
  match_pattern_type?: 'contains' | 'regex' | 'exact';
  match_field?: 'description' | 'raw_description' | 'counterparty_account';
  match_category_id?: string;
  match_merchant_id?: string;
  match_account_id?: string;
  is_expense: boolean;
  sort_order: number;
  is_active: boolean;
  notes?: string;
}

export interface BudgetItemStatus {
  budget_item: BudgetItem;
  normalized_amount: number;
  actual_amount: number;
  difference: number;
  matched_transactions: FinancialRecord[];
  status: 'pending' | 'paid' | 'over_budget' | 'under_budget';
}

export interface BudgetGroupStatus {
  budget: BudgetGroup;
  items: BudgetItemStatus[];
  total_budgeted: number;
  total_actual: number;
}

export interface IncomeSourceStatus {
  income_source: IncomeSource;
  calculated_amount: number;
  hours_this_month?: number;
}

export interface BudgetSummary {
  total_income: number;
  income_sources: IncomeSourceStatus[];
  budgets: BudgetGroupStatus[];
  total_budgeted: number;
  total_actual: number;
  remaining: number;
  unmatched_expenses: FinancialRecord[];
}


export interface Loan {
  id: string;
  name: string;
  loan_type: 'mortgage' | 'personal' | 'car' | 'student' | 'borrowed_from' | 'lent_to';
  counterparty?: string;
  principal: number;
  current_balance: number;
  interest_rate: number;
  monthly_payment: number;
  currency: string;
  start_date?: string;
  end_date?: string;
  match_pattern?: string;
  match_pattern_type?: 'contains' | 'exact' | 'starts_with' | 'regex';
  match_field?: 'description' | 'merchant';
  notes?: string;
  is_active: boolean;
}

export interface Goal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  currency: string;
  target_date?: string;
  color: string;
  icon?: string;
  linked_account?: string;
  is_active: boolean;
}

export interface NetWorthSnapshot {
  id: string;
  date: string;
  total_assets: number;
  total_liabilities: number;
  net_worth: number;
  currency: string;
}

export interface ExchangeRate {
  base_currency: string;
  target_currency: string;
  rate: number;
  date: string;
}

export type DomainType = 'task' | 'finance' | 'communication' | 'calendar';


export interface Result {
  type: DomainType;
  source_id: string;
  source_name: string;
  items: (Task | FinancialRecord | Message | CalendarEvent)[];
}

export interface WorkspaceSettings {
  display_currency?: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  settings?: WorkspaceSettings;
}

export interface User {
  id: string;
  email: string;
}
