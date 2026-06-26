const jwt = require("jsonwebtoken");
const User = require("../models/users");
const Role = require("../models/roles");
const { SPECIAL_ROLES } = require("../constants/permissions");

/**
 * Middleware to verify JWT token and attach user to request
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token is required"
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    // Fetch user with role information
    const user = await User.findById(decoded.userId)
      .populate('roleId')
      .select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    if (user.status !== 'active' || user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "User account is inactive or blocked"
      });
    }

    // Attach user to request
    req.user = user;
    req.userId = user._id;
    req.role = user.roleId;
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: "Invalid token"
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: "Token expired"
      });
    }

    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: "Authentication failed"
    });
  }
};

/**
 * Check if user is Admin (special role with full access)
 */
const isAdmin = (role) => {
  return role && role.name === SPECIAL_ROLES.ADMIN;
};

/**
 * Middleware to check if user has required permissions
 * @param {string|string[]} requiredPermissions - Single permission or array of permissions
 * @param {string} logic - 'AND' (all required) or 'OR' (at least one required). Default: 'AND'
 * 
 * Usage:
 * - Single permission: checkPermission('products:view')
 * - Multiple with AND: checkPermission(['products:view', 'products:edit'])
 * - Multiple with OR: checkPermission(['products:view', 'products:edit'], 'OR')
 */
const checkPermission = (requiredPermissions, logic = 'AND') => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      const role = req.role;

      // Check if user exists
      if (!user || !role) {
        return res.status(401).json({
          success: false,
          message: "Authentication required"
        });
      }

      // Admin has full access to everything
      if (isAdmin(role)) {
        return next();
      }

      // Check if role is active
      if (!role.isActive) {
        return res.status(403).json({
          success: false,
          message: "Role is inactive"
        });
      }

      // Get user's permissions from role
      const userPermissions = role.permissions || [];

      // Convert to array if single permission provided
      const permissions = Array.isArray(requiredPermissions) 
        ? requiredPermissions 
        : [requiredPermissions];

      let hasPermission = false;

      if (logic === 'OR') {
        // User needs at least ONE of the required permissions
        hasPermission = permissions.some(permission => 
          userPermissions.includes(permission)
        );
      } else {
        // User needs ALL required permissions (AND logic)
        hasPermission = permissions.every(permission => 
          userPermissions.includes(permission)
        );
      }

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to perform this action",
          requiredPermissions: permissions
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        message: "Permission check failed"
      });
    }
  };
};

/**
 * Middleware to check if user is Admin only
 */
const requireAdmin = async (req, res, next) => {
  try {
    const role = req.role;

    if (!role) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    if (!isAdmin(role)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required"
      });
    }

    next();
  } catch (error) {
    console.error('Admin check error:', error);
    return res.status(500).json({
      success: false,
      message: "Authorization failed"
    });
  }
};

/**
 * Optional authentication - attaches user if token exists but doesn't fail if not
 * Useful for endpoints that have different behavior for authenticated vs unauthenticated users
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.userId)
      .populate('roleId')
      .select('-password');

    if (user && user.status === 'active' && !user.isBlocked) {
      req.user = user;
      req.userId = user._id;
      req.role = user.roleId;
    }

    next();
  } catch (error) {
    // If token verification fails, just continue without user
    next();
  }
};

module.exports = {
  authenticateToken,
  checkPermission,
  requireAdmin,
  optionalAuth,
  isAdmin,
};
