'use client';

import { useMemo } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
} from 'recharts';
import {
    Wallet,
    TrendingUp,
    TrendingDown,
    Info,
    DollarSign,
    Briefcase,
    Landmark,
    PieChart as PieChartIcon,
} from 'lucide-react';
import { Account, InvestmentPortfolio, Loan, NetWorthSnapshot, ExchangeRate } from '@/types';

interface NetWorthDashboardProps {
    accounts: Account[];
    portfolios: InvestmentPortfolio[];
    loans: Loan[];
    history: NetWorthSnapshot[];
    exchangeRates: ExchangeRate[];
    baseCurrency: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function NetWorthDashboard({
    accounts,
    portfolios,
    loans,
    history,
    exchangeRates,
    baseCurrency,
}: NetWorthDashboardProps) {

    const fmt = (amount: number) =>
        new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: baseCurrency, maximumFractionDigits: 0 }).format(amount);

    const convertAmount = (amount: number, from: string) => {
        if (from === baseCurrency) return amount;
        const rate = exchangeRates.find(r => r.base_currency === from && r.target_currency === baseCurrency);
        if (rate) return amount * rate.rate;
        // Fallback search inverse
        const invRate = exchangeRates.find(r => r.base_currency === baseCurrency && r.target_currency === from);
        if (invRate) return amount / invRate.rate;
        return amount; // Fallback
    };

    const totals = useMemo(() => {
        const cash = accounts.reduce((sum, a) => sum + convertAmount(a.current_balance, a.currency), 0);
        const investments = portfolios.reduce((sum, p) => sum + convertAmount(p.latest_snapshot?.end_value || 0, p.currency), 0);
        const debt = loans.reduce((sum, l) => sum + convertAmount(l.current_balance, l.currency), 0);

        return {
            cash,
            investments,
            debt,
            totalAssets: cash + investments,
            netWorth: cash + investments - debt
        };
    }, [accounts, portfolios, loans, exchangeRates, baseCurrency]);

    const allocationData = [
        { name: 'Cash', value: totals.cash, color: '#3b82f6' },
        { name: 'Investments', value: totals.investments, color: '#10b981' },
        { name: 'Debt (Liabilities)', value: totals.debt, color: '#ef4444' },
    ].filter(d => d.value > 0);

    const chartData = useMemo(() => {
        return history.map(h => ({
            date: new Date(h.date).toLocaleDateString('cs-CZ', { month: 'short', year: '2-digit' }),
            netWorth: Math.round(h.net_worth / 1000), // showing in k for better chart readability if needed? no, full scale is better
            assets: h.total_assets,
            liabilities: h.total_liabilities,
            nw: h.net_worth
        }));
    }, [history]);

    return (
        <div className="space-y-6">
            {/* Main Net Worth Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full -mr-32 -mt-32 blur-3xl" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Total Net Worth</span>
                        <div className="text-5xl font-black text-slate-100 tracking-tight">{fmt(totals.netWorth)}</div>
                        <div className="flex items-center gap-3 mt-4">
                            <div className="flex items-center gap-1 text-emerald-400 text-sm font-bold bg-emerald-400/10 px-2 py-1 rounded-lg">
                                <TrendingUp size={14} /> +4.2%
                            </div>
                            <span className="text-xs text-slate-500 italic">vs last month</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Total Assets</span>
                            <span className="text-xl font-bold text-emerald-400">{fmt(totals.totalAssets)}</span>
                        </div>
                        <div className="w-px h-12 bg-slate-800" />
                        <div className="text-right">
                            <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Total Liabilities</span>
                            <span className="text-xl font-bold text-rose-400">{fmt(totals.debt)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Trend Chart */}
                <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-slate-200 flex items-center gap-2">
                            <TrendingUp size={18} className="text-blue-400" /> Net Worth History
                        </h3>
                        <div className="flex gap-2">
                            {['6M', '1Y', 'ALL'].map(p => (
                                <button key={p} className={`text-[10px] font-bold px-2 py-1 rounded-md ${p === '6M' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}>{p}</button>
                            ))}
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorNW" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    stroke="#475569"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#475569"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(val) => `${(val / 1000000).toFixed(1)}M`}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                                    labelStyle={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}
                                />
                                <Area type="monotone" dataKey="nw" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorNW)" name="Net Worth" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Allocation */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
                    <h3 className="font-bold text-slate-200 flex items-center gap-2 mb-6">
                        <PieChartIcon size={18} className="text-purple-400" /> Asset Allocation
                    </h3>
                    <div className="h-[200px] w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={allocationData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {allocationData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: any) => typeof value === 'number' ? fmt(value) : value}
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center">
                                <div className="text-[10px] font-bold text-slate-500 uppercase">Ratio</div>
                                <div className="text-lg font-bold text-slate-200">
                                    {((totals.totalAssets / (totals.debt || 1)) * 10).toFixed(1)}x
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-3 mt-6">
                        {allocationData.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                    <span className="text-xs text-slate-400 font-medium">{item.name}</span>
                                </div>
                                <span className="text-xs font-bold text-slate-200">{((item.value / (totals.totalAssets + totals.debt)) * 100).toFixed(0)}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Breakdown Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <BreakdownItem title="Liquid Cash" value={fmt(totals.cash)} icon={<Wallet className="text-blue-400" />} />
                <BreakdownItem title="Investments" value={fmt(totals.investments)} icon={<Briefcase className="text-emerald-400" />} />
                <BreakdownItem title="Loans & Debt" value={fmt(totals.debt)} icon={<Landmark className="text-rose-400" />} color="text-rose-400" />
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center gap-4">
                    <div className="p-3 bg-purple-900/20 rounded-xl">
                        <DollarSign className="text-purple-400" />
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Currencies</span>
                        <div className="flex gap-2 mt-1">
                            {['CZK', 'EUR', 'USD'].map(c => (
                                <span key={c} className="px-1.5 py-0.5 bg-slate-800 text-slate-400 text-[9px] font-bold rounded uppercase">{c}</span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function BreakdownItem({ title, value, icon, color = 'text-slate-100' }: { title: string, value: string, icon: React.ReactNode, color?: string }) {
    return (
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center gap-4">
            <div className="p-3 bg-slate-800/40 rounded-xl">
                {icon}
            </div>
            <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">{title}</span>
                <span className={`text-sm font-bold ${color}`}>{value}</span>
            </div>
        </div>
    );
}
