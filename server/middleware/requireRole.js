const logger = require('../services/logger');

/**
 * Role-based access control middleware.
 * Usage: requireRole('super_admin') or requireRole('admin', 'staff')
 *
 * Must be used AFTER authenticate middleware.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('auth', `Access denied: ${req.user.role} tried to access ${req.method} ${req.originalUrl} (requires ${roles.join('/')})`, {
        userId: req.user?.id,
        ip: req.ip,
        details: { userRole: req.user.role, requiredRoles: roles, url: req.originalUrl },
        source: 'middleware.requireRole',
      });
      return res.status(403).json({ error: 'Forbidden — insufficient permissions' });
    }

    next();
  };
}

module.exports = requireRole;
