const Category = require("../models/categories");

// Get all categories
exports.getAllCategories = async (req, res) => {
  try {
    const { isActive, page = 1, limit = 10 } = req.query;
    
    const filter = {};
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const categories = await Category.find(filter)
      .sort({ sortOrder: 1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Category.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: categories,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching categories",
      error: error.message
    });
  }
};

// Get single category by ID
exports.getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching category",
      error: error.message
    });
  }
};

// Create new category
exports.createCategory = async (req, res) => {
  try {
    const { name, description, sortOrder, isActive } = req.body;
    const image = req.file ? `/assets/uploads/${req.file.filename}` : null;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Category name is required"
      });
    }

    const category = new Category({
      name,
      image,
      description,
      sortOrder,
      isActive
    });

    await category.save();

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating category",
      error: error.message
    });
  }
};

// Update category
exports.updateCategory = async (req, res) => {
  try {
    const { name, description, sortOrder, isActive } = req.body;
    const image = req.file ? `/assets/uploads/${req.file.filename}` : undefined;

    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    if (name !== undefined) category.name = name;
    if (image !== undefined) category.image = image;
    if (description !== undefined) category.description = description;
    if (sortOrder !== undefined) category.sortOrder = sortOrder;
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();

    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: category
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating category",
      error: error.message
    });
  }
};

// Delete category
exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Category deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting category",
      error: error.message
    });
  }
};

// Toggle category status
exports.toggleCategoryStatus = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    category.isActive = !category.isActive;
    await category.save();

    res.status(200).json({
      success: true,
      message: `Category ${category.isActive ? 'activated' : 'deactivated'} successfully`,
      data: category
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error toggling category status",
      error: error.message
    });
  }
};
