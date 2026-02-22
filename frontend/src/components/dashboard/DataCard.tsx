import { CheckCircle2, Wallet, Slack, Calendar, Settings, MapPin, Video } from 'lucide-react';
import { DomainType, Task, FinancialRecord, Message, CalendarEvent } from '@/types';

interface DataCardProps {
  type: DomainType;
  sourceName: string;
  items: (Task | FinancialRecord | Message | CalendarEvent)[];
  onEdit?: () => void;
}

export function DataCard({ type, sourceName, items, onEdit }: DataCardProps) {
  const Icon = type === 'task' ? CheckCircle2 : type === 'finance' ? Wallet : type === 'calendar' ? Calendar : Slack;
  const color = type === 'task' ? 'text-blue-500' : type === 'finance' ? 'text-emerald-500' : type === 'calendar' ? 'text-amber-500' : 'text-purple-500';

  return (
    <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-sm flex flex-col h-[450px]">
      <div className="p-6 border-b border-slate-800 flex items-center justify-between">
        <div className="flex flex-col">
          <h4 className="font-bold text-slate-200 capitalize flex items-center gap-2">
            <Icon size={18} className={color} />
            {type}s
          </h4>
          <span className="text-[10px] text-slate-500 font-bold uppercase ml-6">{sourceName}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] bg-slate-800 px-2 py-1 rounded-md text-slate-400 font-bold uppercase">{items.length} Items</span>
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-all"
            >
              <Settings size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {items.map((item, i) => {
            const task = type === 'task' ? item as Task : null;
            const finance = type === 'finance' ? item as FinancialRecord : null;
            const message = type === 'communication' ? item as Message : null;
            const calEvent = type === 'calendar' ? item as CalendarEvent : null;
            const itemDate = task?.due || finance?.date || calEvent?.start || new Date().toISOString();

            return (
              <div key={i} className="p-4 rounded-2xl hover:bg-slate-800 transition-colors group cursor-pointer">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-sm font-semibold text-slate-300 group-hover:text-blue-400 transition-colors truncate pr-4">
                    {task?.content || finance?.description || message?.preview || calEvent?.title}
                  </span>
                  {finance && (
                    <span className={`text-xs font-bold shrink-0 ${finance.is_expense ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {finance.is_expense ? '-' : '+'}${finance.amount}
                    </span>
                  )}
                  {calEvent && (
                    <span className="text-xs font-bold shrink-0 text-amber-500">
                      {calEvent.all_day ? 'All day' : new Date(calEvent.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {task?.priority && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      task.priority === 'high' ? 'bg-rose-900/50 text-rose-400' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {task.priority}
                    </span>
                  )}
                  {calEvent?.location && (
                    <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                      <MapPin size={10} /> {calEvent.location}
                    </span>
                  )}
                  {calEvent?.meet_link && (
                    <a href={calEvent.meet_link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[10px] text-blue-400 font-medium flex items-center gap-1 hover:text-blue-300">
                      <Video size={10} /> Meet
                    </a>
                  )}
                  <span className="text-[10px] text-slate-500 font-medium">
                    {new Date(itemDate).toLocaleDateString()}
                  </span>
                </div>
              </div>
            );
          })}
          {items.length === 0 && <p className="p-8 text-center text-slate-500 text-sm italic">Nothing here yet.</p>}
        </div>
      </div>
    </div>
  );
}
