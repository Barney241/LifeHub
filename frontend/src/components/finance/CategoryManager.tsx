'use client';

import { useState } from 'react';
import { Plus, Loader2, Pencil, Trash2, X, Check, Wand2, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { Category, CategorizationSuggestion, ImportRule } from '@/types';

interface CategoryManagerProps {
  categories: Category[];
  rules?: ImportRule[];
  onCreateCategory: (category: { name: string; icon?: string; color?: string }) => Promise<void>;
  onUpdateCategory?: (id: string, updates: { name?: string; color?: string }) => Promise<void>;
  onDeleteCategory?: (id: string) => Promise<void>;
  onCreateRule?: (rule: { name: string; pattern: string; pattern_type: string; match_field?: string; category_id?: string; priority?: number }) => Promise<void>;
  onUpdateRule?: (id: string, updates: { name?: string; pattern?: string; pattern_type?: string; match_field?: string; category_id?: string; active?: boolean }) => Promise<void>;
  onDeleteRule?: (id: string) => Promise<void>;
  onGetSuggestions?: () => Promise<CategorizationSuggestion[]>;
  onApplyBulkCategorization?: (
    transactionIds: string[],
    categoryId?: string,
    merchantId?: string,
    createRule?: boolean,
    pattern?: string
  ) => Promise<void>;
  onRecategorizeAll?: () => Promise<{ checked: number; updated: number }>;
  onApplyRules?: (overrideExisting: boolean) => Promise<{ checked: number; updated: number }>;
}

const defaultColors = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

export function CategoryManager({
  categories,
  rules = [],
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onCreateRule,
  onUpdateRule,
  onDeleteRule,
  onGetSuggestions,
  onApplyBulkCategorization,
  onRecategorizeAll,
  onApplyRules,
}: CategoryManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', color: '#3b82f6' });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Rules state
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleFormData, setRuleFormData] = useState({ name: '', pattern: '', pattern_type: 'contains', match_field: 'description', category_id: '' });
  const [deleteRuleConfirm, setDeleteRuleConfirm] = useState<string | null>(null);

  // Auto-categorization state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<CategorizationSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [applyingRules, setApplyingRules] = useState(false);
  const [showApplyRulesOptions, setShowApplyRulesOptions] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setLoading(true);
    try {
      if (editingId && onUpdateCategory) {
        await onUpdateCategory(editingId, { name: formData.name, color: formData.color });
      } else {
        await onCreateCategory({ name: formData.name, color: formData.color });
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ name: '', color: '#3b82f6' });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setFormData({ name: category.name, color: category.color || '#3b82f6' });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!onDeleteCategory) return;
    setLoading(true);
    try {
      await onDeleteCategory(id);
      setDeleteConfirm(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestions = async () => {
    if (!onGetSuggestions) return;
    setLoadingSuggestions(true);
    try {
      const data = await onGetSuggestions();
      setSuggestions(data);
      setShowSuggestions(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const applySuggestion = async (suggestion: CategorizationSuggestion, categoryId: string, createRule: boolean) => {
    if (!onApplyBulkCategorization) return;
    setApplyingId(suggestion.pattern);
    try {
      await onApplyBulkCategorization(
        suggestion.transaction_ids,
        categoryId,
        undefined,
        createRule,
        suggestion.pattern
      );
      // Remove applied suggestion
      setSuggestions(prev => prev.filter(s => s.pattern !== suggestion.pattern));
    } catch (err) {
      console.error(err);
    } finally {
      setApplyingId(null);
    }
  };

  const handleRecategorizeAll = async () => {
    if (!onRecategorizeAll) return;
    setLoading(true);
    try {
      const result = await onRecategorizeAll();
      alert(`Re-categorization complete: ${result.updated} of ${result.checked} transactions updated.`);
    } catch (err) {
      console.error(err);
      alert('Failed to re-categorize transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyRules = async (overrideExisting: boolean) => {
    if (!onApplyRules) return;
    setApplyingRules(true);
    try {
      const result = await onApplyRules(overrideExisting);
      setShowApplyRulesOptions(false);
      alert(`Rules applied: ${result.updated} of ${result.checked} transactions updated.`);
    } catch (err) {
      console.error(err);
      alert('Failed to apply rules');
    } finally {
      setApplyingRules(false);
    }
  };

  // Rule handlers
  const handleRuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleFormData.pattern.trim()) return;

    setLoading(true);
    try {
      if (editingRuleId && onUpdateRule) {
        await onUpdateRule(editingRuleId, {
          name: ruleFormData.name,
          pattern: ruleFormData.pattern,
          pattern_type: ruleFormData.pattern_type,
          match_field: ruleFormData.match_field,
          category_id: ruleFormData.category_id || undefined,
        });
      } else if (onCreateRule) {
        await onCreateRule({
          name: ruleFormData.name || ruleFormData.pattern,
          pattern: ruleFormData.pattern,
          pattern_type: ruleFormData.pattern_type,
          match_field: ruleFormData.match_field,
          category_id: ruleFormData.category_id || undefined,
        });
      }
      setShowRuleForm(false);
      setEditingRuleId(null);
      setRuleFormData({ name: '', pattern: '', pattern_type: 'contains', match_field: 'description', category_id: '' });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const startEditRule = (rule: ImportRule) => {
    setEditingRuleId(rule.id);
    setRuleFormData({
      name: rule.name,
      pattern: rule.pattern,
      pattern_type: rule.pattern_type,
      match_field: rule.match_field || 'description',
      category_id: rule.category_id || '',
    });
    setShowRuleForm(true);
  };

  const handleDeleteRule = async (id: string) => {
    if (!onDeleteRule) return;
    setLoading(true);
    try {
      await onDeleteRule(id);
      setDeleteRuleConfirm(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Categories Section */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-200">Categories</h3>
          <button
            onClick={() => {
              setEditingId(null);
              setFormData({ name: '', color: '#3b82f6' });
              setShowForm(!showForm);
            }}
            className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Plus size={16} />
            Add Category
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-4 p-4 bg-slate-800/50 rounded-xl space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g. Groceries"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Color
              </label>
              <div className="flex gap-2 flex-wrap">
                {defaultColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-8 h-8 rounded-lg transition-all ${
                      formData.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingId(null); }}
                className="flex-1 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={14} /> : editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-1">
          {categories.map((category) => (
            <div
              key={category.id}
              className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-xl hover:bg-slate-800/50 transition-colors group"
            >
              <div
                className="w-4 h-4 rounded-full shrink-0"
                style={{ backgroundColor: category.color || '#64748b' }}
              />
              <span className="text-sm text-slate-200 flex-1">{category.name}</span>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => startEdit(category)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
                {deleteConfirm === category.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(category.id)}
                      disabled={loading}
                      className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-900/30 transition-colors"
                      title="Confirm delete"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
                      title="Cancel"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(category.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {categories.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-sm">
              No categories yet. Create one to get started.
            </div>
          )}
        </div>
      </div>

      {/* Auto-Categorization Section */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-200">Auto-Categorization</h3>
            <p className="text-xs text-slate-500 mt-1">Find and categorize similar transactions</p>
          </div>
          <div className="flex items-center gap-2">
            {onApplyRules && (
              <div className="relative">
                <button
                  onClick={() => setShowApplyRulesOptions(!showApplyRulesOptions)}
                  disabled={applyingRules}
                  className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  {applyingRules ? (
                    <Loader2 className="animate-spin" size={14} />
                  ) : (
                    <Zap size={14} />
                  )}
                  Apply Rules
                  <ChevronDown size={14} />
                </button>
                {showApplyRulesOptions && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setShowApplyRulesOptions(false)} />
                    <div className="absolute top-full right-0 mt-1 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-30 py-1">
                      <button
                        onClick={() => handleApplyRules(false)}
                        className="w-full text-left px-4 py-2.5 hover:bg-slate-700 transition-colors"
                      >
                        <div className="text-sm text-slate-200 font-medium">Uncategorized only</div>
                        <div className="text-xs text-slate-500">Apply rules to transactions without a category</div>
                      </button>
                      <button
                        onClick={() => handleApplyRules(true)}
                        className="w-full text-left px-4 py-2.5 hover:bg-slate-700 transition-colors border-t border-slate-700"
                      >
                        <div className="text-sm text-slate-200 font-medium">Override all</div>
                        <div className="text-xs text-slate-500">Re-apply rules to all transactions, replacing existing categories</div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            <button
              onClick={loadSuggestions}
              disabled={loadingSuggestions}
              className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              {loadingSuggestions ? (
                <Loader2 className="animate-spin" size={14} />
              ) : (
                <Wand2 size={14} />
              )}
              Find Suggestions
            </button>
          </div>
        </div>

        {showSuggestions && (
          <div className="space-y-2">
            {suggestions.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                No categorization suggestions found. All transactions are categorized.
              </div>
            ) : (
              suggestions.map((suggestion) => (
                <SuggestionCard
                  key={suggestion.pattern}
                  suggestion={suggestion}
                  categories={categories}
                  onApply={applySuggestion}
                  isApplying={applyingId === suggestion.pattern}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Rules Section */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-200">Matching Rules</h3>
            <p className="text-xs text-slate-500 mt-1">Auto-assign categories when importing transactions</p>
          </div>
          <button
            onClick={() => {
              setEditingRuleId(null);
              setRuleFormData({ name: '', pattern: '', pattern_type: 'contains', match_field: 'description', category_id: '' });
              setShowRuleForm(!showRuleForm);
            }}
            className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Plus size={16} />
            Add Rule
          </button>
        </div>

        {showRuleForm && (
          <form onSubmit={handleRuleSubmit} className="mb-4 p-4 bg-slate-800/50 rounded-xl space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Pattern
                </label>
                <input
                  type="text"
                  value={ruleFormData.pattern}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, pattern: e.target.value })}
                  required
                  placeholder="e.g. NETFLIX or 1234567890"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Match Field
                </label>
                <select
                  value={ruleFormData.match_field}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, match_field: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                >
                  <option value="description">Description</option>
                  <option value="counterparty_account">Counterparty Account</option>
                  <option value="raw_description">Raw Description</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Match Type
                </label>
                <select
                  value={ruleFormData.pattern_type}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, pattern_type: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                >
                  <option value="contains">Contains</option>
                  <option value="exact">Exact match</option>
                  <option value="regex">Regex</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Name (optional)
                </label>
                <input
                  type="text"
                  value={ruleFormData.name}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, name: e.target.value })}
                  placeholder="Rule name"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Category
                </label>
                <select
                  value={ruleFormData.category_id}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, category_id: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                >
                  <option value="">Select category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setShowRuleForm(false); setEditingRuleId(null); }}
                className="flex-1 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={14} /> : editingRuleId ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-1">
          {rules.map((rule) => {
            const category = categories.find(c => c.id === rule.category_id);
            return (
              <div
                key={rule.id}
                className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-xl hover:bg-slate-800/50 transition-colors group"
              >
                <Zap size={14} className="text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-200 font-medium">{rule.name || rule.pattern}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
                      {rule.pattern_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono">"{rule.pattern}"</span>
                    {category && (
                      <>
                        <span>→</span>
                        <span style={{ color: category.color }}>{category.name}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => startEditRule(rule)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  {deleteRuleConfirm === rule.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        disabled={loading}
                        className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-900/30 transition-colors"
                        title="Confirm delete"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteRuleConfirm(null)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
                        title="Cancel"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteRuleConfirm(rule.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {rules.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-sm">
              No rules yet. Create one or use auto-categorization to generate rules.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface SuggestionCardProps {
  suggestion: CategorizationSuggestion;
  categories: Category[];
  onApply: (suggestion: CategorizationSuggestion, categoryId: string, createRule: boolean) => void;
  isApplying: boolean;
}

function SuggestionCard({ suggestion, categories, onApply, isApplying }: SuggestionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [createRule, setCreateRule] = useState(true);

  return (
    <div className="bg-slate-800/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-800/70 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="font-medium text-slate-200 text-sm truncate">
            "{suggestion.pattern}"
          </div>
          <div className="text-xs text-slate-500">
            {suggestion.count} transactions
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-slate-700/50 pt-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Assign Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
            >
              <option value="">Select category...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={createRule}
              onChange={(e) => setCreateRule(e.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500"
            />
            Create rule for future transactions
          </label>

          <button
            onClick={() => onApply(suggestion, selectedCategory, createRule)}
            disabled={!selectedCategory || isApplying}
            className="w-full py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isApplying ? (
              <>
                <Loader2 className="animate-spin" size={14} />
                Applying...
              </>
            ) : (
              <>
                <Check size={14} />
                Apply to {suggestion.count} transactions
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
