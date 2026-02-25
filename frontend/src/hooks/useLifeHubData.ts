import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Result, Workspace, User, FinancialRecord, Task, CalendarEvent } from '@/types';
import { pb } from '@/lib/pocketbase';

export function useLifeHubData() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [data, setData] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Authentication Guard
  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/login');
    }
  }, [router]);

  // Load Workspaces

  useEffect(() => {

    if (!pb.authStore.isValid) return;



    // Use { requestKey: null } to disable auto-cancellation for this call

    pb.collection('workspaces').getFullList<Workspace>({ requestKey: null })

      .then((list) => {

        setWorkspaces(list);

        if (list.length > 0 && !activeWorkspace) {

          setActiveWorkspace(list[0]);

        }

      })

      .catch((err) => {

        if (!err.isAbort) console.error(err);

      });

  }, []);

  // Only run on mount

  // Fetch Data Logic (Memoized)
  const fetchData = useCallback(async () => {
    if (!activeWorkspace || !pb.authStore.isValid) return;

    // Optimistic UI updates could go here, but for now we rely on strict sync
    setLoading(prev => prev); // keep previous loading state to avoid flicker on refetch

    try {
      const res = await fetch(`http://127.0.0.1:8090/api/eink/relevant?workspace=${activeWorkspace.id}`, {
        headers: {
          'Authorization': pb.authStore.token
        }
      });
      if (!res.ok) throw new Error('Failed to fetch data');
      const json = await res.json();
      setData(json.data || []);
    } catch (err) {
      console.error("Sync Error:", err);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace]);

  // Initial Fetch & Realtime Subscription
  useEffect(() => {
    fetchData();

    // Subscribe to ALL relevant collections
    const collections = ['tasks', 'finance_transactions'];
    const unsubscribeFunctions: (() => void)[] = [];

    collections.forEach(col => {
      pb.collection(col).subscribe('*', (e) => {
        if (e.record.workspace === activeWorkspace?.id) {
          fetchData(); // Only refresh if the change belongs to current workspace
        }
      }).then(unsub => unsubscribeFunctions.push(unsub));
    });

    return () => {
      unsubscribeFunctions.forEach(unsub => unsub());
    };
  }, [fetchData, activeWorkspace]);

  // Computed Stats
  const stats = useMemo(() => {
    const finance = (data.find(d => d.type === 'finance')?.items || []) as FinancialRecord[];
    const balance = finance.reduce((acc, curr) => acc + (curr.is_expense ? -curr.amount : curr.amount), 0);

    const tasks = (data.find(d => d.type === 'task')?.items || []) as Task[];
    const pendingTasks = tasks.length;

    const calendarEvents = data
      .filter(d => d.type === 'calendar')
      .flatMap(d => d.items as CalendarEvent[]);
    const upcomingEvents = calendarEvents.length;

    return { balance, pendingTasks, upcomingEvents };
  }, [data]);

  // Actions
  const createTask = async (content: string, priority: string, sourceId: string, due?: Date) => {
    if (!activeWorkspace) return;
    await pb.collection('tasks').create({
      content,
      priority,
      due_date: due,
      workspace: activeWorkspace.id,
      source: sourceId,
      completed: false
    });
  };

  const createTransaction = async (description: string, amount: number, type: 'income' | 'expense', sourceId: string) => {
    if (!activeWorkspace) return;
    await pb.collection('finance_transactions').create({
      description,
      amount,
      type,
      date: new Date(),
      workspace: activeWorkspace.id,
      source: sourceId
    });
  };



  const createWorkspace = async (name: string, slug: string, icon: string = 'layout-dashboard') => {



    const record = await pb.collection('workspaces').create({



      name,



      slug,



      icon,

      owner: pb.authStore.record?.id,



    });



    const newWorkspace = record as unknown as Workspace;



    setWorkspaces(prev => [...prev, newWorkspace]);



    setActiveWorkspace(newWorkspace);



    return newWorkspace;



  };







  const updateWorkspace = async (id: string, name: string, slug: string, icon: string) => {



    const record = await pb.collection('workspaces').update(id, {



      name,



      slug,



      icon,



    });



    const updated = record as unknown as Workspace;



    setWorkspaces(prev => prev.map(ws => ws.id === id ? updated : ws));



    if (activeWorkspace?.id === id) setActiveWorkspace(updated);



    return updated;



  };

  const updateWorkspaceSettings = async (id: string, settings: Record<string, unknown>) => {
    const workspace = workspaces.find(ws => ws.id === id);
    const mergedSettings = { ...(workspace?.settings || {}), ...settings };
    const record = await pb.collection('workspaces').update(id, { settings: mergedSettings });
    const updated = record as unknown as Workspace;
    setWorkspaces(prev => prev.map(ws => ws.id === id ? updated : ws));
    if (activeWorkspace?.id === id) setActiveWorkspace(updated);
    return updated;
  };







  const deleteWorkspace = async (id: string) => {







    await pb.collection('workspaces').delete(id);







    setWorkspaces(prev => {







      const filtered = prev.filter(ws => ws.id !== id);







      if (activeWorkspace?.id === id) {







        setActiveWorkspace(filtered.length > 0 ? filtered[0] : null);







      }







      return filtered;







    });







  };















  const getAvailableSources = async () => {







    const res = await fetch('http://127.0.0.1:8090/api/sources/available');







    return res.json();







  };















  const addSourceToWorkspace = async (sourceType: string, name: string) => {















    if (!activeWorkspace) return;















    await pb.collection('sources').create({















      name,















      type: sourceType,















      workspace: activeWorkspace.id,















      active: true,















      config: {}















    });















    fetchData(); // Refresh current view















  };































  const updateSource = async (id: string, name: string) => {















    await pb.collection('sources').update(id, { name });















    fetchData();















  };































  const removeSource = async (id: string) => {















    await pb.collection('sources').delete(id);















    fetchData();















  };































  return {















    workspaces,















    activeWorkspace,















    setActiveWorkspace,















    data,















    loading,















    stats,















    authToken: pb.authStore.token,

    user: pb.authStore.model as User | null,















    logout: () => {















      pb.authStore.clear();















      router.push('/login');















    },















    createTask,















    createTransaction,















    createWorkspace,















    updateWorkspace,
    updateWorkspaceSettings,















    deleteWorkspace,















    getAvailableSources,















    addSourceToWorkspace,















    updateSource,















    removeSource















  };















}





























