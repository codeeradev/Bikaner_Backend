const jwt = require("jsonwebtoken");
const User = require("../models/users");
const Role = require("../models/roles");

/**
 * Generate JWT token for admin (expires in 1 day)
 */
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || "your-secret-key", {
    expiresIn: "1d", // Admin token expires in 1 day
  });
};

/**
 * Login user
 */
const login = async (req, res) => {
  try {
    const { mobile, email, password } = req.body;

    // Validation
    if ((!mobile && !email) || !password) {
      return res.status(400).json({
        success: false,
        message: "Mobile/Email and password are required",
      });
    }

    // Find user by mobile or email
    const query = mobile ? { mobile } : { email };
    const user = await User.findOne(query).populate("roleId");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check password (In production, use bcrypt.compare)
    // const isPasswordValid = await bcrypt.compare(password, user.password);
    const isPasswordValid = password === user.password; // TODO: Implement bcrypt

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check if user is active
    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive. Please contact administrator.",
      });
    }

    // Check if user is blocked
    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Your account has been blocked. Please contact administrator.",
      });
    }

    // Check if role is active
    if (!user.roleId || !user.roleId.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your role is inactive. Please contact administrator.",
      });
    }
    
    // Check if user is staff member (constRoleId: 4)
    if (!user.constRoleId || user.constRoleId !== 4) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to access the admin panel.",
      });
    }
    
    // Generate token
    const token = generateToken(user._id);

    // Prepare user data
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      profileImage: user.profileImage,
      role: user.roleId.name,
      roleId: user.roleId._id,
      permissions: user.roleId.permissions || [],
      cityId: user.cityId,
      zoneIds: user.zoneIds,
      status: user.status,
    };

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: userData,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message,
    });
  }
};

/**
 * Logout user
 */
const logout = async (req, res) => {
  try {
    // In a production app, you might want to:
    // 1. Blacklist the token
    // 2. Log the logout event

    res.json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Logout failed",
      error: error.message,
    });
  }
};

/**
 * Get current user profile
 */
const getProfile = async (req, res) => {
  try {
    const userId = req.userId;

    const user = await User.findById(userId)
      .populate("roleId", "name permissions isActive")
      .populate("cityId", "name")
      .populate("zoneIds", "name")
      .populate("allowedCategories", "name")
      .select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: user,
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
const updateProfile = async (req, res) => {
  try {
    const userId = req.userId;
    const { name, email, mobile, currentPassword, newPassword } = req.body;

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
      const existingEmail = await User.findOne({ email, _id: { $ne: userId } });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: "Email already in use",
        });
      }
      user.email = email;
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
      user.mobile = mobile;
    }

    // Update password if provided
    if (currentPassword && newPassword) {
      // Verify current password (In production, use bcrypt.compare)
      const isPasswordValid = currentPassword === user.password; // TODO: Implement bcrypt

      if (!isPasswordValid) {
        return res.status(400).json({
          success: false,
          message: "Current password is incorrect",
        });
      }

      user.password = newPassword; // TODO: Hash with bcrypt
    }

    // Update profile image if uploaded
    if (req.file) {
      user.profileImage = `/assets/users/${req.file.filename}`;
    }

    await user.save();

    // Return updated user without password
    const updatedUser = await User.findById(userId)
      .populate("roleId", "name permissions isActive")
      .populate("cityId", "name")
      .populate("zoneIds", "name")
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

module.exports = {
  login,
  logout,
  getProfile,
  updateProfile,
};
