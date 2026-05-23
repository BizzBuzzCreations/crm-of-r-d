import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import DashboardLayout from '../layouts/DashboardLayout';

// Pages
import LoginPage       from '../pages/auth/LoginPage';
import DashboardPage   from '../pages/DashboardPage';
import TasksPage       from '../pages/TasksPage';
import TodosPage       from '../pages/TodosPage';
import ClientsPage     from '../pages/ClientsPage';
import MessagesPage    from '../pages/MessagesPage';
import ReportsPage     from '../pages/ReportsPage';
import MeetingsPage    from '../pages/MeetingsPage';
import CalendarPage    from '../pages/CalendarPage';
import TeamPage        from '../pages/TeamPage';
import SettingsPage    from '../pages/SettingsPage';

// ── Guards ────────────────────────────────────────────────────
function RequireAuth({ children }) {
  const authUser = useAppStore((s) => s.authUser);
  if (!authUser) return <Navigate to="/login" replace />;
  return children;
}

function RequireRole({ roles, children }) {
  const authUser = useAppStore((s) => s.authUser);
  if (!authUser) return <Navigate to="/login" replace />;
  if (!roles.includes(authUser?.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

// ── Router ────────────────────────────────────────────────────
export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected */}
        <Route
          path="/"
          element={
            <RequireAuth>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="tasks"     element={<TasksPage />} />
          <Route path="todos"     element={<TodosPage />} />
          <Route path="clients"   element={<ClientsPage />} />
          <Route path="messages"  element={<MessagesPage />} />
          <Route path="reports"   element={<ReportsPage />} />
          <Route path="meetings"  element={<MeetingsPage />} />
          <Route path="calendar"  element={<CalendarPage />} />
          <Route
            path="team"
            element={
              <RequireRole roles={['admin', 'manager']}>
                <TeamPage />
              </RequireRole>
            }
          />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
