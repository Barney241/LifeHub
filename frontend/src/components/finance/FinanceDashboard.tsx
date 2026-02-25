'use client';

import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, Receipt, Flame, Landmark, PiggyBank } from 'lucide-react';
import { FinanceStats, FinancialRecord, InvestmentPortfolio, Account, BudgetSummary } from '@/types';

interface FinanceDashboardProps {
  stats: FinanceStats | null;
  transactions: FinancialRecord[];
  categories?: { id: string; name: string; color?: string }[];
  onCategorySelect?: (categoryId: string | null) => void;
  currency?: string;
  displayCurrency?: string;
  portfolios?: InvestmentPortfolio[];
  accounts?: Account[];
  onViewInvestments?: () => void;
  budgetStatus?: BudgetSummary | null;
}

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

const RATES_TO_CZK: Record<string, number> = { CZK: 1, EUR: 25.2, USD: 23.5, GBP: 29.5 };
const convertCurrency = (value: number, from: string, to: string): number => {
  if (from === to) return value;
  const inCZK = value * (RATES_TO_CZK[from] || 1);
  return inCZK / (RATES_TO_CZK[to] || 1);
};

export function FinanceDashboard({
  stats,
  transactions,
  categories = [],
  onCategorySelect,
  currency = 'CZK',
  displayCurrency: dc,
  portfolios = [],
  accounts = [],
  onViewInvestments,
  budgetStatus,
}: FinanceDashboardProps) {
  // Map category names to info for quick lookup
  const categoryByName = useMemo(() => {
    const map: Record<string, { id: string; color: string }> = {};
    categories.forEach(c => { map[c.name] = { id: c.id, color: c.color || '#64748b' }; });
    return map;
  }, [categories]);

  const handleCategoryClick = (categoryName: string) => {
    if (onCategorySelect) {
      if (categoryName === 'Uncategorized') {
        onCategorySelect('__uncategorized');
      } else {
        const categoryId = categoryByName[categoryName]?.id;
        onCategorySelect(categoryId || null);
      }
    }
  };
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const fmtDC = dc || currency;
  const formatPortfolioValue = (value: number, portfolioCurrency: string) => {
    const converted = convertCurrency(value, portfolioCurrency || 'CZK', fmtDC);
    const primary = new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: fmtDC, maximumFractionDigits: 0 }).format(converted);
    if ((portfolioCurrency || 'CZK') === fmtDC) return primary;
    const original = new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: portfolioCurrency, maximumFractionDigits: 0 }).format(value);
    return `${primary} (${original})`;
  };

  // Category pie chart data with colors (all non-zero categories)
  const categoryData = useMemo(() => {
    if (!stats?.by_category) return [];
    return Object.entries(stats.by_category)
      .filter(([, value]) => value > 0)
      .map(([name, value], index) => ({
        name,
        value,
        color: categoryByName[name]?.color || COLORS[index % COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [stats, categoryByName]);

  // Monthly trend data with net flow
  const monthlyData = useMemo(() => {
    const months: Record<string, { income: number; expenses: number; sortKey: string }> = {};

    transactions.forEach((tx) => {
      const date = new Date(tx.date);
      const sortKey = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`;
      const month = date.toLocaleString('default', {
        month: 'short',
        year: '2-digit',
      });
      if (!months[sortKey]) {
        months[sortKey] = { income: 0, expenses: 0, sortKey };
      }
      if (tx.is_expense) {
        months[sortKey].expenses += tx.amount;
      } else {
        months[sortKey].income += tx.amount;
      }
    });

    // Sort by date and compute net flow
    const sorted = Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6);

    return sorted.map(([key, data]) => {
      const [year, monthNum] = key.split('-');
      const date = new Date(parseInt(year), parseInt(monthNum));
      const month = date.toLocaleString('default', { month: 'short', year: '2-digit' });
      const net = data.income - data.expenses;
      return {
        month,
        income: data.income,
        expenses: data.expenses,
        net,
      };
    });
  }, [transactions]);

  // Spending trend (adaptive aggregation based on date range)
  const dailySpendingData = useMemo(() => {
    if (transactions.length === 0) return [];

    const expenses = transactions.filter(tx => tx.is_expense);
    if (expenses.length === 0) return [];

    // Get date range to determine aggregation level
    const dates = expenses.map(tx => new Date(tx.date).getTime());
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const daySpan = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));

    // Choose aggregation level: daily (<60 days), weekly (60-180 days), monthly (>180 days)
    let aggregationLevel: 'daily' | 'weekly' | 'monthly';
    if (daySpan <= 60) {
      aggregationLevel = 'daily';
    } else if (daySpan <= 180) {
      aggregationLevel = 'weekly';
    } else {
      aggregationLevel = 'monthly';
    }

    // Group by period
    const byPeriod: Record<string, number> = {};
    expenses.forEach(tx => {
      const date = new Date(tx.date);
      let key: string;
      if (aggregationLevel === 'daily') {
        key = tx.date.split('T')[0];
      } else if (aggregationLevel === 'weekly') {
        // Get start of week (Monday)
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        const weekStart = new Date(date.setDate(diff));
        key = weekStart.toISOString().split('T')[0];
      } else {
        // Monthly
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
      }
      byPeriod[key] = (byPeriod[key] || 0) + tx.amount;
    });

    // Sort and create cumulative data
    const sortedPeriods = Object.keys(byPeriod).sort();
    let cumulative = 0;
    return sortedPeriods.map(period => {
      cumulative += byPeriod[period];
      const date = new Date(period);
      let label: string;
      if (aggregationLevel === 'daily') {
        label = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      } else if (aggregationLevel === 'weekly') {
        label = `W${Math.ceil(date.getDate() / 7)} ${date.toLocaleDateString('en-GB', { month: 'short' })}`;
      } else {
        label = date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
      }
      return {
        date: label,
        daily: byPeriod[period],
        cumulative,
      };
    });
  }, [transactions]);

  // Computed metrics
  const metrics = useMemo(() => {
    const expenseTransactions = transactions.filter(tx => tx.is_expense);
    const expenseCount = expenseTransactions.length;
    const incomeCount = transactions.length - expenseCount;

    const avgExpense = expenseCount > 0 ? (stats?.total_expenses ?? 0) / expenseCount : 0;
    const avgIncome = incomeCount > 0 ? (stats?.total_income ?? 0) / incomeCount : 0;

    const totalIncome = stats?.total_income ?? 0;
    const totalExpenses = stats?.total_expenses ?? 0;
    const savingsRate = totalIncome > 0
      ? ((totalIncome - totalExpenses) / totalIncome) * 100
      : 0;

    const largestExpense = expenseTransactions.length > 0
      ? expenseTransactions.reduce((max, tx) => tx.amount > max.amount ? tx : max, expenseTransactions[0])
      : null;

    // Daily average (based on date range in transactions)
    const dates = transactions.map(tx => new Date(tx.date).getTime());
    const daySpan = dates.length > 0
      ? Math.max(1, Math.ceil((Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24)))
      : 1;
    const dailyAvgExpense = (stats?.total_expenses ?? 0) / daySpan;

    return {
      expenseCount,
      incomeCount,
      totalCount: transactions.length,
      avgExpense,
      avgIncome,
      savingsRate,
      largestExpense,
      dailyAvgExpense,
      daySpan,
    };
  }, [transactions, stats]);

  if (!stats) {
    return (
      <div className="bg-slate-900 rounded-3xl border border-slate-800 p-8 text-center">
        <Wallet size={48} className="text-slate-600 mx-auto mb-4" />
        <div className="text-slate-400">No financial data yet</div>
        <div className="text-sm text-slate-500 mt-1">Import transactions to see your dashboard</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Income
            </span>
            <div className="p-2 rounded-lg bg-emerald-900/30">
              <ArrowUpRight size={16} className="text-emerald-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            {formatCurrency(stats.total_income)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {metrics.incomeCount} transactions · avg {formatCurrency(metrics.avgIncome)}
          </div>
        </div>

        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Expenses
            </span>
            <div className="p-2 rounded-lg bg-rose-900/30">
              <ArrowDownRight size={16} className="text-rose-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-400">
            {formatCurrency(stats.total_expenses)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {metrics.expenseCount} transactions · avg {formatCurrency(metrics.avgExpense)}
          </div>
        </div>

        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Net Balance
            </span>
            <div
              className={`p-2 rounded-lg ${stats.net_balance >= 0 ? 'bg-emerald-900/30' : 'bg-rose-900/30'
                }`}
            >
              {stats.net_balance >= 0 ? (
                <TrendingUp size={16} className="text-emerald-400" />
              ) : (
                <TrendingDown size={16} className="text-rose-400" />
              )}
            </div>
          </div>
          <div
            className={`text-2xl font-bold ${stats.net_balance >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
          >
            {formatCurrency(stats.net_balance)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {metrics.savingsRate >= 0 ? (
              <span className="text-emerald-500">{metrics.savingsRate.toFixed(0)}% savings rate</span>
            ) : (
              <span className="text-rose-500">{Math.abs(metrics.savingsRate).toFixed(0)}% overspend</span>
            )}
          </div>
        </div>

        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Daily Average
            </span>
            <div className="p-2 rounded-lg bg-blue-900/30">
              <Receipt size={16} className="text-blue-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-blue-400">
            {formatCurrency(metrics.dailyAvgExpense)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            over {metrics.daySpan} days
          </div>
        </div>
      </div>

      {/* Total Net Worth - Accounts + Investments */}
      {(accounts.length > 0 || portfolios.length > 0) && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
          {/* Overall total header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Total Net Worth
              </span>
              <div className="text-2xl font-bold text-blue-300 mt-1">
                {new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: fmtDC, maximumFractionDigits: 0 }).format(
                  accounts.filter(a => a.is_active).reduce((sum, a) => sum + convertCurrency(a.current_balance, a.currency || currency, fmtDC), 0) +
                  portfolios.reduce((sum, p) => sum + convertCurrency(p.latest_snapshot?.end_value || 0, p.currency || 'CZK', fmtDC), 0)
                )}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-blue-900/30">
              <PiggyBank size={16} className="text-blue-400" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Accounts column: total + breakdown */}
            {accounts.length > 0 && (
              <div className="bg-slate-800/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Landmark size={14} className="text-slate-400" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Accounts</span>
                </div>
                <div className="text-xl font-bold text-slate-200 mb-3">
                  {formatCurrency(accounts.filter(a => a.is_active).reduce((sum, a) => sum + a.current_balance, 0))}
                </div>
                <div className="border-t border-slate-700/50 pt-2 space-y-1.5">
                  {accounts.filter(a => a.is_active).map((a) => (
                    <div key={a.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        {a.icon && <span className="text-xs">{a.icon}</span>}
                        <span className="text-slate-400 truncate">{a.name}</span>
                      </div>
                      <span className="font-medium text-slate-300 shrink-0 ml-2">
                        {formatCurrency(a.current_balance)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Investments column: total + breakdown */}
            {portfolios.length > 0 && (
              <div
                className={`bg-slate-800/50 rounded-xl p-4 ${onViewInvestments ? 'cursor-pointer hover:bg-slate-800/70 transition-colors' : ''}`}
                onClick={onViewInvestments}
              >
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={14} className="text-violet-400" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Investments</span>
                </div>
                <div className="text-xl font-bold text-slate-200">
                  {new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: fmtDC, maximumFractionDigits: 0 }).format(
                    portfolios.reduce((sum, p) => sum + convertCurrency(p.latest_snapshot?.end_value || 0, p.currency || 'CZK', fmtDC), 0)
                  )}
                </div>
                {(() => {
                  const totalGain = portfolios.reduce((sum, p) => sum + convertCurrency(p.latest_snapshot?.gain_loss || 0, p.currency || 'CZK', fmtDC), 0);
                  return (
                    <div className={`text-xs mb-3 ${totalGain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {totalGain >= 0 ? '+' : ''}{new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: fmtDC, maximumFractionDigits: 0 }).format(totalGain)} gain/loss
                    </div>
                  );
                })()}
                <div className="border-t border-slate-700/50 pt-2 space-y-1.5">
                  {portfolios.map((p) => {
                    const snap = p.latest_snapshot;
                    if (!snap) return null;
                    const pctGain = snap.invested > 0 ? ((snap.gain_loss / snap.invested) * 100).toFixed(1) : null;
                    return (
                      <div key={p.id} className="flex items-center justify-between text-sm">
                        <div className="min-w-0">
                          <span className="text-slate-400 truncate">{p.name}</span>
                          <span className="text-xs text-slate-600 ml-1">{p.provider}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="font-medium text-slate-300">{formatPortfolioValue(snap.end_value, p.currency)}</span>
                          <span className={`text-xs ${snap.gain_loss >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {pctGain && `${snap.gain_loss >= 0 ? '+' : ''}${pctGain}%`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spending by category */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
          <h3 className="font-bold text-slate-200 mb-4">Spending by Category</h3>
          {categoryData.length > 0 ? (
            <div className="flex items-center gap-4">
              <div className="w-40 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={60}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {categoryData.map((cat, index) => (
                        <Cell key={`cell-${index}`} fill={cat.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1 max-h-48 overflow-y-auto">
                {categoryData.map((cat) => {
                  const percentage = stats?.total_expenses > 0 ? (cat.value / stats.total_expenses) * 100 : 0;
                  return (
                    <button
                      key={cat.name}
                      onClick={() => handleCategoryClick(cat.name)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 transition-colors text-left group"
                    >
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="text-sm text-slate-300 truncate flex-1 group-hover:text-slate-100">{cat.name}</span>
                      <span className="text-xs text-slate-500 shrink-0">{percentage.toFixed(0)}%</span>
                      <span className="text-sm font-medium text-slate-400 group-hover:text-slate-300 shrink-0">
                        {formatCurrency(cat.value)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-slate-500 text-sm">
              No category data
            </div>
          )}
        </div>

        {/* Budget vs Actual (Replaces Monthly Cash Flow) */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-200">Budget vs Actual</h3>
            {budgetStatus && (
              <span className="text-xs text-slate-500">
                {budgetStatus.total_actual > budgetStatus.total_budgeted ? 'Over budget' : 'On track'}
              </span>
            )}
          </div>
          {budgetStatus ? (
            <BudgetComparisonMini budgetStatus={budgetStatus} currency={currency} />
          ) : (
            <div className="h-40 flex items-center justify-center text-slate-500 text-sm italic">
              No budget data for this period
            </div>
          )}
        </div>
      </div>

      {/* Spending Trend & Largest Expense */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cumulative Spending Trend */}
        {dailySpendingData.length > 1 && (
          <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 p-5">
            <h3 className="font-bold text-slate-200 mb-4">Spending Trend</h3>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailySpendingData}>
                  <defs>
                    <linearGradient id="spendingGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#e2e8f0' }}
                    formatter={(value, name) => [
                      formatCurrency(value as number),
                      name === 'cumulative' ? 'Total' : 'Daily'
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulative"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fill="url(#spendingGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Largest Expense */}
        {metrics.largestExpense && (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-orange-900/30">
                <Flame size={16} className="text-orange-400" />
              </div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Largest Expense
              </span>
            </div>
            <div className="text-2xl font-bold text-orange-400 mb-2">
              {formatCurrency(metrics.largestExpense.amount)}
            </div>
            <div className="text-sm text-slate-300 truncate">
              {metrics.largestExpense.merchant_name || metrics.largestExpense.description}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {new Date(metrics.largestExpense.date).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </div>
          </div>
        )}
      </div>

      {/* Top merchants */}
      {stats.top_merchants && stats.top_merchants.length > 0 && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
          <h3 className="font-bold text-slate-200 mb-4">Top Merchants</h3>
          <div className="space-y-3">
            {stats.top_merchants.slice(0, 5).map((merchant, i) => (
              <div key={merchant.merchant_id || i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-400">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-200 truncate">
                    {merchant.merchant_name || 'Unknown'}
                  </div>
                  <div className="text-xs text-slate-500">{merchant.count} transactions</div>
                </div>
                <div className="font-bold text-rose-400">{formatCurrency(merchant.total_spend)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Budget Comparison Mini ───────────────────────────────────────────────────
function BudgetComparisonMini({ budgetStatus, currency }: { budgetStatus: BudgetSummary; currency: string }) {
  const barData = budgetStatus.budgets.map((gs, idx) => {
    const name = gs.budget.name.replace(/^\p{Emoji}+\s*/u, '').trim();
    return {
      name,
      budgeted: gs.total_budgeted,
      actual: gs.total_actual,
      over: gs.total_actual > gs.total_budgeted,
      color: COLORS[idx % COLORS.length],
    };
  }).filter(d => d.budgeted > 0 || d.actual > 0);

  const maxVal = Math.max(...barData.map(d => Math.max(d.budgeted, d.actual)), 1);
  const fmt = (val: number) => new Intl.NumberFormat('cs-CZ', { style: 'currency', currency, maximumFractionDigits: 0 }).format(val);

  return (
    <div className="space-y-3">
      {barData.length > 0 ? (
        barData.map((d) => {
          const budgetPct = (d.budgeted / maxVal) * 100;
          const actualPct = Math.min((d.actual / maxVal) * 100, 100);
          const overPct = d.actual > d.budgeted
            ? Math.min(((d.actual - d.budgeted) / maxVal) * 100, 100 - budgetPct)
            : 0;
          return (
            <div key={d.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-400 truncate max-w-[100px]">{d.name}</span>
                <div className="flex items-center gap-1.5 text-[10px] shrink-0">
                  <span className="text-slate-500">{fmt(d.actual)}</span>
                  <span className="text-slate-700">/</span>
                  <span className="text-slate-600 font-semibold">{fmt(d.budgeted)}</span>
                </div>
              </div>
              <div className="relative h-2 rounded-full overflow-hidden bg-slate-800">
                <div
                  className="absolute inset-y-0 left-0 rounded-full opacity-20"
                  style={{ width: `${budgetPct}%`, backgroundColor: d.color }}
                />
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-all ${d.over ? 'bg-rose-500' : ''}`}
                  style={{
                    width: `${actualPct}%`,
                    backgroundColor: d.over ? undefined : d.color,
                  }}
                />
                {overPct > 0 && (
                  <div
                    className="absolute inset-y-0 bg-rose-600"
                    style={{ left: `${budgetPct}%`, width: `${overPct}%` }}
                  />
                )}
                <div
                  className="absolute inset-y-0 w-px bg-white/40"
                  style={{ left: `${budgetPct}%` }}
                />
              </div>
            </div>
          );
        })
      ) : (
        <div className="h-32 flex items-center justify-center text-slate-600 text-xs italic">
          No budget items assigned
        </div>
      )}
    </div>
  );
}

