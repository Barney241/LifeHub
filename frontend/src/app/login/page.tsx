'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, Loader2 } from 'lucide-react';
import { pb } from '@/lib/pocketbase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await pb.collection('users').authWithPassword(email, password);
      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to login. Please check your credentials.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await pb.collection('users').authWithOAuth2({ provider: 'google' });
      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to login with Google.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 rounded-3xl shadow-xl shadow-slate-950/50 p-8 border border-slate-800">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-4 shadow-lg shadow-blue-900/50">L</div>
          <h1 className="text-2xl font-bold text-slate-100">Welcome to LifeHub</h1>
          <p className="text-slate-400 text-sm mt-2">Sign in to manage your workspaces</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-slate-800 text-slate-200 border border-slate-700 py-3 rounded-xl font-bold hover:bg-slate-700 transition-all shadow-sm flex items-center justify-center gap-3 disabled:opacity-70 mb-6"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </button>

          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-slate-700"></div>
            <span className="flex-shrink mx-4 text-slate-500 text-[10px] font-bold uppercase tracking-widest">Or Email</span>
            <div className="flex-grow border-t border-slate-700"></div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 pl-12 pr-4 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm text-slate-100 placeholder-slate-500"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 pl-12 pr-4 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm text-slate-100 placeholder-slate-500"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="bg-rose-900/30 text-rose-400 text-xs font-medium p-3 rounded-xl border border-rose-800 animate-shake">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/50 flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-slate-500 text-xs mt-8">
            Authorized access only. Device tokens are managed via Admin.
          </p>
        </div>
      </div>
    </div>
  );
}
