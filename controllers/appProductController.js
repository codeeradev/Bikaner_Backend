const Product = require("../models/products");
const Category = require("../models/categories");
const User = require("../models/users");
const mongoose = require("mongoose");

/**
 * Transform product with role-based pricing
 * For bulk users (role 3): Calculate price based on quantity tiers in bulkPricing
 * For regular users: Use sellingPrice
 */
const transformProductForUser = (product, user) => {
  const productObj = product.toObject({
    flattenMaps: true,
  });

  // Determine pricing based on user role
  if (user && user.constRoleId === 3) {
    // Bulk user - expose bulk pricing tiers
    productObj.displayPrice = productObj.sellingPrice; // Default to selling price
    productObj.priceType = "bulk";
    productObj.bulkPricingTiers = productObj.bulkPricing || [];
    
    // If bulk pricing tiers exist, show the lowest tier price as display price
    if (productObj.bulkPricing && productObj.bulkPricing.length > 0) {
      const lowestTier = productObj.bulkPricing.reduce((min, tier) => 
        tier.price < min.price ? tier : min
      );
      productObj.displayPrice = lowestTier.price;
      productObj.minBulkQuantity = lowestTier.minQty;
    }
  } else {
    // Regular user - use selling price
    productObj.displayPrice = productObj.sellingPrice;
    productObj.priceType = "selling";
  }

  // Remove sensitive pricing data from response
  delete productObj.sellingPrice;
  delete productObj.bulkPricing;

  return productObj;
};

exports.getCategoryProducts = async (req, res) => {
  try {
    const userId = req.userId;
    const { categoryId } = req.params;

    // Get user to determine pricing
    let user = null;
    if (userId) {
      user = await User.findById(userId);
    }

    const products = await Product.find({
      categoryId,
      isActive: true,
    }).populate("categoryId", "name");

    // Transform products with role-based pricing
    const transformedProducts = products.map(product => 
      transformProductForUser(product, user)
    );

    res.status(200).json({
      success: true,
      message: "Products fetched successfully",
      data: transformedProducts,
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
    const userId = req.userId;
    const { id, isFeatured, categoryId, search, page = 1, limit = 10 } = req.query;

    // Get user to determine pricing
    let user = null;
    if (userId) {
      user = await User.findById(userId);
    }

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
      .populate("categoryId", "name")
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    // Transform products with role-based pricing
    const transformedProducts = products.map(product => 
      transformProductForUser(product, user)
    );

    res.status(200).json({
      success: true,
      message: "Products fetched successfully",
      total,
      page: Number(page),
      limit: Number(limit),
      data: transformedProducts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching products",
      error: error.message,
    });
  }
};

/**
 * Get single product by ID with role-based pricing
 */
exports.getProductById = async (req, res) => {
  try {
    const userId = req.userId;
    const { productId } = req.params;

    // Get user to determine pricing
    let user = null;
    if (userId) {
      user = await User.findById(userId);
    }

    const product = await Product.findOne({ _id: productId, isActive: true })
      .populate("categoryId", "name");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Transform product with role-based pricing
    const transformedProduct = transformProductForUser(product, user);

    res.status(200).json({
      success: true,
      message: "Product fetched successfully",
      data: transformedProduct,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching product",
      error: error.message,
    });
  }
};

