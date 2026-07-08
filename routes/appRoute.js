const express = require("express");

const router = express.Router();

const { getActiveCategories } = require("../controllers/categoryController");

const { getActiveZones } = require("../controllers/zoneController");

const {getActiveBanners} = require("../controllers/appBannerController");

const { getCategoryProducts, getProducts, getProductById } = require("../controllers/appProductController");

const settingsController = require("../controllers/settingsController");

const {
  authenticateToken,
} = require("../middleware/auth");

// Import app controllers
const appAuthController = require("../controllers/app/appAuthController");
const appCartController = require("../controllers/app/appCartController");
const appOrderController = require("../controllers/app/appOrderController");
const appSellerController = require("../controllers/app/appSellerController");
const appAddressController = require("../controllers/app/appAddressController");

// ============= PUBLIC ROUTES (No Auth Required) =============
// GET active banners
router.get("/banners", getActiveBanners);

// GET active categories
router.get("/categories", getActiveCategories);

// GET active zones
router.get("/zones", getActiveZones);

// GET public settings (terms, privacy policy, etc.)
router.get("/settings", settingsController.getPublicSettings);

// ============= AUTH ROUTES =============
// POST send OTP (Step 1)
router.post("/auth/login", appAuthController.login);

// POST verify OTP and login/register (Step 2)
router.post("/auth/verify-otp", appAuthController.verifyOTP);

// ============= PROTECTED ROUTES (Auth Required) =============
// GET current user profile
router.get("/auth/profile", authenticateToken, appAuthController.getProfile);

// PUT update profile
router.put("/auth/profile", authenticateToken, appAuthController.updateProfile);

// ============= PRODUCT ROUTES =============
// GET products with optional filters (token optional for pricing)
router.get("/products", authenticateToken, getProducts);

// GET products by category (token optional for pricing)
router.get("/products/:categoryId", authenticateToken, getCategoryProducts);

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

// ============= ADDRESS ROUTES (Auth Required) =============
// GET all addresses for current user
router.get("/addresses", authenticateToken, appAddressController.getAddresses);

// GET single address by ID
router.get("/addresses/:addressId", authenticateToken, appAddressController.getAddressById);

// POST create new address
router.post("/addresses", authenticateToken, appAddressController.createAddress);

// PUT update address
router.put("/addresses/:addressId", authenticateToken, appAddressController.updateAddress);

// DELETE address
router.delete("/addresses/:addressId", authenticateToken, appAddressController.deleteAddress);

// PUT set address as default
router.put("/addresses/:addressId/default", authenticateToken, appAddressController.setDefaultAddress);

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

router.post("/update-location", authenticateToken, appAddressController.updateLocation);
module.exports = router;

