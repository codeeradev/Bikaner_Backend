const Banner = require("../models/banner");

// Get all banners
exports.getAllBanners = async (req, res) => {
  try {
    const banners = await Banner.find()
      .populate("productId", "name")
      .sort({ createdAt: -1 });

    // Transform the response to match frontend expectations
    const transformedBanners = banners.map((banner) => ({
      ...banner.toObject(),
      id: banner._id.toString(),
      product: banner.productId ? {
        _id: banner.productId._id.toString(),
        name: banner.productId.name
      } : undefined
    }));

    res.status(200).json({
      success: true,
      data: transformedBanners,
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
    const { title, isActive, productId } = req.body;

    console.log("Request Body:", req.body);

    console.log("Request Files:", req.files);
    const image = req.files?.image
      ? `/assets/uploads/${req.files.image[0].filename}`
      : null;

    const newBanner = await Banner.create({
      title,
      productId,
      image,
      isActive,
    });

    res.status(201).json({
      success: true,
      message: "Banner added successfully",
      data: newBanner,
    });
  } catch (error) {
    console.error("Error adding banner:", error);
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
    const { title, isActive, productId } = req.body;

    const updateData = {};

    if (title !== undefined) {
      updateData.title = title;
    }

    if (req.files?.image) {
      updateData.image = `/assets/uploads/${req.files.image[0].filename}`;
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

exports.deleteBanner = async (req, res) => {
  try {
    const { bannerId } = req.params;

    const banner = await Banner.findByIdAndDelete(bannerId);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Banner deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error deleting banner",
      error: error.message,
    });
  }
};
