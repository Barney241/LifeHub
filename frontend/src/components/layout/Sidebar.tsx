import { Briefcase, User as UserIcon, LogOut, Plus, LayoutDashboard, Home, Star, Heart, Target, Zap, Coffee, ShoppingCart, GraduationCap, CheckCircle2, Wallet, Calendar } from 'lucide-react';
import { Workspace, User } from '@/types';

const ICON_MAP: Record<string, React.ElementType> = {
  'layout-dashboard': LayoutDashboard,
  'briefcase': Briefcase,
  'user': UserIcon,
  'home': Home,
  'star': Star,
  'heart': Heart,
  'target': Target,
  'zap': Zap,
  'coffee': Coffee,
  'shopping-cart': ShoppingCart,
  'graduation-cap': GraduationCap,
};

interface SidebarProps {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setActiveWorkspace: (ws: Workspace) => void;
  user: User | null;
  onLogout: () => void;
  onAddWorkspace: () => void;
  activeModules?: string[];
  activeSection?: string;
  setActiveSection?: (s: string) => void;
  isMobile?: boolean;
}

export function Sidebar({
  workspaces,
  activeWorkspace,
  setActiveWorkspace,
  user,
  onLogout,
  onAddWorkspace,
  activeModules = [],
  activeSection = 'dashboard',
  setActiveSection,
  isMobile
}: SidebarProps) {
  const containerClass = isMobile
    ? "w-full flex flex-col h-full bg-slate-900"
    : "w-64 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex";

  return (
    <aside className={containerClass}>
      {!isMobile && (
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">L</div>
          <span className="font-bold text-xl tracking-tight text-slate-100">LifeHub</span>
        </div>
      )}

      <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
        <div>
          <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Workspaces</p>
          <div className="space-y-1">
            {workspaces.map((ws) => {
              const Icon = ICON_MAP[ws.icon || 'layout-dashboard'] || LayoutDashboard;
              return (
                <button
                  key={ws.id}
                  onClick={() => setActiveWorkspace(ws)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeWorkspace?.id === ws.id
                      ? 'bg-blue-600/20 text-blue-400'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Icon size={18} />
                  <span className="truncate">{ws.name}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={onAddWorkspace}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-800 transition-all mt-2 border border-dashed border-slate-700"
          >
            <Plus size={18} />
            <span>Add Workspace</span>
          </button>
        </div>

        {activeWorkspace && activeModules.length > 0 && (
          <div>
            <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Modules</p>
            <div className="space-y-1">
              <button
                onClick={() => setActiveSection?.('dashboard')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeSection === 'dashboard' ? 'bg-slate-800 text-slate-100 font-bold' : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                <LayoutDashboard size={18} /> Dashboard
              </button>
              {activeModules.includes('task') && (
                <button
                  onClick={() => setActiveSection?.('tasks')}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeSection === 'tasks' ? 'bg-blue-600/20 text-blue-400 font-bold' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <CheckCircle2 size={18} /> Tasks
                </button>
              )}
              {activeModules.includes('calendar') && (
                <button
                  onClick={() => setActiveSection?.('calendar')}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeSection === 'calendar' ? 'bg-amber-600/20 text-amber-400 font-bold' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Calendar size={18} /> Calendar
                </button>
              )}
              {activeModules.includes('finance') && (
                <button
                  onClick={() => setActiveSection?.('finance')}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeSection === 'finance' ? 'bg-emerald-600/20 text-emerald-400 font-bold' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Wallet size={18} /> Finance
                </button>
              )}
            </div>
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-2">
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-800 rounded-2xl mb-4">
          <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-slate-400 font-bold text-xs uppercase">
            {user?.email?.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-300 truncate">{user?.email}</p>
          </div>
        </div>

        <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-2 text-rose-400 text-sm font-semibold hover:bg-rose-900/30 rounded-xl transition-all">
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
