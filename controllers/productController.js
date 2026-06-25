const Product = require("../models/products");
const Category = require("../models/categories");

// Get all products
exports.getAllProducts = async (req, res) => {
  try {
    const {
      isActive,
      categoryId,
      isFeatured,
      page = 1,
      limit = 10,
    } = req.query;

    const filter = {};
    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    if (categoryId && categoryId !== "undefined" && categoryId !== "null") {
      filter.categoryId = categoryId;
    }
    if (isFeatured !== undefined) {
      filter.isFeatured = isFeatured === "true";
    }

    const products = await Product.find(filter)
      .populate("categoryId", "name")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Product.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: products,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching products",
      error: error.message,
    });
  }
};

// Get single product by ID
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate(
      "categoryId",
      "name",
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching product",
      error: error.message,
    });
  }
};

// Create new product
exports.createProduct = async (req, res) => {
  try {
    const {
      categoryId,
      name,
      slug,
      description,
      sku,
      weight,
      unit,
      mrp,
      sellingPrice,
      bulkPrice,
      stock,
      minBulkQty,
      isFeatured,
      isActive,
    } = req.body;

    const image = req.files?.image
      ? `/assets/uploads/${req.files.image[0].filename}`
      : null;
    const gallery = req.files?.gallery
      ? req.files.gallery.map((file) => `/assets/uploads/${file.filename}`)
      : [];

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Product name is required",
      });
    }

    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: "Category is required",
      });
    }

    // Verify category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const product = new Product({
      categoryId,
      name,
      slug: slug || name.toLowerCase().replace(/\s+/g, "-"),
      description,
      sku,
      image,
      gallery,
      weight,
      unit,
      mrp,
      sellingPrice,
      bulkPrice,
      stock,
      minBulkQty,
      isFeatured,
      isActive,
    });

    await product.save();

    // Populate category before sending response
    await product.populate("categoryId", "name");

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating product",
      error: error.message,
    });
  }
};

// Update product
exports.updateProduct = async (req, res) => {
  try {
    const {
      categoryId,
      name,
      slug,
      description,
      sku,
      weight,
      unit,
      mrp,
      sellingPrice,
      bulkPrice,
      stock,
      minBulkQty,
      isFeatured,
      isActive,
    } = req.body;

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Handle image upload
    if (req.files?.image) {
      product.image = `/assets/uploads/${req.files.image[0].filename}`;
    }

    // Handle gallery upload
    if (req.files?.gallery) {
      const newGalleryImages = req.files.gallery.map(
        (file) => `/assets/uploads/${file.filename}`,
      );
      product.gallery = product.gallery
        ? [...product.gallery, ...newGalleryImages]
        : newGalleryImages;
    }

    // Verify category if being updated
    if (categoryId && categoryId !== product.categoryId.toString()) {
      const category = await Category.findById(categoryId);
      if (!category) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
      }
      product.categoryId = categoryId;
    }

    if (name !== undefined) product.name = name;
    if (slug !== undefined) product.slug = slug;
    if (description !== undefined) product.description = description;
    if (sku !== undefined) product.sku = sku;
    if (weight !== undefined) product.weight = weight;
    if (unit !== undefined) product.unit = unit;
    if (mrp !== undefined) product.mrp = mrp;
    if (sellingPrice !== undefined) product.sellingPrice = sellingPrice;
    if (bulkPrice !== undefined) product.bulkPrice = bulkPrice;
    if (stock !== undefined) product.stock = stock;
    if (minBulkQty !== undefined) product.minBulkQty = minBulkQty;
    if (isFeatured !== undefined) product.isFeatured = isFeatured;
    if (isActive !== undefined) product.isActive = isActive;

    await product.save();
    await product.populate("categoryId", "name");

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating product",
      error: error.message,
    });
  }
};

// Delete product
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting product",
      error: error.message,
    });
  }
};

// Toggle product status
exports.toggleProductStatus = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    product.isActive = !product.isActive;
    await product.save();

    res.status(200).json({
      success: true,
      message: `Product ${product.isActive ? "activated" : "deactivated"} successfully`,
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error toggling product status",
      error: error.message,
    });
  }
};

// Toggle product featured status
exports.toggleProductFeatured = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    product.isFeatured = !product.isFeatured;
    await product.save();

    res.status(200).json({
      success: true,
      message: `Product ${product.isFeatured ? "marked as featured" : "unmarked from featured"}`,
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error toggling product featured status",
      error: error.message,
    });
  }
};
