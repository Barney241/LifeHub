import { useState, useEffect } from 'react';
import { Tag, Check, X, Loader2, Lightbulb } from 'lucide-react';
import { CategorizationSuggestion, Category } from '@/types';
import { CategoryPicker } from './CategoryPicker';

interface BulkCategorizeProps {
  categories: Category[];
  onGetSuggestions: () => Promise<CategorizationSuggestion[]>;
  onApply: (
    transactionIds: string[],
    categoryId?: string,
    merchantId?: string,
    createRule?: boolean,
    pattern?: string
  ) => Promise<void>;
}

export function BulkCategorize({ categories, onGetSuggestions, onApply }: BulkCategorizeProps) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<CategorizationSuggestion[]>([]);
  const [applyingPattern, setApplyingPattern] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<Record<string, string>>({});

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const results = await onGetSuggestions();
      setSuggestions(results);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuggestions();
  }, []);

  const handleApply = async (suggestion: CategorizationSuggestion, createRule: boolean) => {
    const categoryId = selectedCategories[suggestion.pattern] || suggestion.suggested_category_id;
    if (!categoryId) return;

    setApplyingPattern(suggestion.pattern);
    try {
      await onApply(
        suggestion.transaction_ids,
        categoryId,
        suggestion.suggested_merchant_id,
        createRule,
        suggestion.pattern
      );
      setSuggestions(suggestions.filter((s) => s.pattern !== suggestion.pattern));
    } catch (err) {
      console.error(err);
    } finally {
      setApplyingPattern(null);
    }
  };

  const handleDismiss = (pattern: string) => {
    setSuggestions(suggestions.filter((s) => s.pattern !== pattern));
  };

  if (loading) {
    return (
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center">
        <Loader2 className="animate-spin text-blue-400 mx-auto mb-3" size={32} />
        <div className="text-slate-400">Analyzing transactions...</div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center">
        <Tag size={32} className="text-slate-600 mx-auto mb-3" />
        <div className="text-slate-400">No categorization suggestions</div>
        <div className="text-sm text-slate-500 mt-1">
          All transactions are categorized or no patterns found
        </div>
        <button
          onClick={loadSuggestions}
          className="mt-4 text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          Refresh suggestions
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb size={18} className="text-amber-400" />
          <h3 className="font-bold text-slate-200">Categorization Suggestions</h3>
        </div>
        <span className="text-xs bg-amber-900/30 text-amber-400 px-2 py-1 rounded-md font-bold">
          {suggestions.length} patterns found
        </span>
      </div>

      <div className="space-y-3">
        {suggestions.map((suggestion) => (
          <div
            key={suggestion.pattern}
            className="bg-slate-900 rounded-2xl border border-slate-800 p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-medium text-slate-200">{suggestion.pattern}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {suggestion.count} transactions matching • Sample: "{suggestion.sample_description}"
                </div>
              </div>
              <button
                onClick={() => handleDismiss(suggestion.pattern)}
                className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X size={16} className="text-slate-500" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <CategoryPicker
                  categories={categories}
                  selectedCategoryId={
                    selectedCategories[suggestion.pattern] || suggestion.suggested_category_id
                  }
                  onSelect={(id) =>
                    setSelectedCategories({
                      ...selectedCategories,
                      [suggestion.pattern]: id || '',
                    })
                  }
                  placeholder="Select category"
                />
              </div>

              <button
                onClick={() => handleApply(suggestion, false)}
                disabled={
                  applyingPattern === suggestion.pattern ||
                  (!selectedCategories[suggestion.pattern] && !suggestion.suggested_category_id)
                }
                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply Once
              </button>

              <button
                onClick={() => handleApply(suggestion, true)}
                disabled={
                  applyingPattern === suggestion.pattern ||
                  (!selectedCategories[suggestion.pattern] && !suggestion.suggested_category_id)
                }
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {applyingPattern === suggestion.pattern ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <Check size={14} />
                )}
                Apply & Create Rule
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
