import { useState, useEffect, useCallback } from 'react';
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
  const [transactions, setTransactions] = useState<FinancialRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    if (!workspaceId) return;
    try {
      let filter = `workspace = '${workspaceId}'`;
      if (accountId) filter += ` && account = '${accountId}'`;
      if (categoryId) filter += ` && category_rel = '${categoryId}'`;

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
    ]).finally(() => setLoading(false));
  }, [workspaceId, accountId, categoryId, period, dateOffset, customDateRange, fetchAccounts, fetchCategories, fetchMerchants, fetchTemplates, fetchRules, fetchStats, fetchTransactions]);

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

  // Refresh all data
  const refreshAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchAccounts(),
      fetchCategories(),
      fetchMerchants(),
      fetchStats(),
      fetchTransactions(),
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

    // Utility
    refreshAll,
  };
}
