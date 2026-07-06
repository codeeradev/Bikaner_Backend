const express = require("express");

const router = express.Router();

const { getActiveCategories } = require("../controllers/categoryController");

const { getActiveZones } = require("../controllers/zoneController");

const {getActiveBanners} = require("../controllers/appBannerController");

const { getCategoryProducts, getProducts } = require("../controllers/appProductController");

const {
  authenticateToken,
  checkPermission,
  requireAdmin,
} = require("../middleware/auth");

// GET products by category
router.get("/products/:categoryId", authenticateToken, getCategoryProducts);

// GET products with optional filters
router.get("/products", authenticateToken, getProducts);
// GET active banners
router.get("/banners", getActiveBanners);
router.get("/categories", getActiveCategories);

// GET active zones
router.get("/zones", getActiveZones);
module.exports = router;
