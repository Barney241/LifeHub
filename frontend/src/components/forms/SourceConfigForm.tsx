import { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface SourceConfigFormProps {
  source: {
    id: string;
    name: string;
  };
  onUpdate: (id: string, newName: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onClose: () => void;
}

export function SourceConfigForm({ source, onUpdate, onRemove, onClose }: SourceConfigFormProps) {
  const [name, setName] = useState(source.name);
  const [loading, setLoading] = useState(false);
  const [removeLoading, setRemoveLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onUpdate(source.id, name);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm('Are you sure you want to remove this integration? Existing data linked to it will remain in the database but will be hidden.')) return;
    setRemoveLoading(true);
    try {
      await onRemove(source.id);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setRemoveLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Display Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. My Custom Task List"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm text-slate-100 placeholder-slate-500"
          />
        </div>

        <div className="flex gap-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-slate-800 font-bold text-slate-300 hover:bg-slate-700 transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || removeLoading}
            className="flex-1 py-3 rounded-xl bg-blue-600 font-bold text-white hover:bg-blue-700 shadow-lg shadow-blue-900/50 transition-all text-sm flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : 'Save Changes'}
          </button>
        </div>
      </form>

      <div className="pt-4 border-t border-slate-800">
        <button
          type="button"
          onClick={handleRemove}
          disabled={loading || removeLoading}
          className="w-full py-3 rounded-xl bg-rose-900/30 font-bold text-rose-400 hover:bg-rose-900/50 transition-colors text-sm flex items-center justify-center gap-2"
        >
          {removeLoading ? <Loader2 className="animate-spin" size={16} /> : 'Remove Integration'}
        </button>
      </div>
    </div>
  );
}
