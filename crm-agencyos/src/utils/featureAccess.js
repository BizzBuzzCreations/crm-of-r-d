import { getId } from '../store/useAppStore';

// Shared by Sidebar.jsx (nav visibility) and AppRouter.jsx (route guards) so
// there is exactly one place that decides "can this user use this feature" —
// backed by the admin-configurable SystemSettings.featureAccess map
// (Settings → Feature Access Control), same additive OR semantics as
// notificationRouting: allowed if the user's role is in the configured
// roles[] OR their own id is in userIds[].
//
// `systemSettings.featureAccess` arrives from the backend as a plain JSON
// object (Mongoose Map serializes over the wire automatically), so no
// client-side Map handling is needed here.
//
// `defaultRoles` is the feature's pre-existing hardcoded role list — used
// whenever the feature has never been configured (map/doc predates this
// field, or systemSettings hasn't loaded yet for some reason), so behavior
// never regresses to "nobody can see anything" on a settings-fetch hiccup.
export function hasFeatureAccess(authUser, systemSettings, featureKey, defaultRoles) {
  if (!authUser) return false;

  // Client-portal access to a handful of shared nav items (Messages,
  // Settings) is structural, mirroring the backend's clientBypass on the
  // tasks/todos/meetings/messages routers — never admin-configurable via
  // this system. Sidebar renders even on /portal (same DashboardLayout), so
  // this has to be handled here too, not just server-side.
  if (authUser.role === 'client') return defaultRoles.includes('client');

  // read_only always sees every feature, unconditionally — mirrors the
  // backend's authorizeFeature bypass (middleware/authorizeFeature.js).
  // Writes are blocked server-side regardless of what the UI shows.
  if (authUser.role === 'read_only') return true;

  const rule = systemSettings?.featureAccess?.[featureKey];
  const roles   = rule ? rule.roles   : defaultRoles;
  const userIds = (rule ? rule.userIds : []).map(String);
  return roles.includes(authUser.role) || userIds.includes(String(getId(authUser)));
}
