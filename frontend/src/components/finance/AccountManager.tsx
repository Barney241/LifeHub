import { useState, useMemo } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { Account } from '@/types';
import { AccountCard } from './AccountCard';

interface AccountManagerProps {
  accounts: Account[];
  selectedAccountId: string | null;
  onSelectAccount: (accountId: string | null) => void;
  onCreateAccount: (account: Omit<Account, 'id' | 'current_balance'>) => Promise<void>;
}

export function AccountManager({
  accounts,
  selectedAccountId,
  onSelectAccount,
  onCreateAccount,
}: AccountManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    bank_name: '',
    account_type: 'checking' as Account['account_type'],
    currency: 'CZK',
    initial_balance: 0,
    is_active: true,
  });

  // Aggregate balances by currency
  const aggregatedBalances = useMemo(() => {
    const byCurrency: Record<string, number> = {};
    accounts.filter(a => a.is_active).forEach(acc => {
      byCurrency[acc.currency] = (byCurrency[acc.currency] || 0) + acc.current_balance;
    });
    return Object.entries(byCurrency).map(([currency, total]) => ({ currency, total }));
  }, [accounts]);

  const formatCurrency = (amount: number, currency: string) =>
    new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onCreateAccount(formData);
      setShowForm(false);
      setFormData({
        name: '',
        bank_name: '',
        account_type: 'checking',
        currency: 'CZK',
        initial_balance: 0,
        is_active: true,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-200">Accounts</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          <Plus size={16} />
          Add Account
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-800/50 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g. Main Checking"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Bank
              </label>
              <input
                type="text"
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                placeholder="e.g. CSOB"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Type
              </label>
              <select
                value={formData.account_type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    account_type: e.target.value as Account['account_type'],
                  })
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
              >
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
                <option value="credit">Credit</option>
                <option value="cash">Cash</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Currency
              </label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
              >
                <option value="CZK">CZK</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Initial Balance
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.initial_balance}
                onChange={(e) =>
                  setFormData({ ...formData, initial_balance: parseFloat(e.target.value) || 0 })
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={14} /> : 'Create'}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* All accounts option */}
        <div
          onClick={() => onSelectAccount(null)}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            selectedAccountId === null
              ? 'bg-blue-600/20 border-blue-500 ring-2 ring-blue-500/30'
              : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="font-bold text-slate-200 text-sm">All Accounts</div>
            <div className="text-xs text-slate-500">{accounts.filter(a => a.is_active).length} active</div>
          </div>
          {aggregatedBalances.length > 0 ? (
            <div className="space-y-0.5">
              {aggregatedBalances.map(({ currency, total }) => (
                <div
                  key={currency}
                  className={`text-lg font-bold ${total >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                >
                  {formatCurrency(total, currency)}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-500">No accounts</div>
          )}
        </div>

        {accounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            isSelected={selectedAccountId === account.id}
            onClick={() => onSelectAccount(account.id)}
          />
        ))}
      </div>
    </div>
  );
}
