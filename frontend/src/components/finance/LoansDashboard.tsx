'use client';

import { useState, useMemo } from 'react';
import {
    Landmark,
    Plus,
    Trash2,
    ChevronRight,
    ChevronLeft,
    Calendar,
    DollarSign,
    TrendingDown,
    ArrowUpRight,
    ArrowDownRight,
    Info,
    CheckCircle2,
    AlertTriangle,
    Clock,
    ExternalLink,
    X,
    Settings,
} from 'lucide-react';
import { Loan, FinancialRecord } from '@/types';

interface LoansDashboardProps {
    loans: Loan[];
    transactions: FinancialRecord[];
    currency: string;
    onCreateLoan: (loan: Omit<Loan, 'id'>) => Promise<any>;
    onUpdateLoan: (id: string, updates: Partial<Loan>) => Promise<any>;
    onDeleteLoan: (id: string) => Promise<void>;
}

const COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16',
];

const fmt = (amount: number, currency: string) =>
    new Intl.NumberFormat('cs-CZ', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);

export function LoansDashboard({
    loans,
    transactions,
    currency,
    onCreateLoan,
    onUpdateLoan,
    onDeleteLoan,
}: LoansDashboardProps) {
    const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingLoan, setEditingLoan] = useState<Loan | null>(null);

    const selectedLoan = useMemo(() => loans.find(l => l.id === selectedLoanId), [loans, selectedLoanId]);

    // Summary stats
    const stats = useMemo(() => {
        const iOweFiltered = loans.filter(l => ['mortgage', 'personal', 'car', 'student', 'borrowed_from'].includes(l.loan_type));
        const theyOweMeFiltered = loans.filter(l => l.loan_type === 'lent_to');

        const totalOwed = iOweFiltered.reduce((sum, l) => sum + l.current_balance, 0);
        const totalOwedToMe = theyOweMeFiltered.reduce((sum, l) => sum + l.current_balance, 0);
        const monthlyInstalments = iOweFiltered.reduce((sum, l) => sum + l.monthly_payment, 0);

        return { totalOwed, totalOwedToMe, monthlyInstalments };
    }, [loans]);

    if (selectedLoan) {
        return (
            <LoanDetail
                loan={selectedLoan}
                transactions={transactions}
                currency={currency}
                onBack={() => setSelectedLoanId(null)}
                onUpdate={onUpdateLoan}
                onDelete={onDeleteLoan}
            />
        );
    }

    return (
        <div className="space-y-6">
            {/* Header & Add Button */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                    <Landmark className="text-blue-400" /> Loans & Debts
                </h2>
                <button
                    onClick={() => setShowAddForm(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
                >
                    <Plus size={16} /> Add Loan
                </button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-rose-900/20 rounded-lg">
                            <TrendingDown size={18} className="text-rose-400" />
                        </div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total I Owe</span>
                    </div>
                    <div className="text-2xl font-bold text-rose-400">{fmt(stats.totalOwed, currency)}</div>
                    <div className="text-xs text-slate-500 mt-1">Across {loans.filter(l => l.loan_type !== 'lent_to').length} liabilities</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-emerald-900/20 rounded-lg">
                            <ArrowUpRight size={18} className="text-emerald-400" />
                        </div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Owed To Me</span>
                    </div>
                    <div className="text-2xl font-bold text-emerald-400">{fmt(stats.totalOwedToMe, currency)}</div>
                    <div className="text-xs text-slate-500 mt-1">Lent to colleagues/friends</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-900/20 rounded-lg">
                            <Calendar size={18} className="text-blue-400" />
                        </div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Monthly Commitment</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-400">{fmt(stats.monthlyInstalments, currency)}</div>
                    <div className="text-xs text-slate-500 mt-1">Regular monthly repayments</div>
                </div>
            </div>

            {loans.length === 0 ? (
                <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl p-12 text-center">
                    <div className="p-4 bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Landmark className="text-slate-600" size={32} />
                    </div>
                    <h3 className="text-slate-300 font-bold mb-1">No loans found</h3>
                    <p className="text-slate-500 text-sm mb-6 max-w-xs mx-auto">
                        Add your mortgage, personal loans, or money you lent to someone to track them here.
                    </p>
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="text-blue-400 hover:text-blue-300 font-bold text-sm"
                    >
                        + Create your first loan record
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loans.map((loan, idx) => (
                        <LoanCard
                            key={loan.id}
                            loan={loan}
                            currency={currency}
                            onClick={() => setSelectedLoanId(loan.id)}
                            color={COLORS[idx % COLORS.length]}
                        />
                    ))}
                </div>
            )}

            {(showAddForm || editingLoan) && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                        <LoanForm
                            loan={editingLoan || undefined}
                            currency={currency}
                            onSubmit={async (data) => {
                                if (editingLoan) {
                                    await onUpdateLoan(editingLoan.id, data);
                                } else {
                                    await onCreateLoan(data);
                                }
                                setShowAddForm(false);
                                setEditingLoan(null);
                            }}
                            onCancel={() => {
                                setShowAddForm(false);
                                setEditingLoan(null);
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

function LoanCard({ loan, currency, onClick, color }: { loan: Loan; currency: string; onClick: () => void; color: string }) {
    const progress = Math.min(100, Math.max(0, ((loan.principal - loan.current_balance) / loan.principal) * 100));

    return (
        <div
            onClick={onClick}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all cursor-pointer group shadow-sm overflow-hidden relative"
        >
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight size={16} className="text-slate-500" />
            </div>

            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-slate-800">
                    <Landmark size={20} style={{ color }} />
                </div>
                <div className="min-w-0">
                    <h4 className="font-bold text-slate-200 truncate">{loan.name}</h4>
                    <p className="text-xs text-slate-500 truncate">{loan.counterparty || 'No counterparty'}</p>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-end justify-between">
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Remaining</p>
                        <p className="text-lg font-bold text-slate-100">{fmt(loan.current_balance, loan.currency)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Principal</p>
                        <p className="text-sm font-medium text-slate-400">{fmt(loan.principal, loan.currency)}</p>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                        <span className="text-slate-500">Progress</span>
                        <span className="text-slate-300">{progress.toFixed(0)}% Paid</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${progress}%`, backgroundColor: color }}
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/50">
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-slate-600 uppercase">Rate</span>
                            <span className="text-xs font-semibold text-slate-400">{loan.interest_rate > 0 ? `${loan.interest_rate}%` : 'Interest-free'}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-slate-600 uppercase">Pay</span>
                            <span className="text-xs font-semibold text-slate-400">{fmt(loan.monthly_payment, loan.currency)}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${loan.loan_type === 'lent_to' ? 'bg-emerald-900/30 text-emerald-500' : 'bg-rose-900/30 text-rose-500'
                            }`}>
                            {loan.loan_type.replace('_', ' ')}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function LoanDetail({
    loan,
    transactions,
    currency,
    onBack,
    onUpdate,
    onDelete,
}: {
    loan: Loan;
    transactions: FinancialRecord[];
    currency: string;
    onBack: () => void;
    onUpdate: (id: string, updates: Partial<Loan>) => Promise<any>;
    onDelete: (id: string) => Promise<void>;
}) {
    const [showEditForm, setShowEditForm] = useState(false);
    const [showPaymentDialog, setShowPaymentDialog] = useState(false);

    const matchedTransactions = useMemo(() => {
        if (!loan.match_pattern) return [];
        return transactions.filter(tx => {
            const field = loan.match_field === 'merchant' ? (tx.merchant_name || '') : (tx.description || '');
            const pattern = loan.match_pattern!.toLowerCase();
            const value = field.toLowerCase();

            if (loan.match_pattern_type === 'contains') return value.includes(pattern);
            if (loan.match_pattern_type === 'exact') return value === pattern;
            if (loan.match_pattern_type === 'starts_with') return value.startsWith(pattern);
            return false;
        });
    }, [loan, transactions]);

    const stats = useMemo(() => {
        const principalPaid = loan.principal - loan.current_balance;

        // Amortization (Full)
        const r = (loan.interest_rate / 100) / 12;
        let balance = loan.principal;
        let totalInterestProjected = 0;
        let interestPaidEst = 0;

        // Estimate how many months passed since start_date
        const startDate = loan.start_date ? new Date(loan.start_date) : new Date();
        const now = new Date();
        const monthsPassed = Math.max(0, (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth()));

        for (let i = 0; i < 600; i++) { // Max 50 years
            if (balance <= 0) break;
            const interest = balance * r;
            const principal = Math.min(balance, loan.monthly_payment - interest);

            if (i < monthsPassed) {
                interestPaidEst += interest;
            }
            totalInterestProjected += interest;
            balance -= principal;
        }

        return {
            principalPaid,
            interestPaidEst,
            totalInterestProjected,
        };
    }, [loan]);

    // Projected amortization (Remaining only)
    const amortization = useMemo(() => {
        if (loan.interest_rate === 0) {
            const remainingMonths = Math.ceil(loan.current_balance / (loan.monthly_payment || 1));
            return Array.from({ length: Math.min(remainingMonths, 60) }, (_, i) => ({
                index: i + 1,
                date: new Date(new Date().setMonth(new Date().getMonth() + i + 1)).toISOString(),
                payment: loan.monthly_payment,
                principal: Math.min(loan.monthly_payment, loan.current_balance - (i * loan.monthly_payment)),
                interest: 0,
                balance: Math.max(0, loan.current_balance - ((i + 1) * loan.monthly_payment)),
            }));
        }

        const r = (loan.interest_rate / 100) / 12;
        let balance = loan.current_balance;
        const schedule = [];
        for (let i = 0; i < 60; i++) {
            if (balance <= 0) break;
            const interest = balance * r;
            const principal = Math.min(balance, loan.monthly_payment - interest);
            balance -= principal;
            schedule.push({
                index: i + 1,
                date: new Date(new Date().setMonth(new Date().getMonth() + i + 1)).toISOString(),
                payment: loan.monthly_payment,
                principal,
                interest,
                balance,
            });
        }
        return schedule;
    }, [loan]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <button
                onClick={onBack}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-300 transition-colors text-sm font-medium mb-2"
            >
                <ChevronLeft size={16} /> Back to list
            </button>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-900/20 rounded-2xl">
                        <Landmark size={32} className="text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-100">{loan.name}</h2>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="text-sm text-slate-500">{loan.counterparty}</span>
                            <span className="w-1 h-1 bg-slate-700 rounded-full" />
                            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                {loan.loan_type.replace('_', ' ')}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowPaymentDialog(true)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2"
                    >
                        <Plus size={16} /> Log Payment
                    </button>
                    <button
                        onClick={() => setShowEditForm(true)}
                        className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-sm font-bold hover:bg-slate-700 transition-colors"
                    >
                        Edit Loan
                    </button>
                    <button
                        onClick={() => {
                            if (confirm('Are you sure you want to delete this loan?')) {
                                onDelete(loan.id);
                                onBack();
                            }
                        }}
                        className="p-2.5 rounded-xl bg-rose-900/20 border border-rose-900/30 text-rose-400 hover:bg-rose-900/40 transition-colors"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <DetailStat label="Principal" value={fmt(loan.principal, loan.currency)} />
                <DetailStat label="Principal Paid" value={fmt(stats.principalPaid, loan.currency)} color="text-emerald-400" />
                <DetailStat label="Current Balance" value={fmt(loan.current_balance, loan.currency)} color="text-blue-400" />
                <DetailStat label="Monthly Pay" value={fmt(loan.monthly_payment, loan.currency)} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <DetailStat label="Interest Rate" value={loan.interest_rate > 0 ? `${loan.interest_rate}%` : 'None'} />
                <DetailStat label="Interest Paid (Est.)" value={fmt(stats.interestPaidEst, loan.currency)} color="text-rose-400/80" />
                <DetailStat label="Total Interest (Projected)" value={fmt(stats.totalInterestProjected, loan.currency)} color="text-rose-400" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Amortization Projection */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Calendar size={18} className="text-blue-400" />
                                <h3 className="font-bold text-slate-200">Projected Schedule</h3>
                                <div className="group relative">
                                    <Info size={14} className="text-slate-600 cursor-help" />
                                    <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-slate-800 text-[11px] text-slate-300 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none border border-slate-700">
                                        Standard annuity calculation. Updating the interest rate or current balance will automatically recalculate the remaining projection.
                                    </div>
                                </div>
                            </div>
                            <span className="text-xs text-slate-500">Next 5 years</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-800/50 text-[10px] uppercase tracking-wider font-bold text-slate-500">
                                    <tr>
                                        <th className="px-5 py-3">No.</th>
                                        <th className="px-5 py-3">Date</th>
                                        <th className="px-5 py-3">Total</th>
                                        <th className="px-5 py-3">Principal</th>
                                        <th className="px-5 py-3">Interest</th>
                                        <th className="px-5 py-3 text-right">Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {amortization.map((row) => (
                                        <tr key={row.index} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="px-5 py-3 text-slate-600 font-medium">{row.index}</td>
                                            <td className="px-5 py-3 text-slate-400 whitespace-nowrap">
                                                {new Date(row.date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                                            </td>
                                            <td className="px-5 py-3 text-slate-300 font-semibold">{fmt(row.payment, loan.currency)}</td>
                                            <td className="px-5 py-3 text-emerald-500/80">{fmt(row.principal, loan.currency)}</td>
                                            <td className="px-5 py-3 text-rose-500/80">{fmt(row.interest, loan.currency)}</td>
                                            <td className="px-5 py-3 text-right text-slate-100 font-bold">{fmt(row.balance, loan.currency)}</td>
                                        </tr>
                                    ))}
                                    {amortization.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-5 py-8 text-center text-slate-600 italic">No projection available</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Matched Payments */}
                <div className="space-y-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                        <div className="p-5 border-b border-slate-800">
                            <h3 className="font-bold text-slate-200 flex items-center gap-2">
                                <DollarSign size={18} className="text-emerald-400" /> Matched Payments
                            </h3>
                        </div>
                        <div className="p-2 space-y-1 max-h-[500px] overflow-y-auto">
                            {matchedTransactions.length > 0 ? (
                                matchedTransactions.map((tx) => (
                                    <div key={tx.id} className="p-3 rounded-xl hover:bg-slate-800/50 transition-colors flex items-center justify-between group">
                                        <div>
                                            <div className="text-xs font-bold text-slate-300 truncate max-w-[140px]">{tx.description}</div>
                                            <div className="text-[10px] text-slate-600 mt-0.5">
                                                {new Date(tx.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-bold text-rose-400">-{fmt(tx.amount, tx.currency || loan.currency)}</div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 text-center text-slate-600 text-sm">
                                    <span className="block mb-2 italic">No transactions matched</span>
                                    <div className="p-3 bg-slate-800/40 rounded-xl text-xs text-left">
                                        <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Rule</div>
                                        <span className="text-slate-400">{loan.match_pattern_type} "{loan.match_pattern}"</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Notes & Details</h4>
                        <p className="text-sm text-slate-400 bg-slate-800/30 p-3 rounded-xl border border-slate-800/50 min-h-[80px]">
                            {loan.notes || "No notes provided for this loan."}
                        </p>
                        <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-600">Start Date</span>
                                <span className="text-slate-400 font-medium">{loan.start_date ? new Date(loan.start_date).toLocaleDateString('en-GB') : 'N/A'}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-600">End Date</span>
                                <span className="text-slate-400 font-medium">{loan.end_date ? new Date(loan.end_date).toLocaleDateString('en-GB') : 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {showEditForm && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                        <LoanForm
                            loan={loan}
                            currency={currency}
                            onSubmit={async (data) => {
                                await onUpdate(loan.id, data);
                                setShowEditForm(false);
                            }}
                            onCancel={() => setShowEditForm(false)}
                        />
                    </div>
                </div>
            )}

            {showPaymentDialog && (
                <PaymentDialog
                    loan={loan}
                    onClose={() => setShowPaymentDialog(false)}
                    onSubmit={async (amount) => {
                        await onUpdate(loan.id, { current_balance: loan.current_balance - amount });
                        setShowPaymentDialog(false);
                    }}
                />
            )}
        </div>
    );
}

function DetailStat({ label, value, color = 'text-slate-100' }: { label: string, value: string, color?: string }) {
    return (
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">{label}</span>
            <span className={`text-xl font-bold ${color}`}>{value}</span>
        </div>
    );
}

// ─── Loan Form Component ──────────────────────────────────────────────────────
function LoanForm({
    loan,
    currency,
    onSubmit,
    onCancel,
}: {
    loan?: Loan;
    currency: string;
    onSubmit: (data: Omit<Loan, 'id'>) => Promise<void>;
    onCancel: () => void;
}) {
    const [formData, setFormData] = useState<Omit<Loan, 'id'>>({
        name: loan?.name || '',
        loan_type: (loan?.loan_type as any) || 'mortgage',
        counterparty: loan?.counterparty || '',
        principal: loan?.principal || 0,
        current_balance: loan?.current_balance || 0,
        interest_rate: loan?.interest_rate || 0,
        monthly_payment: loan?.monthly_payment || 0,
        currency: loan?.currency || currency,
        start_date: loan?.start_date ? loan.start_date.split('T')[0] : '',
        end_date: loan?.end_date ? loan.end_date.split('T')[0] : '',
        match_pattern: loan?.match_pattern || '',
        match_pattern_type: (loan?.match_pattern_type as any) || 'contains',
        match_field: (loan?.match_field as any) || 'description',
        notes: loan?.notes || '',
        is_active: loan?.is_active ?? true,
    });

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-100">{loan ? 'Edit Loan' : 'Add New Loan'}</h3>
                <button onClick={onCancel} className="text-slate-500 hover:text-slate-300 transition-colors">
                    <X size={20} />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <FormInput label="Loan Name" value={formData.name} onChange={(v: string) => setFormData({ ...formData, name: v })} placeholder="e.g. KB Mortgage" />
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Type</label>
                    <select
                        value={formData.loan_type}
                        onChange={e => setFormData({ ...formData, loan_type: e.target.value as any })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 text-sm outline-none focus:border-blue-500 transition-colors"
                    >
                        <option value="mortgage">Mortgage</option>
                        <option value="personal">Personal Loan</option>
                        <option value="car">Car Loan</option>
                        <option value="student">Student Loan</option>
                        <option value="borrowed_from">Borrowed from person</option>
                        <option value="lent_to">Lent to person</option>
                    </select>
                </div>
                <FormInput label="Counterparty" value={formData.counterparty} onChange={(v: string) => setFormData({ ...formData, counterparty: v })} placeholder="Bank or person" />
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Currency</label>
                    <select
                        value={formData.currency}
                        onChange={e => setFormData({ ...formData, currency: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 text-sm outline-none focus:border-blue-500 transition-colors"
                    >
                        <option value="CZK">CZK</option>
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                    </select>
                </div>

                <FormInput label="Principal Amount" type="number" value={formData.principal} onChange={(v: string) => setFormData({ ...formData, principal: Number(v) })} />
                <FormInput label="Current Balance" type="number" value={formData.current_balance} onChange={(v: string) => setFormData({ ...formData, current_balance: Number(v) })} />
                <FormInput label="Interest Rate (%)" type="number" value={formData.interest_rate} onChange={(v: string) => setFormData({ ...formData, interest_rate: Number(v) })} />
                <FormInput label="Monthly Payment" type="number" value={formData.monthly_payment} onChange={(v: string) => setFormData({ ...formData, monthly_payment: Number(v) })} />

                <FormInput label="Start Date" type="date" value={formData.start_date} onChange={(v: string) => setFormData({ ...formData, start_date: v })} />
                <FormInput label="End Date" type="date" value={formData.end_date} onChange={(v: string) => setFormData({ ...formData, end_date: v })} />
            </div>

            <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 mb-6">
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                    <Settings size={14} /> Transaction Matching
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-1">
                        <label className="block text-xs text-slate-500 mb-1">Match Field</label>
                        <select
                            value={formData.match_field}
                            onChange={e => setFormData({ ...formData, match_field: e.target.value as any })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-slate-200 text-xs outline-none focus:border-blue-500"
                        >
                            <option value="description">Description</option>
                            <option value="merchant">Merchant</option>
                        </select>
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-xs text-slate-500 mb-1">Type</label>
                        <select
                            value={formData.match_pattern_type}
                            onChange={e => setFormData({ ...formData, match_pattern_type: e.target.value as any })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-slate-200 text-xs outline-none focus:border-blue-500"
                        >
                            <option value="contains">Contains</option>
                            <option value="exact">Exact</option>
                            <option value="starts_with">Starts With</option>
                        </select>
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-xs text-slate-500 mb-1">Pattern</label>
                        <input
                            type="text"
                            value={formData.match_pattern}
                            onChange={e => setFormData({ ...formData, match_pattern: e.target.value })}
                            placeholder="HYPOTEKA"
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-slate-200 text-xs outline-none focus:border-blue-500"
                        />
                    </div>
                </div>
            </div>

            <div className="mb-6">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Notes</label>
                <textarea
                    value={formData.notes || ''}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 text-sm outline-none focus:border-blue-500 transition-colors resize-none"
                />
            </div>

            <div className="flex gap-3 mt-8">
                <button
                    onClick={onCancel}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-700 text-slate-400 font-bold hover:bg-slate-800 transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={() => onSubmit(formData)}
                    className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all font-bold"
                >
                    {loan ? 'Save Changes' : 'Create Loan'}
                </button>
            </div>
        </div>
    );
}

// ─── Payment Dialog ───────────────────────────────────────────────────────────
function PaymentDialog({
    loan,
    onClose,
    onSubmit,
}: {
    loan: Loan;
    onClose: () => void;
    onSubmit: (amount: number) => Promise<void>;
}) {
    const [amount, setAmount] = useState<number>(loan.monthly_payment);

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-[110]">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                <h3 className="text-xl font-bold text-slate-100 mb-2">Log Payment</h3>
                <p className="text-sm text-slate-500 mb-6">For {loan.name}. This will reduce the current balance.</p>

                <div className="space-y-4 mb-8">
                    <FormInput
                        label="Payment Amount"
                        type="number"
                        value={amount}
                        onChange={(v: string) => setAmount(Number(v))}
                        autoFocus
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={() => setAmount(loan.monthly_payment)}
                            className="text-[10px] px-2 py-1 rounded-md bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700"
                        >
                            Set Regular
                        </button>
                        <button
                            onClick={() => setAmount(loan.current_balance)}
                            className="text-[10px] px-2 py-1 rounded-md bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700"
                        >
                            Pay Off Full
                        </button>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 px-4 py-3 rounded-xl border border-slate-700 text-slate-400 font-bold hover:bg-slate-800 transition-colors">Cancel</button>
                    <button
                        onClick={() => onSubmit(amount)}
                        className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all font-bold"
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
}

function FormInput({ label, type = 'text', value, onChange, placeholder, autoFocus }: any) {
    return (
        <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                autoFocus={autoFocus}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 text-sm outline-none focus:border-blue-500 transition-colors"
            />
        </div>
    );
}
