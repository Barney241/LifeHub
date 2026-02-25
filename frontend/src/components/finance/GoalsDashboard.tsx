'use client';

import { useState, useMemo } from 'react';
import {
    Target,
    Plus,
    TrendingUp,
    Calendar,
    MoreVertical,
    CheckCircle2,
    AlertCircle,
    PiggyBank,
    ArrowRight,
    Shield,
    Palmtree,
    Laptop,
} from 'lucide-react';
import { Goal, Account } from '@/types';

interface GoalsDashboardProps {
    goals: Goal[];
    accounts: Account[];
    currency: string;
    onCreate: (data: Omit<Goal, 'id'>) => Promise<any>;
    onUpdate: (id: string, updates: Partial<Goal>) => Promise<any>;
    onDelete: (id: string) => Promise<void>;
}

export function GoalsDashboard({
    goals,
    accounts,
    currency,
    onCreate,
    onUpdate,
    onDelete,
}: GoalsDashboardProps) {
    const [showAddForm, setShowAddForm] = useState(false);
    const [contributeGoalId, setContributeGoalId] = useState<string | null>(null);
    const [contributionAmount, setContributionAmount] = useState<number>(0);

    const stats = useMemo(() => {
        const totalTarget = goals.reduce((sum, g) => sum + g.target_amount, 0);
        const totalSaved = goals.reduce((sum, g) => sum + g.current_amount, 0);
        const progress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;
        return { totalTarget, totalSaved, progress };
    }, [goals]);

    const fmt = (amount: number, curr: string = currency) =>
        new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: curr, maximumFractionDigits: 0 }).format(amount);

    const getIcon = (iconName?: string) => {
        switch (iconName) {
            case 'shield': return <Shield size={20} />;
            case 'palmtree': return <Palmtree size={20} />;
            case 'laptop': return <Laptop size={20} />;
            default: return <Target size={20} />;
        }
    };

    const handleContribute = async () => {
        if (!contributeGoalId || contributionAmount <= 0) return;
        const goal = goals.find(g => g.id === contributeGoalId);
        if (!goal) return;

        try {
            await onUpdate(contributeGoalId, {
                current_amount: goal.current_amount + contributionAmount
            });
            setContributeGoalId(null);
            setContributionAmount(0);
        } catch (err) {
            console.error('Failed to contribute:', err);
        }
    };

    return (
        <div className="space-y-6">
            {/* Overview Stats */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex-1">
                        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 mb-1">
                            <PiggyBank className="text-emerald-400" /> Savings Goals
                        </h2>
                        <p className="text-sm text-slate-500">Track your progress towards specific financial targets</p>

                        <div className="mt-4 flex items-center gap-4">
                            <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-emerald-500 transition-all duration-1000 ease-out"
                                    style={{ width: `${stats.progress}%` }}
                                />
                            </div>
                            <span className="text-sm font-bold text-emerald-400">{stats.progress.toFixed(0)}%</span>
                        </div>
                        <div className="flex items-center gap-4 mt-2">
                            <span className="text-xs text-slate-500">Total Saved: <span className="text-slate-300 font-bold">{fmt(stats.totalSaved)}</span></span>
                            <span className="text-xs text-slate-500">Target: <span className="text-slate-300 font-bold">{fmt(stats.totalTarget)}</span></span>
                        </div>
                    </div>

                    <button
                        onClick={() => setShowAddForm(true)}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20"
                    >
                        <Plus size={18} /> New Goal
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {goals.map((goal) => {
                    const progress = (goal.current_amount / goal.target_amount) * 100;
                    return (
                        <div key={goal.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 group hover:border-slate-700 transition-all">
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-3 rounded-2xl" style={{ backgroundColor: `${goal.color}20`, color: goal.color }}>
                                    {getIcon(goal.icon)}
                                </div>
                                <button className="text-slate-600 hover:text-slate-300 p-1">
                                    <MoreVertical size={16} />
                                </button>
                            </div>

                            <h3 className="font-bold text-slate-100 text-lg mb-1">{goal.name}</h3>
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-xs text-slate-500">{fmt(goal.current_amount)} of {fmt(goal.target_amount)}</span>
                                <span className="text-xs font-black" style={{ color: goal.color }}>{progress.toFixed(0)}%</span>
                            </div>

                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-6">
                                <div
                                    className="h-full rounded-full transition-all duration-700"
                                    style={{ width: `${progress}%`, backgroundColor: goal.color }}
                                />
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-slate-800/50">
                                <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase font-bold">
                                    <Calendar size={12} /> {goal.target_date ? new Date(goal.target_date).toLocaleDateString() : 'No deadline'}
                                </div>
                                <button
                                    onClick={() => setContributeGoalId(goal.id)}
                                    className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                >
                                    Contribute <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Contribution Modal */}
            {contributeGoalId && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-[110]">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-8 shadow-2xl">
                        <h3 className="text-xl font-bold text-slate-100 mb-2">Contribute</h3>
                        <p className="text-sm text-slate-500 mb-8">Add money from your accounts to this goal.</p>

                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block tracking-wider">Amount</label>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-500">{currency}</div>
                                    <input
                                        type="number"
                                        value={contributionAmount}
                                        onChange={(e) => setContributionAmount(Number(e.target.value))}
                                        className="w-full bg-slate-800 border-none rounded-2xl pl-12 pr-4 py-4 text-xl font-bold text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => setContributeGoalId(null)}
                                    className="flex-1 px-4 py-4 rounded-2xl border border-slate-700 text-slate-400 font-bold hover:bg-slate-800 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleContribute}
                                    className="flex-1 px-4 py-4 rounded-2xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20"
                                >
                                    Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
