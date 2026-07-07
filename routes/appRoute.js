const express = require("express");

const router = express.Router();

const { getActiveCategories } = require("../controllers/categoryController");

const { getActiveZones } = require("../controllers/zoneController");

const {getActiveBanners} = require("../controllers/appBannerController");

const { getCategoryProducts, getProducts, getProductById } = require("../controllers/appProductController");

const {
  authenticateToken,
} = require("../middleware/auth");

// Import app controllers
const appAuthController = require("../controllers/app/appAuthController");
const appCartController = require("../controllers/app/appCartController");
const appOrderController = require("../controllers/app/appOrderController");
const appSellerController = require("../controllers/app/appSellerController");

// ============= PUBLIC ROUTES (No Auth Required) =============
// GET active banners
router.get("/banners", getActiveBanners);

// GET active categories
router.get("/categories", getActiveCategories);

// GET active zones
router.get("/zones", getActiveZones);

// ============= AUTH ROUTES =============
// POST register new user
router.post("/auth/register", appAuthController.register);

// POST login
router.post("/auth/login", appAuthController.login);

// ============= PROTECTED ROUTES (Auth Required) =============
// GET current user profile
router.get("/auth/profile", authenticateToken, appAuthController.getProfile);

// PUT update profile
router.put("/auth/profile", authenticateToken, appAuthController.updateProfile);

// ============= PRODUCT ROUTES =============
// GET products with optional filters (token optional for pricing)
router.get("/products", authenticateToken, getProducts);

// GET products by category (token optional for pricing)
router.get("/products/category/:categoryId", authenticateToken, getCategoryProducts);

// GET single product by ID (token optional for pricing)
router.get("/products/:productId", authenticateToken, getProductById);

// ============= CART ROUTES (Auth Required) =============
// GET user's cart
router.get("/cart", authenticateToken, appCartController.getCart);

// POST add item to cart
router.post("/cart", authenticateToken, appCartController.addToCart);

// PUT update cart item
router.put("/cart", authenticateToken, appCartController.updateCartItem);

// DELETE remove item from cart
router.delete("/cart/:productId", authenticateToken, appCartController.removeFromCart);

// DELETE clear entire cart
router.delete("/cart", authenticateToken, appCartController.clearCart);

// ============= ORDER ROUTES (Auth Required) =============
// POST create order from cart
router.post("/orders", authenticateToken, appOrderController.createOrder);

// GET user's orders
router.get("/orders", authenticateToken, appOrderController.getOrders);

// GET single order details
router.get("/orders/:orderId", authenticateToken, appOrderController.getOrderById);

// PUT cancel order
router.put("/orders/:orderId/cancel", authenticateToken, appOrderController.cancelOrder);

// ============= SELLER ROUTES (Auth Required) =============
// POST request to become a seller
router.post("/seller/become", authenticateToken, appSellerController.becomeSeller);

// GET bulk orders (seller only)
router.get("/seller/bulk-orders", authenticateToken, appSellerController.getBulkOrders);

module.exports = router;

