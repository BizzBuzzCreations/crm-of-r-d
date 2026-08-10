const jwt    = require('jsonwebtoken');
const User   = require('../models/User');
const { Client } = require('../models/index');

// Verify access token
exports.protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  } else if (req.query?._token) {
    // sendBeacon cannot set headers, so the beforeunload flush passes token via query string
    token = req.query._token;
  } else if (req.query?.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    // Immediately revoke access for client portal users whose client has been soft-deleted
    // This fires on every request so deletion takes effect within one request, not one token lifetime
    if (user.role === 'client' && user.clientId) {
      const clientRec = await Client.findById(user.clientId, 'isDeleted status').lean();
      if (!clientRec || clientRec.isDeleted || clientRec.status === 'inactive') {
        return res.status(403).json({
          success: false,
          message: 'Your portal access has been deactivated. Please contact your account manager.',
        });
      }
    }

    // read_only sees everything (enforced centrally in authorize/authorizeRoles/
    // authorizeFeature below) but can never write — blocked here, once, for
    // every router that calls protect, rather than at each of the ~20
    // individual router definitions. Two exemptions: managing their own
    // account (login/logout/password/profile) and their own notifications
    // (mark-read/dismiss) aren't "changes to the business" — blocking those
    // would make the role frustratingly unusable for no security benefit.
    const writeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    const isSelfServiceRoute = req.originalUrl.startsWith('/api/auth') || req.originalUrl.startsWith('/api/notifications');
    if (user.role === 'read_only' && writeMethods.includes(req.method) && !isSelfServiceRoute) {
      return res.status(403).json({
        success: false,
        message: 'Your account has read-only access — changes are not permitted.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// Role guard
exports.authorize = (...roles) => (req, res, next) => {
  // read_only can view anything gated by this middleware, regardless of the
  // specific roles list passed in — see protect() above for the write-side
  // enforcement that makes this safe.
  if (req.user.role === 'read_only' && req.method === 'GET') return next();
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Role '${req.user.role}' is not authorized for this action`,
    });
  }
  next();
};

// Role guard that also allows a specific opt-in permission flag on the user
// doc — e.g. a solo member granted `campaignsAccess: true` without being
// promoted to manager. The opt-in flag is only ever meant for internal
// staff (member/client_relations) — portal `client` logins are a different
// access model entirely and must never pass here, regardless of what the
// flag happens to be set to (the Team page UI already excludes client
// accounts from the picker, but that's not a substitute for the actual
// authorization boundary enforcing it too).
exports.authorizeOrFlag = (roles, flagField) => (req, res, next) => {
  if (req.user.role !== 'client' && (roles.includes(req.user.role) || req.user[flagField] === true)) return next();
  return res.status(403).json({
    success: false,
    message: `Role '${req.user.role}' is not authorized for this action`,
  });
};

// Strict Role Guard for corporate financial permissions
exports.authorizeRoles = (...allowedRoles) => (req, res, next) => {
  if (req.user?.role === 'read_only' && req.method === 'GET') return next();
  if (!allowedRoles.includes(req.user?.role)) {
    return res.status(403).json({
      message: "Access denied. Insufficient corporate permissions."
    });
  }
  next();
};

// Block all write operations (POST/PUT/PATCH/DELETE) for client role
// Attach to any router to make it read-only for client users
exports.denyClientWrites = (req, res, next) => {
  const writeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (req.user?.role === 'client' && writeMethods.includes(req.method)) {
    return res.status(403).json({
      success: false,
      message: 'Client portal is read-only. Please contact your account manager to make changes.',
    });
  }
  next();
};

