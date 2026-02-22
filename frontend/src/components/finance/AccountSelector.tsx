import { useState, useMemo } from 'react';
import { ChevronDown, Wallet, LayoutGrid } from 'lucide-react';
import { Account } from '@/types';

interface AccountSelectorProps {
  accounts: Account[];
  selectedAccountId: string | null;
  onSelect: (accountId: string | null) => void;
}

export function AccountSelector({ accounts, selectedAccountId, onSelect }: AccountSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

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

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 hover:bg-slate-700 transition-colors min-w-[180px]"
      >
        {selectedAccount ? (
          <>
            <Wallet size={16} className="text-blue-400" />
            <span className="font-medium text-slate-200 text-sm truncate">
              {selectedAccount.name}
            </span>
            <span className={`text-xs font-bold ml-1 ${selectedAccount.current_balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatCurrency(selectedAccount.current_balance, selectedAccount.currency)}
            </span>
          </>
        ) : (
          <>
            <LayoutGrid size={16} className="text-slate-400" />
            <span className="font-medium text-slate-300 text-sm">All Accounts</span>
            {aggregatedBalances.length === 1 && (
              <span className={`text-xs font-bold ml-1 ${aggregatedBalances[0].total >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatCurrency(aggregatedBalances[0].total, aggregatedBalances[0].currency)}
              </span>
            )}
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
          <div className="absolute top-full left-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-20 py-1 overflow-hidden">
            <button
              onClick={() => {
                onSelect(null);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 transition-colors ${
                !selectedAccountId ? 'bg-blue-600/20' : ''
              }`}
            >
              <LayoutGrid size={18} className="text-slate-400" />
              <div className="text-left flex-1 min-w-0">
                <div className="font-medium text-slate-200 text-sm">All Accounts</div>
                <div className="text-[10px] text-slate-500">{accounts.filter(a => a.is_active).length} accounts</div>
              </div>
              {aggregatedBalances.length > 0 && (
                <div className="text-right">
                  {aggregatedBalances.map(({ currency, total }) => (
                    <div
                      key={currency}
                      className={`text-xs font-bold ${total >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                    >
                      {formatCurrency(total, currency)}
                    </div>
                  ))}
                </div>
              )}
            </button>

            <div className="h-px bg-slate-700 my-1" />

            {accounts.map((account) => (
              <button
                key={account.id}
                onClick={() => {
                  onSelect(account.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 transition-colors ${
                  selectedAccountId === account.id ? 'bg-blue-600/20' : ''
                }`}
              >
                <Wallet
                  size={18}
                  className={selectedAccountId === account.id ? 'text-blue-400' : 'text-slate-400'}
                />
                <div className="text-left flex-1 min-w-0">
                  <div className="font-medium text-slate-200 text-sm truncate">{account.name}</div>
                  <div className="text-[10px] text-slate-500">
                    {account.bank_name || account.account_type}
                  </div>
                </div>
                <span
                  className={`text-xs font-bold ${
                    account.current_balance >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {new Intl.NumberFormat('cs-CZ', {
                    style: 'currency',
                    currency: account.currency || 'CZK',
                    maximumFractionDigits: 0,
                  }).format(account.current_balance)}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
