'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Wallet, Check, Tag, Store, Zap, X } from 'lucide-react';
import { FinancialRecord, Category, Merchant } from '@/types';

interface TransactionListProps {
  transactions: FinancialRecord[];
  categories: Category[];
  merchants: Merchant[];
  onUpdateTransaction: (transactionId: string, categoryId?: string, merchantId?: string) => Promise<void>;
  onCreateRule?: (rule: { name: string; pattern: string; pattern_type: string; match_field?: string; category_id?: string }) => Promise<void>;
  currency?: string;
}

export function TransactionList({
  transactions,
  categories,
  merchants,
  onUpdateTransaction,
  onCreateRule,
  currency = 'CZK',
}: TransactionListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingField, setEditingField] = useState<{ id: string; field: 'category' | 'merchant' } | null>(null);
  const [bulkCategory, setBulkCategory] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [creatingRuleFor, setCreatingRuleFor] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState({ pattern: '', category_id: '', pattern_type: 'contains', match_field: 'description' });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map(t => t.id)));
    }
  };

  const handleQuickCategory = async (txId: string, categoryId: string) => {
    setSaving(true);
    try {
      const tx = transactions.find(t => t.id === txId);
      await onUpdateTransaction(txId, categoryId, tx?.merchant_id);
      setEditingField(null);
    } catch (err) {
      console.error('Failed to update:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleQuickMerchant = async (txId: string, merchantId: string) => {
    setSaving(true);
    try {
      const tx = transactions.find(t => t.id === txId);
      await onUpdateTransaction(txId, tx?.category_id, merchantId);
      setEditingField(null);
    } catch (err) {
      console.error('Failed to update:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleBulkCategory = async () => {
    if (!bulkCategory || selectedIds.size === 0) return;
    setSaving(true);
    try {
      for (const id of selectedIds) {
        const tx = transactions.find(t => t.id === id);
        await onUpdateTransaction(id, bulkCategory, tx?.merchant_id);
      }
      setSelectedIds(new Set());
      setBulkCategory('');
    } catch (err) {
      console.error('Failed to bulk update:', err);
    } finally {
      setSaving(false);
    }
  };

  const startCreateRule = (tx: FinancialRecord, matchField: 'description' | 'counterparty_account' = 'description') => {
    // Extract a good default pattern from the transaction based on match field
    let pattern = '';
    if (matchField === 'counterparty_account') {
      pattern = tx.counterparty_account || '';
    } else {
      pattern = tx.merchant_name || tx.description?.split(' ').slice(0, 3).join(' ') || '';
    }
    setRuleForm({
      pattern: pattern.toUpperCase(),
      category_id: tx.category_id || '',
      pattern_type: 'contains',
      match_field: matchField,
    });
    setCreatingRuleFor(tx.id);
  };

  const handleCreateRule = async () => {
    if (!onCreateRule || !ruleForm.pattern.trim()) return;
    setSaving(true);
    try {
      await onCreateRule({
        name: ruleForm.pattern,
        pattern: ruleForm.pattern,
        pattern_type: ruleForm.pattern_type,
        match_field: ruleForm.match_field,
        category_id: ruleForm.category_id || undefined,
      });
      setCreatingRuleFor(null);
      setRuleForm({ pattern: '', category_id: '', pattern_type: 'contains', match_field: 'description' });
    } catch (err) {
      console.error('Failed to create rule:', err);
    } finally {
      setSaving(false);
    }
  };

  if (transactions.length === 0) {
    return (
      <div className="bg-slate-900 rounded-3xl border border-slate-800 p-12 text-center">
        <Wallet size={48} className="text-slate-600 mx-auto mb-4" />
        <div className="text-slate-400">No transactions yet</div>
        <div className="text-sm text-slate-500 mt-1">Import a CSV to get started</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-900/30 border border-blue-800 rounded-xl p-3 flex items-center gap-4 sticky top-0 z-10">
          <span className="text-sm text-blue-300 font-medium">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2 flex-1">
            <select
              value={bulkCategory}
              onChange={(e) => setBulkCategory(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-blue-500"
            >
              <option value="">Set category...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              onClick={handleBulkCategory}
              disabled={!bulkCategory || saving}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Applying...' : 'Apply'}
            </button>
          </div>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            Clear
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
        <button
          onClick={selectAll}
          className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
            selectedIds.size === transactions.length
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'border-slate-600 hover:border-slate-500'
          }`}
        >
          {selectedIds.size === transactions.length && <Check size={12} />}
        </button>
        <span className="w-16">Date</span>
        <span className="flex-1">Description</span>
        <span className="w-32 text-right">Amount</span>
        <span className="w-24"></span>
      </div>

      {/* Transactions */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden divide-y divide-slate-800">
        {transactions.map((tx) => {
          const isExpanded = expandedId === tx.id;
          const isSelected = selectedIds.has(tx.id);
          const category = categories.find(c => c.id === tx.category_id);
          const isEditingCategory = editingField?.id === tx.id && editingField?.field === 'category';
          const isEditingMerchant = editingField?.id === tx.id && editingField?.field === 'merchant';

          return (
            <div key={tx.id} className={`${isSelected ? 'bg-blue-900/10' : ''}`}>
              {/* Main row */}
              <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/50 transition-colors group">
                {/* Checkbox */}
                <button
                  onClick={() => toggleSelect(tx.id)}
                  className={`w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 ${
                    isSelected
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-slate-600 hover:border-slate-500'
                  }`}
                >
                  {isSelected && <Check size={12} />}
                </button>

                {/* Date */}
                <div className="w-16 shrink-0 text-xs text-slate-500">
                  {formatDate(tx.date)}
                </div>

                {/* Description & Category */}
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : tx.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-200 truncate">
                      {tx.merchant_name || tx.description}
                    </span>
                    {tx.account_name && (
                      <span className="text-[10px] text-slate-600 shrink-0">
                        {tx.account_name}
                      </span>
                    )}
                  </div>
                  {tx.merchant_name && tx.description !== tx.merchant_name && (
                    <div className="text-xs text-slate-500 truncate">{tx.description}</div>
                  )}
                </div>

                {/* Category badge - clickable */}
                <div className="shrink-0 relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingField(isEditingCategory ? null : { id: tx.id, field: 'category' });
                    }}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                      tx.category_name
                        ? 'hover:ring-2 hover:ring-slate-600'
                        : 'text-slate-500 hover:text-slate-400 hover:bg-slate-800'
                    }`}
                    style={tx.category_name ? {
                      backgroundColor: category?.color ? `${category.color}20` : '#33415520',
                      color: category?.color || '#94a3b8',
                    } : undefined}
                  >
                    <Tag size={10} />
                    {tx.category_name || 'Add'}
                  </button>
                  {isEditingCategory && (
                    <>
                      <div className="fixed inset-0 z-20" onClick={() => setEditingField(null)} />
                      <div className="absolute top-full right-0 mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-30 py-1 max-h-64 overflow-y-auto">
                        <button
                          onClick={() => handleQuickCategory(tx.id, '')}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-700 transition-colors ${
                            !tx.category_id ? 'text-blue-400' : 'text-slate-400'
                          }`}
                        >
                          None
                        </button>
                        {categories.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => handleQuickCategory(tx.id, c.id)}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-700 transition-colors flex items-center gap-2 ${
                              tx.category_id === c.id ? 'text-blue-400' : 'text-slate-200'
                            }`}
                          >
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: c.color || '#64748b' }}
                            />
                            {c.name}
                            {tx.category_id === c.id && <Check size={12} className="ml-auto" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Amount */}
                <div className="w-32 text-right shrink-0">
                  <span className={`font-bold ${tx.is_expense ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {tx.is_expense ? '-' : '+'}{formatCurrency(tx.amount)}
                  </span>
                </div>

                {/* Expand */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : tx.id)}
                  className="shrink-0 text-slate-600 hover:text-slate-400 p-1"
                >
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-4 pb-3 pt-0 bg-slate-800/20 text-sm">
                  <div className="pl-8 grid grid-cols-2 md:grid-cols-4 gap-4 py-3 border-t border-slate-800/50">
                    {tx.raw_description && tx.raw_description !== tx.description && (
                      <div>
                        <span className="text-[10px] text-slate-600 uppercase block">Raw</span>
                        <span className="text-slate-400 text-xs">{tx.raw_description}</span>
                      </div>
                    )}
                    <div className="relative">
                      <span className="text-[10px] text-slate-600 uppercase block">Merchant</span>
                      <button
                        onClick={() => setEditingField(isEditingMerchant ? null : { id: tx.id, field: 'merchant' })}
                        className="text-slate-300 text-xs flex items-center gap-1 hover:text-blue-400 mt-1"
                      >
                        <Store size={10} />
                        {tx.merchant_name || 'Set merchant'}
                      </button>
                      {isEditingMerchant && (
                        <>
                          <div className="fixed inset-0 z-20" onClick={() => setEditingField(null)} />
                          <div className="absolute top-full left-0 mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-30 py-1 max-h-48 overflow-y-auto">
                            <button
                              onClick={() => handleQuickMerchant(tx.id, '')}
                              className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-700 transition-colors ${
                                !tx.merchant_id ? 'text-blue-400' : 'text-slate-400'
                              }`}
                            >
                              None
                            </button>
                            {merchants.map((m) => (
                              <button
                                key={m.id}
                                onClick={() => handleQuickMerchant(tx.id, m.id)}
                                className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-700 transition-colors ${
                                  tx.merchant_id === m.id ? 'text-blue-400' : 'text-slate-200'
                                }`}
                              >
                                {m.display_name || m.name}
                                {tx.merchant_id === m.id && <Check size={12} className="inline ml-2" />}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    {tx.counterparty_account && (
                      <div>
                        <span className="text-[10px] text-slate-600 uppercase block">Counterparty Account</span>
                        <span className="text-slate-400 text-xs font-mono">{tx.counterparty_account}</span>
                      </div>
                    )}
                    {tx.balance_after !== undefined && (
                      <div>
                        <span className="text-[10px] text-slate-600 uppercase block">Balance After</span>
                        <span className="text-slate-400 text-xs">{formatCurrency(tx.balance_after)}</span>
                      </div>
                    )}
                    {tx.external_id && (
                      <div>
                        <span className="text-[10px] text-slate-600 uppercase block">ID</span>
                        <span className="text-slate-500 text-[10px] font-mono">{tx.external_id}</span>
                      </div>
                    )}
                  </div>

                  {/* Create Rule Section */}
                  {onCreateRule && (
                    <div className="pl-8 pt-2 border-t border-slate-800/50">
                      {creatingRuleFor === tx.id ? (
                        <div className="bg-slate-800/50 rounded-lg p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-300 flex items-center gap-1">
                              <Zap size={12} className="text-amber-500" />
                              Create Rule
                            </span>
                            <button
                              onClick={() => setCreatingRuleFor(null)}
                              className="text-slate-500 hover:text-slate-300"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            <div>
                              <label className="block text-[10px] text-slate-600 uppercase mb-1">Pattern</label>
                              <input
                                type="text"
                                value={ruleForm.pattern}
                                onChange={(e) => setRuleForm({ ...ruleForm, pattern: e.target.value })}
                                className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 outline-none focus:border-blue-500"
                                placeholder="e.g. NETFLIX"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-600 uppercase mb-1">Match Field</label>
                              <select
                                value={ruleForm.match_field}
                                onChange={(e) => setRuleForm({ ...ruleForm, match_field: e.target.value })}
                                className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 outline-none focus:border-blue-500"
                              >
                                <option value="description">Description</option>
                                <option value="counterparty_account">Account</option>
                                <option value="raw_description">Raw Desc</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-600 uppercase mb-1">Match Type</label>
                              <select
                                value={ruleForm.pattern_type}
                                onChange={(e) => setRuleForm({ ...ruleForm, pattern_type: e.target.value })}
                                className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 outline-none focus:border-blue-500"
                              >
                                <option value="contains">Contains</option>
                                <option value="exact">Exact</option>
                                <option value="regex">Regex</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-600 uppercase mb-1">Category</label>
                              <select
                                value={ruleForm.category_id}
                                onChange={(e) => setRuleForm({ ...ruleForm, category_id: e.target.value })}
                                className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 outline-none focus:border-blue-500"
                              >
                                <option value="">Select...</option>
                                {categories.map((c) => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setCreatingRuleFor(null)}
                              className="px-3 py-1 text-xs text-slate-400 hover:text-slate-200"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleCreateRule}
                              disabled={!ruleForm.pattern.trim() || !ruleForm.category_id || saving}
                              className="px-3 py-1 rounded bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {saving ? 'Creating...' : 'Create Rule'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => startCreateRule(tx, 'description')}
                            className="flex items-center gap-1 text-xs text-slate-500 hover:text-amber-400 transition-colors py-1"
                          >
                            <Zap size={12} />
                            Create rule from description
                          </button>
                          {tx.counterparty_account && (
                            <button
                              onClick={() => startCreateRule(tx, 'counterparty_account')}
                              className="flex items-center gap-1 text-xs text-slate-500 hover:text-amber-400 transition-colors py-1"
                            >
                              <Zap size={12} />
                              Create rule from account
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
