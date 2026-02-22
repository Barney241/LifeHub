import { useState } from 'react';
import { ChevronDown, Tag, LayoutGrid } from 'lucide-react';
import { Category } from '@/types';

interface CategorySelectorProps {
  categories: Category[];
  selectedCategoryId: string | null;
  onSelect: (categoryId: string | null) => void;
}

export function CategorySelector({ categories, selectedCategoryId, onSelect }: CategorySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 hover:bg-slate-700 transition-colors min-w-[160px]"
      >
        {selectedCategory ? (
          <>
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: selectedCategory.color || '#64748b' }}
            />
            <span className="font-medium text-slate-200 text-sm truncate">
              {selectedCategory.name}
            </span>
          </>
        ) : (
          <>
            <LayoutGrid size={16} className="text-slate-400" />
            <span className="font-medium text-slate-300 text-sm">All Categories</span>
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
          <div className="absolute top-full left-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-20 py-1 overflow-hidden max-h-80 overflow-y-auto">
            <button
              onClick={() => {
                onSelect(null);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 transition-colors ${
                !selectedCategoryId ? 'bg-blue-600/20' : ''
              }`}
            >
              <LayoutGrid size={18} className="text-slate-400" />
              <div className="text-left">
                <div className="font-medium text-slate-200 text-sm">All Categories</div>
                <div className="text-[10px] text-slate-500">Show all transactions</div>
              </div>
            </button>

            <div className="h-px bg-slate-700 my-1" />

            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => {
                  onSelect(category.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 transition-colors ${
                  selectedCategoryId === category.id ? 'bg-blue-600/20' : ''
                }`}
              >
                <div
                  className="w-4 h-4 rounded-full shrink-0"
                  style={{ backgroundColor: category.color || '#64748b' }}
                />
                <span className="font-medium text-slate-200 text-sm truncate">
                  {category.name}
                </span>
                {category.is_system && (
                  <span className="text-[8px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-500 ml-auto">
                    SYS
                  </span>
                )}
              </button>
            ))}

            {categories.length === 0 && (
              <div className="px-4 py-3 text-sm text-slate-500 text-center">
                No categories yet
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
