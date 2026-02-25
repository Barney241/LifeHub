'use client';

import { useState, useMemo } from 'react';
import {
    Repeat,
    Calendar,
    CreditCard,
    Plus,
    Trash2,
    AlertCircle,
    CheckCircle2,
    Clock,
    ArrowRight,
    Filter,
    Search,
    Zap,
    DollarSign,
    TrendingUp,
    X,
} from 'lucide-react';
import { RecurringPayment, Merchant, Account } from '@/types';

interface RecurringDashboardProps {
    recurringPayments: RecurringPayment[];
    merchants: Merchant[];
    accounts: Account[];
    currency: string;
    onCreate: (data: any) => Promise<any>;
    onUpdate: (id: string, updates: any) => Promise<any>;
    onDelete: (id: string) => Promise<void>;
    onDetect: () => Promise<any[]>;
}

export function RecurringDashboard({
    recurringPayments,
    merchants,
    accounts,
    currency,
    onCreate,
    onUpdate,
    onDelete,
    onDetect,
}: RecurringDashboardProps) {
    const [showAddModal, setShowAddModal] = useState(false);
    const [isDetecting, setIsDetecting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredPayments = useMemo(() => {
        return recurringPayments.filter(p =>
            p.merchant_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.notes?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [recurringPayments, searchQuery]);

    const stats = useMemo(() => {
        const active = recurringPayments.filter(p => p.status === 'active');
        const monthlyTotal = active.reduce((sum, p) => {
            let amount = p.expected_amount;
            if (p.frequency === 'weekly') amount *= 4.33;
            if (p.frequency === 'biweekly') amount *= 2.16;
            if (p.frequency === 'yearly') amount /= 12;
            return sum + amount;
        }, 0);

        const upcomingCount = active.filter(p => {
            if (!p.next_due) return false;
            const due = new Date(p.next_due);
            const now = new Date();
            const diff = due.getTime() - now.getTime();
            return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000; // Next 7 days
        }).length;

        return { monthlyTotal, upcomingCount, totalActive: active.length };
    }, [recurringPayments]);

    const fmt = (amount: number, curr: string = currency) =>
        new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: curr, maximumFractionDigits: 0 }).format(amount);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                        <Repeat className="text-orange-400" /> Subscriptions & Recurring
                    </h2>
                    <p className="text-sm text-slate-500">Track and manage your regular monthly bills and overhead</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={async () => {
                            setIsDetecting(true);
                            const detected = await onDetect();
                            setIsDetecting(false);
                            if (detected.length > 0) {
                                alert(`Detected ${detected.length} potential recurring payments! Check the results.`);
                                // In a real app, show a list of detected items to confirm
                            } else {
                                alert('No new recurring patterns detected in recent transactions.');
                            }
                        }}
                        disabled={isDetecting}
                        className="px-4 py-2 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20 text-sm font-bold hover:bg-orange-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        <Zap size={16} className={isDetecting ? 'animate-pulse' : ''} />
                        {isDetecting ? 'Analyzing...' : 'Auto-Detect'}
                    </button>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
                    >
                        <Plus size={16} /> Add Bill
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-orange-900/20 rounded-lg">
                            <TrendingUp size={18} className="text-orange-400" />
                        </div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Monthly Overhead</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-100">{fmt(stats.monthlyTotal)}</div>
                    <div className="text-xs text-slate-500 mt-1">Total projected recurring costs</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-900/20 rounded-lg">
                            <CreditCard size={18} className="text-blue-400" />
                        </div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Subscriptions</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-100">{stats.totalActive}</div>
                    <div className="text-xs text-slate-500 mt-1">Regularly billed services</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-emerald-900/20 rounded-lg">
                            <Calendar size={18} className="text-emerald-400" />
                        </div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Due This Week</span>
                    </div>
                    <div className="text-2xl font-bold text-emerald-400">{stats.upcomingCount}</div>
                    <div className="text-xs text-slate-500 mt-1">Payments scheduled soon</div>
                </div>
            </div>

            {/* Search & Filters */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                    <input
                        type="text"
                        placeholder="Search subscriptions or notes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-800 border-none rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-orange-500 transition-all outline-none"
                    />
                </div>
                <button className="p-2 text-slate-400 hover:text-slate-100">
                    <Filter size={20} />
                </button>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredPayments.map((p) => (
                    <RecurringCard
                        key={p.id}
                        payment={p}
                        fmt={fmt}
                        onToggleStatus={() => onUpdate(p.id, { status: p.status === 'active' ? 'paused' : 'active' })}
                        onDelete={() => {
                            if (confirm('Delete this recurring payment?')) onDelete(p.id);
                        }}
                    />
                ))}

                {filteredPayments.length === 0 && (
                    <div className="col-span-full py-12 text-center bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl">
                        <p className="text-slate-500 text-sm">No subscriptions found matching your search.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function RecurringCard({ payment, fmt, onToggleStatus, onDelete }: {
    payment: RecurringPayment;
    fmt: (n: number) => string;
    onToggleStatus: () => void;
    onDelete: () => void;
}) {
    const daysUntil = useMemo(() => {
        if (!payment.next_due) return null;
        const due = new Date(payment.next_due);
        const now = new Date();
        const diff = due.getTime() - now.getTime();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }, [payment.next_due]);

    const isActive = payment.status === 'active';

    return (
        <div className={`bg-slate-900 border ${isActive ? 'border-slate-800' : 'border-slate-800/50 opacity-60'} rounded-2xl p-5 hover:border-slate-700 transition-all group relative overflow-hidden`}>
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${isActive ? 'bg-orange-500/10 text-orange-400' : 'bg-slate-800 text-slate-600'}`}>
                        <Repeat size={24} />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-100 group-hover:text-orange-400 transition-colors uppercase tracking-tight">
                            {payment.merchant_name}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-500 font-medium capitalize">{payment.frequency}</span>
                            <span className="w-1 h-1 bg-slate-700 rounded-full" />
                            <span className="text-[10px] font-bold text-slate-600 uppercase">{payment.account_name || 'No account linked'}</span>
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-lg font-bold text-slate-100">{fmt(payment.expected_amount)}</div>
                    {isActive && daysUntil !== null && (
                        <div className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${daysUntil <= 3 ? 'text-rose-400' : 'text-slate-500'}`}>
                            {daysUntil === 0 ? 'Due Today' : daysUntil < 0 ? 'Overdue' : `Due in ${daysUntil} days`}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800/50">
                <div className="flex items-center gap-1">
                    {payment.last_paid && (
                        <div className="text-[10px] text-slate-600 flex items-center gap-1.5">
                            <Clock size={12} /> Last paid: {new Date(payment.last_paid).toLocaleDateString()}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onToggleStatus}
                        className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg border transition-all ${isActive
                                ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                            }`}
                    >
                        {isActive ? 'Pause' : 'Resume'}
                    </button>
                    <button
                        onClick={onDelete}
                        className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-all"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}
