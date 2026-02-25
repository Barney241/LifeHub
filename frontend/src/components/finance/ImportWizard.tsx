import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, Check, AlertCircle, Loader2, X } from 'lucide-react';
import { Account, BankTemplate, ImportPreview, ImportResult } from '@/types';

interface ImportWizardProps {
  accounts: Account[];
  templates: BankTemplate[];
  onPreview: (file: File, templateCode: string) => Promise<ImportPreview>;
  onImport: (file: File, accountId: string, templateCode: string) => Promise<ImportResult>;
  onClose: () => void;
}

type Step = 'upload' | 'preview' | 'result';

export function ImportWizard({
  accounts,
  templates,
  onPreview,
  onImport,
  onClose,
}: ImportWizardProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [templateCode, setTemplateCode] = useState('csob');
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (!selectedFile) return;

      setFile(selectedFile);
      setError(null);
      setLoading(true);

      try {
        const previewResult = await onPreview(selectedFile, templateCode);
        setPreview(previewResult);
        setStep('preview');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse file');
      } finally {
        setLoading(false);
      }
    },
    [templateCode, onPreview]
  );

  const handleImport = async () => {
    if (!file || !accountId) return;

    setLoading(true);
    setError(null);

    try {
      const importResult = await onImport(file, accountId, templateCode);
      setResult(importResult);
      setStep('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-200">Import Transactions</h2>
        <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
          <X size={20} className="text-slate-400" />
        </button>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {(['upload', 'preview', 'result'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step === s
                  ? 'bg-blue-600 text-white'
                  : i < ['upload', 'preview', 'result'].indexOf(step)
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-700 text-slate-400'
              }`}
            >
              {i < ['upload', 'preview', 'result'].indexOf(step) ? (
                <Check size={16} />
              ) : (
                i + 1
              )}
            </div>
            {i < 2 && <div className="w-8 h-0.5 bg-slate-700" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-rose-900/30 border border-rose-800 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-rose-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-rose-400">Error</div>
            <div className="text-sm text-rose-300">{error}</div>
          </div>
        </div>
      )}

      {/* Step: Upload */}
      {step === 'upload' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Bank Format
            </label>
            <select
              value={templateCode}
              onChange={(e) => setTemplateCode(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-blue-500"
            >
              {templates.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Target Account
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-blue-500"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.bank_name || a.account_type})
                </option>
              ))}
            </select>
          </div>

          <label className="block">
            <div className="border-2 border-dashed border-slate-700 rounded-2xl p-8 hover:border-slate-600 transition-colors cursor-pointer text-center">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                disabled={loading}
              />
              {loading ? (
                <Loader2 size={32} className="animate-spin text-blue-400 mx-auto mb-3" />
              ) : (
                <FileSpreadsheet size={32} className="text-slate-500 mx-auto mb-3" />
              )}
              <div className="font-medium text-slate-300 mb-1">
                {loading ? 'Processing...' : 'Drop CSV file here or click to browse'}
              </div>
              <div className="text-sm text-slate-500">Supports bank statement exports</div>
            </div>
          </label>
        </div>
      )}

      {/* Step: Preview */}
      {step === 'preview' && preview && (
        <div className="space-y-4">
          <div className="bg-slate-800/50 rounded-xl p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-slate-200">{preview.total_rows}</div>
                <div className="text-xs text-slate-500 uppercase">Total Rows</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-400">
                  {preview.transactions.length}
                </div>
                <div className="text-xs text-slate-500 uppercase">Valid</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-rose-400">{preview.errors.length}</div>
                <div className="text-xs text-slate-500 uppercase">Errors</div>
              </div>
            </div>
          </div>

          {/* Transaction preview */}
          <div className="max-h-64 overflow-y-auto bg-slate-800/30 rounded-xl">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-800">
                <tr className="text-left text-xs text-slate-500 uppercase">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Description</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {preview.transactions.slice(0, 10).map((tx, i) => (
                  <tr key={i} className="border-t border-slate-700/50">
                    <td className="px-4 py-2 text-slate-400">
                      {new Date(tx.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-slate-200 truncate max-w-[200px]">
                      {tx.description}
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-medium ${
                        tx.is_expense ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {tx.is_expense ? '-' : '+'}
                      {tx.amount.toFixed(2)} {tx.currency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.transactions.length > 10 && (
              <div className="px-4 py-2 text-center text-sm text-slate-500">
                ... and {preview.transactions.length - 10} more
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setStep('upload');
                setPreview(null);
                setFile(null);
              }}
              className="flex-1 py-3 rounded-xl bg-slate-800 font-bold text-slate-300 hover:bg-slate-700 transition-colors text-sm"
            >
              Back
            </button>
            <button
              onClick={handleImport}
              disabled={loading || preview.transactions.length === 0}
              className="flex-1 py-3 rounded-xl bg-blue-600 font-bold text-white hover:bg-blue-700 shadow-lg shadow-blue-900/50 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <>
                  <Upload size={16} />
                  Import {preview.transactions.length} Transactions
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step: Result */}
      {step === 'result' && result && (
        <div className="space-y-4">
          <div className="bg-emerald-900/30 border border-emerald-800 rounded-xl p-6 text-center">
            <Check size={48} className="text-emerald-400 mx-auto mb-3" />
            <div className="text-lg font-bold text-emerald-400 mb-1">Import Complete</div>
            <div className="text-sm text-emerald-300">
              Successfully imported {result.transactions_imported} transactions
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-slate-200">
                {result.transactions_imported}
              </div>
              <div className="text-xs text-slate-500 uppercase">Imported</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-amber-400">{result.duplicates_found}</div>
              <div className="text-xs text-slate-500 uppercase">Duplicates Skipped</div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="bg-rose-900/20 rounded-xl p-4">
              <div className="font-medium text-rose-400 mb-2">
                {result.errors.length} Errors
              </div>
              <div className="space-y-1 text-sm text-rose-300 max-h-32 overflow-y-auto">
                {result.errors.map((err, i) => (
                  <div key={i}>
                    Row {err.row}: {err.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-blue-600 font-bold text-white hover:bg-blue-700 transition-colors text-sm"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
