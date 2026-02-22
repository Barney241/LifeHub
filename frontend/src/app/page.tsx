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
  CategoryManager,
  CategorySelector,
  ImportWizard,
  FinanceDashboard,
  TransactionList,
} from '@/components/finance';
import { Wallet, CheckCircle2, Calendar, Plus, LayoutDashboard, Menu, Settings, Puzzle, MapPin, Video, Upload, Tag, ChevronLeft, ChevronRight } from 'lucide-react';

export default function LifeHub() {
  const [showAddModal, setShowAddModal] = useState<'task' | 'transaction' | 'workspace' | 'marketplace' | 'import' | null>(null);
  const [showConfigModal, setShowConfigModal] = useState<{id: string, name: string} | null>(null);
  const [targetSourceId, setTargetSourceId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [financeTab, setFinanceTab] = useState<'overview' | 'transactions' | 'categories'>('overview');
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
  } = useFinanceData({ workspaceId: activeWorkspace?.id || null, accountId: selectedAccountId, categoryId: selectedCategoryId, period: financePeriod, dateOffset, customDateRange });

  if (!user) return null;

  // Get currency from selected account or default to CZK
  const selectedAccount = accounts.find(a => a.id === selectedAccountId);
  const activeCurrency = selectedAccount?.currency || accounts[0]?.currency || 'CZK';

  // Calculate total balance across all accounts (grouped by currency for display)
  const totalAccountBalance = accounts
    .filter(a => a.is_active)
    .reduce((sum, a) => sum + a.current_balance, 0);

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
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {activeModules.includes('finance') && <StatCard label="Balance" value={new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: activeCurrency, maximumFractionDigits: 0 }).format(totalAccountBalance)} Icon={Wallet} />}
                  {activeModules.includes('task') && <StatCard label="Pending" value={stats.pendingTasks.toString()} Icon={CheckCircle2} />}
                  {activeModules.includes('calendar') && <StatCard label="Upcoming" value={stats.upcomingEvents.toString()} Icon={Calendar} />}
                </section>

                <div className="flex gap-4">
                   <button onClick={() => setShowAddModal('marketplace')} className="bg-slate-900 border border-slate-700 px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-slate-800 transition-all shadow-sm text-slate-200">
                     <Plus size={18} /> Add Integration
                   </button>
                </div>

                <section className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                  {/* Finance Summary Card */}
                  {activeModules.includes('finance') && financeStats && (
                    <div
                      className="bg-slate-900 rounded-3xl border border-slate-800 p-6 cursor-pointer hover:border-slate-700 transition-colors"
                      onClick={() => setActiveSection('finance')}
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <Wallet className="text-emerald-500" size={20} />
                        <h4 className="font-bold text-slate-200">Finance Overview</h4>
                        <span className="text-xs text-slate-500 ml-auto">This Month</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div>
                          <div className="text-xs text-slate-500 mb-1">Income</div>
                          <div className="text-emerald-400 font-bold">
                            {new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: activeCurrency, maximumFractionDigits: 0 }).format(financeStats.total_income || 0)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">Expenses</div>
                          <div className="text-rose-400 font-bold">
                            {new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: activeCurrency, maximumFractionDigits: 0 }).format(financeStats.total_expenses || 0)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">Net</div>
                          <div className={`font-bold ${(financeStats.net_balance || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: activeCurrency, maximumFractionDigits: 0 }).format(financeStats.net_balance || 0)}
                          </div>
                        </div>
                      </div>
                      {/* Recent transactions */}
                      <div className="border-t border-slate-800 pt-3">
                        <div className="text-xs text-slate-500 mb-2">Recent Transactions</div>
                        <div className="space-y-2">
                          {financeTransactions.slice(0, 3).map((tx, i) => (
                            <div key={tx.id || i} className="flex items-center justify-between text-sm">
                              <span className="text-slate-400 truncate flex-1 mr-2">
                                {tx.merchant_name || tx.description}
                              </span>
                              <span className={tx.is_expense ? 'text-rose-400' : 'text-emerald-400'}>
                                {tx.is_expense ? '-' : '+'}
                                {new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: activeCurrency, maximumFractionDigits: 0 }).format(tx.amount)}
                              </span>
                            </div>
                          ))}
                          {financeTransactions.length === 0 && (
                            <div className="text-slate-500 text-sm italic">No transactions yet</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {data.map((result, idx) => (
                    <DataCard
                      key={idx}
                      type={result.type}
                      sourceName={result.source_name}
                      items={result.items}
                      onEdit={() => setShowConfigModal({id: result.source_id, name: result.source_name})}
                    />
                  ))}
                  {data.length === 0 && !activeModules.includes('finance') && activeWorkspace && (
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
                          onClick={() => setShowConfigModal({id: taskSource.source_id, name: taskSource.source_name})}
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
                          onClick={() => setShowConfigModal({id: calSource.source_id, name: calSource.source_name})}
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Wallet className="text-emerald-500" />
                    <h3 className="text-2xl font-bold text-slate-200">Finance</h3>
                  </div>
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
                    <button
                      onClick={() => setShowAddModal('import')}
                      className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-blue-700 transition-colors"
                    >
                      <Upload size={16} /> Import CSV
                    </button>
                  </div>
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
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        financePeriod === p.value && !customDateRange
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowDatePicker(true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      customDateRange
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
                <div className="flex gap-2 border-b border-slate-800 pb-2">
                  {[
                    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
                    { id: 'transactions', label: 'Transactions', icon: Wallet },
                    { id: 'categories', label: 'Categories', icon: Tag },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setFinanceTab(tab.id as typeof financeTab)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        financeTab === tab.id
                          ? 'bg-slate-800 text-slate-200'
                          : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                      }`}
                    >
                      <tab.icon size={16} />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Account Manager */}
                <AccountManager
                  accounts={accounts}
                  selectedAccountId={selectedAccountId}
                  onSelectAccount={setSelectedAccountId}
                  onCreateAccount={createAccount}
                />

                {/* Tab Content */}
                {financeTab === 'overview' && (
                  <FinanceDashboard
                    stats={financeStats}
                    transactions={financeTransactions}
                    categories={categories}
                    onCategorySelect={setSelectedCategoryId}
                    currency={activeCurrency}
                  />
                )}

                {financeTab === 'transactions' && (
                  <TransactionList
                    transactions={financeTransactions}
                    categories={categories}
                    merchants={merchants}
                    onUpdateTransaction={categorizeTransaction}
                    onCreateRule={createRule}
                    currency={activeCurrency}
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
