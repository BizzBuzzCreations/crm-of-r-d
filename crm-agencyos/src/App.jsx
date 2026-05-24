import { useEffect, useState } from 'react';
import AppRouter from './routes/AppRouter';
import useAppStore from './store/useAppStore';

export default function App() {
  const [checking, setChecking] = useState(true);
  const restoreSession = useAppStore((s) => s.restoreSession);

  // Listen for forced logout from axios 401 refresh failure
  useEffect(() => {
    const handler = () => {
      useAppStore.getState().logout();
    };
    window.addEventListener('crm:logout', handler);
    return () => window.removeEventListener('crm:logout', handler);
  }, []);

  useEffect(() => {
    restoreSession().finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-lg mx-auto mb-4">
            AO
          </div>
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 text-[12px] mt-3">Connecting…</p>
        </div>
      </div>
    );
  }

  return <AppRouter />;
}