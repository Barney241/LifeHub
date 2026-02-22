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

export type DomainType = 'task' | 'finance' | 'communication' | 'calendar';

export interface Result {
  type: DomainType;
  source_id: string;
  source_name: string;
  items: (Task | FinancialRecord | Message | CalendarEvent)[];
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  icon?: string;
}

export interface User {
  id: string;
  email: string;
}
