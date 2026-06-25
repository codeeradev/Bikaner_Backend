const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");

// Import controllers
const categoryController = require("../controllers/categoryController");
const cityController = require("../controllers/cityController");
const zoneController = require("../controllers/zoneController");
const productController = require("../controllers/productController");

// ============= CATEGORY ROUTES =============
// GET all categories
router.get("/categories", categoryController.getAllCategories);

// GET single category by ID
router.get("/categories/:id", categoryController.getCategoryById);

// POST create new category (with image upload)
router.post("/categories", upload.single('image'), categoryController.createCategory);

// PUT update category (with image upload)
router.put("/categories/:id", upload.single('image'), categoryController.updateCategory);

// DELETE category
router.delete("/categories/:id", categoryController.deleteCategory);

// PATCH toggle category status
router.patch("/categories/:id/toggle-status", categoryController.toggleCategoryStatus);

// ============= CITY ROUTES =============
// GET all cities
router.get("/cities", cityController.getAllCities);

// GET single city by ID
router.get("/cities/:id", cityController.getCityById);

// GET city with zones
router.get("/cities/:id/zones", cityController.getCityWithZones);

// POST create new city
router.post("/cities", cityController.createCity);

// PUT update city
router.put("/cities/:id", cityController.updateCity);

// DELETE city
router.delete("/cities/:id", cityController.deleteCity);

// PATCH toggle city status
router.patch("/cities/:id/toggle-status", cityController.toggleCityStatus);

// ============= ZONE ROUTES =============
// GET all zones
router.get("/zones", zoneController.getAllZones);

// GET zones by city
router.get("/zones/city/:cityId", zoneController.getZonesByCity);

// GET single zone by ID
router.get("/zones/:id", zoneController.getZoneById);

// POST create new zone
router.post("/zones", zoneController.createZone);

// PUT update zone
router.put("/zones/:id", zoneController.updateZone);

// DELETE zone
router.delete("/zones/:id", zoneController.deleteZone);

// PATCH toggle zone status
router.patch("/zones/:id/toggle-status", zoneController.toggleZoneStatus);

// ============= PRODUCT ROUTES =============
// GET all products
router.get("/products", productController.getAllProducts);

// GET single product by ID
router.get("/products/:id", productController.getProductById);

// POST create new product (with image and gallery upload)
router.post("/products", upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'gallery', maxCount: 10 }
]), productController.createProduct);

// PUT update product (with image and gallery upload)
router.put("/products/:id", upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'gallery', maxCount: 10 }
]), productController.updateProduct);

// DELETE product
router.delete("/products/:id", productController.deleteProduct);

// PATCH toggle product status
router.patch("/products/:id/toggle-status", productController.toggleProductStatus);

// PATCH toggle product featured status
router.patch("/products/:id/toggle-featured", productController.toggleProductFeatured);

module.exports = router;
