const jwt = require("jsonwebtoken");
const User = require("../../models/users");
const Role = require("../../models/roles");

/**
 * Generate JWT token for app users (no expiration)
 */
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || "your-secret-key");
  // No expiration for app users
};

/**
 * Register new user (constRoleId: 1)
 */
exports.register = async (req, res) => {
  try {
    const { name, mobile, email, password } = req.body;

    // Validation
    if (!name || !mobile || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, mobile, and password are required",
      });
    }

    // Check if mobile already exists
    const existingUser = await User.findOne({ mobile });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this mobile number already exists",
      });
    }

    // Check if email already exists (if provided)
    if (email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: "User with this email already exists",
        });
      }
    }

    // Create user (password should be hashed in production)
    const user = new User({
      roleId: null,
      name,
      mobile,
      email: email || null,
      password, // TODO: Hash password using bcrypt
      constRoleId: 1, // User constant role ID
      status: "active",
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id);

    // Prepare user data (exclude password)
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: "User",
      constRoleId: 1,
      status: user.status,
    };

    res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user: userData,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed",
      error: error.message,
    });
  }
};

/**
 * Login user (constRoleId: 1 or 3)
 */
exports.login = async (req, res) => {
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

    // Check if user is app user (constRoleId: 1 or 3)
    if (!user.constRoleId || (user.constRoleId !== 1 && user.constRoleId !== 3)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to access this app",
      });
    }

    // Check password (In production, use bcrypt.compare)
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

    // Generate token
    const token = generateToken(user._id);

    // Prepare user data
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      profileImage: user.profileImage,
      role: user.roleId?.name || "User",
      constRoleId: user.constRoleId,
      cityId: user.cityId,
      lat: user.lat,
      lng: user.lng,
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
 * Get current user profile
 */
exports.getProfile = async (req, res) => {
  try {
    const userId = req.userId;

    const user = await User.findById(userId)
      .populate("cityId", "name")
      .select("-password -roleId -__v");

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
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.userId;
    const { name, email, currentPassword, newPassword, lat, lng } = req.body;

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
