import { useState } from 'react';
import { ChevronDown, Tag, Check } from 'lucide-react';
import { Category } from '@/types';

interface CategoryPickerProps {
  categories: Category[];
  selectedCategoryId?: string;
  onSelect: (categoryId: string | undefined) => void;
  placeholder?: string;
}

export function CategoryPicker({
  categories,
  selectedCategoryId,
  onSelect,
  placeholder = 'Select category',
}: CategoryPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 hover:bg-slate-700 transition-colors"
      >
        {selectedCategory ? (
          <>
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: selectedCategory.color || '#64748b' }}
            />
            <span className="font-medium text-slate-200 text-sm">{selectedCategory.name}</span>
          </>
        ) : (
          <>
            <Tag size={16} className="text-slate-500" />
            <span className="text-slate-500 text-sm">{placeholder}</span>
          </>
        )}
        <ChevronDown
          size={16}
          className={`text-slate-400 ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-2 w-full bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-20 py-1 max-h-64 overflow-y-auto">
            {selectedCategoryId && (
              <button
                onClick={() => {
                  onSelect(undefined);
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700 transition-colors text-slate-400"
              >
                <span className="text-sm">Clear selection</span>
              </button>
            )}

            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => {
                  onSelect(category.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700 transition-colors ${
                  selectedCategoryId === category.id ? 'bg-blue-600/20' : ''
                }`}
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: category.color || '#64748b' }}
                />
                <span className="font-medium text-slate-200 text-sm">{category.name}</span>
                {selectedCategoryId === category.id && (
                  <Check size={16} className="text-blue-400 ml-auto" />
                )}
              </button>
            ))}

            {categories.length === 0 && (
              <div className="px-4 py-3 text-slate-500 text-sm text-center">No categories</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
