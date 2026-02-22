import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '5xl';
  noPadding?: boolean;
}

export function Modal({ isOpen, onClose, title, children, size = 'md', noPadding = false }: ModalProps) {
  if (!isOpen) return null;

  const maxWidthClass = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
  }[size];

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`bg-slate-900 w-full ${maxWidthClass} rounded-3xl shadow-2xl overflow-hidden border border-slate-800 relative`}>
        <div className="p-8 pb-4">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X size={20} />
          </button>
          <h3 className="text-xl font-bold text-slate-200">{title}</h3>
        </div>
        <div className={noPadding ? "" : "p-8 pt-0"}>
          {children}
        </div>
      </div>
    </div>
  );
}
