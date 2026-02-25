'use client';

import { useState, useCallback, useMemo } from 'react';
import { TrendingUp, TrendingDown, Upload, ChevronDown, ChevronRight } from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { InvestmentPortfolio, InvestmentSnapshot } from '@/types';

interface InvestmentDashboardProps {
  portfolios: InvestmentPortfolio[];
  onImport: () => void;
  onFetchSnapshots: (portfolioId: string) => Promise<InvestmentSnapshot[]>;
  dateRange?: { start: string; end: string } | null;
  displayCurrency?: string;
}

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899',
  '#06b6d4', '#ef4444', '#84cc16', '#f97316', '#14b8a6',
];

const fmt = (value: number, currency = 'CZK') =>
  new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: currency || 'CZK', maximumFractionDigits: 0 }).format(value);

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatShortDate = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('cs-CZ', { month: 'short', year: '2-digit' });
};

// Approximate exchange rates to CZK for cross-currency conversion
const RATES_TO_CZK: Record<string, number> = {
  CZK: 1,
  EUR: 25.2,
  USD: 23.5,
  GBP: 29.5,
};

// Convert from one currency to another via CZK as intermediate
const convert = (value: number, from: string, to: string): number => {
  if (from === to) return value;
  const inCZK = value * (RATES_TO_CZK[from] || 1);
  return inCZK / (RATES_TO_CZK[to] || 1);
};

export function InvestmentDashboard({ portfolios, onImport, onFetchSnapshots, dateRange, displayCurrency: dc = 'CZK' }: InvestmentDashboardProps) {
  // formatCurrency: shows value in display currency, with original in parens if different
  const formatCurrency = useCallback((value: number, originalCurrency = 'CZK') => {
    const oc = originalCurrency || 'CZK';
    if (oc === dc) return fmt(value, dc);
    const converted = convert(value, oc, dc);
    return `${fmt(converted, dc)} (${fmt(value, oc)})`;
  }, [dc]);

  // formatSingle: just format in display currency without showing original (for aggregated/already-converted values)
  const formatInDC = useCallback((value: number) => fmt(value, dc), [dc]);

  // Convert value to display currency
  const toDC = useCallback((value: number, from: string) => convert(value, from, dc), [dc]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<InvestmentSnapshot[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [expandedSnapshotId, setExpandedSnapshotId] = useState<string | null>(null);
  // Cache snapshots per portfolio for charts
  const [allSnapshots, setAllSnapshots] = useState<Record<string, InvestmentSnapshot[]>>({});

  const handleSelectPortfolio = useCallback(async (portfolioId: string) => {
    if (selectedPortfolioId === portfolioId) {
      setSelectedPortfolioId(null);
      setSnapshots([]);
      return;
    }
    setSelectedPortfolioId(portfolioId);
    setLoadingSnapshots(true);
    const data = await onFetchSnapshots(portfolioId);
    setSnapshots(data);
    setAllSnapshots(prev => ({ ...prev, [portfolioId]: data }));
    setLoadingSnapshots(false);
  }, [selectedPortfolioId, onFetchSnapshots]);

  // Load snapshots for all portfolios on first render for charts
  const loadAllSnapshots = useCallback(async () => {
    const missing = portfolios.filter(p => !allSnapshots[p.id]);
    if (missing.length === 0) return;
    const results: Record<string, InvestmentSnapshot[]> = { ...allSnapshots };
    for (const p of missing) {
      results[p.id] = await onFetchSnapshots(p.id);
    }
    setAllSnapshots(results);
  }, [portfolios, allSnapshots, onFetchSnapshots]);

  // Auto-load on mount
  useMemo(() => {
    if (portfolios.length > 0 && Object.keys(allSnapshots).length === 0) {
      loadAllSnapshots();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolios.length]);

  // Filter snapshots by selected date range
  const filteredSnapshots = useMemo(() => {
    if (!dateRange) return allSnapshots; // null = all time
    const result: Record<string, InvestmentSnapshot[]> = {};
    Object.entries(allSnapshots).forEach(([portfolioId, snaps]) => {
      result[portfolioId] = snaps.filter(snap => {
        const snapDate = (snap.report_date || snap.period_end || '').split('T')[0];
        return snapDate >= dateRange.start && snapDate <= dateRange.end;
      });
    });
    return result;
  }, [allSnapshots, dateRange]);

  // For totals header, use the latest snapshot within the filtered range per portfolio
  const filteredTotals = useMemo(() => {
    let value = 0, gainLoss = 0, invested = 0;
    Object.entries(filteredSnapshots).forEach(([portfolioId, snaps]) => {
      if (snaps.length === 0) return;
      const portfolio = portfolios.find(p => p.id === portfolioId);
      const curr = portfolio?.currency || 'CZK';
      const latest = snaps.reduce((a, b) =>
        (a.report_date || a.period_end) > (b.report_date || b.period_end) ? a : b
      );
      value += toDC(latest.end_value, curr);
      gainLoss += toDC(latest.gain_loss, curr);
      invested += toDC(latest.invested, curr);
    });
    return { value, gainLoss, invested };
  }, [filteredSnapshots, portfolios]);

  // Use filtered totals when a date range is set, otherwise aggregate from latest_snapshot
  const totalValue = dateRange
    ? filteredTotals.value
    : portfolios.reduce((sum, p) => sum + toDC(p.latest_snapshot?.end_value || 0, p.currency), 0);
  const totalGainLoss = dateRange
    ? filteredTotals.gainLoss
    : portfolios.reduce((sum, p) => sum + toDC(p.latest_snapshot?.gain_loss || 0, p.currency), 0);
  const totalInvested = dateRange
    ? filteredTotals.invested
    : portfolios.reduce((sum, p) => sum + toDC(p.latest_snapshot?.invested || 0, p.currency), 0);
  const gainPercent = totalInvested > 0 ? ((totalGainLoss / totalInvested) * 100).toFixed(1) : null;

  // Chart data: portfolio value over time (from filtered snapshots, converted to CZK)
  const valueOverTimeData = useMemo(() => {
    const pointMap: Record<string, { date: string; value: number; invested: number }> = {};

    Object.entries(filteredSnapshots).forEach(([portfolioId, snaps]) => {
      const portfolio = portfolios.find(p => p.id === portfolioId);
      const curr = portfolio?.currency || 'CZK';
      snaps.forEach(snap => {
        const key = snap.report_date?.split('T')[0] || snap.period_end?.split('T')[0];
        if (!key) return;
        if (!pointMap[key]) {
          pointMap[key] = { date: key, value: 0, invested: 0 };
        }
        pointMap[key].value += toDC(snap.end_value, curr);
        pointMap[key].invested += toDC(snap.invested, curr);
      });
    });

    return Object.values(pointMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(p => ({
        ...p,
        label: formatShortDate(p.date),
        gain: p.value - p.invested,
      }));
  }, [filteredSnapshots, portfolios]);

  // Chart data: gain/loss per snapshot period (bar chart, converted to CZK)
  const gainLossData = useMemo(() => {
    const pointMap: Record<string, { date: string; gain: number }> = {};

    Object.entries(filteredSnapshots).forEach(([portfolioId, snaps]) => {
      const portfolio = portfolios.find(p => p.id === portfolioId);
      const curr = portfolio?.currency || 'CZK';
      snaps.forEach(snap => {
        const key = snap.report_date?.split('T')[0] || snap.period_end?.split('T')[0];
        if (!key) return;
        if (!pointMap[key]) {
          pointMap[key] = { date: key, gain: 0 };
        }
        pointMap[key].gain += toDC(snap.gain_loss, curr);
      });
    });

    return Object.values(pointMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(p => ({
        ...p,
        label: formatShortDate(p.date),
      }));
  }, [filteredSnapshots, portfolios]);

  // Chart data: holdings allocation (pie chart from latest filtered snapshots)
  // Values converted to CZK for comparable aggregation
  const holdingsAllocation = useMemo(() => {
    const holdingMap: Record<string, { name: string; valueCZK: number; originalValue: number; currency: string }> = {};

    Object.entries(filteredSnapshots).forEach(([portfolioId, snaps]) => {
      if (snaps.length === 0) return;
      const latest = snaps.reduce((a, b) =>
        (a.report_date || a.period_end) > (b.report_date || b.period_end) ? a : b
      );
      if (latest.holdings) {
        latest.holdings.forEach(h => {
          const key = h.isin || h.name;
          if (!holdingMap[key]) {
            holdingMap[key] = { name: h.name, valueCZK: 0, originalValue: 0, currency: h.value_currency };
          }
          holdingMap[key].valueCZK += toDC(h.total_value, h.value_currency);
          holdingMap[key].originalValue += h.total_value;
        });
      } else {
        const p = portfolios.find(p => p.id === portfolioId);
        if (p) {
          holdingMap[portfolioId] = {
            name: p.name,
            valueCZK: toDC(latest.end_value, p.currency),
            originalValue: latest.end_value,
            currency: p.currency,
          };
        }
      }
    });

    return Object.values(holdingMap)
      .sort((a, b) => b.valueCZK - a.valueCZK);
  }, [filteredSnapshots, portfolios]);

  // Chart data: allocation by category (Akciový fond, Smíšený fond, etc.)
  // Values converted to CZK. Portfolios without holdings detail use portfolio name as category.
  const categoryAllocation = useMemo(() => {
    const catMap: Record<string, number> = {};

    Object.entries(filteredSnapshots).forEach(([portfolioId, snaps]) => {
      if (snaps.length === 0) return;
      const latest = snaps.reduce((a, b) =>
        (a.report_date || a.period_end) > (b.report_date || b.period_end) ? a : b
      );
      if (latest.holdings && latest.holdings.length > 0) {
        latest.holdings.forEach(h => {
          const cat = h.category || 'Other';
          catMap[cat] = (catMap[cat] || 0) + toDC(h.total_value, h.value_currency);
        });
      } else {
        const p = portfolios.find(p => p.id === portfolioId);
        if (p) {
          const label = p.name;
          catMap[label] = (catMap[label] || 0) + toDC(latest.end_value, p.currency);
        }
      }
    });

    return Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredSnapshots, portfolios]);

  // Get the latest snapshot per portfolio within the filtered range
  const latestFilteredSnap = useMemo(() => {
    const result: Record<string, InvestmentSnapshot | null> = {};
    Object.entries(filteredSnapshots).forEach(([portfolioId, snaps]) => {
      if (snaps.length === 0) {
        result[portfolioId] = null;
      } else {
        result[portfolioId] = snaps.reduce((a, b) =>
          (a.report_date || a.period_end) > (b.report_date || b.period_end) ? a : b
        );
      }
    });
    return result;
  }, [filteredSnapshots]);

  // Find the snapshot just BEFORE the selected date range per portfolio.
  // Since gain_loss = cumulative unrealized P&L (end_value − invested),
  // period gain = latest_in_range.gain_loss − prePeriod.gain_loss.
  const prePeriodSnap = useMemo(() => {
    const result: Record<string, InvestmentSnapshot | null> = {};
    portfolios.forEach(({ id }) => {
      if (!dateRange) {
        result[id] = null;
        return;
      }
      const all = allSnapshots[id] || [];
      // All snapshots strictly before the period start, pick the latest one
      const before = all.filter(s => {
        const d = (s.report_date || s.period_end || '').split('T')[0];
        return d < dateRange.start;
      });
      result[id] = before.length === 0 ? null : before.reduce((a, b) =>
        (a.report_date || a.period_end) > (b.report_date || b.period_end) ? a : b
      );
    });
    return result;
  }, [allSnapshots, portfolios, dateRange]);

  // Chart data: per-portfolio value over time (line chart comparison)
  const portfolioValueOverTime = useMemo(() => {
    // Collect all dates across all portfolios
    const dateSet = new Set<string>();
    const portfolioNames: { id: string; name: string; currency: string }[] = [];

    portfolios.forEach(p => {
      const snaps = filteredSnapshots[p.id] || [];
      if (snaps.length === 0) return;
      portfolioNames.push({ id: p.id, name: p.name, currency: p.currency });
      snaps.forEach(s => {
        const d = (s.report_date || s.period_end || '').split('T')[0];
        if (d) dateSet.add(d);
      });
    });

    if (portfolioNames.length < 2) return { data: [], names: [] };

    const dates = Array.from(dateSet).sort();

    // Build a lookup: portfolioId -> date -> snap
    const snapByDate: Record<string, Record<string, InvestmentSnapshot>> = {};
    portfolioNames.forEach(({ id }) => {
      snapByDate[id] = {};
      (filteredSnapshots[id] || []).forEach(s => {
        const d = (s.report_date || s.period_end || '').split('T')[0];
        if (d) snapByDate[id][d] = s;
      });
    });

    const data = dates.map(date => {
      const point: Record<string, string | number> = { date, label: formatShortDate(date) };
      portfolioNames.forEach(({ id, name, currency }) => {
        const snap = snapByDate[id][date];
        if (snap) {
          point[`val_${id}`] = Math.round(toDC(snap.end_value, currency));
        }
      });
      return point;
    });

    return { data, names: portfolioNames };
  }, [filteredSnapshots, portfolios]);

  // Chart data: per-portfolio gain % over time (line chart comparison)
  const portfolioGainOverTime = useMemo(() => {
    const { names } = portfolioValueOverTime;
    if (names.length < 2) return [];

    const dateSet = new Set<string>();
    names.forEach(({ id }) => {
      (filteredSnapshots[id] || []).forEach(s => {
        const d = (s.report_date || s.period_end || '').split('T')[0];
        if (d) dateSet.add(d);
      });
    });

    const dates = Array.from(dateSet).sort();

    const snapByDate: Record<string, Record<string, InvestmentSnapshot>> = {};
    names.forEach(({ id }) => {
      snapByDate[id] = {};
      (filteredSnapshots[id] || []).forEach(s => {
        const d = (s.report_date || s.period_end || '').split('T')[0];
        if (d) snapByDate[id][d] = s;
      });
    });

    return dates.map(date => {
      const point: Record<string, string | number> = { date, label: formatShortDate(date) };
      names.forEach(({ id, currency }) => {
        const snap = snapByDate[id][date];
        if (snap && snap.invested > 0) {
          const gainPct = (toDC(snap.gain_loss, currency) / toDC(snap.invested, currency)) * 100;
          point[`pct_${id}`] = Math.round(gainPct * 10) / 10;
        }
      });
      return point;
    });
  }, [filteredSnapshots, portfolioValueOverTime]);

  const hasChartData = valueOverTimeData.length > 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-200">Investment Portfolios</h3>
          {portfolios.length > 0 && (
            <div className="flex gap-4 mt-1 text-sm">
              <span className="text-slate-400">Total: <span className="text-slate-200 font-medium">{formatInDC(totalValue)}</span></span>
              <span className="text-slate-400">Invested: <span className="text-slate-200 font-medium">{formatInDC(totalInvested)}</span></span>
              <span className={totalGainLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {totalGainLoss >= 0 ? '+' : ''}{formatInDC(totalGainLoss)}
                {gainPercent && ` (${gainPercent}%)`}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={onImport}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <Upload size={16} />
          Import PDF
        </button>
      </div>

      {/* Empty state */}
      {portfolios.length === 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center">
          <TrendingUp size={48} className="text-slate-600 mx-auto mb-4" />
          <div className="text-lg font-medium text-slate-400 mb-2">No investment portfolios yet</div>
          <div className="text-sm text-slate-500 mb-6">Import a Fondee or Amundi PDF statement to get started</div>
          <button
            onClick={onImport}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            Import First Report
          </button>
        </div>
      )}

      {/* Portfolio Cards */}
      {portfolios.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {portfolios.map((portfolio) => {
            const filteredSnap = latestFilteredSnap[portfolio.id];
            const preSnap = prePeriodSnap[portfolio.id];
            // Use filtered snapshot when date range is set, otherwise latest from API
            const snap = dateRange ? filteredSnap : portfolio.latest_snapshot;
            const isSelected = selectedPortfolioId === portfolio.id;

            // Period-aware gain:
            // gain_loss is CUMULATIVE unrealized P&L (= end_value − total invested).
            // So period gain = latest_in_range.gain_loss − last_snap_before_range.gain_loss.
            // This correctly excludes new deposits made during the period.
            let pGainValue: number | null = null;
            let pGainPercent: string | null = null;
            if (snap) {
              if (!dateRange) {
                // All-time: gain_loss is already the total unrealized gain vs total invested
                pGainValue = snap.gain_loss;
                if (snap.invested > 0)
                  pGainPercent = ((snap.gain_loss / snap.invested) * 100).toFixed(1);
              } else {
                // Period gain = how much cumulative P&L changed during the period
                const basePnL = preSnap?.gain_loss ?? 0;
                const baseValue = preSnap?.end_value ?? snap.invested; // starting portfolio value
                pGainValue = snap.gain_loss - basePnL;
                if (baseValue > 0)
                  pGainPercent = ((pGainValue / baseValue) * 100).toFixed(1);
              }
            }

            return (
              <button
                key={portfolio.id}
                onClick={() => handleSelectPortfolio(portfolio.id)}
                className={`text-left p-5 rounded-2xl border transition-all ${isSelected
                  ? 'bg-slate-800 border-blue-500/50 shadow-lg shadow-blue-900/20'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {portfolio.provider}
                  </span>
                  {snap && (
                    <span className="text-xs text-slate-500">{formatDate(snap.report_date)}</span>
                  )}
                </div>
                <div className="text-base font-semibold text-slate-200 mb-3">
                  {portfolio.name}
                </div>
                {snap ? (
                  <>
                    <div className="text-2xl font-bold text-slate-100 mb-1">
                      {formatCurrency(snap.end_value, portfolio.currency)}
                    </div>
                    <div className="flex items-center gap-2">
                      {(pGainValue ?? snap.gain_loss) >= 0 ? (
                        <TrendingUp size={14} className="text-emerald-400" />
                      ) : (
                        <TrendingDown size={14} className="text-rose-400" />
                      )}
                      <span className={`text-sm font-medium ${(pGainValue ?? snap.gain_loss) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {(pGainValue ?? snap.gain_loss) >= 0 ? '+' : ''}{formatCurrency(pGainValue ?? snap.gain_loss, portfolio.currency)}
                        {pGainPercent && ` (${pGainPercent}%)`}
                      </span>
                    </div>
                    {snap.invested > 0 && (
                      <div className="text-xs text-slate-500 mt-1">
                        Invested: {formatCurrency(snap.invested, portfolio.currency)}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-slate-500">No snapshot data</div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Charts Section */}
      {hasChartData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Portfolio Value Over Time */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
            <h4 className="font-bold text-slate-200 mb-4">Portfolio Value</h4>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={valueOverTimeData}>
                  <defs>
                    <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="investedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#64748b" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#64748b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
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
                    formatter={(value, name) => [
                      formatInDC(value as number),
                      name === 'value' ? 'Value' : 'Invested',
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="invested"
                    stroke="#64748b"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    fill="url(#investedGradient)"
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#valueGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-between text-xs mt-3 pt-3 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-blue-500 rounded" />
                <span className="text-slate-500">Current Value</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-slate-500 rounded border-dashed" style={{ borderTop: '1px dashed #64748b' }} />
                <span className="text-slate-500">Invested</span>
              </div>
            </div>
          </div>

          {/* Gain/Loss Per Period */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
            <h4 className="font-bold text-slate-200 mb-4">Gain / Loss by Period</h4>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gainLossData}>
                  <XAxis
                    dataKey="label"
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
                    formatter={(value) => [
                      formatInDC(value as number),
                      'Gain/Loss',
                    ]}
                  />
                  <Bar dataKey="gain" radius={[4, 4, 4, 4]}>
                    {gainLossData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.gain >= 0 ? '#10b981' : '#ef4444'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Allocation Charts */}
      {(holdingsAllocation.length > 1 || categoryAllocation.length > 1) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Holdings Allocation */}
          {holdingsAllocation.length > 1 && (
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
              <h4 className="font-bold text-slate-200 mb-1">Holdings Allocation</h4>
              <p className="text-xs text-slate-500 mb-4">Values converted to {dc}</p>
              <div className="flex items-center gap-4">
                <div className="w-40 h-40 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={holdingsAllocation}
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={60}
                        paddingAngle={2}
                        dataKey="valueCZK"
                      >
                        {holdingsAllocation.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                        }}
                        formatter={(value, _name, props) => {
                          const entry = props.payload;
                          const original = entry.currency !== dc
                            ? ` (${fmt(entry.originalValue, entry.currency)})`
                            : '';
                          return [`${formatInDC(value as number)}${original}`, 'Value'];
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1 max-h-48 overflow-y-auto">
                  {holdingsAllocation.map((h, i) => {
                    const total = holdingsAllocation.reduce((s, x) => s + x.valueCZK, 0);
                    const pct = total > 0 ? ((h.valueCZK / total) * 100).toFixed(0) : '0';
                    return (
                      <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        />
                        <span className="text-sm text-slate-300 truncate flex-1">
                          {h.name}
                          {h.currency !== dc && (
                            <span className="text-xs text-slate-500 ml-1">({h.currency})</span>
                          )}
                        </span>
                        <span className="text-xs text-slate-500 shrink-0">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Category Allocation */}
          {categoryAllocation.length > 1 && (
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
              <h4 className="font-bold text-slate-200 mb-1">By Fund Category</h4>
              <p className="text-xs text-slate-500 mb-4">Values converted to {dc}</p>
              <div className="flex items-center gap-4">
                <div className="w-40 h-40 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryAllocation}
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={60}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {categoryAllocation.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                        }}
                        formatter={(value) => [formatInDC(value as number), `Value (${dc})`]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1">
                  {categoryAllocation.map((c, i) => {
                    const total = categoryAllocation.reduce((s, x) => s + x.value, 0);
                    const pct = total > 0 ? ((c.value / total) * 100).toFixed(0) : '0';
                    return (
                      <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: COLORS[(i + 3) % COLORS.length] }}
                        />
                        <span className="text-sm text-slate-300 truncate flex-1">{c.name}</span>
                        <span className="text-xs text-slate-500 shrink-0">{pct}%</span>
                        <span className="text-sm font-medium text-slate-400 shrink-0">
                          {formatInDC(c.value)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Portfolio Comparison Over Time */}
      {portfolioValueOverTime.data.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Value Over Time per Portfolio */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
            <h4 className="font-bold text-slate-200 mb-1">Portfolio Value Comparison</h4>
            <p className="text-xs text-slate-500 mb-4">Total value over time ({dc})</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={portfolioValueOverTime.data}>
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#e2e8f0' }}
                    formatter={(value, name) => {
                      const pId = (name as string).replace('val_', '');
                      const p = portfolioValueOverTime.names.find(n => n.id === pId);
                      return [formatInDC(value as number), p?.name || name];
                    }}
                  />
                  <Legend
                    formatter={(value) => {
                      const pId = value.replace('val_', '');
                      const p = portfolioValueOverTime.names.find(n => n.id === pId);
                      return <span className="text-xs text-slate-400">{p?.name || value}</span>;
                    }}
                  />
                  {portfolioValueOverTime.names.map(({ id }, i) => (
                    <Line
                      key={id}
                      type="monotone"
                      dataKey={`val_${id}`}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3, fill: COLORS[i % COLORS.length] }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gain % Over Time per Portfolio */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
            <h4 className="font-bold text-slate-200 mb-1">Performance Comparison</h4>
            <p className="text-xs text-slate-500 mb-4">Gain / loss % over time</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={portfolioGainOverTime}>
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#e2e8f0' }}
                    formatter={(value, name) => {
                      const pId = (name as string).replace('pct_', '');
                      const p = portfolioValueOverTime.names.find(n => n.id === pId);
                      return [`${value}%`, p?.name || name];
                    }}
                  />
                  <Legend
                    formatter={(value) => {
                      const pId = value.replace('pct_', '');
                      const p = portfolioValueOverTime.names.find(n => n.id === pId);
                      return <span className="text-xs text-slate-400">{p?.name || value}</span>;
                    }}
                  />
                  {portfolioValueOverTime.names.map(({ id }, i) => (
                    <Line
                      key={id}
                      type="monotone"
                      dataKey={`pct_${id}`}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3, fill: COLORS[i % COLORS.length] }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Snapshot History */}
      {selectedPortfolioId && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h4 className="font-semibold text-slate-200">Snapshot History</h4>
          </div>

          {loadingSnapshots ? (
            <div className="p-8 text-center text-slate-500">Loading snapshots...</div>
          ) : (() => {
            const selectedPortfolio = portfolios.find(p => p.id === selectedPortfolioId);
            const portfolioCurrency = selectedPortfolio?.currency || 'CZK';
            const displaySnapshots = dateRange
              ? snapshots.filter(s => {
                const d = (s.report_date || s.period_end || '').split('T')[0];
                return d >= dateRange.start && d <= dateRange.end;
              })
              : snapshots;
            return displaySnapshots.length === 0 ? (
              <div className="p-8 text-center text-slate-500">No snapshots in selected period</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 uppercase border-b border-slate-800">
                      <th className="px-5 py-3 w-8"></th>
                      <th className="px-5 py-3">Period</th>
                      <th className="px-5 py-3 text-right">End Value</th>
                      <th className="px-5 py-3 text-right">Invested</th>
                      <th className="px-5 py-3 text-right">Gain/Loss</th>
                      <th className="px-5 py-3 text-right">Fees</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displaySnapshots.map((snap) => {
                      const hasHoldings = snap.holdings && snap.holdings.length > 0;
                      const isExpanded = expandedSnapshotId === snap.id;

                      return (
                        <tr key={snap.id} className="contents">
                          <tr
                            className={`border-b border-slate-800/50 ${hasHoldings ? 'cursor-pointer hover:bg-slate-800/30' : ''}`}
                            onClick={() => hasHoldings && setExpandedSnapshotId(isExpanded ? null : snap.id)}
                          >
                            <td className="px-5 py-3 text-slate-500">
                              {hasHoldings && (
                                isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                              )}
                            </td>
                            <td className="px-5 py-3 text-slate-300">
                              {formatDate(snap.period_start)} – {formatDate(snap.period_end)}
                            </td>
                            <td className="px-5 py-3 text-right font-medium text-slate-200">
                              {formatCurrency(snap.end_value, portfolioCurrency)}
                            </td>
                            <td className="px-5 py-3 text-right text-slate-400">
                              {snap.invested > 0 ? formatCurrency(snap.invested, portfolioCurrency) : '–'}
                            </td>
                            <td className={`px-5 py-3 text-right font-medium ${snap.gain_loss >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {snap.gain_loss >= 0 ? '+' : ''}{formatCurrency(snap.gain_loss, portfolioCurrency)}
                            </td>
                            <td className="px-5 py-3 text-right text-slate-500">
                              {snap.fees > 0 ? formatCurrency(snap.fees, portfolioCurrency) : '–'}
                            </td>
                          </tr>
                          {isExpanded && snap.holdings && (
                            <tr>
                              <td colSpan={6} className="px-5 py-3 bg-slate-800/20">
                                <div className="space-y-2">
                                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Holdings ({snap.holdings.length})
                                  </div>
                                  {snap.holdings.map((h, i) => (
                                    <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-800/50 last:border-0">
                                      <div className="flex-1 min-w-0">
                                        <div className="text-slate-300 truncate">{h.name}</div>
                                        <div className="text-xs text-slate-500">
                                          {h.isin && <span className="mr-3">{h.isin}</span>}
                                          {h.category && <span>{h.category}</span>}
                                        </div>
                                      </div>
                                      <div className="text-right shrink-0 ml-4">
                                        <div className="text-slate-200 font-medium">
                                          {formatCurrency(h.total_value, h.value_currency)}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                          {h.units.toFixed(4)} x {formatCurrency(h.price_per_unit, h.price_currency)}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
