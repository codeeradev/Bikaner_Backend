const Role = require("../models/roles");
const SellerApplication = require("../models/sellerApplications");
const User = require("../models/users");

exports.getSellerApplications = async (req, res) => {
  try {
    const { page = 1, limit = 20, status = "pending", search } = req.query;
    const filter = {};

    if (status && status !== "all") {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { gst: { $regex: search, $options: "i" } },
      ];
    }

    const parsedPage = parseInt(page);
    const parsedLimit = parseInt(limit);
    const skip = (parsedPage - 1) * parsedLimit;

    const applications = await SellerApplication.find(filter)
      .populate("userId", "name email mobile constRoleId")
      .populate("cityId", "name")
      .populate("reviewedBy", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit);

    const total = await SellerApplication.countDocuments(filter);

    res.json({
      success: true,
      data: applications,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        pages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (error) {
    console.error("Error fetching seller applications:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch seller applications",
      error: error.message,
    });
  }
};

exports.approveSellerApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const application = await SellerApplication.findById(id);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Seller application not found",
      });
    }

    if (application.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Application is already ${application.status}`,
      });
    }

    const user = await User.findById(application.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Applicant user not found",
      });
    }

    const sellerRole = await Role.findOne({ name: "Seller" });
    if (!sellerRole) {
      return res.status(500).json({
        success: false,
        message: "Seller role not configured in system",
      });
    }

    const existingMobile = await User.findOne({
      mobile: application.mobile,
      _id: { $ne: application.userId },
    });
    if (existingMobile) {
      return res.status(400).json({
        success: false,
        message: "Mobile number already in use",
      });
    }

    if (application.email) {
      const existingEmail = await User.findOne({
        email: application.email,
        _id: { $ne: application.userId },
      });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: "Email already in use",
        });
      }
    }

    user.roleId = sellerRole._id;
    user.constRoleId = 3;
    user.name = application.name;
    user.mobile = application.mobile;
    user.email = application.email || user.email;
    user.cityId = application.cityId;
    await user.save();

    application.status = "approved";
    application.reviewedBy = req.userId;
    application.reviewedAt = new Date();
    application.rejectionReason = "";
    await application.save();

    const populatedApplication = await SellerApplication.findById(id)
      .populate("userId", "name email mobile constRoleId")
      .populate("cityId", "name")
      .populate("reviewedBy", "name");

    res.json({
      success: true,
      message: "Seller application approved",
      data: populatedApplication,
    });
  } catch (error) {
    console.error("Error approving seller application:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve seller application",
      error: error.message,
    });
  }
};

exports.rejectSellerApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const application = await SellerApplication.findById(id);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Seller application not found",
      });
    }

    if (application.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Application is already ${application.status}`,
      });
    }

    application.status = "rejected";
    application.reviewedBy = req.userId;
    application.reviewedAt = new Date();
    application.rejectionReason = reason || "Rejected by admin";
    await application.save();

    const populatedApplication = await SellerApplication.findById(id)
      .populate("userId", "name email mobile constRoleId")
      .populate("cityId", "name")
      .populate("reviewedBy", "name");

    res.json({
      success: true,
      message: "Seller application rejected",
      data: populatedApplication,
    });
  } catch (error) {
    console.error("Error rejecting seller application:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject seller application",
      error: error.message,
    });
  }
};
