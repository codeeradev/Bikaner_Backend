const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");

// Import middleware
const { authenticateToken, checkPermission, requireAdmin } = require("../middleware/auth");
const { PERMISSIONS } = require("../constants/permissions");

// Import controllers
const authController = require("../controllers/authController");
const roleController = require("../controllers/roleController");
const userController = require("../controllers/userController");
const categoryController = require("../controllers/categoryController");
const cityController = require("../controllers/cityController");
const zoneController = require("../controllers/zoneController");
const productController = require("../controllers/productController");

// ============= PUBLIC AUTH ROUTES =============
// POST login
router.post("/api/auth/login", authController.login);

// POST refresh token
router.post("/api/auth/refresh", authController.refreshToken);

// POST logout (requires auth)
router.post("/api/auth/logout", authenticateToken, authController.logout);

// GET current user profile
router.get("/api/auth/profile", authenticateToken, authController.getProfile);

// PUT update current user profile
router.put("/api/auth/profile", authenticateToken, upload.single('profileImage'), authController.updateProfile);

// ============= ROLE ROUTES (Admin Only) =============
// GET all available permissions
router.get("/api/permissions", authenticateToken, requireAdmin, roleController.getAvailablePermissions);

// GET all roles
router.get("/api/roles", authenticateToken, checkPermission(PERMISSIONS.ROLES_VIEW), roleController.getAllRoles);

// GET single role by ID
router.get("/api/roles/:id", authenticateToken, checkPermission(PERMISSIONS.ROLES_VIEW), roleController.getRoleById);

// POST create new role (Admin only)
router.post("/api/roles", authenticateToken, requireAdmin, roleController.createRole);

// PUT update role (Admin only)
router.put("/api/roles/:id", authenticateToken, requireAdmin, roleController.updateRole);

// DELETE role (Admin only)
router.delete("/api/roles/:id", authenticateToken, requireAdmin, roleController.deleteRole);

// PATCH toggle role status (Admin only)
router.patch("/api/roles/:id/toggle-status", authenticateToken, requireAdmin, roleController.toggleRoleStatus);

// ============= USER/STAFF ROUTES =============
// GET all users
router.get("/api/users", authenticateToken, checkPermission(PERMISSIONS.USERS_VIEW), userController.getAllUsers);

// GET single user by ID
router.get("/api/users/:id", authenticateToken, checkPermission(PERMISSIONS.USERS_VIEW), userController.getUserById);

// POST create new user
router.post("/api/users", authenticateToken, checkPermission(PERMISSIONS.USERS_CREATE), upload.single('profileImage'), userController.createUser);

// PUT update user
router.put("/api/users/:id", authenticateToken, checkPermission(PERMISSIONS.USERS_EDIT), upload.single('profileImage'), userController.updateUser);

// DELETE user
router.delete("/api/users/:id", authenticateToken, checkPermission(PERMISSIONS.USERS_DELETE), userController.deleteUser);

// PATCH toggle user status
router.patch("/api/users/:id/toggle-status", authenticateToken, checkPermission(PERMISSIONS.USERS_EDIT), userController.toggleUserStatus);

// ============= CATEGORY ROUTES =============
// GET all categories
router.get("/api/categories", authenticateToken, checkPermission(PERMISSIONS.CATEGORIES_VIEW), categoryController.getAllCategories);

// GET single category by ID
router.get("/api/categories/:id", authenticateToken, checkPermission(PERMISSIONS.CATEGORIES_VIEW), categoryController.getCategoryById);

// POST create new category (with image upload)
router.post("/api/categories", authenticateToken, checkPermission(PERMISSIONS.CATEGORIES_CREATE), upload.single('image'), categoryController.createCategory);

// PUT update category (with image upload)
router.put("/api/categories/:id", authenticateToken, checkPermission(PERMISSIONS.CATEGORIES_EDIT), upload.single('image'), categoryController.updateCategory);

// DELETE category
router.delete("/api/categories/:id", authenticateToken, checkPermission(PERMISSIONS.CATEGORIES_DELETE), categoryController.deleteCategory);

// PATCH toggle category status
router.patch("/api/categories/:id/toggle-status", authenticateToken, checkPermission(PERMISSIONS.CATEGORIES_EDIT), categoryController.toggleCategoryStatus);

// ============= CITY ROUTES =============
// GET all cities
router.get("/api/cities", authenticateToken, checkPermission(PERMISSIONS.CITIES_VIEW), cityController.getAllCities);

// GET single city by ID
router.get("/api/cities/:id", authenticateToken, checkPermission(PERMISSIONS.CITIES_VIEW), cityController.getCityById);

// GET city with zones
router.get("/api/cities/:id/zones", authenticateToken, checkPermission(PERMISSIONS.CITIES_VIEW), cityController.getCityWithZones);

// POST create new city
router.post("/api/cities", authenticateToken, checkPermission(PERMISSIONS.CITIES_CREATE), cityController.createCity);

// PUT update city
router.put("/api/cities/:id", authenticateToken, checkPermission(PERMISSIONS.CITIES_EDIT), cityController.updateCity);

// DELETE city
router.delete("/api/cities/:id", authenticateToken, checkPermission(PERMISSIONS.CITIES_DELETE), cityController.deleteCity);

// PATCH toggle city status
router.patch("/api/cities/:id/toggle-status", authenticateToken, checkPermission(PERMISSIONS.CITIES_EDIT), cityController.toggleCityStatus);

// ============= ZONE ROUTES =============
// GET all zones
router.get("/api/zones", authenticateToken, checkPermission(PERMISSIONS.ZONES_VIEW), zoneController.getAllZones);

// GET zones by city
router.get("/api/zones/city/:cityId", authenticateToken, checkPermission(PERMISSIONS.ZONES_VIEW), zoneController.getZonesByCity);

// GET single zone by ID
router.get("/api/zones/:id", authenticateToken, checkPermission(PERMISSIONS.ZONES_VIEW), zoneController.getZoneById);

// POST create new zone
router.post("/api/zones", authenticateToken, checkPermission(PERMISSIONS.ZONES_CREATE), zoneController.createZone);

// PUT update zone
router.put("/api/zones/:id", authenticateToken, checkPermission(PERMISSIONS.ZONES_EDIT), zoneController.updateZone);

// DELETE zone
router.delete("/api/zones/:id", authenticateToken, checkPermission(PERMISSIONS.ZONES_DELETE), zoneController.deleteZone);

// PATCH toggle zone status
router.patch("/api/zones/:id/toggle-status", authenticateToken, checkPermission(PERMISSIONS.ZONES_EDIT), zoneController.toggleZoneStatus);

// ============= PRODUCT ROUTES =============
// GET all products
router.get("/api/products", authenticateToken, checkPermission(PERMISSIONS.PRODUCTS_VIEW), productController.getAllProducts);

// GET single product by ID
router.get("/api/products/:id", authenticateToken, checkPermission(PERMISSIONS.PRODUCTS_VIEW), productController.getProductById);

// POST create new product (with image and gallery upload)
router.post("/api/products", authenticateToken, checkPermission(PERMISSIONS.PRODUCTS_CREATE), upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'gallery', maxCount: 10 }
]), productController.createProduct);

// PUT update product (with image and gallery upload)
router.put("/api/products/:id", authenticateToken, checkPermission(PERMISSIONS.PRODUCTS_EDIT), upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'gallery', maxCount: 10 }
]), productController.updateProduct);

// DELETE product
router.delete("/api/products/:id", authenticateToken, checkPermission(PERMISSIONS.PRODUCTS_DELETE), productController.deleteProduct);

// PATCH toggle product status
router.patch("/api/products/:id/toggle-status", authenticateToken, checkPermission(PERMISSIONS.PRODUCTS_EDIT), productController.toggleProductStatus);

// PATCH toggle product featured status
router.patch("/api/products/:id/toggle-featured", authenticateToken, checkPermission(PERMISSIONS.PRODUCTS_EDIT), productController.toggleProductFeatured);

module.exports = router;
