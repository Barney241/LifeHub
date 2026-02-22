import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Workspace, User } from '@/types';

interface MobileNavProps {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setActiveWorkspace: (ws: Workspace) => void;
  user: User | null;
  onLogout: () => void;
  onAddWorkspace: () => void;
}

export function MobileNav({ workspaces, activeWorkspace, setActiveWorkspace, user, onLogout, onAddWorkspace }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsOpen(true)} className="p-2 -ml-2 text-slate-500 hover:bg-slate-50 rounded-lg">
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center text-white font-bold text-xs">L</div>
            <span className="font-bold text-lg tracking-tight">LifeHub</span>
          </div>
        </div>
      </div>

      {/* Slide-over Menu */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <div className="absolute top-0 bottom-0 left-0 w-3/4 max-w-xs bg-white shadow-2xl flex flex-col animate-in slide-in-from-left duration-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <span className="font-bold text-lg text-slate-800">Menu</span>
              <button onClick={() => setIsOpen(false)} className="p-2 -mr-2 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            
            {/* Reuse Sidebar Logic inside Mobile Menu */}
            <div className="flex-1 overflow-y-auto">
               <Sidebar 
                 workspaces={workspaces} 
                 activeWorkspace={activeWorkspace} 
                 setActiveWorkspace={(ws) => {
                   setActiveWorkspace(ws);
                   setIsOpen(false);
                 }}
                 user={user}
                 onLogout={onLogout}
                 onAddWorkspace={() => {
                   onAddWorkspace();
                   setIsOpen(false);
                 }}
                 isMobile={true}
               />
            </div>
          </div>
        </div>
      )}
    </>
  );
}