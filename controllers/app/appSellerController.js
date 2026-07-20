const User = require("../../models/users");
const SellerApplication = require("../../models/sellerApplications");
const Role = require("../../models/roles");
const { SPECIAL_ROLES } = require("../../constants/permissions");

/**
 * Request to become a seller
 * User (constRoleId: 1) can request to become Seller (constRoleId: 3)
 */
exports.becomeSeller = async (req, res) => {
  try {
    const userId = req.userId;
    const { name, mobile, email, gst, address } = req.body;

    // Validation
    if (!name || !mobile || !address) {
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

    const existingApplication = await SellerApplication.findOne({
      userId,
      status: "pending",
    });

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: "Your seller application is already pending review",
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

    const application = await SellerApplication.create({
      userId,
      name,
      mobile,
      email: email || "",
      gst: gst || "",
      address,
    });

    const populatedApplication = await SellerApplication.findById(
      application._id,
    )
      .populate("userId", "name email mobile")
      .populate("cityId", "name");

    res.json({
      success: true,
      message: "Seller application submitted successfully",
      data: populatedApplication,
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

/**
 * Switch app user between User and Seller roles by constRoleId only
 */
exports.switchAppUserRole = async (req, res) => {
  try {
    const { id } = req.user;
    const { requestedRole } = req.body;

    if (!requestedRole || !["user", "seller"].includes(requestedRole.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "requestedRole must be 'user' or 'seller'",
      });
    }

    const constRoleId = requestedRole.toLowerCase() === "seller" ? 3 : 1;

    const user = await User.findById(id).populate("roleId", "name");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.constRoleId === 4 || user.roleId?.name === SPECIAL_ROLES.ADMIN) {
      return res.status(403).json({
        success: false,
        message: "Cannot switch role for admin users",
      });
    }

    user.constRoleId = constRoleId;
    await user.save();

    const updatedUser = await User.findById(user._id)
      .populate("roleId", "name permissions isActive")
      .populate("cityId", "name")
      .populate("zoneId", "name")
      .select("-password");

    res.json({
      success: true,
      message: `User switched to ${requestedRole.toLowerCase() === "seller" ? "Seller" : "User"}`,
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error switching user role:", error);
    res.status(500).json({
      success: false,
      message: "Failed to switch user role",
      error: error.message,
    });
  }
};
