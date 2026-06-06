import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import useAppStore from '../store/useAppStore';

export default function DashboardLayout() {
  const darkMode = useAppStore((s) => s.darkMode);
  const navigate = useNavigate();

  // ── In-app toast click → navigate to thread ──────────────────
  useEffect(() => {
    const handler = (e) => {
      useAppStore.getState().setActiveThread(e.detail.threadId);
      navigate('/messages');
    };
    window.addEventListener('crm:navigate-thread', handler);
    return () => window.removeEventListener('crm:navigate-thread', handler);
  }, [navigate]);

  // ── Service Worker registration + notification permission ─────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Register the notification service worker
    navigator.serviceWorker
      .register('/sw-notify.js', { scope: '/' })
      .catch(() => {});

    // Handle click messages from the SW (OS notification clicked)
    const swMessageHandler = (event) => {
      if (event.data?.type === 'crm:navigate-thread' && event.data.threadId) {
        useAppStore.getState().setActiveThread(event.data.threadId);
        navigate('/messages');
      }
    };
    navigator.serviceWorker.addEventListener('message', swMessageHandler);

    // Request notification permission once (only if not yet decided)
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      navigator.serviceWorker.removeEventListener('message', swMessageHandler);
    };
  }, [navigate]);

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-slate-950">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Navbar />
          <main className="flex-1 overflow-y-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
