'use client';

import { useState, useMemo } from 'react';
import {
  DollarSign,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Clock,
  AlertTriangle,
  CheckCircle2,
  X,
  TrendingUp,
  Wallet,
  PiggyBank,
  Receipt,
  Search,
  Zap,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import {
  IncomeSource,
  BudgetGroup,
  BudgetItem,
  BudgetSummary,
  BudgetItemStatus,
  BudgetGroupStatus,
  Category,
  Merchant,
  Account,
  ImportRule,
  FinancialRecord,
} from '@/types';

interface BudgetDashboardProps {
  budgetStatus: BudgetSummary | null;
  incomeSources: IncomeSource[];
  budgets: BudgetGroup[];
  categories: Category[];
  merchants: Merchant[];
  accounts: Account[];
  rules: ImportRule[];
  transactions: FinancialRecord[];
  currency: string;
  onCreateIncomeSource: (source: Omit<IncomeSource, 'id'>) => Promise<void>;
  onUpdateIncomeSource: (id: string, updates: Partial<IncomeSource>) => Promise<void>;
  onDeleteIncomeSource: (id: string) => Promise<void>;
  onUpsertIncomeHours: (incomeSourceId: string, year: number, month: number, hours: number) => Promise<void>;
  onCreateBudget: (budget: Omit<BudgetGroup, 'id' | 'items'>) => Promise<void>;
  onUpdateBudget: (id: string, updates: Partial<BudgetGroup>) => Promise<void>;
  onDeleteBudget: (id: string) => Promise<void>;
  onCreateBudgetItem: (item: Omit<BudgetItem, 'id'>) => Promise<void>;
  onUpdateBudgetItem: (id: string, updates: Partial<BudgetItem>) => Promise<void>;
  onDeleteBudgetItem: (id: string) => Promise<void>;
  currentYear: number;
  currentMonth: number;
}

const fmt = (amount: number, currency: string) =>
  new Intl.NumberFormat('cs-CZ', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);

const PIE_COLORS = [
  '#6366f1', '#22c55e', '#3b82f6', '#f97316', '#8b5cf6',
  '#ec4899', '#14b8a6', '#eab308', '#ef4444', '#f59e0b',
];

function progressColor(actual: number, budgeted: number) {
  const pct = budgeted > 0 ? actual / budgeted : 0;
  if (pct > 1.05) return 'bg-rose-500';
  if (pct >= 0.9) return 'bg-emerald-500';
  if (pct >= 0.5) return 'bg-amber-500';
  return 'bg-blue-500';
}

function statusBadge(status: string) {
  switch (status) {
    case 'paid': return { label: 'Paid', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: <CheckCircle2 size={10} /> };
    case 'over_budget': return { label: 'Over', cls: 'bg-rose-500/20    text-rose-400    border-rose-500/30', icon: <AlertTriangle size={10} /> };
    case 'under_budget': return { label: 'Under', cls: 'bg-amber-500/20   text-amber-400   border-amber-500/30', icon: <Clock size={10} /> };
    default: return { label: 'Pending', cls: 'bg-slate-800      text-slate-500   border-slate-700', icon: <Clock size={10} /> };
  }
}

// ─── Custom Pie Tooltip ───────────────────────────────────────────────────────
function PieTooltipContent({ active, payload, currency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 shadow-xl text-sm">
      <div className="font-semibold text-slate-200">{payload[0].name}</div>
      <div className="text-blue-300">{fmt(payload[0].value, currency)}</div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function BudgetDashboard({
  budgetStatus,
  incomeSources,
  budgets,
  categories,
  merchants,
  accounts,
  rules,
  transactions,
  currency,
  onCreateIncomeSource,
  onUpdateIncomeSource,
  onDeleteIncomeSource,
  onUpsertIncomeHours,
  onCreateBudget,
  onUpdateBudget,
  onDeleteBudget,
  onCreateBudgetItem,
  onUpdateBudgetItem,
  onDeleteBudgetItem,
  currentYear,
  currentMonth,
}: BudgetDashboardProps) {
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [editingItemForBudget, setEditingItemForBudget] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (id: string) =>
    setExpandedGroups(prev => ({ ...prev, [id]: prev[id] === false ? true : false }));

  const totalIncome = budgetStatus?.total_income ?? 0;
  const totalBudgeted = budgetStatus?.total_budgeted ?? 0;
  const totalActual = budgetStatus?.total_actual ?? 0;
  const remaining = budgetStatus?.remaining ?? 0;
  const unmatched = budgetStatus?.unmatched_expenses ?? [];

  // Pie data — allocation by group
  const allocationData = useMemo(() =>
    (budgetStatus?.budgets ?? []).map(gs => ({
      name: gs.budget.name,
      value: gs.total_budgeted,
    })).filter(d => d.value > 0),
    [budgetStatus]
  );

  // Pie data — actual spend by group
  const actualData = useMemo(() =>
    (budgetStatus?.budgets ?? []).map(gs => ({
      name: gs.budget.name,
      value: gs.total_actual,
    })).filter(d => d.value > 0),
    [budgetStatus]
  );

  const utilizePct = totalBudgeted > 0 ? Math.round((totalActual / totalBudgeted) * 100) : 0;

  return (
    <div className="space-y-6">

      {/* ── Overview cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <OverviewCard
          label="Total Income"
          value={fmt(totalIncome, currency)}
          icon={<TrendingUp size={16} />}
          colorClass="text-emerald-400"
          bgClass="bg-emerald-500/10"
        />
        <OverviewCard
          label="Budgeted"
          value={fmt(totalBudgeted, currency)}
          sub={`${utilizePct}% utilized`}
          icon={<PiggyBank size={16} />}
          colorClass="text-blue-400"
          bgClass="bg-blue-500/10"
        />
        <OverviewCard
          label="Actual Spent"
          value={fmt(totalActual, currency)}
          sub={totalBudgeted > 0 ? `${Math.round((totalActual / totalBudgeted) * 100)}% of budget` : undefined}
          icon={<Receipt size={16} />}
          colorClass="text-slate-200"
          bgClass="bg-slate-700/50"
        />
        <OverviewCard
          label="Remaining"
          value={fmt(remaining, currency)}
          icon={<Wallet size={16} />}
          colorClass={remaining >= 0 ? 'text-emerald-400' : 'text-rose-400'}
          bgClass={remaining >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'}
        />
      </div>

      {/* ── Budget vs Actual comparison chart ────────────────────────────── */}
      {budgetStatus?.budgets && budgetStatus.budgets.length > 0 && (
        <BudgetComparisonChart
          groupStatuses={budgetStatus.budgets}
          allocationData={allocationData}
          currency={currency}
        />
      )}

      {/* ── Income Sources ──────────────────────────────────────────────────── */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-200 flex items-center gap-2">
            <DollarSign size={16} className="text-emerald-500" />
            Income Sources
          </h3>
          <button
            onClick={() => setShowIncomeForm(v => !v)}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Plus size={13} /> Add Source
          </button>
        </div>

        {budgetStatus?.income_sources && budgetStatus.income_sources.length > 0 ? (
          <div className="space-y-2">
            {budgetStatus.income_sources.map((is) => (
              <div key={is.income_source.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
                <div>
                  <div className="text-sm font-medium text-slate-300">{is.income_source.name}</div>
                  {is.income_source.income_type === 'hourly' && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500">{fmt(is.income_source.amount, currency)}/hr ×</span>
                      <input
                        type="number"
                        defaultValue={is.hours_this_month ?? is.income_source.default_hours ?? 0}
                        onBlur={(e) => {
                          const h = parseFloat(e.target.value);
                          if (!isNaN(h)) onUpsertIncomeHours(is.income_source.id, currentYear, currentMonth, h);
                        }}
                        className="w-14 bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-300 outline-none focus:border-blue-500"
                      />
                      <span className="text-xs text-slate-500">hrs</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-emerald-400">{fmt(is.calculated_amount, currency)}</span>
                  <button onClick={() => onDeleteIncomeSource(is.income_source.id)} className="text-slate-600 hover:text-rose-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : !showIncomeForm ? (
          <p className="text-sm text-slate-500 italic">No income sources yet.</p>
        ) : null}

        {showIncomeForm && (
          <IncomeSourceForm
            currency={currency}
            onSubmit={async (src) => { await onCreateIncomeSource(src); setShowIncomeForm(false); }}
            onCancel={() => setShowIncomeForm(false)}
          />
        )}
      </div>

      {/* ── Budget Groups ───────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-200">Budget Groups</h3>
          <button
            onClick={() => setShowBudgetForm(v => !v)}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Plus size={13} /> Add Group
          </button>
        </div>

        {showBudgetForm && (
          <BudgetGroupForm
            onSubmit={async (b) => { await onCreateBudget(b); setShowBudgetForm(false); }}
            onCancel={() => setShowBudgetForm(false)}
          />
        )}

        {budgetStatus?.budgets && budgetStatus.budgets.length > 0 ? (
          budgetStatus.budgets.map((gs, idx) => (
            <BudgetGroupCard
              key={gs.budget.id}
              groupStatus={gs}
              currency={currency}
              colorIndex={idx}
              isExpanded={expandedGroups[gs.budget.id] !== false}
              onToggleGroup={() => toggleGroup(gs.budget.id)}
              onDeleteBudget={() => onDeleteBudget(gs.budget.id)}
              onAddItem={() => setEditingItemForBudget(gs.budget.id)}
              onDeleteItem={onDeleteBudgetItem}
              showItemForm={editingItemForBudget === gs.budget.id}
              rules={rules}
              transactions={transactions}
              onCreateItem={async (item) => { await onCreateBudgetItem(item); setEditingItemForBudget(null); }}
              onCancelItemForm={() => setEditingItemForBudget(null)}
            />
          ))
        ) : budgets.length > 0 ? (
          <div className="text-sm text-slate-500 italic p-4">Computing budget status…</div>
        ) : (
          <div className="bg-slate-900 rounded-2xl border border-dashed border-slate-700 p-10 text-center text-slate-500 text-sm">
            No budget groups yet. Create one to start tracking your expenses.
          </div>
        )}
      </div>

      {/* ── Unmatched Expenses ──────────────────────────────────────────────── */}
      {unmatched.length > 0 && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
          <h3 className="font-bold text-slate-200 mb-3 flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-400" />
            Unmatched Expenses
            <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30">{unmatched.length}</span>
          </h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {unmatched.map(tx => (
              <div key={tx.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-800/50 text-sm">
                <span className="text-slate-400 truncate flex-1">{tx.merchant_name || tx.description}</span>
                <span className="text-slate-500 text-xs ml-3 shrink-0">{new Date(tx.date).toLocaleDateString('cs-CZ')}</span>
                <span className="text-rose-400 font-medium ml-3 shrink-0">{fmt(tx.amount, currency)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Overview Card ────────────────────────────────────────────────────────────
function OverviewCard({ label, value, sub, icon, colorClass, bgClass }: {
  label: string; value: string; sub?: string;
  icon: React.ReactNode; colorClass: string; bgClass: string;
}) {
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 flex items-start gap-3">
      <div className={`p-2 rounded-xl ${bgClass} shrink-0`}>
        <span className={colorClass}>{icon}</span>
      </div>
      <div className="min-w-0">
        <div className="text-xs text-slate-500 mb-0.5">{label}</div>
        <div className={`font-bold text-base leading-tight ${colorClass}`}>{value}</div>
        {sub && <div className="text-xs text-slate-600 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Budget Comparison Chart ──────────────────────────────────────────────────
function BudgetComparisonChart({
  groupStatuses,
  allocationData,
  currency,
}: {
  groupStatuses: BudgetGroupStatus[];
  allocationData: { name: string; value: number }[];
  currency: string;
}) {
  // Build bar chart data — strip emojis from group names for cleaner axis labels
  const barData = groupStatuses.map((gs, idx) => {
    const name = gs.budget.name.replace(/^\p{Emoji}+\s*/u, '').trim();
    return {
      name,
      budgeted: gs.total_budgeted,
      actual: gs.total_actual,
      over: gs.total_actual > gs.total_budgeted,
      color: PIE_COLORS[idx % PIE_COLORS.length],
    };
  });

  const maxVal = Math.max(...barData.map(d => Math.max(d.budgeted, d.actual)), 1);

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
      <h4 className="text-sm font-semibold text-slate-400 mb-4">Budget vs Actual</h4>
      <div className="flex gap-4 flex-col md:flex-row">

        {/* ── Grouped horizontal bars ── */}
        <div className="flex-1 space-y-3 min-w-0">
          {barData.map((d) => {
            const budgetPct = (d.budgeted / maxVal) * 100;
            const actualPct = Math.min((d.actual / maxVal) * 100, 100);
            const overPct = d.actual > d.budgeted
              ? Math.min(((d.actual - d.budgeted) / maxVal) * 100, 100 - budgetPct)
              : 0;
            return (
              <div key={d.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-400 truncate max-w-[120px]">{d.name}</span>
                  <div className="flex items-center gap-2 text-xs shrink-0">
                    <span className="text-slate-500">{fmt(d.actual, currency)}</span>
                    <span className="text-slate-700">/</span>
                    <span className="text-slate-600">{fmt(d.budgeted, currency)}</span>
                    {d.over
                      ? <span className="text-rose-400 font-semibold">▲ {fmt(d.actual - d.budgeted, currency)}</span>
                      : <span className="text-emerald-500 font-semibold">▼ {fmt(d.budgeted - d.actual, currency)}</span>
                    }
                  </div>
                </div>
                {/* Budget bar (background) */}
                <div className="relative h-5 rounded-lg overflow-hidden bg-slate-800">
                  {/* Budgeted (dim) */}
                  <div
                    className="absolute inset-y-0 left-0 rounded-lg opacity-25"
                    style={{ width: `${budgetPct}%`, backgroundColor: d.color }}
                  />
                  {/* Actual (solid) */}
                  <div
                    className={`absolute inset-y-0 left-0 rounded-lg transition-all ${d.over ? 'bg-rose-500' : ''}`}
                    style={{
                      width: `${actualPct}%`,
                      backgroundColor: d.over ? undefined : d.color,
                    }}
                  />
                  {/* Over-budget overflow bar */}
                  {overPct > 0 && (
                    <div
                      className="absolute inset-y-0 bg-rose-600 rounded-r-lg"
                      style={{ left: `${budgetPct}%`, width: `${overPct}%` }}
                    />
                  )}
                  {/* Budget marker line */}
                  <div
                    className="absolute inset-y-0 w-0.5 bg-white/30"
                    style={{ left: `${budgetPct}%` }}
                  />
                </div>
              </div>
            );
          })}
          {/* Legend */}
          <div className="flex items-center gap-4 pt-1 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-8 h-2 rounded-full bg-slate-600 inline-block opacity-30" />
              Budgeted
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-8 h-2 rounded-full bg-blue-500 inline-block" />
              Actual
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-8 h-2 rounded-full bg-rose-500 inline-block" />
              Over budget
            </span>
          </div>
        </div>

        {/* ── Allocation donut ── */}
        {allocationData.length > 0 && (
          <div className="w-full md:w-48 shrink-0">
            <p className="text-xs text-slate-600 text-center mb-1">Allocation</p>
            <ResponsiveContainer width="100%" height={170}>
              <PieChart>
                <Pie
                  data={allocationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={68}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {allocationData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltipContent currency={currency} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Pie Card ─────────────────────────────────────────────────────────────────
function PieCard({ title, data, currency }: { title: string; data: { name: string; value: number }[]; currency: string }) {

  if (data.length === 0) return null;
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
      <h4 className="text-sm font-semibold text-slate-400 mb-3">{title}</h4>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip content={<PieTooltipContent currency={currency} />} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => <span className="text-xs text-slate-400">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Budget Group Card ────────────────────────────────────────────────────────
function BudgetGroupCard({
  groupStatus, currency, colorIndex, isExpanded,
  onToggleGroup, onDeleteBudget, onAddItem, onDeleteItem,
  showItemForm, rules, transactions, onCreateItem, onCancelItemForm,
}: {
  groupStatus: BudgetGroupStatus; currency: string; colorIndex: number; isExpanded: boolean;
  onToggleGroup: () => void; onDeleteBudget: () => void; onAddItem: () => void;
  onDeleteItem: (id: string) => Promise<void>; showItemForm: boolean;
  rules: ImportRule[]; transactions: FinancialRecord[];
  onCreateItem: (item: Omit<BudgetItem, 'id'>) => Promise<void>;
  onCancelItemForm: () => void;
}) {
  const { budget, items: rawItems, total_budgeted, total_actual } = groupStatus;
  const items = rawItems || [];
  const color = PIE_COLORS[colorIndex % PIE_COLORS.length];
  const pct = total_budgeted > 0 ? Math.min((total_actual / total_budgeted) * 100, 100) : 0;
  const overBudget = total_actual > total_budgeted * 1.05;

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-800/40 transition-colors" onClick={onToggleGroup}>
        <div className="flex items-center gap-3 min-w-0">
          {isExpanded
            ? <ChevronDown size={15} className="text-slate-500 shrink-0" />
            : <ChevronRight size={15} className="text-slate-500 shrink-0" />}
          {budget.icon && <span className="text-lg leading-none">{budget.icon}</span>}
          <span className="font-semibold text-slate-200 truncate">{budget.name}</span>
          <span className="text-xs text-slate-500 shrink-0">{items.length} items</span>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-medium" style={{ color }}>
              {fmt(total_actual, currency)}
              <span className="text-slate-600 mx-1">/</span>
              <span className="text-slate-400">{fmt(total_budgeted, currency)}</span>
            </div>
            {/* mini progress */}
            <div className="h-1.5 w-28 bg-slate-800 rounded-full overflow-hidden mt-1.5">
              <div
                className={`h-full rounded-full transition-all ${overBudget ? 'bg-rose-500' : ''}`}
                style={{ width: `${pct}%`, backgroundColor: overBudget ? undefined : color }}
              />
            </div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); onDeleteBudget(); }} className="text-slate-600 hover:text-rose-400 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Items */}
      {isExpanded && (
        <div className="border-t border-slate-800">
          {items.length === 0 && !showItemForm && (
            <div className="px-6 py-4 text-sm text-slate-500 italic text-center">No items — add one below.</div>
          )}
          {items.map((itemStatus) => (
            <BudgetItemRow
              key={itemStatus.budget_item.id}
              itemStatus={itemStatus}
              currency={currency}
              onDelete={() => onDeleteItem(itemStatus.budget_item.id)}
            />
          ))}

          {showItemForm && (
            <div className="p-4 border-t border-slate-800 bg-slate-900/60">
              <BudgetItemForm
                budgetId={budget.id}
                currency={currency}
                rules={rules}
                transactions={transactions}
                onSubmit={onCreateItem}
                onCancel={onCancelItemForm}
              />
            </div>
          )}

          <div className="px-4 py-3 border-t border-slate-800/60">
            <button
              onClick={onAddItem}
              className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1.5 transition-colors"
            >
              <Plus size={12} /> Add Budget Item
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Budget Item Row ──────────────────────────────────────────────────────────
function BudgetItemRow({ itemStatus, currency, onDelete }: {
  itemStatus: BudgetItemStatus; currency: string; onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { budget_item, normalized_amount, actual_amount, difference, status, matched_transactions } = itemStatus;
  const badge = statusBadge(status);
  const pct = normalized_amount > 0 ? Math.min((actual_amount / normalized_amount) * 100, 100) : 0;

  return (
    <div className="border-t border-slate-800/50">
      <div
        className="flex items-center justify-between px-4 py-3 hover:bg-slate-800/20 cursor-pointer transition-colors"
        onClick={() => matched_transactions?.length > 0 && setExpanded(v => !v)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {matched_transactions?.length > 0 ? (
            expanded ? <ChevronDown size={12} className="text-slate-600 shrink-0" /> : <ChevronRight size={12} className="text-slate-600 shrink-0" />
          ) : (
            <span className="w-3 shrink-0" />
          )}
          <span className="text-sm text-slate-300 truncate">{budget_item.name}</span>
          {budget_item.frequency === 'yearly' && (
            <span className="text-xs text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded shrink-0">yearly</span>
          )}
          <span className={`text-xs px-1.5 py-0.5 rounded border flex items-center gap-1 shrink-0 ${badge.cls}`}>
            {badge.icon} {badge.label}
          </span>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="hidden sm:block w-20">
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${progressColor(actual_amount, normalized_amount)}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="text-right text-sm">
            <span className={`font-medium ${actual_amount === 0 ? 'text-slate-500' : actual_amount > normalized_amount * 1.05 ? 'text-rose-400' : 'text-slate-200'}`}>
              {fmt(actual_amount, currency)}
            </span>
            <span className="text-slate-600 mx-1">/</span>
            <span className="text-slate-500">{fmt(normalized_amount, currency)}</span>
          </div>
          <span className={`text-xs font-medium w-16 text-right ${difference >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {difference >= 0 ? '+' : ''}{fmt(difference, currency)}
          </span>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-slate-700 hover:text-rose-400 transition-colors">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* matched transactions */}
      {expanded && matched_transactions && matched_transactions.length > 0 && (
        <div className="px-10 pb-3">
          <div className="bg-slate-800/30 rounded-xl p-2 space-y-1">
            {matched_transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between px-3 py-1.5 text-xs rounded-lg hover:bg-slate-800/50">
                <span className="text-slate-400 truncate flex-1">{tx.merchant_name || tx.description}</span>
                <span className="text-slate-500 ml-3 shrink-0">{new Date(tx.date).toLocaleDateString('cs-CZ')}</span>
                <span className="text-slate-300 font-medium ml-3 shrink-0">{fmt(tx.amount, currency)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Income Source Form ───────────────────────────────────────────────────────
function IncomeSourceForm({ currency, onSubmit, onCancel }: {
  currency: string;
  onSubmit: (source: Omit<IncomeSource, 'id'>) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [incomeType, setIncomeType] = useState<'fixed' | 'hourly'>('fixed');
  const [amount, setAmount] = useState('');
  const [defaultHours, setDefaultHours] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name || !amount) return;
    setSaving(true);
    try {
      await onSubmit({ name, income_type: incomeType, amount: parseFloat(amount), currency, default_hours: parseFloat(defaultHours) || 0, is_active: true });
    } finally { setSaving(false); }
  };

  return (
    <div className="mt-4 p-4 bg-slate-800/50 rounded-xl space-y-3 border border-slate-700">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-300">New Income Source</span>
        <button onClick={onCancel} className="text-slate-500 hover:text-slate-300"><X size={15} /></button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input type="text" placeholder="Name" value={name} onChange={e => setName(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500 col-span-2" />
        <select value={incomeType} onChange={e => setIncomeType(e.target.value as any)}
          className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500">
          <option value="fixed">Fixed monthly</option>
          <option value="hourly">Hourly</option>
        </select>
        <input type="number" placeholder={incomeType === 'hourly' ? 'Rate per hour' : 'Monthly amount'} value={amount} onChange={e => setAmount(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500" />
        {incomeType === 'hourly' && (
          <input type="number" placeholder="Default hours/month" value={defaultHours} onChange={e => setDefaultHours(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500 col-span-2" />
        )}
      </div>
      <div className="flex gap-2">
        <button onClick={handleSubmit} disabled={saving || !name || !amount}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onCancel} className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Budget Group Form ────────────────────────────────────────────────────────
function BudgetGroupForm({ onSubmit, onCancel }: {
  onSubmit: (budget: Omit<BudgetGroup, 'id' | 'items'>) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name) return;
    setSaving(true);
    try { await onSubmit({ name, icon, color, sort_order: 0, is_active: true }); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-700 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-300">New Budget Group</span>
        <button onClick={onCancel} className="text-slate-500 hover:text-slate-300"><X size={15} /></button>
      </div>
      <div className="flex gap-3">
        <input type="text" placeholder="Icon (emoji)" value={icon} onChange={e => setIcon(e.target.value)}
          className="w-20 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500 text-center" />
        <input type="text" placeholder="Group name" value={name} onChange={e => setName(e.target.value)}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500" />
        <input type="color" value={color} onChange={e => setColor(e.target.value)}
          className="w-12 h-10 bg-slate-800 border border-slate-700 rounded-xl cursor-pointer p-1" title="Group color" />
      </div>
      <div className="flex gap-2">
        <button onClick={handleSubmit} disabled={saving || !name}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
          {saving ? 'Creating…' : 'Create Group'}
        </button>
        <button onClick={onCancel} className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Helper: match transactions for a given rule ──────────────────────────────
function matchTransactions(rule: ImportRule, transactions: FinancialRecord[]): FinancialRecord[] {
  return transactions.filter(tx => {
    const field = rule.match_field || 'description';
    const value = field === 'raw_description' ? tx.raw_description
      : field === 'counterparty_account' ? tx.counterparty_account
        : tx.description;
    if (!value) return false;
    const pattern = rule.pattern;
    const type = rule.pattern_type || 'contains';
    if (type === 'exact') return value.toLowerCase() === pattern.toLowerCase();
    if (type === 'regex') { try { return new RegExp(pattern, 'i').test(value); } catch { return false; } }
    return value.toUpperCase().includes(pattern.toUpperCase());
  });
}

// ─── Budget Item Form ─────────────────────────────────────────────────────────
function BudgetItemForm({ budgetId, currency, rules, transactions, onSubmit, onCancel }: {
  budgetId: string; currency: string;
  rules: ImportRule[]; transactions: FinancialRecord[];
  onSubmit: (item: Omit<BudgetItem, 'id'>) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFreq] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedRule, setSelectedRule] = useState<ImportRule | null>(null);
  const [ruleSearch, setRuleSearch] = useState('');
  const [showRuleDropdown, setShowRuleDropdown] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filter rules by search query
  const filteredRules = useMemo(() =>
    rules.filter(r => r.active && (
      r.name.toLowerCase().includes(ruleSearch.toLowerCase()) ||
      r.pattern.toLowerCase().includes(ruleSearch.toLowerCase())
    )),
    [rules, ruleSearch]
  );

  // Matching transactions for selected rule — shown as previews
  const previewTxns = useMemo(() => {
    if (!selectedRule) return [];
    return matchTransactions(selectedRule, transactions)
      .filter(tx => tx.is_expense)
      .slice(0, 4);
  }, [selectedRule, transactions]);

  // Suggested amount = avg of last 3 matching txns (read-only hint, never overwrites)
  const suggestedAmount = useMemo(() => {
    if (previewTxns.length === 0) return null;
    const total = previewTxns.reduce((s, tx) => s + tx.amount, 0);
    return Math.round(total / previewTxns.length);
  }, [previewTxns]);

  const selectRule = (rule: ImportRule) => {
    setSelectedRule(rule);
    setRuleSearch(rule.name);
    setShowRuleDropdown(false);
    // Auto-fill name if empty
    if (!name) setName(rule.name);
    // Do NOT auto-fill amount — just show suggestion
  };

  const handleSubmit = async () => {
    if (!name || !amount) return;
    setSaving(true);
    try {
      await onSubmit({
        budget_id: budgetId,
        name,
        budgeted_amount: parseFloat(amount),
        currency,
        frequency,
        match_pattern: selectedRule?.pattern || undefined,
        match_pattern_type: selectedRule?.pattern_type || undefined,
        match_field: selectedRule?.match_field || undefined,
        match_category_id: selectedRule?.category_id || undefined,
        match_merchant_id: selectedRule?.merchant_id || undefined,
        is_expense: true,
        sort_order: 0,
        is_active: true,
      });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-300">New Budget Item</span>
        <button onClick={onCancel} className="text-slate-500 hover:text-slate-300"><X size={15} /></button>
      </div>

      {/* Rule picker */}
      <div className="relative">
        <label className="text-xs text-slate-500 font-medium mb-1.5 flex items-center gap-1.5">
          <Zap size={11} className="text-blue-400" />
          Link to Import Rule <span className="text-slate-600">(determines which transactions are tracked)</span>
        </label>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search rules…"
            value={ruleSearch}
            onChange={e => { setRuleSearch(e.target.value); setShowRuleDropdown(true); if (!e.target.value) { setSelectedRule(null); } }}
            onFocus={() => setShowRuleDropdown(true)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
          />
          {selectedRule && (
            <button onClick={() => { setSelectedRule(null); setRuleSearch(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              <X size={12} />
            </button>
          )}
        </div>

        {showRuleDropdown && filteredRules.length > 0 && (
          <div className="absolute z-20 mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
            {filteredRules.map(rule => (
              <button
                key={rule.id}
                type="button"
                onClick={() => selectRule(rule)}
                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-700 text-left transition-colors"
              >
                <span className="text-sm text-slate-200">{rule.name}</span>
                <span className="text-xs text-slate-500 ml-2 font-mono bg-slate-900 px-2 py-0.5 rounded">
                  {rule.pattern_type}: "{rule.pattern}"
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Preview transactions */}
      {selectedRule && previewTxns.length > 0 && (
        <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-3">
          <div className="text-xs text-slate-500 mb-2 flex items-center gap-1.5">
            <Receipt size={11} />
            Recent matching transactions
            {suggestedAmount !== null && (
              <button
                type="button"
                onClick={() => setAmount(String(suggestedAmount))}
                className="ml-auto text-blue-400 hover:text-blue-300 transition-colors font-medium"
              >
                Use avg: {fmt(suggestedAmount, currency)}
              </button>
            )}
          </div>
          <div className="space-y-1">
            {previewTxns.map(tx => (
              <div key={tx.id} className="flex items-center justify-between text-xs px-2 py-1 rounded-lg bg-slate-800/40">
                <span className="text-slate-400 truncate flex-1">{tx.merchant_name || tx.description}</span>
                <span className="text-slate-500 ml-2 shrink-0">{new Date(tx.date).toLocaleDateString('cs-CZ')}</span>
                <span className="text-slate-300 font-medium ml-2 shrink-0">{fmt(tx.amount, currency)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedRule && previewTxns.length === 0 && (
        <div className="text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
          No transactions matched this rule in the current period.
        </div>
      )}

      {/* Name, Amount, Frequency */}
      <div className="grid grid-cols-2 gap-3">
        <input
          type="text"
          placeholder="Item name"
          value={name}
          onChange={e => setName(e.target.value)}
          className="col-span-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
        />
        <div className="relative">
          <input
            type="number"
            placeholder="Budget amount"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
          />
          {suggestedAmount !== null && !amount && (
            <div className="absolute -bottom-5 left-0 text-xs text-slate-500">
              Suggested: {fmt(suggestedAmount, currency)}
            </div>
          )}
        </div>
        <select
          value={frequency}
          onChange={e => setFreq(e.target.value as 'monthly' | 'yearly')}
          className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
        >
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSubmit}
          disabled={saving || !name || !amount}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
        >
          {saving ? 'Adding…' : 'Add Item'}
        </button>
        <button onClick={onCancel} className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}
