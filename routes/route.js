const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");

// Import middleware
const {
  authenticateToken,
  checkPermission,
  requireAdmin,
} = require("../middleware/auth");
const { PERMISSIONS } = require("../constants/permissions");

// Import controllers
const authController = require("../controllers/authController");
const roleController = require("../controllers/roleController");
const userController = require("../controllers/userController");
const categoryController = require("../controllers/categoryController");
const cityController = require("../controllers/cityController");
const zoneController = require("../controllers/zoneController");
const productController = require("../controllers/productController");
const bannerController = require("../controllers/bannerController");
const settingsController = require("../controllers/settingsController");
const orderController = require("../controllers/orderController");
const sellerApplicationController = require("../controllers/sellerApplicationController");
const offerController = require("../controllers/offerController");
const adminNotificationController = require("../controllers/adminNotificationController");
const dashboardController = require("../controllers/dashboardController");

// ============= DASHBOARD ROUTES =============
router.get(
  "/dashboard/stats",
  authenticateToken,
  dashboardController.getDashboardStats,
);

router.get(
  "/dashboard/recent-orders",
  authenticateToken,
  dashboardController.getRecentOrders,
);

router.get(
  "/dashboard/top-products",
  authenticateToken,
  dashboardController.getTopProducts,
);

router.get(
  "/dashboard/inventory-status",
  authenticateToken,
  dashboardController.getInventoryStatus,
);

router.get(
  "/dashboard/revenue-by-region",
  authenticateToken,
  dashboardController.getRevenueByRegion,
);

router.get(
  "/dashboard/monthly-trends",
  authenticateToken,
  dashboardController.getMonthlyTrends,
);

router.get(
  "/dashboard/seller-applications",
  authenticateToken,
  dashboardController.getRecentSellerApplications,
);

// ============= PUBLIC AUTH ROUTES =============
// POST login
router.post("/auth/login", authController.login);

// POST logout (requires auth)
router.post("/auth/logout", authenticateToken, authController.logout);

// GET current user profile
router.get("/auth/profile", authenticateToken, authController.getProfile);

// PUT update current user profile
router.put(
  "/auth/profile",
  authenticateToken,
  upload.single("profileImage"),
  authController.updateProfile,
);

// ============= ROLE ROUTES (Admin Only) =============
// GET all available permissions
router.get(
  "/permissions",
  authenticateToken,
  requireAdmin,
  roleController.getAvailablePermissions,
);

// GET all roles
router.get(
  "/roles",
  authenticateToken,
  checkPermission(PERMISSIONS.ROLES_VIEW),
  roleController.getAllRoles,
);

// GET single role by ID
router.get(
  "/roles/:id",
  authenticateToken,
  checkPermission(PERMISSIONS.ROLES_VIEW),
  roleController.getRoleById,
);

// POST create new role (Admin only)
router.post(
  "/roles",
  authenticateToken,
  requireAdmin,
  roleController.createRole,
);

// PUT update role (Admin only)
router.put(
  "/roles/:id",
  authenticateToken,
  requireAdmin,
  roleController.updateRole,
);

// DELETE role (Admin only)
router.delete(
  "/roles/:id",
  authenticateToken,
  requireAdmin,
  roleController.deleteRole,
);

// PATCH toggle role status (Admin only)
router.patch(
  "/roles/:id/toggle-status",
  authenticateToken,
  requireAdmin,
  roleController.toggleRoleStatus,
);

// ============= USER/STAFF ROUTES =============
// GET all users
router.get(
  "/users",
  authenticateToken,
  checkPermission(PERMISSIONS.USERS_VIEW),
  userController.getAllUsers,
);

// GET single user by ID
router.get(
  "/users/:id",
  authenticateToken,
  checkPermission(PERMISSIONS.USERS_VIEW),
  userController.getUserById,
);

// POST create new user
router.post(
  "/users",
  authenticateToken,
  checkPermission(PERMISSIONS.USERS_CREATE),
  upload.single("profileImage"),
  userController.createUser,
);

// PUT update user
router.put(
  "/users/:id",
  authenticateToken,
  checkPermission(PERMISSIONS.USERS_EDIT),
  upload.single("profileImage"),
  userController.updateUser,
);

// DELETE user
router.delete(
  "/users/:id",
  authenticateToken,
  checkPermission(PERMISSIONS.USERS_DELETE),
  userController.deleteUser,
);

// PATCH toggle user status
router.patch(
  "/users/:id/toggle-status",
  authenticateToken,
  checkPermission(PERMISSIONS.USERS_EDIT),
  userController.toggleUserStatus,
);

// ============= ORDER ROUTES =============
router.get(
  "/orders",
  authenticateToken,
  checkPermission(PERMISSIONS.ORDERS_VIEW),
  orderController.getAllOrders,
);

router.get(
  "/orders/normal",
  authenticateToken,
  checkPermission(PERMISSIONS.NORMAL_ORDERS_VIEW),
  (req, res) => {
    req.query.orderType = "normal";
    return orderController.getAllOrders(req, res);
  },
);

router.get(
  "/orders/bulk",
  authenticateToken,
  checkPermission(PERMISSIONS.BULK_ORDERS_VIEW),
  (req, res) => {
    req.query.orderType = "bulk";
    return orderController.getAllOrders(req, res);
  },
);

router.get(
  "/orders/:orderId",
  authenticateToken,
  checkPermission(PERMISSIONS.ORDERS_VIEW),
  orderController.getOrderDetails,
);

router.get(
  "/orders/:orderId/invoice",
  authenticateToken,
  checkPermission(PERMISSIONS.ORDERS_VIEW),
  orderController.generateInvoice,
);

router.put(
  "/orders/:orderId/status",
  authenticateToken,
  checkPermission(
    [
      PERMISSIONS.ORDERS_EDIT,
      PERMISSIONS.NORMAL_ORDERS_EDIT,
      PERMISSIONS.BULK_ORDERS_EDIT,
    ],
    "OR",
  ),
  orderController.updateOrderStatus,
);

router.put(
  "/orders/:orderId/cancel",
  authenticateToken,
  checkPermission(
    [
      PERMISSIONS.ORDERS_EDIT,
      PERMISSIONS.NORMAL_ORDERS_EDIT,
      PERMISSIONS.BULK_ORDERS_EDIT,
    ],
    "OR",
  ),
  orderController.cancelOrder,
);

// ============= ADMIN NOTIFICATION ROUTES =============
router.get(
  "/admin-notifications",
  authenticateToken,
  adminNotificationController.getAdminNotifications,
);

router.put(
  "/admin-notifications/read",
  authenticateToken,
  adminNotificationController.markAllAdminNotificationsAsRead,
);

router.put(
  "/admin-notifications/:notificationId/read",
  authenticateToken,
  adminNotificationController.markAdminNotificationAsRead,
);

router.delete(
  "/admin-notifications/:notificationId",
  authenticateToken,
  adminNotificationController.deleteAdminNotification,
);

// ============= SELLER APPROVAL ROUTES =============
router.get(
  "/seller-applications",
  authenticateToken,
  checkPermission(PERMISSIONS.SELLER_APPROVALS_VIEW),
  sellerApplicationController.getSellerApplications,
);

router.put(
  "/seller-applications/:id/approve",
  authenticateToken,
  checkPermission(PERMISSIONS.SELLER_APPROVALS_MANAGE),
  sellerApplicationController.approveSellerApplication,
);

router.put(
  "/seller-applications/:id/reject",
  authenticateToken,
  checkPermission(PERMISSIONS.SELLER_APPROVALS_MANAGE),
  sellerApplicationController.rejectSellerApplication,
);

router.get(
  "/offers",
  authenticateToken,
  checkPermission(PERMISSIONS.OFFERS_VIEW),
  offerController.getOffers,
);

router.get(
  "/offers/:id",
  authenticateToken,
  checkPermission(PERMISSIONS.OFFERS_VIEW),
  offerController.getOfferById,
);

router.post(
  "/offers",
  authenticateToken,
  checkPermission(PERMISSIONS.OFFERS_MANAGE),
  offerController.createOffer,
);

router.put(
  "/offers/:id",
  authenticateToken,
  checkPermission(PERMISSIONS.OFFERS_MANAGE),
  offerController.updateOffer,
);

router.delete(
  "/offers/:id",
  authenticateToken,
  checkPermission(PERMISSIONS.OFFERS_MANAGE),
  offerController.deleteOffer,
);

// ============= CATEGORY ROUTES =============
// GET all categories
router.get(
  "/categories",
  authenticateToken,
  checkPermission(PERMISSIONS.CATEGORIES_VIEW),
  categoryController.getAllCategories,
);

// GET single category by ID
router.get(
  "/categories/:id",
  authenticateToken,
  checkPermission(PERMISSIONS.CATEGORIES_VIEW),
  categoryController.getCategoryById,
);

// POST create new category (with image upload)
router.post(
  "/categories",
  authenticateToken,
  checkPermission(PERMISSIONS.CATEGORIES_CREATE),
  upload.single("image"),
  categoryController.createCategory,
);

// PUT update category (with image upload)
router.put(
  "/categories/:id",
  authenticateToken,
  checkPermission(PERMISSIONS.CATEGORIES_EDIT),
  upload.single("image"),
  categoryController.updateCategory,
);

// DELETE category
router.delete(
  "/categories/:id",
  authenticateToken,
  checkPermission(PERMISSIONS.CATEGORIES_DELETE),
  categoryController.deleteCategory,
);

// PATCH toggle category status
router.patch(
  "/categories/:id/toggle-status",
  authenticateToken,
  checkPermission(PERMISSIONS.CATEGORIES_EDIT),
  categoryController.toggleCategoryStatus,
);

// ============= CITY ROUTES =============
// GET all cities
router.get(
  "/cities",
  authenticateToken,
  checkPermission(PERMISSIONS.CITIES_VIEW),
  cityController.getAllCities,
);

// GET single city by ID
router.get(
  "/cities/:id",
  authenticateToken,
  checkPermission(PERMISSIONS.CITIES_VIEW),
  cityController.getCityById,
);

// GET city with zones
router.get(
  "/cities/:id/zones",
  authenticateToken,
  checkPermission(PERMISSIONS.CITIES_VIEW),
  cityController.getCityWithZones,
);

// POST create new city
router.post(
  "/cities",
  authenticateToken,
  checkPermission(PERMISSIONS.CITIES_CREATE),
  cityController.createCity,
);

// PUT update city
router.put(
  "/cities/:id",
  authenticateToken,
  checkPermission(PERMISSIONS.CITIES_EDIT),
  cityController.updateCity,
);

// DELETE city
router.delete(
  "/cities/:id",
  authenticateToken,
  checkPermission(PERMISSIONS.CITIES_DELETE),
  cityController.deleteCity,
);

// PATCH toggle city status
router.patch(
  "/cities/:id/toggle-status",
  authenticateToken,
  checkPermission(PERMISSIONS.CITIES_EDIT),
  cityController.toggleCityStatus,
);

// ============= ZONE ROUTES =============
// GET all zones
router.get(
  "/zones",
  authenticateToken,
  checkPermission(PERMISSIONS.ZONES_VIEW),
  zoneController.getAllZones,
);

// POST create new zone
router.post(
  "/zones",
  authenticateToken,
  checkPermission(PERMISSIONS.ZONES_CREATE),
  zoneController.createZone,
);

// PUT update zone
router.put(
  "/zones/:id",
  authenticateToken,
  checkPermission(PERMISSIONS.ZONES_EDIT),
  zoneController.updateZone,
);

// DELETE zone
router.delete(
  "/zones/:id",
  authenticateToken,
  checkPermission(PERMISSIONS.ZONES_DELETE),
  zoneController.deleteZone,
);

// PATCH toggle zone status
router.patch(
  "/zones/:id/toggle-status",
  authenticateToken,
  checkPermission(PERMISSIONS.ZONES_EDIT),
  zoneController.toggleZoneStatus,
);

// ============= PRODUCT ROUTES =============
// GET all products
router.get(
  "/products",
  authenticateToken,
  checkPermission(PERMISSIONS.PRODUCTS_VIEW),
  productController.getAllProducts,
);

// GET single product by ID
router.get(
  "/products/:id",
  authenticateToken,
  checkPermission(PERMISSIONS.PRODUCTS_VIEW),
  productController.getProductById,
);

// POST create new product (with image)
router.post(
  "/products",
  authenticateToken,
  checkPermission(PERMISSIONS.PRODUCTS_CREATE),
  upload.fields([{ name: "image", maxCount: 1 }]),
  productController.createProduct,
);

// PUT update product (with image)
router.put(
  "/products/:id",
  authenticateToken,
  checkPermission(PERMISSIONS.PRODUCTS_EDIT),
  upload.fields([{ name: "image", maxCount: 1 }]),
  productController.updateProduct,
);

// DELETE product
router.delete(
  "/products/:id",
  authenticateToken,
  checkPermission(PERMISSIONS.PRODUCTS_DELETE),
  productController.deleteProduct,
);

// PATCH toggle product status
router.patch(
  "/products/:id/toggle-status",
  authenticateToken,
  checkPermission(PERMISSIONS.PRODUCTS_EDIT),
  productController.toggleProductStatus,
);

// PATCH toggle product featured status
router.patch(
  "/products/:id/toggle-featured",
  authenticateToken,
  checkPermission(PERMISSIONS.PRODUCTS_EDIT),
  productController.toggleProductFeatured,
);

router.get(
  "/banners",
  authenticateToken,
  checkPermission(PERMISSIONS.BANNERS_VIEW),
  bannerController.getAllBanners,
);

// POST create new banner (with image upload)
router.post(
  "/banners",
  authenticateToken,
  checkPermission(PERMISSIONS.BANNERS_CREATE),
  upload.fields([{ name: "image", maxCount: 1 }]),
  bannerController.addBanner,
);

// PUT update banner (with image upload)
router.put(
  "/banners/:bannerId",
  authenticateToken,
  checkPermission(PERMISSIONS.BANNERS_EDIT),
  upload.fields([{ name: "image", maxCount: 1 }]),
  bannerController.updateBanner,
);

// DELETE banner
router.delete(
  "/banners/:bannerId",
  authenticateToken,
  checkPermission(PERMISSIONS.BANNERS_DELETE),
  bannerController.deleteBanner,
);

// ============= SETTINGS ROUTES (Admin Only) =============
// GET site settings
router.get(
  "/settings",
  authenticateToken,
  requireAdmin,
  settingsController.getSettings,
);

// PUT update site settings
router.put(
  "/settings",
  authenticateToken,
  requireAdmin,
  upload.single("siteLogo"),
  settingsController.updateSettings,
);

module.exports = router;
