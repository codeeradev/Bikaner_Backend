const Role = require("../models/roles");
const User = require("../models/users");
const { 
  getAllPermissions, 
  getPermissionsByModule, 
  isValidPermission,
  SPECIAL_ROLES 
} = require("../constants/permissions");

/**
 * Get all roles
 */
const getAllRoles = async (req, res) => {
  try {
    const { search, status, page = 1, limit = 10 } = req.query;

    // Build filter
    const filter = {};

    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    if (status) {
      filter.isActive = status === "active";
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch roles
    const roles = await Role.find(filter)
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Role.countDocuments(filter);

    res.json({
      success: true,
      data: roles,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error("Error fetching roles:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch roles",
      error: error.message
    });
  }
};

/**
 * Get single role by ID
 */
const getRoleById = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await Role.findById(id);

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found"
      });
    }

    // Get count of users with this role
    const userCount = await User.countDocuments({ roleId: id });

    res.json({
      success: true,
      data: {
        ...role.toObject(),
        userCount
      }
    });
  } catch (error) {
    console.error("Error fetching role:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch role",
      error: error.message
    });
  }
};

/**
 * Create new role
 */
const createRole = async (req, res) => {
  try {
    const { name, permissions, isActive = true } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Role name is required"
      });
    }

    // Check if Admin role already exists (should be created via seed/migration)
    if (name.trim() === SPECIAL_ROLES.ADMIN) {
      return res.status(400).json({
        success: false,
        message: "Cannot create Admin role manually"
      });
    }

    // Check if role name already exists
    const existingRole = await Role.findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
    });

    if (existingRole) {
      return res.status(400).json({
        success: false,
        message: "Role with this name already exists"
      });
    }

    // Validate permissions
    if (permissions && Array.isArray(permissions)) {
      const invalidPermissions = permissions.filter(p => !isValidPermission(p));
      
      if (invalidPermissions.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid permissions provided",
          invalidPermissions
        });
      }
    }

    // Create role
    const role = new Role({
      name: name.trim(),
      permissions: permissions || [],
      isActive
    });

    await role.save();

    res.status(201).json({
      success: true,
      message: "Role created successfully",
      data: role
    });
  } catch (error) {
    console.error("Error creating role:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create role",
      error: error.message
    });
  }
};

/**
 * Update role
 */
const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, permissions, isActive } = req.body;

    const role = await Role.findById(id);

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found"
      });
    }

    // Prevent editing Admin role
    if (role.name === SPECIAL_ROLES.ADMIN) {
      return res.status(403).json({
        success: false,
        message: "Admin role cannot be edited"
      });
    }

    // If changing name, check for duplicates
    if (name && name.trim() !== role.name) {
      const existingRole = await Role.findOne({ 
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        _id: { $ne: id }
      });

      if (existingRole) {
        return res.status(400).json({
          success: false,
          message: "Role with this name already exists"
        });
      }

      role.name = name.trim();
    }

    // Validate and update permissions
    if (permissions !== undefined) {
      if (Array.isArray(permissions)) {
        const invalidPermissions = permissions.filter(p => !isValidPermission(p));
        
        if (invalidPermissions.length > 0) {
          return res.status(400).json({
            success: false,
            message: "Invalid permissions provided",
            invalidPermissions
          });
        }

        role.permissions = permissions;
      } else {
        return res.status(400).json({
          success: false,
          message: "Permissions must be an array"
        });
      }
    }

    // Update active status
    if (isActive !== undefined) {
      role.isActive = isActive;
    }

    await role.save();

    res.json({
      success: true,
      message: "Role updated successfully",
      data: role
    });
  } catch (error) {
    console.error("Error updating role:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update role",
      error: error.message
    });
  }
};

/**
 * Delete role
 */
const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await Role.findById(id);

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found"
      });
    }

    // Prevent deleting Admin role
    if (role.name === SPECIAL_ROLES.ADMIN) {
      return res.status(403).json({
        success: false,
        message: "Admin role cannot be deleted"
      });
    }

    // Check if any users have this role
    const usersWithRole = await User.countDocuments({ roleId: id });

    if (usersWithRole > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete role. ${usersWithRole} user(s) are assigned to this role`,
        userCount: usersWithRole
      });
    }

    await Role.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Role deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting role:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete role",
      error: error.message
    });
  }
};

/**
 * Toggle role status (active/inactive)
 */
const toggleRoleStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await Role.findById(id);

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found"
      });
    }

    // Prevent deactivating Admin role
    if (role.name === SPECIAL_ROLES.ADMIN) {
      return res.status(403).json({
        success: false,
        message: "Admin role status cannot be changed"
      });
    }

    role.isActive = !role.isActive;
    await role.save();

    res.json({
      success: true,
      message: `Role ${role.isActive ? 'activated' : 'deactivated'} successfully`,
      data: role
    });
  } catch (error) {
    console.error("Error toggling role status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to toggle role status",
      error: error.message
    });
  }
};

/**
 * Get all available permissions grouped by module
 */
const getAvailablePermissions = async (req, res) => {
  try {
    const permissionsByModule = getPermissionsByModule();
    const allPermissions = getAllPermissions();

    res.json({
      success: true,
      data: {
        byModule: permissionsByModule,
        all: allPermissions
      }
    });
  } catch (error) {
    console.error("Error fetching permissions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch permissions",
      error: error.message
    });
  }
};

module.exports = {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  toggleRoleStatus,
  getAvailablePermissions
};
