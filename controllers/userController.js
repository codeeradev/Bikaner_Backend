const User = require("../models/users");
const Role = require("../models/roles");
const { SPECIAL_ROLES } = require("../constants/permissions");

/**
 * Get all users/staff
 */
const getAllUsers = async (req, res) => {
  try {
    const { search, role, status, page = 1, limit = 10 } = req.query;

    // Build filter
    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } }
      ];
    }

    if (role) {
      filter.roleId = role;
    }

    if (status) {
      filter.status = status;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch users with role information
    const users = await User.find(filter)
      .populate('roleId', 'name permissions isActive')
      .populate('cityId', 'name')
      .populate('zoneIds', 'name')
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message
    });
  }
};

/**
 * Get single user by ID
 */
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id)
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
    console.error("Error fetching user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user",
      error: error.message
    });
  }
};

/**
 * Create new user/staff
 */
const createUser = async (req, res) => {
  try {
    const {
      roleId,
      name,
      mobile,
      email,
      password,
      cityId,
      zoneIds,
      allowedCategories,
      customPricingEnabled,
      status = 'active'
    } = req.body;

    // Validation
    if (!roleId || !name || !mobile || !password) {
      return res.status(400).json({
        success: false,
        message: "Role, name, mobile, and password are required"
      });
    }

    // Verify role exists
    const role = await Role.findById(roleId);
    
    if (!role) {
      return res.status(400).json({
        success: false,
        message: "Invalid role selected"
      });
    }

    // Prevent assigning Admin role to new users
    if (role.name === SPECIAL_ROLES.ADMIN) {
      return res.status(403).json({
        success: false,
        message: "Cannot assign Admin role to new users"
      });
    }

    // Check if role is active
    if (!role.isActive) {
      return res.status(400).json({
        success: false,
        message: "Cannot assign inactive role"
      });
    }

    // Check if mobile already exists
    const existingUser = await User.findOne({ mobile });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this mobile number already exists"
      });
    }

    // Check if email already exists (if provided)
    if (email) {
      const existingEmail = await User.findOne({ email });
      
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: "User with this email already exists"
        });
      }
    }

    // Create user (password should be hashed in real implementation)
    const user = new User({
      roleId,
      name,
      mobile,
      email: email || null,
      password, // TODO: Hash password using bcrypt
      cityId: cityId || null,
      zoneIds: zoneIds || [],
      allowedCategories: allowedCategories || [],
      customPricingEnabled: customPricingEnabled || false,
      status,
      profileImage: req.file ? `/assets/users/${req.file.filename}` : ''
    });

    await user.save();

    // Fetch populated user
    const populatedUser = await User.findById(user._id)
      .populate('roleId', 'name permissions isActive')
      .populate('cityId', 'name')
      .populate('zoneIds', 'name')
      .select('-password');

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: populatedUser
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create user",
      error: error.message
    });
  }
};

/**
 * Update user/staff
 */
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      roleId,
      name,
      mobile,
      email,
      password,
      cityId,
      zoneIds,
      allowedCategories,
      customPricingEnabled,
      status
    } = req.body;

    const user = await User.findById(id).populate('roleId');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Prevent changing role for Admin users
    if (user.roleId && user.roleId.name === SPECIAL_ROLES.ADMIN && roleId && roleId !== user.roleId._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Cannot change role for Admin users"
      });
    }

    // If changing role, verify new role
    if (roleId && roleId !== user.roleId._id.toString()) {
      const newRole = await Role.findById(roleId);
      
      if (!newRole) {
        return res.status(400).json({
          success: false,
          message: "Invalid role selected"
        });
      }

      // Prevent assigning Admin role
      if (newRole.name === SPECIAL_ROLES.ADMIN) {
        return res.status(403).json({
          success: false,
          message: "Cannot assign Admin role to users"
        });
      }

      // Check if role is active
      if (!newRole.isActive) {
        return res.status(400).json({
          success: false,
          message: "Cannot assign inactive role"
        });
      }

      user.roleId = roleId;
    }

    // Update fields
    if (name) user.name = name;
    
    // Check mobile uniqueness if changing
    if (mobile && mobile !== user.mobile) {
      const existingMobile = await User.findOne({ mobile, _id: { $ne: id } });
      if (existingMobile) {
        return res.status(400).json({
          success: false,
          message: "Mobile number already in use"
        });
      }
      user.mobile = mobile;
    }

    // Check email uniqueness if changing
    if (email !== undefined) {
      if (email && email !== user.email) {
        const existingEmail = await User.findOne({ email, _id: { $ne: id } });
        if (existingEmail) {
          return res.status(400).json({
            success: false,
            message: "Email already in use"
          });
        }
      }
      user.email = email || null;
    }

    // Update password if provided (should be hashed)
    if (password) {
      user.password = password; // TODO: Hash password using bcrypt
    }

    if (cityId !== undefined) user.cityId = cityId || null;
    if (zoneIds !== undefined) user.zoneIds = zoneIds || [];
    if (allowedCategories !== undefined) user.allowedCategories = allowedCategories || [];
    if (customPricingEnabled !== undefined) user.customPricingEnabled = customPricingEnabled;
    if (status !== undefined) user.status = status;

    // Update profile image if uploaded
    if (req.file) {
      user.profileImage = `/assets/users/${req.file.filename}`;
    }

    await user.save();

    // Fetch populated user
    const populatedUser = await User.findById(user._id)
      .populate('roleId', 'name permissions isActive')
      .populate('cityId', 'name')
      .populate('zoneIds', 'name')
      .select('-password');

    res.json({
      success: true,
      message: "User updated successfully",
      data: populatedUser
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update user",
      error: error.message
    });
  }
};

/**
 * Delete user/staff
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).populate('roleId');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Prevent deleting Admin users
    if (user.roleId && user.roleId.name === SPECIAL_ROLES.ADMIN) {
      return res.status(403).json({
        success: false,
        message: "Cannot delete Admin users"
      });
    }

    await User.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "User deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete user",
      error: error.message
    });
  }
};

/**
 * Toggle user status (active/inactive)
 */
const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).populate('roleId');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Prevent status change for Admin users
    if (user.roleId && user.roleId.name === SPECIAL_ROLES.ADMIN) {
      return res.status(403).json({
        success: false,
        message: "Cannot change status for Admin users"
      });
    }

    user.status = user.status === 'active' ? 'inactive' : 'active';
    await user.save();

    res.json({
      success: true,
      message: `User ${user.status === 'active' ? 'activated' : 'deactivated'} successfully`,
      data: {
        _id: user._id,
        status: user.status
      }
    });
  } catch (error) {
    console.error("Error toggling user status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to toggle user status",
      error: error.message
    });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus
};
