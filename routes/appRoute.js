const express = require("express");

const router = express.Router();

const { getActiveCategories } = require("../controllers/categoryController");

const { getActiveZones } = require("../controllers/zoneController");
router.get("/categories", getActiveCategories);

// GET active zones
router.get("/zones", getActiveZones);
module.exports = router;
