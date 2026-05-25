import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import useAppStore from '../store/useAppStore';

export default function DashboardLayout() {
  const darkMode = useAppStore((s) => s.darkMode);

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
