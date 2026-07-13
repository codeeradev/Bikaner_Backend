const jwt = require("jsonwebtoken");
const User = require("../../models/users");
const Role = require("../../models/roles");
const OTP = require("../../models/otp");
const {
  generateOTP,
  sendOTPEmail,
  sendOTPSMS,
} = require("../../utils/otpService");

/**
 * Generate JWT token for app users (no expiration)
 */
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || "your-secret-key");
  // No expiration for app users
};

/**
 * Send OTP - Step 1 of authentication
 * POST /app/auth/send-otp
 * Body: { identifier: "email@example.com" OR "9999999999", type: "email" OR "mobile" }
 */
exports.login = async (req, res) => {
  try {
    const { identifier, type } = req.body; // identifier = email or mobile, type = "email" or "mobile"

    // Validation
    if (!identifier || !type) {
      return res.status(400).json({
        success: false,
        message: "Identifier and type are required",
      });
    }

    if (!["email", "mobile"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Type must be either 'email' or 'mobile'",
      });
    }

    // Validate format
    if (type === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(identifier)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email format",
        });
      }
    } else if (type === "mobile") {
      const mobileRegex = /^[0-9]{10}$/;
      if (!mobileRegex.test(identifier)) {
        return res.status(400).json({
          success: false,
          message: "Invalid mobile number. Must be 10 digits.",
        });
      }
    }

    // Generate OTP
    const otp = generateOTP(); // Returns "123456" for development

    // Delete any existing OTPs for this identifier
    await OTP.deleteMany({ identifier, identifierType: type });

    // Save OTP to database
    const otpDoc = new OTP({
      identifier,
      identifierType: type,
      otp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    });

    await otpDoc.save();

    // Send OTP based on type
    let sendResult;
    if (type === "email") {
      sendResult = await sendOTPEmail(identifier, otp);
    } else {
      sendResult = await sendOTPSMS(identifier, otp);
    }

    if (!sendResult.success) {
      return res.status(500).json({
        success: false,
        message: `Failed to send OTP: ${sendResult.error}`,
      });
    }

    res.json({
      success: true,
      message: `OTP sent successfully to your ${type}`,
      // For development only - remove in production
      devOTP: process.env.NODE_ENV === "development" ? otp : undefined,
    });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send OTP",
      error: error.message,
    });
  }
};

/**
 * Verify OTP and Login/Register - Step 2 of authentication
 * POST /app/auth/verify-otp
 * Body: { identifier: "email@example.com" OR "9999999999", type: "email" OR "mobile", otp: "123456", name: "John Doe" (optional for new users) }
 */
exports.verifyOTP = async (req, res) => {
  try {
    const { identifier, type, otp, name } = req.body; // name is optional for new users

    // Validation
    if (!identifier || !type || !otp) {
      return res.status(400).json({
        success: false,
        message: "Identifier, type, and OTP are required",
      });
    }

    // Find OTP in database
    const otpDoc = await OTP.findOne({
      identifier,
      identifierType: type,
      otp,
      verified: false,
      expiresAt: { $gt: new Date() }, // Not expired
    }).sort({ createdAt: -1 }); // Get the latest OTP

    if (!otpDoc) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    // Mark OTP as verified
    otpDoc.verified = true;
    await otpDoc.save();

    // Check if user exists
    let user;
    if (type === "email") {
      user = await User.findOne({ email: identifier }).populate("roleId");
    } else {
      user = await User.findOne({ mobile: identifier }).populate("roleId");
    }

    // If user doesn't exist, create new user (auto-registration)
    if (!user) {
      // Create new user
      user = new User({
        name: name,
        email: type === "email" ? identifier : "",
        mobile: type === "mobile" ? identifier : "",
        constRoleId: 1,
        status: "active",
      });

      await user.save();
      await user.populate("roleId");
    } else {
      // Check if user is active
      if (user.status !== "active") {
        return res.status(403).json({
          success: false,
          message: "Your account is inactive. Please contact support.",
        });
      }

      // Check if user is blocked
      if (user.isBlocked) {
        return res.status(403).json({
          success: false,
          message: "Your account has been blocked. Please contact support.",
        });
      }

      // Check if user is app user (constRoleId: 1 or 3)
      if (![1, 3].includes(user.constRoleId)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. This login is for app users only.",
        });
      }
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        profileImage: user.profileImage,
        constRoleId: user.constRoleId,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify OTP",
      error: error.message,
    });
  }
};

/**
 * Get current user profile
 */
exports.getProfile = async (req, res) => {
  try {
    const userId = req.userId;

    const user = await User.findById(userId)
      .populate("cityId", "name")
      .select("-password -roleId -__v -zoneIds -allowedCategories -isBlocked -constRoleId -createdAt -customPricingEnabled");

      if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if profile is completed
    const profileCompleted = !!(user.name && user.name.trim() !== "");

    res.json({
      success: true,
      data: {
        ...user.toObject(),
        profileCompleted,
      },
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
      error: error.message,
    });
  }
};

/**
 * Update current user profile
 */
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.userId;
    const { name, email, lat, lng } = req.body;

    console.log(req.body)
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update basic info
    if (name) user.name = name;

    // Check email uniqueness if changing
    if (email !== undefined && email !== user.email) {
      if (email) {
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
      user.email = email || null;
    }

    // Update location
    if (lat !== undefined) user.lat = lat;
    if (lng !== undefined) user.lng = lng;

    // Update profile image if uploaded
    if (req.file) {
      user.profileImage = `/assets/uploads/${req.file.filename}`;
    }

    await user.save();

    // Return updated user without password
    const updatedUser = await User.findById(userId)
      .populate("roleId", "name")
      .populate("cityId", "name")
      .select("-password");

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: error.message,
    });
  }
};
