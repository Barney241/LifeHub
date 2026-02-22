import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Account, Category } from '@/types';
import { CategoryPicker } from '../finance/CategoryPicker';

interface TransactionFormProps {
  onSubmit: (
    description: string,
    amount: number,
    type: 'income' | 'expense',
    accountId?: string,
    categoryId?: string
  ) => Promise<void>;
  onClose: () => void;
  accounts?: Account[];
  categories?: Category[];
}

export function TransactionForm({ onSubmit, onClose, accounts, categories }: TransactionFormProps) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [accountId, setAccountId] = useState(accounts?.[0]?.id || '');
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(description, parseFloat(amount), type, accountId || undefined, categoryId);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          placeholder="e.g. Lunch with team"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm text-slate-100 placeholder-slate-500"
        />
      </div>

      {accounts && accounts.length > 0 && (
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Account</label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm text-slate-100"
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} {acc.bank_name ? `(${acc.bank_name})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Amount</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 pl-8 pr-4 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm text-slate-100"
            />
          </div>
        </div>

        <div className="flex-1">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Type</label>
          <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all ${
                type === 'expense'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              EXP
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all ${
                type === 'income'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              INC
            </button>
          </div>
        </div>
      </div>

      {categories && categories.length > 0 && (
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Category</label>
          <CategoryPicker
            categories={categories}
            selectedCategoryId={categoryId}
            onSelect={setCategoryId}
            placeholder="Select category (optional)"
          />
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-3 rounded-xl bg-slate-800 font-bold text-slate-300 hover:bg-slate-700 transition-colors text-sm"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-3 rounded-xl bg-blue-600 font-bold text-white hover:bg-blue-700 shadow-lg shadow-blue-900/50 transition-all text-sm flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : 'Log Transaction'}
        </button>
      </div>
    </form>
  );
}
