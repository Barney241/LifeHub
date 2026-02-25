'use client';

import { useState, useCallback } from 'react';
import { Upload, Check, AlertCircle, Loader2, X, Lock, FileText } from 'lucide-react';
import { InvestmentImportResult } from '@/types';

interface InvestmentImportProps {
  onImport: (file: File, provider: string, password?: string) => Promise<InvestmentImportResult>;
  onClose: () => void;
}

interface FileResult {
  filename: string;
  status: 'pending' | 'importing' | 'success' | 'error' | 'duplicate';
  result?: InvestmentImportResult;
  error?: string;
  validationErrors?: string[];
}

export function InvestmentImport({ onImport, onClose }: InvestmentImportProps) {
  const [provider, setProvider] = useState<'fondee' | 'amundi' | 'revolut-stocks' | 'revolut-crypto'>('fondee');
  const [password, setPassword] = useState('');
  const [files, setFiles] = useState<FileResult[]>([]);
  const [importing, setImporting] = useState(false);

  const formatCurrency = (value: number, currency = 'CZK') =>
    new Intl.NumberFormat('cs-CZ', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);

  const handleFilesSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      if (selectedFiles.length === 0) return;

      const fileResults: FileResult[] = selectedFiles.map((f) => ({
        filename: f.name,
        status: 'pending' as const,
      }));
      setFiles(fileResults);
      setImporting(true);

      // Process files sequentially
      for (let i = 0; i < selectedFiles.length; i++) {
        setFiles((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, status: 'importing' } : f))
        );

        try {
          const result = await onImport(selectedFiles[i], provider, password || undefined);
          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === i ? { ...f, status: 'success', result } : f
            )
          );
        } catch (err: any) {
          let status: FileResult['status'] = 'error';
          let errorMsg = 'Import failed';
          let validationErrors: string[] | undefined;

          if (err?.error === 'duplicate snapshot') {
            status = 'duplicate';
            errorMsg = err.message || 'Already imported';
          } else if (err?.validation_errors) {
            validationErrors = err.validation_errors;
            errorMsg = err.error || 'Validation failed';
          } else if (err?.error) {
            errorMsg = err.error;
          } else if (err instanceof Error) {
            errorMsg = err.message;
          }

          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === i ? { ...f, status, error: errorMsg, validationErrors } : f
            )
          );
        }
      }

      setImporting(false);
      // Reset input so same files can be re-selected
      e.target.value = '';
    },
    [provider, password, onImport]
  );

  const successCount = files.filter((f) => f.status === 'success').length;
  const errorCount = files.filter((f) => f.status === 'error').length;
  const dupeCount = files.filter((f) => f.status === 'duplicate').length;
  const hasResults = files.length > 0 && !importing;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-200">Import Investment Reports</h2>
        <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
          <X size={20} className="text-slate-400" />
        </button>
      </div>

      {/* Settings */}
      {!hasResults && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Provider
            </label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as typeof provider)}
              disabled={importing}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-blue-500 disabled:opacity-50"
            >
              <option value="fondee">Fondee</option>
              <option value="amundi">Amundi</option>
              <option value="revolut-stocks">Revolut Stocks</option>
              <option value="revolut-crypto">Revolut Crypto</option>
            </select>
          </div>

          {provider === 'amundi' && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                <Lock size={12} className="inline mr-1" />
                PDF Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter PDF password (shared for all files)"
                disabled={importing}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-blue-500 disabled:opacity-50"
              />
            </div>
          )}

          <label className="block">
            <div className="border-2 border-dashed border-slate-700 rounded-2xl p-8 hover:border-slate-600 transition-colors cursor-pointer text-center">
              <input
                type="file"
                accept={provider.startsWith('revolut') ? '.csv' : '.pdf'}
                multiple
                onChange={handleFilesSelected}
                className="hidden"
                disabled={importing}
              />
              {importing ? (
                <Loader2 size={32} className="animate-spin text-blue-400 mx-auto mb-3" />
              ) : (
                <Upload size={32} className="text-slate-500 mx-auto mb-3" />
              )}
              <div className="font-medium text-slate-300 mb-1">
                {importing
                  ? `Processing ${files.filter((f) => f.status === 'importing').length > 0 ? files.findIndex((f) => f.status === 'importing') + 1 : files.length} of ${files.length}...`
                  : provider.startsWith('revolut')
                  ? 'Drop CSV files here or click to browse'
                  : 'Drop PDF files here or click to browse'}
              </div>
              <div className="text-sm text-slate-500">
                {provider === 'fondee' && 'Select one or multiple Fondee statements'}
                {provider === 'amundi' && 'Select one or multiple Amundi reports'}
                {provider === 'revolut-stocks' && 'Select Revolut stock trading P&L statement CSV'}
                {provider === 'revolut-crypto' && 'Select Revolut crypto trading account statement CSV'}
              </div>
            </div>
          </label>
        </div>
      )}

      {/* Progress / Results */}
      {files.length > 0 && (
        <div className="space-y-3">
          {/* Summary bar */}
          {hasResults && (
            <div className="grid grid-cols-3 gap-3 mb-2">
              <div className="bg-emerald-900/20 border border-emerald-800/30 rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-emerald-400">{successCount}</div>
                <div className="text-xs text-slate-500">Imported</div>
              </div>
              <div className="bg-amber-900/20 border border-amber-800/30 rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-amber-400">{dupeCount}</div>
                <div className="text-xs text-slate-500">Duplicates</div>
              </div>
              <div className="bg-rose-900/20 border border-rose-800/30 rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-rose-400">{errorCount}</div>
                <div className="text-xs text-slate-500">Errors</div>
              </div>
            </div>
          )}

          {/* Per-file results */}
          <div className="max-h-80 overflow-y-auto space-y-2">
            {files.map((f, i) => (
              <div
                key={i}
                className={`rounded-xl border p-4 ${
                  f.status === 'success'
                    ? 'bg-emerald-900/10 border-emerald-800/30'
                    : f.status === 'duplicate'
                    ? 'bg-amber-900/10 border-amber-800/30'
                    : f.status === 'error'
                    ? 'bg-rose-900/10 border-rose-800/30'
                    : f.status === 'importing'
                    ? 'bg-blue-900/10 border-blue-800/30'
                    : 'bg-slate-800/30 border-slate-700/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  {f.status === 'importing' && <Loader2 size={16} className="animate-spin text-blue-400" />}
                  {f.status === 'success' && <Check size={16} className="text-emerald-400" />}
                  {f.status === 'duplicate' && <AlertCircle size={16} className="text-amber-400" />}
                  {f.status === 'error' && <AlertCircle size={16} className="text-rose-400" />}
                  {f.status === 'pending' && <FileText size={16} className="text-slate-500" />}

                  <span className="text-sm text-slate-300 truncate flex-1">{f.filename}</span>

                  {f.status === 'success' && f.result && (
                    <span className="text-sm font-medium text-slate-200 shrink-0">
                      {formatCurrency(f.result.snapshot.end_value)}
                    </span>
                  )}
                </div>

                {f.status === 'success' && f.result && (
                  <div className="mt-2 ml-7 flex gap-4 text-xs text-slate-400">
                    <span>{f.result.snapshot.portfolio_name}</span>
                    <span className={f.result.snapshot.gain_loss >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {f.result.snapshot.gain_loss >= 0 ? '+' : ''}{formatCurrency(f.result.snapshot.gain_loss)}
                    </span>
                    {f.result.snapshot.holdings && f.result.snapshot.holdings.length > 0 && (
                      <span>{f.result.snapshot.holdings.length} holdings</span>
                    )}
                  </div>
                )}

                {f.status === 'duplicate' && (
                  <div className="mt-1 ml-7 text-xs text-amber-400">{f.error}</div>
                )}

                {f.status === 'error' && (
                  <div className="mt-1 ml-7">
                    <div className="text-xs text-rose-400">{f.error}</div>
                    {f.validationErrors && f.validationErrors.length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-xs text-rose-300">
                        {f.validationErrors.map((ve, j) => (
                          <li key={j}>- {ve}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Action buttons */}
          {hasResults && (
            <div className="flex gap-3">
              <button
                onClick={() => setFiles([])}
                className="flex-1 py-3 rounded-xl bg-slate-800 font-bold text-slate-300 hover:bg-slate-700 transition-colors text-sm"
              >
                Import More
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl bg-blue-600 font-bold text-white hover:bg-blue-700 transition-colors text-sm"
              >
                Done
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
