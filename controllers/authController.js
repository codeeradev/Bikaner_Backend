const jwt = require("jsonwebtoken");
const User = require("../models/users");
const Role = require("../models/roles");

/**
 * Generate JWT token
 */
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: process.env.JWT_EXPIRY || '24h' }
  );
};

/**
 * Generate refresh token
 */
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key',
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
  );
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
        message: "Mobile/Email and password are required"
      });
    }

    // Find user by mobile or email
    const query = mobile ? { mobile } : { email };
    const user = await User.findOne(query).populate('roleId');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // Check password (In production, use bcrypt.compare)
    // const isPasswordValid = await bcrypt.compare(password, user.password);
    const isPasswordValid = password === user.password; // TODO: Implement bcrypt

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive. Please contact administrator."
      });
    }

    // Check if user is blocked
    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Your account has been blocked. Please contact administrator."
      });
    }

    // Check if role is active
    if (!user.roleId || !user.roleId.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your role is inactive. Please contact administrator."
      });
    }

    // Generate tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

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
      status: user.status
    };

    res.json({
      success: true,
      message: "Login successful",
      token,
      refreshToken,
      user: userData
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message
    });
  }
};

/**
 * Refresh token
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "Refresh token is required"
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(
      refreshToken, 
      process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key'
    );

    // Fetch user
    const user = await User.findById(decoded.userId).populate('roleId');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token"
      });
    }

    // Check user status
    if (user.status !== 'active' || user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Account is inactive or blocked"
      });
    }

    // Generate new tokens
    const newToken = generateToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    res.json({
      success: true,
      token: newToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token"
      });
    }

    console.error("Token refresh error:", error);
    res.status(500).json({
      success: false,
      message: "Token refresh failed",
      error: error.message
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
    // 2. Clear refresh token from database
    // 3. Log the logout event

    res.json({
      success: true,
      message: "Logout successful"
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Logout failed",
      error: error.message
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
      .populate('roleId', 'name permissions isActive')
      .populate('cityId', 'name')
      .populate('zoneIds', 'name')
      .populate('allowedCategories', 'name')
      .select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
      error: error.message
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
        message: "User not found"
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
          message: "Email already in use"
        });
      }
      user.email = email;
    }

    // Check mobile uniqueness if changing
    if (mobile && mobile !== user.mobile) {
      const existingMobile = await User.findOne({ mobile, _id: { $ne: userId } });
      if (existingMobile) {
        return res.status(400).json({
          success: false,
          message: "Mobile number already in use"
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
          message: "Current password is incorrect"
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
      .populate('roleId', 'name permissions isActive')
      .populate('cityId', 'name')
      .populate('zoneIds', 'name')
      .select('-password');

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: error.message
    });
  }
};

module.exports = {
  login,
  refreshToken,
  logout,
  getProfile,
  updateProfile
};
