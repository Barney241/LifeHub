'use client';

import { useState } from 'react';
import { useLifeHubData } from '@/hooks/useLifeHubData';
import { useFinanceData } from '@/hooks/useFinanceData';
import { Sidebar } from '@/components/layout/Sidebar';
import { DataCard } from '@/components/dashboard/DataCard';
import { Modal } from '@/components/ui/Modal';
import { TaskForm } from '@/components/forms/TaskForm';
import { TransactionForm } from '@/components/forms/TransactionForm';
import { WorkspaceForm } from '@/components/forms/WorkspaceForm';
import { Marketplace } from '@/components/dashboard/Marketplace';
import { SourceConfigForm } from '@/components/forms/SourceConfigForm';
import {
  AccountManager,
  AccountSelector,
  BudgetDashboard,
  CategoryManager,
  CategorySelector,
  ImportWizard,
  InvestmentDashboard,
  InvestmentImport,
  FinanceDashboard,
  TransactionList,
  LoansDashboard,
  RecurringDashboard,
  NetWorthDashboard,
  GoalsDashboard,
} from '@/components/finance';
import { Wallet, CheckCircle2, Calendar, Plus, LayoutDashboard, Menu, Settings, Puzzle, MapPin, Video, Upload, Tag, ChevronLeft, ChevronRight, TrendingUp, PiggyBank, Landmark, Repeat, BarChart3, Target } from 'lucide-react';

export default function LifeHub() {
  const [showAddModal, setShowAddModal] = useState<'task' | 'transaction' | 'workspace' | 'marketplace' | 'import' | null>(null);
  const [showConfigModal, setShowConfigModal] = useState<{ id: string, name: string } | null>(null);
  const [targetSourceId, setTargetSourceId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [financeTab, setFinanceTab] = useState<'overview' | 'accounts' | 'categories' | 'investments' | 'budget' | 'loans' | 'recurring' | 'net-worth' | 'goals'>('overview');
  const [showInvestmentImport, setShowInvestmentImport] = useState(false);
  const [financePeriod, setFinancePeriod] = useState<string | null>('this-month'); // 'this-month', 'last-month', 'this-year', or null for all
  const [dateOffset, setDateOffset] = useState(0); // 0 = current period, 1 = previous period, etc.
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string } | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const {
    workspaces,
    activeWorkspace,
    setActiveWorkspace,
    data,
    loading,
    stats,
    authToken,
    user,
    logout,
    createTask,
    createTransaction,
    createWorkspace,
    updateWorkspace,
    updateWorkspaceSettings,
    deleteWorkspace,
    getAvailableSources,
    addSourceToWorkspace,
    updateSource,
    removeSource
  } = useLifeHubData();

  const {
    accounts,
    categories,
    merchants,
    templates,
    rules,
    stats: financeStats,
    overviewStats,
    overviewTransactions,
    transactions: financeTransactions,
    createAccount,
    createCategory,
    updateCategory,
    deleteCategory,
    createRule,
    updateRule,
    deleteRule,
    previewCSV,
    importCSV,
    getCategorizationSuggestions,
    applyBulkCategorization,
    categorizeTransaction,
    recategorizeAll,
    applyRules,
    portfolios,
    fetchSnapshots,
    importInvestmentPDF,
    incomeSources,
    budgets,
    budgetStatus,
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
    loans,
    createLoan,
    updateLoan,
    deleteLoan,
    goals,
    createGoal,
    updateGoal,
    deleteGoal,
    netWorthHistory,
    exchangeRates,
    recurringPayments,
    createRecurring,
    updateRecurring,
    deleteRecurring,
    detectRecurring,
  } = useFinanceData({ workspaceId: activeWorkspace?.id || null, accountId: selectedAccountId, categoryId: selectedCategoryId, period: financePeriod, dateOffset, customDateRange });

  if (!user) return null;

  // Get currency from selected account or default to CZK
  const selectedAccount = accounts.find(a => a.id === selectedAccountId);
  const activeCurrency = selectedAccount?.currency || accounts[0]?.currency || 'CZK';

  // Display currency from workspace settings (used for investment dashboard)
  const displayCurrency = activeWorkspace?.settings?.display_currency || 'CZK';
  const setDisplayCurrency = (currency: string) => {
    if (activeWorkspace) {
      updateWorkspaceSettings(activeWorkspace.id, { display_currency: currency });
    }
  };

  // Currency conversion (reusing cached exchange rates if available)
  const convertToDC = (value: number, from: string) => {
    if (from === displayCurrency) return value;

    // Try using live exchange rates from the hook
    const rate = exchangeRates.find(r => r.base_currency === from && r.target_currency === displayCurrency);
    if (rate) return value * rate.rate;

    // Try inverse
    const invRate = exchangeRates.find(r => r.base_currency === displayCurrency && r.target_currency === from);
    if (invRate) return value / invRate.rate;

    // Fallback to hardcoded rates
    const RATES_TO_CZK: Record<string, number> = { CZK: 1, EUR: 25.2, USD: 23.5, GBP: 29.5 };
    const inCZK = value * (RATES_TO_CZK[from] || 1);
    return inCZK / (RATES_TO_CZK[displayCurrency] || 1);
  };
  const fmtDC = (amount: number) =>
    new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: displayCurrency, maximumFractionDigits: 0 }).format(amount);

  // Calculate total balance across all accounts converted to display currency
  const totalAccountBalance = accounts
    .filter(a => a.is_active)
    .reduce((sum, a) => sum + convertToDC(a.current_balance, a.currency || 'CZK'), 0);

  // Calculate total portfolio value (latest snapshots) converted to display currency
  const totalPortfolioValue = portfolios
    .reduce((sum, p) => sum + convertToDC(p.latest_snapshot?.end_value || 0, p.currency || 'CZK'), 0);

  // Net worth = accounts + portfolios
  const totalNetWorth = totalAccountBalance + totalPortfolioValue;

  const activeModules = Array.from(new Set([
    ...data.map(d => {
      if (d.type === 'task') return 'task';
      if (d.type === 'finance') return 'finance';
      if (d.type === 'calendar') return 'calendar';
      return '';
    }),
    // Add finance if we have accounts
    accounts.length > 0 ? 'finance' : '',
  ].filter(Boolean)));

  const handleWorkspaceSubmit = async (name: string, slug: string, icon: string) => {
    if (showAddModal === 'workspace' && (!activeWorkspace || !workspaces.find(w => w.id === activeWorkspace.id))) {
      await createWorkspace(name, slug, icon);
    } else if (showAddModal === 'workspace' && activeWorkspace) {
      await updateWorkspace(activeWorkspace.id, name, slug, icon);
    }
    setShowAddModal(null);
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 overflow-hidden">

      {/* Sidebar */}
      <div className="hidden md:flex h-screen">
        <Sidebar
          workspaces={workspaces}
          activeWorkspace={activeWorkspace}
          setActiveWorkspace={setActiveWorkspace}
          user={user}
          onLogout={logout}
          onAddWorkspace={() => { setActiveWorkspace(null); setShowAddModal('workspace'); }}
          activeModules={activeModules}
          activeSection={activeSection}
          setActiveSection={setActiveSection}
        />
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative w-3/4 max-w-xs bg-slate-900 h-full shadow-2xl">
            <Sidebar
              workspaces={workspaces}
              activeWorkspace={activeWorkspace}
              setActiveWorkspace={(ws) => { setActiveWorkspace(ws); setIsMobileMenuOpen(false); }}
              user={user}
              onLogout={logout}
              onAddWorkspace={() => { setActiveWorkspace(null); setShowAddModal('workspace'); setIsMobileMenuOpen(false); }}
              activeModules={activeModules}
              activeSection={activeSection}
              setActiveSection={(s) => { setActiveSection(s); setIsMobileMenuOpen(false); }}
              isMobile={true}
            />
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 md:px-8 shrink-0 z-10 sticky top-0">
          <div className="flex items-center gap-4 text-slate-200">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 -ml-2">
              <Menu size={24} />
            </button>
            <h2 className="font-semibold text-lg">{activeWorkspace?.name || 'Select Workspace'}</h2>
            <div className="h-4 w-[1px] bg-slate-700"></div>
            <span className="text-slate-500 text-sm capitalize">{activeSection}</span>
          </div>

          <button
            onClick={() => setShowAddModal('workspace')}
            className="p-2 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <Settings size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto space-y-8 pb-20">

            {/* 1. SECTION: DASHBOARD */}
            {activeSection === 'dashboard' && (
              <>
                <div className="flex gap-4">
                  <button onClick={() => setShowAddModal('marketplace')} className="bg-slate-900 border border-slate-700 px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-slate-800 transition-all shadow-sm text-slate-200">
                    <Plus size={18} /> Add Integration
                  </button>
                </div>

                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Full Net Worth widget when finance is active */}
                  {activeModules.includes('finance') && (accounts.length > 0 || portfolios.length > 0) ? (
                    <div className="col-span-full lg:col-span-3">
                      <div
                        className="bg-slate-900 rounded-2xl border border-slate-800 p-5 cursor-pointer hover:border-slate-700 transition-colors"
                        onClick={() => setActiveSection('finance')}
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Net Worth</span>
                            <div className="text-2xl font-bold text-blue-300 mt-1">{fmtDC(totalNetWorth)}</div>
                          </div>
                          <div className="p-2 rounded-lg bg-blue-900/30">
                            <Wallet size={16} className="text-blue-400" />
                          </div>
                        </div>
                        {/* Accounts + Investments columns */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {accounts.filter(a => a.is_active).length > 0 && (
                            <div className="bg-slate-800/50 rounded-xl p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <Wallet size={14} className="text-slate-400" />
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Accounts</span>
                              </div>
                              <div className="text-xl font-bold text-slate-200 mb-3">
                                {fmtDC(totalAccountBalance)}
                              </div>
                              <div className="border-t border-slate-700/50 pt-2 space-y-1.5">
                                {accounts.filter(a => a.is_active).map((a) => (
                                  <div key={a.id} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2 min-w-0">
                                      {a.icon && <span className="text-xs">{a.icon}</span>}
                                      <span className="text-slate-400 truncate">{a.name}</span>
                                    </div>
                                    <span className="font-medium text-slate-300 shrink-0 ml-2">
                                      {new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: a.currency || displayCurrency, maximumFractionDigits: 0 }).format(a.current_balance)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {portfolios.length > 0 && (
                            <div
                              className="bg-slate-800/50 rounded-xl p-4 cursor-pointer hover:bg-slate-800/70 transition-colors"
                              onClick={(e) => { e.stopPropagation(); setActiveSection('finance'); setFinanceTab('investments'); }}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <TrendingUp size={14} className="text-violet-400" />
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Investments</span>
                              </div>
                              <div className="text-xl font-bold text-slate-200">
                                {fmtDC(totalPortfolioValue)}
                              </div>
                              {(() => {
                                const totalGain = portfolios.reduce((sum, p) => sum + convertToDC(p.latest_snapshot?.gain_loss || 0, p.currency || 'CZK'), 0);
                                return (
                                  <div className={`text-xs mb-3 ${totalGain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {totalGain >= 0 ? '+' : ''}{fmtDC(totalGain)} gain/loss
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
                                        <span className="font-medium text-slate-300">{fmtDC(convertToDC(snap.end_value, p.currency || 'CZK'))}</span>
                                        {pctGain && (
                                          <span className={`text-xs ${snap.gain_loss >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {snap.gain_loss >= 0 ? '+' : ''}{pctGain}%
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : activeModules.includes('finance') ? (
                    <StatCard label="Net Worth" value={fmtDC(totalNetWorth)} Icon={Wallet} />
                  ) : null}
                  {/* Task & Calendar stat cards */}
                  <div className="col-span-full lg:col-span-1 flex flex-row lg:flex-col gap-6">
                    {activeModules.includes('task') && <StatCard label="Pending" value={stats.pendingTasks.toString()} Icon={CheckCircle2} />}
                    {activeModules.includes('calendar') && <StatCard label="Upcoming" value={stats.upcomingEvents.toString()} Icon={Calendar} />}
                  </div>
                </section>


                <section className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">

                  {data.filter(result => result.type !== 'finance').map((result, idx) => (
                    <DataCard
                      key={idx}
                      type={result.type}
                      sourceName={result.source_name}
                      items={result.items}
                      onEdit={() => setShowConfigModal({ id: result.source_id, name: result.source_name })}
                    />
                  ))}
                  {data.filter(d => d.type !== 'finance').length === 0 && !activeModules.includes('finance') && activeWorkspace && (
                    <div className="col-span-full py-20 text-center bg-slate-900 rounded-3xl border border-dashed border-slate-700 font-medium text-slate-500">
                      Empty Workspace. Add modules from the Marketplace.
                    </div>
                  )}
                </section>
              </>
            )}

            {/* 2. SECTION: TASKS */}
            {activeSection === 'tasks' && (
              <div className="space-y-12">
                {data.filter(d => d.type === 'task').map((taskSource, idx) => (
                  <div key={idx} className="space-y-6">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="text-blue-500" />
                        <h3 className="text-2xl font-bold text-slate-200">{taskSource.source_name}</h3>
                        <button
                          onClick={() => setShowConfigModal({ id: taskSource.source_id, name: taskSource.source_name })}
                          className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                        >
                          <Settings size={16} />
                        </button>
                      </div>
                      <button
                        onClick={() => {
                          setTargetSourceId(taskSource.source_id);
                          setShowAddModal('task');
                        }}
                        className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2"
                      >
                        <Plus size={18} /> New Task
                      </button>
                    </div>
                    <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-sm">
                      {taskSource.items.map((task: any, i: number) => (
                        <div key={i} className="p-6 border-b border-slate-800 flex items-center justify-between hover:bg-slate-800 transition-colors group">
                          <div className="flex items-center gap-4">
                            <div className={`w-2 h-2 rounded-full ${task.priority === 'high' ? 'bg-rose-500' : 'bg-blue-400'}`} />
                            <span className="font-medium text-slate-300">{task.content}</span>
                          </div>
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{task.priority}</span>
                        </div>
                      ))}
                      {taskSource.items.length === 0 && <p className="p-20 text-center text-slate-500 italic font-medium bg-slate-800/50">All caught up!</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 3. SECTION: CALENDAR */}
            {activeSection === 'calendar' && (
              <div className="space-y-12">
                {data.filter(d => d.type === 'calendar').map((calSource, idx) => (
                  <div key={idx} className="space-y-6">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <Calendar className="text-amber-500" />
                        <h3 className="text-2xl font-bold text-slate-200">{calSource.source_name}</h3>
                        <button
                          onClick={() => setShowConfigModal({ id: calSource.source_id, name: calSource.source_name })}
                          className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                        >
                          <Settings size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-sm">
                      {(calSource.items as any[]).map((event: any, i: number) => (
                        <div key={i} className="p-6 border-b border-slate-800 flex items-center justify-between hover:bg-slate-800 transition-colors">
                          <div className="flex flex-col gap-1">
                            <span className="font-bold text-slate-300">{event.title}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-slate-500 font-medium">
                                {event.all_day
                                  ? new Date(event.start).toLocaleDateString()
                                  : `${new Date(event.start).toLocaleDateString()} ${new Date(event.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(event.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                }
                              </span>
                              {event.location && (
                                <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                                  <MapPin size={12} /> {event.location}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {event.meet_link && (
                              <a href={event.meet_link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 font-bold flex items-center gap-1 hover:text-blue-300 bg-blue-900/30 px-3 py-1.5 rounded-lg">
                                <Video size={14} /> Join
                              </a>
                            )}
                            <span className="text-xs font-bold text-amber-500">
                              {event.all_day ? 'All day' : new Date(event.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      ))}
                      {calSource.items.length === 0 && <p className="p-20 text-center text-slate-500 italic font-medium bg-slate-800/50">No upcoming events.</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 4. SECTION: FINANCE */}
            {activeSection === 'finance' && (
              <div className="space-y-6">
                {/* Finance Header */}
                <div className="flex items-center gap-3">
                  <Wallet className="text-emerald-500" />
                  <h3 className="text-2xl font-bold text-slate-200">Finance</h3>
                </div>

                {/* Period Selector */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-500 font-medium">Period:</span>
                  {[
                    { value: 'this-month', label: 'This month' },
                    { value: 'last-month', label: 'Last month' },
                    { value: 'this-year', label: 'This year' },
                    { value: null, label: 'All time' },
                  ].map((p) => (
                    <button
                      key={p.value ?? 'all'}
                      onClick={() => { setFinancePeriod(p.value); setDateOffset(0); setCustomDateRange(null); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${financePeriod === p.value && !customDateRange
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
                        }`}
                    >
                      {p.label}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowDatePicker(true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${customDateRange
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
                      }`}
                  >
                    Custom
                  </button>

                  {/* Date Navigation */}
                  {(financePeriod || customDateRange) && (
                    <>
                      <div className="w-px h-6 bg-slate-700 mx-2" />
                      {!customDateRange && financePeriod && (
                        <button
                          onClick={() => setDateOffset(dateOffset + 1)}
                          className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300 transition-colors"
                          title="Previous period"
                        >
                          <ChevronLeft size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => setShowDatePicker(true)}
                        className="text-xs text-slate-300 min-w-[160px] text-center hover:text-blue-400 transition-colors cursor-pointer"
                        title="Click to select custom date range"
                      >
                        {(() => {
                          const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                          if (customDateRange) {
                            return `${fmt(new Date(customDateRange.start))} - ${fmt(new Date(customDateRange.end))}`;
                          }
                          if (!financePeriod) return 'All time';

                          const now = new Date();
                          let startDate: Date, endDate: Date;

                          if (financePeriod === 'this-month') {
                            startDate = new Date(now.getFullYear(), now.getMonth() - dateOffset, 1);
                            endDate = new Date(now.getFullYear(), now.getMonth() - dateOffset + 1, 0);
                          } else if (financePeriod === 'last-month') {
                            startDate = new Date(now.getFullYear(), now.getMonth() - 1 - dateOffset, 1);
                            endDate = new Date(now.getFullYear(), now.getMonth() - dateOffset, 0);
                          } else if (financePeriod === 'this-year') {
                            startDate = new Date(now.getFullYear() - dateOffset, 0, 1);
                            endDate = new Date(now.getFullYear() - dateOffset, 11, 31);
                          } else {
                            return 'All time';
                          }
                          return `${fmt(startDate)} - ${fmt(endDate)}`;
                        })()}
                      </button>
                      {!customDateRange && financePeriod && (
                        <>
                          <button
                            onClick={() => setDateOffset(Math.max(0, dateOffset - 1))}
                            disabled={dateOffset === 0}
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Next period"
                          >
                            <ChevronRight size={16} />
                          </button>
                          {dateOffset > 0 && (
                            <button
                              onClick={() => setDateOffset(0)}
                              className="text-xs text-blue-400 hover:text-blue-300 ml-1"
                            >
                              Current
                            </button>
                          )}
                        </>
                      )}
                      {customDateRange && (
                        <button
                          onClick={() => { setCustomDateRange(null); setFinancePeriod('this-month'); setDateOffset(0); }}
                          className="text-xs text-slate-500 hover:text-slate-300 ml-1"
                        >
                          Clear
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Date Picker Modal */}
                {showDatePicker && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowDatePicker(false)} />
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-4 w-80">
                      <h4 className="font-bold text-slate-200 mb-4">Select Date Range</h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">From</label>
                          <input
                            type="date"
                            defaultValue={customDateRange?.start || ''}
                            onChange={(e) => {
                              const start = e.target.value;
                              setCustomDateRange(prev => ({ start, end: prev?.end || start }));
                            }}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">To</label>
                          <input
                            type="date"
                            defaultValue={customDateRange?.end || ''}
                            onChange={(e) => {
                              const end = e.target.value;
                              setCustomDateRange(prev => ({ start: prev?.start || end, end }));
                            }}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => setShowDatePicker(false)}
                            className="flex-1 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-600 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              if (customDateRange?.start && customDateRange?.end) {
                                setFinancePeriod(null);
                                setDateOffset(0);
                              }
                              setShowDatePicker(false);
                            }}
                            className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Finance Tabs */}
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                  <div className="flex gap-2 flex-1">
                    {[
                      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
                      { id: 'net-worth', label: 'Net Worth', icon: BarChart3 },
                      { id: 'accounts', label: 'Accounts', icon: Wallet },
                      { id: 'investments', label: 'Investments', icon: TrendingUp },
                      { id: 'budget', label: 'Budget', icon: PiggyBank },
                      { id: 'recurring', label: 'Subscriptions', icon: Repeat },
                      { id: 'goals', label: 'Goals', icon: Target },
                      { id: 'loans', label: 'Loans', icon: Landmark },
                      { id: 'categories', label: 'Categories', icon: Tag },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setFinanceTab(tab.id as typeof financeTab)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${financeTab === tab.id
                          ? 'bg-slate-800 text-slate-200'
                          : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                          }`}
                      >
                        <tab.icon size={16} />
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    {['CZK', 'EUR', 'USD'].map((c) => (
                      <button
                        key={c}
                        onClick={() => setDisplayCurrency(c)}
                        className={`px-2 py-1 rounded-md transition-colors ${displayCurrency === c
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                          }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tab Content */}
                {financeTab === 'overview' && (
                  <FinanceDashboard
                    stats={overviewStats}
                    transactions={overviewTransactions}
                    categories={categories}
                    onCategorySelect={(catId) => {
                      setSelectedCategoryId(catId);
                      setSelectedAccountId(null);
                      setFinanceTab('accounts');
                    }}
                    currency={activeCurrency}
                    displayCurrency={displayCurrency}
                    portfolios={portfolios}
                    accounts={accounts}
                    onViewInvestments={() => setFinanceTab('investments')}
                    budgetStatus={budgetStatus}
                  />
                )}

                {financeTab === 'accounts' && (
                  <div className="space-y-6">
                    {/* Account-specific filters and actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        <AccountSelector
                          accounts={accounts}
                          selectedAccountId={selectedAccountId}
                          onSelect={setSelectedAccountId}
                        />
                        <CategorySelector
                          categories={categories}
                          selectedCategoryId={selectedCategoryId}
                          onSelect={setSelectedCategoryId}
                        />
                      </div>
                      <button
                        onClick={() => setShowAddModal('import')}
                        className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-blue-700 transition-colors"
                      >
                        <Upload size={16} /> Import CSV
                      </button>
                    </div>

                    <AccountManager
                      accounts={accounts}
                      selectedAccountId={selectedAccountId}
                      onSelectAccount={setSelectedAccountId}
                      onCreateAccount={createAccount}
                    />

                    {/* Same dashboard charts as overview, filtered by account/category */}
                    <FinanceDashboard
                      stats={financeStats}
                      transactions={financeTransactions}
                      categories={categories}
                      onCategorySelect={setSelectedCategoryId}
                      currency={activeCurrency}
                      budgetStatus={budgetStatus}
                    />

                    <TransactionList
                      transactions={financeTransactions}
                      categories={categories}
                      merchants={merchants}
                      onUpdateTransaction={categorizeTransaction}
                      onCreateRule={createRule}
                      currency={activeCurrency}
                    />
                  </div>
                )}

                {financeTab === 'budget' && (
                  <BudgetDashboard
                    budgetStatus={budgetStatus}
                    incomeSources={incomeSources}
                    budgets={budgets}
                    categories={categories}
                    merchants={merchants}
                    accounts={accounts}
                    rules={rules}
                    transactions={financeTransactions}
                    currency={activeCurrency}
                    onCreateIncomeSource={createIncomeSource}
                    onUpdateIncomeSource={updateIncomeSource}
                    onDeleteIncomeSource={deleteIncomeSource}
                    onUpsertIncomeHours={upsertIncomeHours}
                    onCreateBudget={createBudget}
                    onUpdateBudget={updateBudget}
                    onDeleteBudget={deleteBudget}
                    onCreateBudgetItem={createBudgetItem}
                    onUpdateBudgetItem={updateBudgetItem}
                    onDeleteBudgetItem={deleteBudgetItem}
                    currentYear={(() => {
                      if (customDateRange) return new Date(customDateRange.start).getFullYear();
                      const now = new Date();
                      if (financePeriod === 'this-month') return new Date(now.getFullYear(), now.getMonth() - dateOffset, 1).getFullYear();
                      if (financePeriod === 'last-month') return new Date(now.getFullYear(), now.getMonth() - 1 - dateOffset, 1).getFullYear();
                      return now.getFullYear();
                    })()}
                    currentMonth={(() => {
                      if (customDateRange) return new Date(customDateRange.start).getMonth() + 1;
                      const now = new Date();
                      if (financePeriod === 'this-month') return new Date(now.getFullYear(), now.getMonth() - dateOffset, 1).getMonth() + 1;
                      if (financePeriod === 'last-month') return new Date(now.getFullYear(), now.getMonth() - 1 - dateOffset, 1).getMonth() + 1;
                      return now.getMonth() + 1;
                    })()}
                  />
                )}

                {financeTab === 'investments' && (
                  <InvestmentDashboard
                    portfolios={portfolios}
                    onImport={() => setShowInvestmentImport(true)}
                    onFetchSnapshots={fetchSnapshots}
                    displayCurrency={displayCurrency}
                    dateRange={(() => {
                      if (customDateRange) return { start: customDateRange.start, end: customDateRange.end };
                      if (!financePeriod) return null; // all time
                      const now = new Date();
                      let startDate: Date, endDate: Date;
                      if (financePeriod === 'this-month') {
                        startDate = new Date(now.getFullYear(), now.getMonth() - dateOffset, 1);
                        endDate = new Date(now.getFullYear(), now.getMonth() - dateOffset + 1, 0);
                      } else if (financePeriod === 'last-month') {
                        startDate = new Date(now.getFullYear(), now.getMonth() - 1 - dateOffset, 1);
                        endDate = new Date(now.getFullYear(), now.getMonth() - dateOffset, 0);
                      } else if (financePeriod === 'this-year') {
                        startDate = new Date(now.getFullYear() - dateOffset, 0, 1);
                        endDate = new Date(now.getFullYear() - dateOffset, 11, 31);
                      } else {
                        return null;
                      }
                      return { start: startDate.toISOString().split('T')[0], end: endDate.toISOString().split('T')[0] };
                    })()}
                  />
                )}

                {financeTab === 'categories' && (
                  <CategoryManager
                    categories={categories}
                    rules={rules}
                    onCreateCategory={createCategory}
                    onUpdateCategory={updateCategory}
                    onDeleteCategory={deleteCategory}
                    onCreateRule={createRule}
                    onUpdateRule={updateRule}
                    onDeleteRule={deleteRule}
                    onGetSuggestions={getCategorizationSuggestions}
                    onApplyBulkCategorization={applyBulkCategorization}
                    onRecategorizeAll={recategorizeAll}
                    onApplyRules={applyRules}
                  />

                )}
                {financeTab === 'recurring' && (
                  <RecurringDashboard
                    recurringPayments={recurringPayments}
                    merchants={merchants}
                    accounts={accounts}
                    currency={activeCurrency}
                    onCreate={createRecurring}
                    onUpdate={updateRecurring}
                    onDelete={deleteRecurring}
                    onDetect={() => detectRecurring(selectedAccountId || undefined)}
                  />
                )}

                {financeTab === 'net-worth' && (
                  <NetWorthDashboard
                    accounts={accounts}
                    portfolios={portfolios}
                    loans={loans}
                    history={netWorthHistory}
                    exchangeRates={exchangeRates}
                    baseCurrency={displayCurrency}
                  />
                )}

                {financeTab === 'goals' && (
                  <GoalsDashboard
                    goals={goals}
                    accounts={accounts}
                    currency={activeCurrency}
                    onCreate={createGoal}
                    onUpdate={updateGoal}
                    onDelete={deleteGoal}
                  />
                )}

                {financeTab === 'loans' && (
                  <LoansDashboard
                    loans={loans}
                    transactions={overviewTransactions}
                    currency={activeCurrency}
                    onCreateLoan={createLoan}
                    onUpdateLoan={updateLoan}
                    onDeleteLoan={deleteLoan}
                  />
                )}
              </div>
            )}

          </div>
        </div>
      </main>

      <Modal
        isOpen={!!showAddModal}
        onClose={() => setShowAddModal(null)}
        size={showAddModal === 'marketplace' ? '5xl' : showAddModal === 'import' ? 'lg' : 'md'}
        noPadding={showAddModal === 'marketplace'}
        title={showAddModal === 'task' ? 'Create Task' : showAddModal === 'transaction' ? 'Log Transaction' : showAddModal === 'marketplace' ? 'Marketplace' : 'Workspace'}
      >
        {showAddModal === 'task' && <TaskForm onSubmit={(c, p, d) => createTask(c, p, targetSourceId!, d)} onClose={() => setShowAddModal(null)} />}
        {showAddModal === 'transaction' && (
          <TransactionForm
            onSubmit={(desc, amt, type, accountId, categoryId) => createTransaction(desc, amt, type, targetSourceId!)}
            onClose={() => setShowAddModal(null)}
            accounts={accounts}
            categories={categories}
          />
        )}
        {showAddModal === 'workspace' && <WorkspaceForm workspace={activeWorkspace} onSubmit={handleWorkspaceSubmit} onClose={() => setShowAddModal(null)} onDelete={deleteWorkspace} />}
        {showAddModal === 'marketplace' && <Marketplace onAdd={addSourceToWorkspace} onClose={() => setShowAddModal(null)} getAvailable={getAvailableSources} activeWorkspaceId={activeWorkspace?.id} authToken={authToken} />}
        {showAddModal === 'import' && (
          <ImportWizard
            accounts={accounts}
            templates={templates}
            onPreview={previewCSV}
            onImport={importCSV}
            onClose={() => setShowAddModal(null)}
          />
        )}
      </Modal>

      {/* Investment Import Modal */}
      <Modal
        isOpen={showInvestmentImport}
        onClose={() => setShowInvestmentImport(false)}
        title="Import Investment Report"
      >
        <InvestmentImport
          onImport={importInvestmentPDF}
          onClose={() => setShowInvestmentImport(false)}
        />
      </Modal>

      {/* Integration Config Modal */}
      <Modal
        isOpen={!!showConfigModal}
        onClose={() => setShowConfigModal(null)}
        title="Integration Settings"
      >
        {showConfigModal && (
          <SourceConfigForm
            source={showConfigModal}
            onUpdate={updateSource}
            onRemove={removeSource}
            onClose={() => setShowConfigModal(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function StatCard({ label, value, Icon }: { label: string, value: string, Icon: any }) {
  return (
    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-sm transition-all hover:shadow-md group">
      <div className="flex justify-between items-center mb-2">
        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">{label}</p>
        <Icon className="text-slate-700 group-hover:text-blue-500 transition-colors" size={20} />
      </div>
      <h3 className="text-3xl font-bold text-slate-200">{value}</h3>
    </div>
  );
}
