import { CreditCard, Wallet, PiggyBank, Banknote } from 'lucide-react';
import { Account } from '@/types';

interface AccountCardProps {
  account: Account;
  isSelected?: boolean;
  onClick?: () => void;
}

const accountIcons = {
  checking: CreditCard,
  savings: PiggyBank,
  credit: CreditCard,
  cash: Banknote,
};

export function AccountCard({ account, isSelected, onClick }: AccountCardProps) {
  const Icon = accountIcons[account.account_type] || Wallet;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: account.currency || 'CZK',
    }).format(amount);
  };

  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-2xl border transition-all cursor-pointer ${
        isSelected
          ? 'bg-blue-600/20 border-blue-500 ring-2 ring-blue-500/30'
          : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-slate-600'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className={`p-2 rounded-xl ${
            isSelected ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700 text-slate-400'
          }`}
        >
          <Icon size={20} />
        </div>
        {account.bank_name && (
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            {account.bank_name}
          </span>
        )}
      </div>

      <h3 className="font-bold text-slate-200 text-sm mb-1">{account.name}</h3>

      <div className="flex items-baseline gap-1">
        <span
          className={`text-lg font-bold ${
            account.current_balance >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}
        >
          {formatCurrency(account.current_balance)}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span
          className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase ${
            account.account_type === 'checking'
              ? 'bg-blue-900/50 text-blue-400'
              : account.account_type === 'savings'
              ? 'bg-emerald-900/50 text-emerald-400'
              : account.account_type === 'credit'
              ? 'bg-amber-900/50 text-amber-400'
              : 'bg-slate-700 text-slate-400'
          }`}
        >
          {account.account_type}
        </span>
        {!account.is_active && (
          <span className="text-[10px] px-2 py-0.5 rounded-md font-bold uppercase bg-slate-700 text-slate-500">
            Inactive
          </span>
        )}
      </div>
    </div>
  );
}
