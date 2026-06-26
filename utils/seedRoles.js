const Role = require("../models/roles");
const User = require("../models/users");
const { PERMISSIONS, SPECIAL_ROLES, getAllPermissions } = require("../constants/permissions");

/**
 * Seed default roles in the database
 * Run this script once to initialize the roles
 */
const seedRoles = async () => {
  try {
    console.log("Starting role seeding...");

    // Check if roles already exist
    const existingRolesCount = await Role.countDocuments();
    
    if (existingRolesCount > 0) {
      console.log(`Found ${existingRolesCount} existing roles. Skipping seed.`);
      console.log("If you want to re-seed, please delete existing roles first.");
      return {
        success: false,
        message: "Roles already exist"
      };
    }

    // 1. Create Admin role with all permissions
    const adminRole = new Role({
      name: SPECIAL_ROLES.ADMIN,
      permissions: getAllPermissions(), // Admin gets all permissions
      isActive: true
    });
    await adminRole.save();
    console.log("✓ Admin role created");

    // 2. Create Franchise role with limited permissions
    const franchisePermissions = [
      // Dashboard access
      PERMISSIONS.DASHBOARD_VIEW,
      
      // Products - view only
      PERMISSIONS.PRODUCTS_VIEW,
      
      // Orders - full access
      PERMISSIONS.ORDERS_VIEW,
      PERMISSIONS.ORDERS_EDIT,
      
      // Normal & Bulk orders
      PERMISSIONS.NORMAL_ORDERS_VIEW,
      PERMISSIONS.NORMAL_ORDERS_EDIT,
      PERMISSIONS.BULK_ORDERS_VIEW,
      PERMISSIONS.BULK_ORDERS_EDIT,
      
      // Profile access
      PERMISSIONS.PROFILE_VIEW,
      PERMISSIONS.PROFILE_EDIT,
    ];

    const franchiseRole = new Role({
      name: SPECIAL_ROLES.FRANCHISE,
      permissions: franchisePermissions,
      isActive: true
    });
    await franchiseRole.save();
    console.log("✓ Franchise role created");

    // 3. Create default Admin user (optional)
    const existingAdminUser = await User.findOne({ mobile: "9999999999" });
    
    if (!existingAdminUser) {
      const adminUser = new User({
        roleId: adminRole._id,
        name: "Super Admin",
        mobile: "9999999999",
        email: "admin@bikanerbiscuit.com",
        password: "admin123", // TODO: Hash this password in production
        status: "active",
        isBlocked: false
      });
      await adminUser.save();
      console.log("✓ Default admin user created");
      console.log("  Mobile: 9999999999");
      console.log("  Password: admin123");
      console.log("  ⚠️  Please change this password immediately!");
    }

    console.log("\n✅ Role seeding completed successfully!");
    
    return {
      success: true,
      message: "Roles seeded successfully",
      roles: {
        admin: adminRole,
        franchise: franchiseRole
      }
    };

  } catch (error) {
    console.error("❌ Error seeding roles:", error);
    return {
      success: false,
      message: "Failed to seed roles",
      error: error.message
    };
  }
};

/**
 * Update Admin role with all current permissions
 * Run this when new permissions are added to the system
 */
const updateAdminPermissions = async () => {
  try {
    console.log("Updating Admin role permissions...");

    const adminRole = await Role.findOne({ name: SPECIAL_ROLES.ADMIN });
    
    if (!adminRole) {
      console.log("❌ Admin role not found. Please run seedRoles first.");
      return {
        success: false,
        message: "Admin role not found"
      };
    }

    // Update with all current permissions
    adminRole.permissions = getAllPermissions();
    await adminRole.save();

    console.log("✅ Admin role permissions updated successfully!");
    console.log(`Total permissions: ${adminRole.permissions.length}`);

    return {
      success: true,
      message: "Admin permissions updated",
      permissionCount: adminRole.permissions.length
    };

  } catch (error) {
    console.error("❌ Error updating admin permissions:", error);
    return {
      success: false,
      message: "Failed to update admin permissions",
      error: error.message
    };
  }
};

// If running directly
if (require.main === module) {
  const connectDb = require("../database");
  
  connectDb().then(async () => {
    await seedRoles();
    process.exit(0);
  }).catch(error => {
    console.error("Database connection error:", error);
    process.exit(1);
  });
}

module.exports = {
  seedRoles,
  updateAdminPermissions
};
