const User = require("../../models/users");
const Role = require("../../models/roles");

/**
 * Request to become a seller
 * User (constRoleId: 1) can request to become Seller (constRoleId: 3)
 */
exports.becomeSeller = async (req, res) => {
  try {
    const userId = req.userId;
    const { name, mobile, email, gst, address, cityId } = req.body;

    // Validation
    if (!name || !mobile || !address || !cityId) {
      return res.status(400).json({
        success: false,
        message: "Name, mobile, address, and city are required",
      });
    }

    // Find user
    const user = await User.findById(userId).populate("roleId");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user is already a seller
    if (user.constRoleId === 3) {
      return res.status(400).json({
        success: false,
        message: "You are already a seller",
      });
    }

    // Check if user is eligible (should be a User with constRoleId: 1)
    if (user.constRoleId !== 1) {
      return res.status(403).json({
        success: false,
        message: "You are not eligible to become a seller",
      });
    }

    // Find Seller role
    const sellerRole = await Role.findOne({ name: "Seller" });
    if (!sellerRole) {
      return res.status(500).json({
        success: false,
        message: "Seller role not configured in system",
      });
    }

    // Check mobile uniqueness if changing
    if (mobile && mobile !== user.mobile) {
      const existingMobile = await User.findOne({
        mobile,
        _id: { $ne: userId },
      });
      if (existingMobile) {
        return res.status(400).json({
          success: false,
          message: "Mobile number already in use",
        });
      }
    }

    // Check email uniqueness if provided and changing
    if (email && email !== user.email) {
      const existingEmail = await User.findOne({
        email,
        _id: { $ne: userId },
      });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: "Email already in use",
        });
      }
    }

    // Update user to seller
    user.roleId = sellerRole._id;
    user.constRoleId = 3; // Seller constant role ID
    user.name = name;
    user.mobile = mobile;
    user.email = email || user.email;
    user.cityId = cityId;
    
    // Store additional seller info
    // Note: If you need separate fields for seller-specific data, add them to the User model
    // For now, we're using existing fields
    
    await user.save();

    // Get updated user data
    const updatedUser = await User.findById(userId)
      .populate("roleId", "name")
      .populate("cityId", "name")
      .select("-password");

    res.json({
      success: true,
      message: "You are now a seller! You can now place bulk orders.",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error becoming seller:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process seller request",
      error: error.message,
    });
  }
};

/**
 * Get bulk order history for seller
 */
exports.getBulkOrders = async (req, res) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 10, status } = req.query;

    // Find user
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user is a seller
    if (user.constRoleId !== 3) {
      return res.status(403).json({
        success: false,
        message: "Only sellers can access bulk orders",
      });
    }

    // TODO: Implement order model and fetch orders
    // For now, return empty response
    res.json({
      success: true,
      message: "Bulk orders retrieved successfully",
      data: [],
      pagination: {
        total: 0,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: 0,
      },
    });
  } catch (error) {
    console.error("Error fetching bulk orders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bulk orders",
      error: error.message,
    });
  }
};
