const Banner = require("../models/banner");

// Get all banners
exports.getAllBanners = async (req, res) => {
  try {
    const banners = await Banner.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: banners,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching banners",
      error: error.message,
    });
  }
};

exports.addBanner = async (req, res) => {
  try {
    const { title, image, isActive, productId } = req.body;

    const newBanner = await Banner.create({
      title,
      image,
      productId,
      isActive,
    });

    res.status(201).json({
      success: true,
      message: "Banner added successfully",
      data: newBanner,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error adding banner",
      error: error.message,
    });
  }
};

exports.updateBanner = async (req, res) => {
  try {
    const { bannerId } = req.params;
    const { title, image, isActive, productId } = req.body;

    const updateData = {};

    if (title !== undefined) {
      updateData.title = title;
    }

    if (image !== undefined) {
      updateData.image = image;
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    if (productId !== undefined) {
      updateData.productId = productId;
    }

    const updatedBanner = await Banner.findByIdAndUpdate(bannerId, updateData, {
      new: true,
    });

    return res
      .status(200)
      .json({ message: "Banner Update Succesfully", updatedBanner });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error updating banner",
      error: error.message,
    });
  }
};
