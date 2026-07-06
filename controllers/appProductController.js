const Product = require("../models/products");
const Category = require("../models/categories");
const mongoose = require("mongoose");

exports.getCategoryProducts = async (req, res) => {
  try {
    const userId = req.user;
    const { categoryId } = req.params;

    const products = await Product.find({
      categoryId,
      isActive: true,
    }).populate("categoryId", "name");

    res.status(200).json({
      success: true,
      message: "Products fetched successfully",
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching products",
      error: error.message,
    });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const userId = req.user;
    const { id, isFeatured, categoryId, search, page = 1, limit } = req.query;

    const filter = { isActive: true }; // Default filter to only fetch active products

    if (id) {
      filter._id = new mongoose.Types.ObjectId(id);
    }

    if (categoryId) {
      filter.categoryId = new mongoose.Types.ObjectId(categoryId);
    }

    if (isFeatured !== undefined) {
      filter.isFeatured = isFeatured === "true";
    }

    if (search) {
      filter.name = {
        $regex: search,
        $options: "i",
      };
    }

    const total = await Product.countDocuments(filter);

    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      message: "Products fetched successfully",
      total,
      page: Number(page),
      limit,
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching products",
      error: error.message,
    });
  }
};
