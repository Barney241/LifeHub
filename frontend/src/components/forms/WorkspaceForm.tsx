import { useState, useEffect } from 'react';
import { Loader2, LayoutDashboard, Briefcase, User, Home, Star, Heart, Target, Zap, Coffee, ShoppingCart, GraduationCap } from 'lucide-react';
import { Workspace } from '@/types';

interface WorkspaceFormProps {
  workspace?: Workspace | null;
  onSubmit: (name: string, slug: string, icon: string) => Promise<any>;
  onClose: () => void;
  onDelete?: (id: string) => Promise<void>;
}

const AVAILABLE_ICONS = [
  { name: 'layout-dashboard', icon: LayoutDashboard },
  { name: 'briefcase', icon: Briefcase },
  { name: 'user', icon: User },
  { name: 'home', icon: Home },
  { name: 'star', icon: Star },
  { name: 'heart', icon: Heart },
  { name: 'target', icon: Target },
  { name: 'zap', icon: Zap },
  { name: 'coffee', icon: Coffee },
  { name: 'shopping-cart', icon: ShoppingCart },
  { name: 'graduation-cap', icon: GraduationCap },
];

export function WorkspaceForm({ workspace, onSubmit, onClose, onDelete }: WorkspaceFormProps) {
  const [name, setName] = useState(workspace?.name || '');
  const [slug, setSlug] = useState(workspace?.slug || '');
  const [icon, setIcon] = useState(workspace?.icon || 'layout-dashboard');
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (workspace) {
      setName(workspace.name);
      setSlug(workspace.slug);
      setIcon(workspace.icon || 'layout-dashboard');
    }
  }, [workspace]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(name, slug || name.toLowerCase().replace(/\s+/g, '-'), icon);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!workspace || !onDelete || !confirm('Are you sure you want to delete this workspace? This action cannot be undone.')) return;
    setDeleteLoading(true);
    try {
      await onDelete(workspace.id);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Workspace Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Home, Office, Project X"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm text-slate-100 placeholder-slate-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Slug</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="e.g. personal, work"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm text-slate-100 placeholder-slate-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 text-center">Icon</label>
          <div className="grid grid-cols-6 gap-2">
            {AVAILABLE_ICONS.map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => setIcon(item.name)}
                className={`p-2 rounded-lg border transition-all flex items-center justify-center ${
                  icon === item.name
                    ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-blue-500 hover:text-blue-400'
                }`}
              >
                <item.icon size={20} />
              </button>
            ))}
          </div>
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
            disabled={loading || deleteLoading}
            className="flex-1 py-3 rounded-xl bg-blue-600 font-bold text-white hover:bg-blue-700 shadow-lg shadow-blue-900/50 transition-all text-sm flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : workspace ? 'Update' : 'Create'}
          </button>
        </div>
      </form>

      {workspace && onDelete && (
        <div className="pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading || deleteLoading}
            className="w-full py-3 rounded-xl bg-rose-900/30 font-bold text-rose-400 hover:bg-rose-900/50 transition-colors text-sm flex items-center justify-center gap-2"
          >
            {deleteLoading ? <Loader2 className="animate-spin" size={16} /> : 'Delete Workspace'}
          </button>
        </div>
      )}
    </div>
  );
}
