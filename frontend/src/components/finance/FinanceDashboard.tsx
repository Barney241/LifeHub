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
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, Receipt, Flame } from 'lucide-react';
import { FinanceStats, FinancialRecord } from '@/types';

interface FinanceDashboardProps {
  stats: FinanceStats | null;
  transactions: FinancialRecord[];
  categories?: { id: string; name: string; color?: string }[];
  onCategorySelect?: (categoryId: string | null) => void;
  currency?: string;
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

export function FinanceDashboard({ stats, transactions, categories = [], onCategorySelect, currency = 'CZK' }: FinanceDashboardProps) {
  // Map category names to info for quick lookup
  const categoryByName = useMemo(() => {
    const map: Record<string, { id: string; color: string }> = {};
    categories.forEach(c => { map[c.name] = { id: c.id, color: c.color || '#64748b' }; });
    return map;
  }, [categories]);

  const handleCategoryClick = (categoryName: string) => {
    if (onCategorySelect) {
      const categoryId = categoryByName[categoryName]?.id;
      onCategorySelect(categoryId || null);
    }
  };
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
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
              className={`p-2 rounded-lg ${
                stats.net_balance >= 0 ? 'bg-emerald-900/30' : 'bg-rose-900/30'
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
            className={`text-2xl font-bold ${
              stats.net_balance >= 0 ? 'text-emerald-400' : 'text-rose-400'
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

        {/* Monthly Cash Flow */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
          <h3 className="font-bold text-slate-200 mb-4">Monthly Cash Flow</h3>
          {monthlyData.length > 0 ? (
            <div className="space-y-4">
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 11 }}
                    />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: '#e2e8f0' }}
                      formatter={(value) => {
                        const v = value as number;
                        return [formatCurrency(Math.abs(v)), v >= 0 ? 'Saved' : 'Overspent'];
                      }}
                    />
                    <Bar
                      dataKey="net"
                      radius={[4, 4, 4, 4]}
                      fill="#64748b"
                    >
                      {monthlyData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.net >= 0 ? '#10b981' : '#ef4444'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Summary row */}
              <div className="flex justify-between text-xs border-t border-slate-800 pt-3">
                <div>
                  <span className="text-slate-500">Total In: </span>
                  <span className="text-emerald-400 font-medium">{formatCurrency(monthlyData.reduce((s, m) => s + m.income, 0))}</span>
                </div>
                <div>
                  <span className="text-slate-500">Total Out: </span>
                  <span className="text-rose-400 font-medium">{formatCurrency(monthlyData.reduce((s, m) => s + m.expenses, 0))}</span>
                </div>
                <div>
                  <span className="text-slate-500">Net: </span>
                  <span className={`font-medium ${monthlyData.reduce((s, m) => s + m.net, 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatCurrency(monthlyData.reduce((s, m) => s + m.net, 0))}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-slate-500 text-sm">
              No monthly data
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
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
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
