import { useState, useEffect } from 'react';
import { Loader2, Slack, Wallet, CheckCircle2, Calendar, Globe, ArrowRight } from 'lucide-react';

interface MarketplaceProps {
  onAdd: (sourceType: string, name: string) => Promise<void>;
  onClose: () => void;
  getAvailable: () => Promise<any[]>;
  activeWorkspaceId?: string;
  authToken?: string;
}

const ICON_MAP: Record<string, any> = {
  'slack': Slack,
  'wallet': Wallet,
  'check-circle': CheckCircle2,
  'calendar': Calendar,
};

export function Marketplace({ onAdd, onClose, getAvailable, activeWorkspaceId, authToken }: MarketplaceProps) {
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    getAvailable().then(setSources).finally(() => setLoading(false));
  }, [getAvailable]);

  const handleAdd = async (source: any) => {
    if (source.auth_type === 'oauth2' && source.auth_url && activeWorkspaceId) {
      setAdding(source.id);
      try {
        const res = await fetch(`http://127.0.0.1:8090${source.auth_url}?workspace=${activeWorkspaceId}`, {
          headers: { 'Authorization': authToken || '' },
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        }
      } catch (error) {
        console.error(error);
      } finally {
        setAdding(null);
      }
      return;
    }

    setAdding(source.id);
    try {
      await onAdd(source.id, source.name);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1 pb-8">
      {loading ? (
        <div className="py-10 flex justify-center">
          <Loader2 className="animate-spin text-slate-500" size={32} />
        </div>
      ) : (
        <div className="flex flex-col space-y-3 w-full">
          {sources.map((s) => {
            const Icon = ICON_MAP[s.icon] || Globe;
            const isAdding = adding === s.id;

            return (
              <button
                key={s.id}
                onClick={() => !adding && handleAdd(s)}
                disabled={!!adding}
                className="w-full group p-5 bg-slate-800 border border-slate-700 rounded-2xl flex items-center justify-between gap-6 hover:bg-slate-700 hover:border-blue-500 hover:shadow-lg transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-5 min-w-0 flex-1">
                  <div className="w-14 h-14 bg-slate-900 rounded-2xl border border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-blue-400 transition-colors shrink-0 shadow-sm">
                    <Icon size={28} />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <h4 className="font-bold text-slate-200 text-base mb-1">{s.name}</h4>
                    <p className="text-xs text-slate-400 leading-relaxed block">
                      {s.description}
                    </p>
                  </div>
                </div>
                <div
                  className={`shrink-0 border px-6 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    isAdding
                      ? 'bg-slate-700 border-slate-600 text-slate-400'
                      : 'bg-slate-900 border-slate-700 text-slate-300 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 shadow-sm'
                  }`}
                >
                  {isAdding ? <Loader2 className="animate-spin" size={14} /> : (
                    <>Connect <ArrowRight size={14} /></>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
