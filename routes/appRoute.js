const express = require("express");

const router = express.Router();

const { getActiveCategories } = require("../controllers/categoryController");


router.get("/categories", getActiveCategories);