const express = require("express");
const router = express.Router();

// Import controllers
const categoryController = require("../controllers/categoryController");
const cityController = require("../controllers/cityController");
const zoneController = require("../controllers/zoneController");

// ============= CATEGORY ROUTES =============
// GET all categories
router.get("/categories", categoryController.getAllCategories);

// GET single category by ID
router.get("/categories/:id", categoryController.getCategoryById);

// POST create new category
router.post("/categories", categoryController.createCategory);

// PUT update category
router.put("/categories/:id", categoryController.updateCategory);

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

module.exports = router;
