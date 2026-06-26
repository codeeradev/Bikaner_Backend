/**
 * RBAC Permissions System
 * 
 * This file defines all available permissions in the system.
 * Format: {module}:{action}
 * 
 * Modules represent different sections/features of the application
 * Actions represent what can be done: view, create, edit, delete
 */

const MODULES = {
  DASHBOARD: 'dashboard',
  CATEGORIES: 'categories',
  PRODUCTS: 'products',
  ZONES: 'zones',
  CITIES: 'cities',
  ORDERS: 'orders',
  NORMAL_ORDERS: 'normalOrders',
  BULK_ORDERS: 'bulkOrders',
  FRANCHISE: 'franchise',
  FRANCHISE_REQUESTS: 'franchiseRequests',
  REGISTERED_FRANCHISES: 'registeredFranchises',
  USERS: 'users',
  ROLES: 'roles',
  WALLET: 'wallet',
  SETTINGS: 'settings',
  THEME: 'theme',
  PROFILE: 'profile',
};

const ACTIONS = {
  VIEW: 'view',
  CREATE: 'create',
  EDIT: 'edit',
  DELETE: 'delete',
  MANAGE: 'manage', // Special permission for full control
};

/**
 * Generate permission string
 * @param {string} module - Module name from MODULES
 * @param {string} action - Action name from ACTIONS
 * @returns {string} Permission string in format "module:action"
 */
const createPermission = (module, action) => `${module}:${action}`;

/**
 * All available permissions in the system
 * These are used for role creation and validation
 */
const PERMISSIONS = {
  // Dashboard
  DASHBOARD_VIEW: createPermission(MODULES.DASHBOARD, ACTIONS.VIEW),

  // Categories
  CATEGORIES_VIEW: createPermission(MODULES.CATEGORIES, ACTIONS.VIEW),
  CATEGORIES_CREATE: createPermission(MODULES.CATEGORIES, ACTIONS.CREATE),
  CATEGORIES_EDIT: createPermission(MODULES.CATEGORIES, ACTIONS.EDIT),
  CATEGORIES_DELETE: createPermission(MODULES.CATEGORIES, ACTIONS.DELETE),

  // Products
  PRODUCTS_VIEW: createPermission(MODULES.PRODUCTS, ACTIONS.VIEW),
  PRODUCTS_CREATE: createPermission(MODULES.PRODUCTS, ACTIONS.CREATE),
  PRODUCTS_EDIT: createPermission(MODULES.PRODUCTS, ACTIONS.EDIT),
  PRODUCTS_DELETE: createPermission(MODULES.PRODUCTS, ACTIONS.DELETE),

  // Zones
  ZONES_VIEW: createPermission(MODULES.ZONES, ACTIONS.VIEW),
  ZONES_CREATE: createPermission(MODULES.ZONES, ACTIONS.CREATE),
  ZONES_EDIT: createPermission(MODULES.ZONES, ACTIONS.EDIT),
  ZONES_DELETE: createPermission(MODULES.ZONES, ACTIONS.DELETE),

  // Cities
  CITIES_VIEW: createPermission(MODULES.CITIES, ACTIONS.VIEW),
  CITIES_CREATE: createPermission(MODULES.CITIES, ACTIONS.CREATE),
  CITIES_EDIT: createPermission(MODULES.CITIES, ACTIONS.EDIT),
  CITIES_DELETE: createPermission(MODULES.CITIES, ACTIONS.DELETE),

  // Orders
  ORDERS_VIEW: createPermission(MODULES.ORDERS, ACTIONS.VIEW),
  ORDERS_CREATE: createPermission(MODULES.ORDERS, ACTIONS.CREATE),
  ORDERS_EDIT: createPermission(MODULES.ORDERS, ACTIONS.EDIT),
  ORDERS_DELETE: createPermission(MODULES.ORDERS, ACTIONS.DELETE),

  // Normal Orders
  NORMAL_ORDERS_VIEW: createPermission(MODULES.NORMAL_ORDERS, ACTIONS.VIEW),
  NORMAL_ORDERS_EDIT: createPermission(MODULES.NORMAL_ORDERS, ACTIONS.EDIT),

  // Bulk Orders
  BULK_ORDERS_VIEW: createPermission(MODULES.BULK_ORDERS, ACTIONS.VIEW),
  BULK_ORDERS_EDIT: createPermission(MODULES.BULK_ORDERS, ACTIONS.EDIT),

  // Franchise
  FRANCHISE_VIEW: createPermission(MODULES.FRANCHISE, ACTIONS.VIEW),
  FRANCHISE_CREATE: createPermission(MODULES.FRANCHISE, ACTIONS.CREATE),
  FRANCHISE_EDIT: createPermission(MODULES.FRANCHISE, ACTIONS.EDIT),
  FRANCHISE_DELETE: createPermission(MODULES.FRANCHISE, ACTIONS.DELETE),

  // Franchise Requests
  FRANCHISE_REQUESTS_VIEW: createPermission(MODULES.FRANCHISE_REQUESTS, ACTIONS.VIEW),
  FRANCHISE_REQUESTS_MANAGE: createPermission(MODULES.FRANCHISE_REQUESTS, ACTIONS.MANAGE),

  // Registered Franchises
  REGISTERED_FRANCHISES_VIEW: createPermission(MODULES.REGISTERED_FRANCHISES, ACTIONS.VIEW),
  REGISTERED_FRANCHISES_EDIT: createPermission(MODULES.REGISTERED_FRANCHISES, ACTIONS.EDIT),

  // Users
  USERS_VIEW: createPermission(MODULES.USERS, ACTIONS.VIEW),
  USERS_CREATE: createPermission(MODULES.USERS, ACTIONS.CREATE),
  USERS_EDIT: createPermission(MODULES.USERS, ACTIONS.EDIT),
  USERS_DELETE: createPermission(MODULES.USERS, ACTIONS.DELETE),

  // Roles
  ROLES_VIEW: createPermission(MODULES.ROLES, ACTIONS.VIEW),
  ROLES_CREATE: createPermission(MODULES.ROLES, ACTIONS.CREATE),
  ROLES_EDIT: createPermission(MODULES.ROLES, ACTIONS.EDIT),
  ROLES_DELETE: createPermission(MODULES.ROLES, ACTIONS.DELETE),

  // Wallet
  WALLET_VIEW: createPermission(MODULES.WALLET, ACTIONS.VIEW),
  WALLET_MANAGE: createPermission(MODULES.WALLET, ACTIONS.MANAGE),

  // Settings
  SETTINGS_VIEW: createPermission(MODULES.SETTINGS, ACTIONS.VIEW),
  SETTINGS_EDIT: createPermission(MODULES.SETTINGS, ACTIONS.EDIT),

  // Theme
  THEME_VIEW: createPermission(MODULES.THEME, ACTIONS.VIEW),
  THEME_EDIT: createPermission(MODULES.THEME, ACTIONS.EDIT),

  // Profile
  PROFILE_VIEW: createPermission(MODULES.PROFILE, ACTIONS.VIEW),
  PROFILE_EDIT: createPermission(MODULES.PROFILE, ACTIONS.EDIT),
};

/**
 * Get all permissions as an array
 * @returns {string[]} Array of all permission strings
 */
const getAllPermissions = () => Object.values(PERMISSIONS);

/**
 * Get all permissions grouped by module
 * @returns {Object} Object with module names as keys and arrays of permissions as values
 */
const getPermissionsByModule = () => {
  const grouped = {};
  
  for (const [key, permission] of Object.entries(PERMISSIONS)) {
    const [module] = permission.split(':');
    if (!grouped[module]) {
      grouped[module] = [];
    }
    grouped[module].push(permission);
  }
  
  return grouped;
};

/**
 * Parse permission string into module and action
 * @param {string} permission - Permission string in format "module:action"
 * @returns {Object} Object with module and action properties
 */
const parsePermission = (permission) => {
  const [module, action] = permission.split(':');
  return { module, action };
};

/**
 * Check if permission string is valid
 * @param {string} permission - Permission string to validate
 * @returns {boolean} True if permission exists in PERMISSIONS
 */
const isValidPermission = (permission) => {
  return getAllPermissions().includes(permission);
};

/**
 * Special roles that have restricted operations
 */
const SPECIAL_ROLES = {
  ADMIN: 'Admin',
  FRANCHISE: 'Franchise',
};

/**
 * User App roles (separate from admin panel)
 */
const USER_APP_ROLES = {
  USER: 'User',
  SELLER: 'Seller',
};

module.exports = {
  MODULES,
  ACTIONS,
  PERMISSIONS,
  SPECIAL_ROLES,
  USER_APP_ROLES,
  createPermission,
  getAllPermissions,
  getPermissionsByModule,
  parsePermission,
  isValidPermission,
};
