import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Account,
  Category,
  Merchant,
  BankTemplate,
  FinanceStats,
  ImportPreview,
  ImportResult,
  ImportRule,
  CategorizationSuggestion,
  FinancialRecord,
  InvestmentPortfolio,
  InvestmentSnapshot,
  InvestmentImportResult,
  IncomeSource,
  IncomeHours,
  BudgetGroup,
  BudgetItem,
  BudgetSummary,
  Loan,
  Goal,
  NetWorthSnapshot,
  ExchangeRate,
  RecurringPayment,
} from '@/types';
import { pb, API_BASE } from '@/lib/pocketbase';

interface UseFinanceDataOptions {
  workspaceId: string | null;
  accountId?: string | null;
  categoryId?: string | null;
  period?: string | null; // '30', '90', '365', or null for all time
  dateOffset?: number; // Number of periods to offset (negative = past, e.g., -1 = previous period)
  customDateRange?: { start: string; end: string } | null; // Custom date range overrides period
}

// Helper to calculate date range based on period and offset
function getDateRange(period: string | null | undefined, dateOffset: number = 0): { startDate: string; endDate: string } | null {
  if (!period) return null;

  const now = new Date();
  let startDate: Date, endDate: Date;

  if (period === 'this-month') {
    startDate = new Date(now.getFullYear(), now.getMonth() - dateOffset, 1);
    endDate = new Date(now.getFullYear(), now.getMonth() - dateOffset + 1, 0);
  } else if (period === 'last-month') {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1 - dateOffset, 1);
    endDate = new Date(now.getFullYear(), now.getMonth() - dateOffset, 0);
  } else if (period === 'this-year') {
    startDate = new Date(now.getFullYear() - dateOffset, 0, 1);
    endDate = new Date(now.getFullYear() - dateOffset, 11, 31);
  } else {
    // Legacy day-based support
    const days = parseInt(period, 10);
    if (isNaN(days)) return null;
    endDate = new Date(now);
    endDate.setDate(endDate.getDate() - (dateOffset * days));
    startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

export function useFinanceData({ workspaceId, accountId, categoryId, period, dateOffset = 0, customDateRange }: UseFinanceDataOptions) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [templates, setTemplates] = useState<BankTemplate[]>([]);
  const [rules, setRules] = useState<ImportRule[]>([]);
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [overviewStats, setOverviewStats] = useState<FinanceStats | null>(null);
  const [overviewTransactions, setOverviewTransactions] = useState<FinancialRecord[]>([]);
  const [transactions, setTransactions] = useState<FinancialRecord[]>([]);
  const [portfolios, setPortfolios] = useState<InvestmentPortfolio[]>([]);
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [budgets, setBudgets] = useState<BudgetGroup[]>([]);
  const [budgetStatus, setBudgetStatus] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [netWorthHistory, setNetWorthHistory] = useState<NetWorthSnapshot[]>([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([]);

  // Ref to access categories in fetchTransactions without adding it as a dependency
  const categoriesRef = useRef<Category[]>([]);
  categoriesRef.current = categories;

  const getAuthHeaders = useCallback(() => ({
    'Authorization': pb.authStore.token,
    'Content-Type': 'application/json',
  }), []);

  // Fetch accounts
  const fetchAccounts = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await fetch(`${API_BASE}/api/finance/accounts?workspace=${workspaceId}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch accounts');
      const data = await res.json();
      setAccounts(Array.isArray(data) ? data : data.accounts || []);
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    }
  }, [workspaceId, getAuthHeaders]);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await fetch(`${API_BASE}/api/finance/categories?workspace=${workspaceId}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch categories');
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : data.categories || []);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  }, [workspaceId, getAuthHeaders]);

  // Fetch merchants
  const fetchMerchants = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await fetch(`${API_BASE}/api/finance/merchants?workspace=${workspaceId}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch merchants');
      const data = await res.json();
      setMerchants(Array.isArray(data) ? data : data.merchants || []);
    } catch (err) {
      console.error('Failed to fetch merchants:', err);
    }
  }, [workspaceId, getAuthHeaders]);

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/finance/templates`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch templates');
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : data.templates || []);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
  }, [getAuthHeaders]);

  // Fetch rules
  const fetchRules = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const records = await pb.collection('finance_import_rules').getList(1, 100, {
        filter: `workspace = '${workspaceId}'`,
        sort: '-priority',
      });
      setRules(records.items.map((r: any) => ({
        id: r.id,
        name: r.name,
        pattern: r.pattern,
        pattern_type: r.pattern_type || 'contains',
        match_field: r.match_field || 'description',
        category_id: r.category,
        merchant_id: r.merchant,
        priority: r.priority || 0,
        active: r.active !== false,
      })));
    } catch (err) {
      console.error('Failed to fetch rules:', err);
    }
  }, [workspaceId]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    if (!workspaceId) return;
    let url = `${API_BASE}/api/finance/stats?workspace=${workspaceId}`;
    if (accountId) url += `&account=${accountId}`;
    if (categoryId) url += `&category=${categoryId}`;

    // Use custom date range if provided, otherwise calculate from period
    if (customDateRange) {
      url += `&start_date=${customDateRange.start}&end_date=${customDateRange.end}`;
    } else {
      const dateRange = getDateRange(period, dateOffset);
      if (dateRange) {
        url += `&start_date=${dateRange.startDate}&end_date=${dateRange.endDate}`;
      }
    }

    try {
      const res = await fetch(url, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, [workspaceId, accountId, categoryId, period, dateOffset, customDateRange, getAuthHeaders]);

  // Fetch unfiltered overview stats (no account/category filter, respects date range)
  const fetchOverviewStats = useCallback(async () => {
    if (!workspaceId) return;
    let url = `${API_BASE}/api/finance/stats?workspace=${workspaceId}`;

    if (customDateRange) {
      url += `&start_date=${customDateRange.start}&end_date=${customDateRange.end}`;
    } else {
      const dateRange = getDateRange(period, dateOffset);
      if (dateRange) {
        url += `&start_date=${dateRange.startDate}&end_date=${dateRange.endDate}`;
      }
    }

    try {
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch overview stats');
      const data = await res.json();
      setOverviewStats(data);
    } catch (err) {
      console.error('Failed to fetch overview stats:', err);
    }
  }, [workspaceId, period, dateOffset, customDateRange, getAuthHeaders]);

  // Fetch unfiltered overview transactions (no account/category filter, respects date range)
  const fetchOverviewTransactions = useCallback(async () => {
    if (!workspaceId) return;
    try {
      let filter = `workspace = '${workspaceId}'`;

      if (customDateRange) {
        filter += ` && date >= '${customDateRange.start}' && date <= '${customDateRange.end}'`;
      } else {
        const dateRange = getDateRange(period, dateOffset);
        if (dateRange) {
          filter += ` && date >= '${dateRange.startDate}' && date <= '${dateRange.endDate}'`;
        }
      }

      const records = await pb.collection('finance_transactions').getList(1, 500, {
        filter,
        sort: '-date',
        expand: 'category_rel,merchant,account',
        requestKey: 'overview-txns',
      });

      setOverviewTransactions(records.items.map((r: any) => ({
        id: r.id,
        description: r.description,
        raw_description: r.raw_description,
        amount: r.amount,
        is_expense: r.type === 'expense',
        date: r.date,
        account_id: r.account,
        account_name: r.expand?.account?.name,
        category_id: r.category_rel,
        category_name: r.expand?.category_rel?.name,
        merchant_id: r.merchant,
        merchant_name: r.expand?.merchant?.display_name || r.expand?.merchant?.name,
        balance_after: r.balance_after,
        external_id: r.external_id,
        counterparty_account: r.counterparty_account,
      })));
    } catch (err) {
      console.error('Failed to fetch overview transactions:', err);
    }
  }, [workspaceId, period, dateOffset, customDateRange]);

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    if (!workspaceId) return;
    try {
      let filter = `workspace = '${workspaceId}'`;
      if (accountId) filter += ` && account = '${accountId}'`;
      if (categoryId === '__uncategorized') {
        const uncatCat = categoriesRef.current.find(c => c.name === 'Uncategorized');
        if (uncatCat) {
          filter += ` && (category_rel = '' || category_rel = '${uncatCat.id}')`;
        } else {
          filter += ` && category_rel = ''`;
        }
      } else if (categoryId) {
        filter += ` && category_rel = '${categoryId}'`;
      }

      // Use custom date range if provided, otherwise calculate from period
      if (customDateRange) {
        filter += ` && date >= '${customDateRange.start}' && date <= '${customDateRange.end}'`;
      } else {
        const dateRange = getDateRange(period, dateOffset);
        if (dateRange) {
          filter += ` && date >= '${dateRange.startDate}' && date <= '${dateRange.endDate}'`;
        }
      }

      const records = await pb.collection('finance_transactions').getList(1, 500, {
        filter,
        sort: '-date',
        expand: 'category_rel,merchant,account',
        requestKey: null,
      });

      setTransactions(records.items.map((r: any) => ({
        id: r.id,
        description: r.description,
        raw_description: r.raw_description,
        amount: r.amount,
        is_expense: r.type === 'expense',
        date: r.date,
        account_id: r.account,
        account_name: r.expand?.account?.name,
        category_id: r.category_rel,
        category_name: r.expand?.category_rel?.name,
        merchant_id: r.merchant,
        merchant_name: r.expand?.merchant?.display_name || r.expand?.merchant?.name,
        balance_after: r.balance_after,
        external_id: r.external_id,
        counterparty_account: r.counterparty_account,
      })));
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    }
  }, [workspaceId, accountId, categoryId, period, dateOffset, customDateRange]);

  // Fetch investment portfolios
  const fetchPortfolios = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await fetch(`${API_BASE}/api/investments/portfolios?workspace=${workspaceId}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch portfolios');
      const data = await res.json();
      setPortfolios(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch portfolios:', err);
    }
  }, [workspaceId, getAuthHeaders]);

  // Fetch investment snapshots for a portfolio
  const fetchSnapshots = useCallback(async (portfolioId: string): Promise<InvestmentSnapshot[]> => {
    try {
      const res = await fetch(`${API_BASE}/api/investments/snapshots?portfolio=${portfolioId}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch snapshots');
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('Failed to fetch snapshots:', err);
      return [];
    }
  }, [getAuthHeaders]);

  // Fetch income sources
  const fetchIncomeSources = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await fetch(`${API_BASE}/api/finance/income-sources?workspace=${workspaceId}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch income sources');
      const data = await res.json();
      setIncomeSources(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch income sources:', err);
    }
  }, [workspaceId, getAuthHeaders]);

  // Fetch budgets
  const fetchBudgets = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await fetch(`${API_BASE}/api/finance/budgets?workspace=${workspaceId}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch budgets');
      const data = await res.json();
      setBudgets(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch budgets:', err);
    }
  }, [workspaceId, getAuthHeaders]);

  // Fetch budget status
  const fetchBudgetStatus = useCallback(async () => {
    if (!workspaceId) return;

    let startDate: string, endDate: string;
    if (customDateRange) {
      startDate = customDateRange.start;
      endDate = customDateRange.end;
    } else {
      const dateRange = getDateRange(period || 'this-month', dateOffset);
      if (!dateRange) return;
      startDate = dateRange.startDate;
      endDate = dateRange.endDate;
    }

    try {
      const res = await fetch(
        `${API_BASE}/api/finance/budget/status?workspace=${workspaceId}&start_date=${startDate}&end_date=${endDate}`,
        { headers: getAuthHeaders() }
      );
      if (!res.ok) throw new Error('Failed to fetch budget status');
      const data = await res.json();
      setBudgetStatus(data);
    } catch (err) {
      console.error('Failed to fetch budget status:', err);
    }
  }, [workspaceId, period, dateOffset, customDateRange, getAuthHeaders]);

  // Import investment PDF
  const importInvestmentPDF = useCallback(async (
    file: File,
    provider: string,
    password?: string
  ): Promise<InvestmentImportResult> => {
    if (!workspaceId) throw new Error('No workspace selected');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('workspace', workspaceId);
    formData.append('provider', provider);
    if (password) formData.append('password', password);

    const res = await fetch(`${API_BASE}/api/investments/import`, {
      method: 'POST',
      headers: { 'Authorization': pb.authStore.token },
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) {
      throw data;
    }

    await fetchPortfolios();
    return data;
  }, [workspaceId, fetchPortfolios]);

  // Initial data load
  useEffect(() => {
    if (!workspaceId || !pb.authStore.isValid) return;
    setLoading(true);
    Promise.all([
      fetchAccounts(),
      fetchCategories(),
      fetchMerchants(),
      fetchTemplates(),
      fetchRules(),
      fetchStats(),
      fetchTransactions(),
      fetchPortfolios(),
      fetchIncomeSources(),
      fetchBudgets(),
      fetchBudgetStatus(),
      fetchOverviewStats(),
      fetchOverviewTransactions(),
      fetchLoans(),
      fetchGoals(),
      fetchNetWorthHistory(),
      fetchExchangeRates(),
      fetchRecurringPayments(),
    ]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, accountId, categoryId, period, dateOffset, customDateRange]);

  const fetchGoals = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const records = await pb.collection('finance_goals').getFullList<any>({
        filter: `workspace = "${workspaceId}"`,
        sort: 'target_date',
      });
      setGoals(records.map(r => ({
        id: r.id,
        name: r.name,
        target_amount: r.target_amount,
        current_amount: r.current_amount,
        currency: r.currency,
        target_date: r.target_date,
        color: r.color,
        icon: r.icon,
        linked_account: r.linked_account,
        is_active: r.is_active,
      })));
    } catch (err) {
      console.error('Failed to fetch goals:', err);
    }
  }, [workspaceId]);

  const fetchNetWorthHistory = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const records = await pb.collection('finance_net_worth_history').getFullList<any>({
        filter: `workspace = "${workspaceId}"`,
        sort: 'date',
      });
      setNetWorthHistory(records.map(r => ({
        id: r.id,
        date: r.date,
        total_assets: r.total_assets,
        total_liabilities: r.total_liabilities,
        net_worth: r.net_worth,
        currency: r.currency,
      })));
    } catch (err) {
      console.error('Failed to fetch net worth history:', err);
    }
  }, [workspaceId]);

  const fetchExchangeRates = useCallback(async () => {
    try {
      const records = await pb.collection('finance_exchange_rates').getFullList<any>({
        sort: '-date',
      });
      setExchangeRates(records.map(r => ({
        base_currency: r.base_currency,
        target_currency: r.target_currency,
        rate: r.rate,
        date: r.date,
      })));
    } catch (err) {
      console.error('Failed to fetch exchange rates:', err);
    }
  }, []);

  const fetchRecurringPayments = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await fetch(`${API_BASE}/api/finance/recurring?workspace=${workspaceId}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch recurring payments');
      const data = await res.json();
      setRecurringPayments(data);
    } catch (err) {
      console.error('Failed to fetch recurring payments:', err);
    }
  }, [workspaceId, getAuthHeaders]);

  const detectRecurring = useCallback(async (accountId?: string) => {
    if (!workspaceId) return [];
    try {
      setLoading(true);
      const url = new URL(`${API_BASE}/api/finance/recurring/detect`);
      url.searchParams.append('workspace', workspaceId);
      if (accountId) url.searchParams.append('account', accountId);

      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to detect recurring payments');
      return await res.json();
    } catch (err) {
      console.error('Failed to detect recurring payments:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [workspaceId, getAuthHeaders]);

  const createGoal = useCallback(async (data: Omit<Goal, 'id'>) => {
    if (!workspaceId || !pb.authStore.model) return;
    try {
      const record = await pb.collection('finance_goals').create({
        ...data,
        workspace: workspaceId,
        owner: pb.authStore.model.id,
      });
      await fetchGoals();
      return record;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [workspaceId, fetchGoals]);

  const updateGoal = useCallback(async (id: string, updates: Partial<Goal>) => {
    try {
      const record = await pb.collection('finance_goals').update(id, updates);
      await fetchGoals();
      return record;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [fetchGoals]);

  const deleteGoal = useCallback(async (id: string) => {
    try {
      await pb.collection('finance_goals').delete(id);
      await fetchGoals();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [fetchGoals]);

  const createRecurring = useCallback(async (data: any) => {
    if (!workspaceId) return;
    try {
      const record = await pb.collection('finance_recurring').create({
        ...data,
        workspace: workspaceId,
      });
      await fetchRecurringPayments();
      return record;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [workspaceId, fetchRecurringPayments]);

  const updateRecurring = useCallback(async (id: string, updates: any) => {
    try {
      const record = await pb.collection('finance_recurring').update(id, updates);
      await fetchRecurringPayments();
      return record;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [fetchRecurringPayments]);

  const deleteRecurring = useCallback(async (id: string) => {
    try {
      await pb.collection('finance_recurring').delete(id);
      await fetchRecurringPayments();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [fetchRecurringPayments]);

  // Create account
  const createAccount = async (account: Omit<Account, 'id' | 'current_balance'>) => {
    if (!workspaceId) throw new Error('No workspace selected');
    const res = await fetch(`${API_BASE}/api/finance/accounts`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ ...account, workspace: workspaceId }),
    });
    if (!res.ok) throw new Error('Failed to create account');
    await fetchAccounts();
  };

  // Create category
  const createCategory = async (category: { name: string; icon?: string; color?: string; parent_id?: string }) => {
    if (!workspaceId) throw new Error('No workspace selected');
    const res = await fetch(`${API_BASE}/api/finance/categories`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ ...category, workspace: workspaceId }),
    });
    if (!res.ok) throw new Error('Failed to create category');
    await fetchCategories();
  };

  // Update category
  const updateCategory = async (id: string, updates: { name?: string; color?: string }) => {
    await pb.collection('finance_categories').update(id, updates);
    await fetchCategories();
  };

  // Delete category
  const deleteCategory = async (id: string) => {
    await pb.collection('finance_categories').delete(id);
    await fetchCategories();
  };

  // Create rule
  const createRule = async (rule: { name: string; pattern: string; pattern_type: string; match_field?: string; category_id?: string; priority?: number }) => {
    if (!workspaceId) throw new Error('No workspace selected');
    const { category_id, ...rest } = rule;
    await pb.collection('finance_import_rules').create({
      ...rest,
      category: category_id || '',
      match_field: rule.match_field || 'description',
      workspace: workspaceId,
      active: true,
    });
    await fetchRules();
  };

  // Update rule
  const updateRule = async (id: string, updates: { name?: string; pattern?: string; pattern_type?: string; match_field?: string; category_id?: string; priority?: number; active?: boolean }) => {
    const { category_id, ...rest } = updates;
    const dbUpdates: Record<string, any> = { ...rest };
    if (category_id !== undefined) {
      dbUpdates.category = category_id;
    }
    await pb.collection('finance_import_rules').update(id, dbUpdates);
    await fetchRules();
  };

  // Delete rule
  const deleteRule = async (id: string) => {
    await pb.collection('finance_import_rules').delete(id);
    await fetchRules();
  };

  // Preview CSV import
  const previewCSV = async (file: File, templateCode: string): Promise<ImportPreview> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('template', templateCode);

    const res = await fetch(`${API_BASE}/api/finance/import/preview`, {
      method: 'POST',
      headers: { 'Authorization': pb.authStore.token },
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to preview CSV');
    return res.json();
  };

  // Import CSV
  const importCSV = async (
    file: File,
    targetAccountId: string,
    templateCode: string
  ): Promise<ImportResult> => {
    if (!workspaceId) throw new Error('No workspace selected');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('template', templateCode);
    formData.append('account', targetAccountId);
    formData.append('workspace', workspaceId);

    const res = await fetch(`${API_BASE}/api/finance/import`, {
      method: 'POST',
      headers: { 'Authorization': pb.authStore.token },
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to import CSV');
    const result = await res.json();

    // Refresh data after import
    await Promise.all([fetchTransactions(), fetchStats()]);

    return result;
  };

  // Get categorization suggestions
  const getCategorizationSuggestions = async (): Promise<CategorizationSuggestion[]> => {
    if (!workspaceId) return [];
    let url = `${API_BASE}/api/finance/categorize/suggestions?workspace=${workspaceId}`;
    if (accountId) url += `&account=${accountId}`;

    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to get suggestions');
    const data = await res.json();
    return data.suggestions || [];
  };

  // Apply bulk categorization
  const applyBulkCategorization = async (
    transactionIds: string[],
    categoryId?: string,
    merchantId?: string,
    createRule?: boolean,
    pattern?: string
  ) => {
    if (!workspaceId) throw new Error('No workspace selected');

    const res = await fetch(`${API_BASE}/api/finance/categorize/bulk`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        workspace: workspaceId,
        transaction_ids: transactionIds,
        category_id: categoryId,
        merchant_id: merchantId,
        create_rule: createRule,
        pattern,
      }),
    });
    if (!res.ok) throw new Error('Failed to apply categorization');

    // Refresh data
    await Promise.all([fetchTransactions(), fetchStats()]);
  };

  // Re-categorize all transactions based on bank category
  const recategorizeAll = async (): Promise<{ checked: number; updated: number }> => {
    if (!workspaceId) throw new Error('No workspace selected');

    const res = await fetch(
      `${API_BASE}/api/finance/categorize/recategorize-all?workspace=${workspaceId}`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
      }
    );
    if (!res.ok) throw new Error('Failed to recategorize');
    const result = await res.json();

    // Refresh data
    await Promise.all([fetchTransactions(), fetchStats()]);

    return result;
  };

  // Apply rules to transactions
  const applyRules = async (overrideExisting: boolean = false): Promise<{ checked: number; updated: number }> => {
    if (!workspaceId) throw new Error('No workspace selected');

    let url = `${API_BASE}/api/finance/categorize/apply-rules?workspace=${workspaceId}`;
    if (overrideExisting) {
      url += '&override=true';
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to apply rules');
    const result = await res.json();

    // Refresh data
    await Promise.all([fetchTransactions(), fetchStats()]);

    return result;
  };

  // Categorize single transaction
  const categorizeTransaction = async (
    transactionId: string,
    categoryId?: string,
    merchantId?: string
  ) => {
    await pb.collection('finance_transactions').update(transactionId, {
      category_rel: categoryId,
      merchant: merchantId,
    });
    await fetchTransactions();
  };

  // Create income source
  const createIncomeSource = async (source: Omit<IncomeSource, 'id'>) => {
    if (!workspaceId) throw new Error('No workspace selected');
    const res = await fetch(`${API_BASE}/api/finance/income-sources`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ ...source, workspace: workspaceId }),
    });
    if (!res.ok) throw new Error('Failed to create income source');
    await Promise.all([fetchIncomeSources(), fetchBudgetStatus()]);
  };

  // Update income source
  const updateIncomeSource = async (id: string, updates: Partial<IncomeSource>) => {
    const res = await fetch(`${API_BASE}/api/finance/income-sources/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update income source');
    await Promise.all([fetchIncomeSources(), fetchBudgetStatus()]);
  };

  // Delete income source
  const deleteIncomeSource = async (id: string) => {
    const res = await fetch(`${API_BASE}/api/finance/income-sources/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete income source');
    await Promise.all([fetchIncomeSources(), fetchBudgetStatus()]);
  };

  // Upsert income hours
  const upsertIncomeHours = async (incomeSourceId: string, year: number, month: number, hours: number) => {
    if (!workspaceId) throw new Error('No workspace selected');
    const res = await fetch(`${API_BASE}/api/finance/income-hours`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        income_source: incomeSourceId,
        year,
        month,
        hours,
        workspace: workspaceId,
      }),
    });
    if (!res.ok) throw new Error('Failed to upsert income hours');
    await fetchBudgetStatus();
  };

  // Create budget
  const createBudget = async (budget: Omit<BudgetGroup, 'id' | 'items'>) => {
    if (!workspaceId) throw new Error('No workspace selected');
    const res = await fetch(`${API_BASE}/api/finance/budgets`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ ...budget, workspace: workspaceId }),
    });
    if (!res.ok) throw new Error('Failed to create budget');
    await Promise.all([fetchBudgets(), fetchBudgetStatus()]);
  };

  // Update budget
  const updateBudget = async (id: string, updates: Partial<BudgetGroup>) => {
    const res = await fetch(`${API_BASE}/api/finance/budgets/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update budget');
    await Promise.all([fetchBudgets(), fetchBudgetStatus()]);
  };

  // Delete budget
  const deleteBudget = async (id: string) => {
    const res = await fetch(`${API_BASE}/api/finance/budgets/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete budget');
    await Promise.all([fetchBudgets(), fetchBudgetStatus()]);
  };

  // Create budget item
  const createBudgetItem = async (item: Omit<BudgetItem, 'id'>) => {
    if (!workspaceId) throw new Error('No workspace selected');
    // Map frontend field names to backend field names
    const payload: Record<string, any> = {
      budget: item.budget_id,
      name: item.name,
      budgeted_amount: item.budgeted_amount,
      currency: item.currency,
      frequency: item.frequency,
      match_pattern: item.match_pattern || '',
      match_pattern_type: item.match_pattern_type || '',
      match_field: item.match_field || '',
      match_category: item.match_category_id || '',
      match_merchant: item.match_merchant_id || '',
      match_account: item.match_account_id || '',
      is_expense: item.is_expense,
      sort_order: item.sort_order,
      is_active: item.is_active,
      notes: item.notes || '',
      workspace: workspaceId,
    };
    const res = await fetch(`${API_BASE}/api/finance/budget-items`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to create budget item');
    await Promise.all([fetchBudgets(), fetchBudgetStatus()]);
  };

  // Update budget item
  const updateBudgetItem = async (id: string, updates: Partial<BudgetItem>) => {
    const payload: Record<string, any> = { ...updates };
    // Map relation field names
    if (updates.match_category_id !== undefined) {
      payload.match_category = updates.match_category_id;
      delete payload.match_category_id;
    }
    if (updates.match_merchant_id !== undefined) {
      payload.match_merchant = updates.match_merchant_id;
      delete payload.match_merchant_id;
    }
    if (updates.match_account_id !== undefined) {
      payload.match_account = updates.match_account_id;
      delete payload.match_account_id;
    }
    if (updates.budget_id !== undefined) {
      payload.budget = updates.budget_id;
      delete payload.budget_id;
    }
    const res = await fetch(`${API_BASE}/api/finance/budget-items/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to update budget item');
    await Promise.all([fetchBudgets(), fetchBudgetStatus()]);
  };

  const deleteBudgetItem = async (id: string) => {
    const res = await fetch(`${API_BASE}/api/finance/budget-items/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete budget item');
    await Promise.all([fetchBudgets(), fetchBudgetStatus()]);
  };

  // ── Loans ─────────────────────────────────────────────────────────────────
  const fetchLoans = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const records = await pb.collection('finance_loans').getFullList<Loan>({
        filter: `workspace = '${workspaceId}' && is_active = true`,
        sort: 'loan_type,name',
        requestKey: null,
      });
      setLoans(records);
    } catch (err) {
      console.error('Failed to fetch loans:', err);
    }
  }, [workspaceId]);

  const createLoan = async (data: Omit<Loan, 'id'>) => {
    if (!workspaceId) throw new Error('No workspace');
    const record = await pb.collection('finance_loans').create<Loan>({
      ...data,
      workspace: workspaceId,
    });
    await fetchLoans();
    return record;
  };

  const updateLoan = async (id: string, data: Partial<Loan>) => {
    const record = await pb.collection('finance_loans').update<Loan>(id, data);
    await fetchLoans();
    return record;
  };

  const deleteLoan = async (id: string) => {
    await pb.collection('finance_loans').delete(id);
    await fetchLoans();
  };

  // Refresh all data
  const refreshAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchAccounts(),
      fetchCategories(),
      fetchMerchants(),
      fetchStats(),
      fetchTransactions(),
      fetchBudgetStatus(),
      fetchLoans(),
      fetchGoals(),
      fetchNetWorthHistory(),
      fetchExchangeRates(),
      fetchRecurringPayments(),
    ]);
    setLoading(false);
  };

  return {
    // Data
    accounts,
    categories,
    merchants,
    templates,
    rules,
    stats,
    overviewStats,
    overviewTransactions,
    transactions,
    loading,
    error,

    // Account actions
    createAccount,
    fetchAccounts,

    // Category actions
    createCategory,
    updateCategory,
    deleteCategory,
    fetchCategories,

    // Rule actions
    createRule,
    updateRule,
    deleteRule,
    fetchRules,

    // Import actions
    previewCSV,
    importCSV,

    // Categorization actions
    getCategorizationSuggestions,
    applyBulkCategorization,
    categorizeTransaction,
    recategorizeAll,
    applyRules,

    // Stats
    fetchStats,

    // Transactions
    fetchTransactions,

    // Investment actions
    portfolios,
    fetchPortfolios,
    fetchSnapshots,
    importInvestmentPDF,

    // Budget actions
    incomeSources,
    budgets,
    budgetStatus,
    fetchIncomeSources,
    fetchBudgets,
    fetchBudgetStatus,
    createIncomeSource,
    updateIncomeSource,
    deleteIncomeSource,
    upsertIncomeHours,
    createBudget,
    updateBudget,
    deleteBudget,
    createBudgetItem,
    updateBudgetItem,
    deleteBudgetItem,

    // Loan actions
    loans,
    fetchLoans,
    createLoan,
    updateLoan,
    deleteLoan,

    // Goal actions
    goals,
    fetchGoals,
    createGoal,
    updateGoal,
    deleteGoal,

    // Net Worth history
    netWorthHistory,
    fetchNetWorthHistory,

    // Exchange Rates
    exchangeRates,
    fetchExchangeRates,

    // Recurring actions
    recurringPayments,
    fetchRecurringPayments,
    createRecurring,
    updateRecurring,
    deleteRecurring,
    detectRecurring,

    // Utility
    refreshAll,
  };
}
