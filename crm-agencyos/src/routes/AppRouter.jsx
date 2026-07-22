import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import DashboardLayout from '../layouts/DashboardLayout';

// Pages
import LoginPage          from '../pages/auth/LoginPage';
import DashboardPage      from '../pages/DashboardPage';
import TasksPage          from '../pages/TasksPage';
import TodosPage          from '../pages/TodosPage';
import ClientsPage        from '../pages/ClientsPage';
import LeadsPage          from '../pages/LeadsPage';
import MessagesPage       from '../pages/MessagesPage';
import ReportsPage        from '../pages/ReportsPage';
import MeetingsPage       from '../pages/MeetingsPage';
import CalendarPage       from '../pages/CalendarPage';
import TeamPage           from '../pages/TeamPage';
import SettingsPage       from '../pages/SettingsPage';
import LogsPage           from '../pages/LogsPage';
import SystemLogsPage     from '../pages/SystemLogsPage';
import ClientPortalPage   from '../pages/portal/ClientPortalPage';
import BillingPage        from '../pages/BillingPage';
import CampaignsPage      from '../pages/CampaignsPage';
import CampaignDetailPage from '../pages/CampaignDetailPage';

// ── Guards ────────────────────────────────────────────────────
function RequireAuth({ children }) {
  const authUser = useAppStore((s) => s.authUser);
  if (!authUser) return <Navigate to="/login" replace />;
  return children;
}

// Blocks client role from accessing staff-only routes
function RequireStaff({ children }) {
  const authUser = useAppStore((s) => s.authUser);
  if (!authUser) return <Navigate to="/login" replace />;
  if (authUser.role === 'client') return <Navigate to="/portal" replace />;
  return children;
}

function RequireRole({ roles, children }) {
  const authUser = useAppStore((s) => s.authUser);
  if (!authUser) return <Navigate to="/login" replace />;
  if (!roles.includes(authUser?.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

// Campaigns: admin/manager always have access; internal staff (member/
// client_relations) need the campaignsAccess flag granted individually from
// the Team page. Portal `client` logins are a different access model
// entirely and must never qualify via the flag, even in theory.
function RequireCampaignsAccess({ children }) {
  const authUser = useAppStore((s) => s.authUser);
  if (!authUser) return <Navigate to="/login" replace />;
  const allowed = authUser.role !== 'client' && (['admin', 'manager'].includes(authUser.role) || authUser.campaignsAccess === true);
  if (!allowed) return <Navigate to="/dashboard" replace />;
  return children;
}

// Clients land on /portal; staff land on /dashboard
function DefaultRedirect() {
  const authUser = useAppStore((s) => s.authUser);
  if (authUser?.role === 'client') return <Navigate to="/portal" replace />;
  return <Navigate to="/dashboard" replace />;
}

// ── Router ────────────────────────────────────────────────────
export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected — all inside DashboardLayout */}
        <Route
          path="/"
          element={
            <RequireAuth>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route index element={<DefaultRedirect />} />

          {/* ── Client portal (role: client only) ── */}
          <Route
            path="portal"
            element={
              <RequireRole roles={['client']}>
                <ClientPortalPage />
              </RequireRole>
            }
          />

          {/* ── Staff routes (all roles except client) ── */}
          <Route path="dashboard" element={<RequireStaff><DashboardPage /></RequireStaff>} />
          <Route path="tasks"     element={<RequireStaff><TasksPage /></RequireStaff>} />
          <Route path="todos"     element={<RequireStaff><TodosPage /></RequireStaff>} />
          <Route
            path="clients"
            element={
              <RequireRole roles={['admin', 'manager', 'client_relations']}>
                <ClientsPage />
              </RequireRole>
            }
          />
          <Route
            path="leads"
            element={
              <RequireRole roles={['admin', 'manager', 'client_relations', 'member']}>
                <LeadsPage />
              </RequireRole>
            }
          />
          <Route path="messages"  element={<MessagesPage />} />
          <Route path="reports"   element={<RequireStaff><ReportsPage /></RequireStaff>} />
          <Route path="meetings"  element={<RequireStaff><MeetingsPage /></RequireStaff>} />
          <Route path="calendar"  element={<RequireStaff><CalendarPage /></RequireStaff>} />
          <Route
            path="billing"
            element={
              <RequireRole roles={['admin', 'manager']}>
                <BillingPage />
              </RequireRole>
            }
          />
          <Route
            path="team"
            element={
              <RequireRole roles={['admin', 'manager']}>
                <TeamPage />
              </RequireRole>
            }
          />
          <Route
            path="campaigns"
            element={
              <RequireCampaignsAccess>
                <CampaignsPage />
              </RequireCampaignsAccess>
            }
          />
          <Route
            path="campaigns/:id"
            element={
              <RequireCampaignsAccess>
                <CampaignDetailPage />
              </RequireCampaignsAccess>
            }
          />
          <Route path="settings" element={<SettingsPage />} />
          <Route
            path="logs"
            element={
              <RequireRole roles={['admin']}>
                <LogsPage />
              </RequireRole>
            }
          />
          <Route
            path="system-logs"
            element={
              <RequireRole roles={['admin']}>
                <SystemLogsPage />
              </RequireRole>
            }
          />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<DefaultRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
