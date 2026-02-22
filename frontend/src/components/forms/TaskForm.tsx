import { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface TaskFormProps {
  onSubmit: (content: string, priority: string, due?: Date) => Promise<void>;
  onClose: () => void;
}

export function TaskForm({ onSubmit, onClose }: TaskFormProps) {
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState('medium');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(content, priority, new Date());
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
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Task Content</label>
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          placeholder="What needs to be done?"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm text-slate-100 placeholder-slate-500"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Priority</label>
        <div className="flex gap-2">
          {['low', 'medium', 'high'].map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase transition-all border ${
                priority === p
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

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
          {loading ? <Loader2 className="animate-spin" size={16} /> : 'Create Task'}
        </button>
      </div>
    </form>
  );
}
