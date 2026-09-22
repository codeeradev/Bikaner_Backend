const Role = require("../models/roles");
const {
  PERMISSIONS: P,
  SPECIAL_ROLES,
  getAllPermissions,
} = require("../constants/permissions");

/**
 * Seed default roles.
 *
 * Usage:
 *   npm run seed:roles                 -> create any missing roles
 *   npm run seed:roles -- --sync       -> also reset permissions of the roles below
 *                                         to the defaults in this file
 *
 * Also called from server.js on every startup, so the default mode
 * ONLY creates missing roles and never touches roles that already exist
 * (admins may have edited their permissions from the panel).
 *
 * Users are seeded separately by utils/seedUsers.js.
 */

// Permission sets -----------------------------------------------------------

const MANAGER_PERMISSIONS = [
  P.DASHBOARD_VIEW,
  P.CATEGORIES_VIEW, P.CATEGORIES_CREATE, P.CATEGORIES_EDIT,
  P.PRODUCTS_VIEW, P.PRODUCTS_CREATE, P.PRODUCTS_EDIT,
  P.BANNERS_VIEW, P.BANNERS_CREATE, P.BANNERS_EDIT,
  P.ZONES_VIEW, P.CITIES_VIEW,
  P.ORDERS_VIEW, P.ORDERS_EDIT, P.ORDERS_ASSIGN_FRANCHISE,
  P.NORMAL_ORDERS_VIEW, P.NORMAL_ORDERS_EDIT,
  P.BULK_ORDERS_VIEW, P.BULK_ORDERS_EDIT,
  P.SELLER_APPROVALS_VIEW, P.SELLER_APPROVALS_MANAGE,
  P.FRANCHISE_VIEW,
  P.FRANCHISE_REQUESTS_VIEW,
  P.REGISTERED_FRANCHISES_VIEW,
  P.USERS_VIEW,
  P.OFFERS_VIEW, P.OFFERS_MANAGE,
  P.PROFILE_VIEW, P.PROFILE_EDIT,
];

const SUPPORT_PERMISSIONS = [
  P.DASHBOARD_VIEW,
  P.PRODUCTS_VIEW,
  P.CATEGORIES_VIEW,
  P.ORDERS_VIEW,
  P.NORMAL_ORDERS_VIEW,
  P.BULK_ORDERS_VIEW,
  P.USERS_VIEW,
  P.PROFILE_VIEW, P.PROFILE_EDIT,
];

const FRANCHISE_PERMISSIONS = [
  P.DASHBOARD_VIEW,
  P.PRODUCTS_VIEW,
  P.ORDERS_VIEW, P.ORDERS_EDIT,
  P.NORMAL_ORDERS_VIEW, P.NORMAL_ORDERS_EDIT,
  P.BULK_ORDERS_VIEW, P.BULK_ORDERS_EDIT,
  P.PROFILE_VIEW, P.PROFILE_EDIT,
];

// Role definitions ----------------------------------------------------------

const buildRoleDefinitions = () => [
  { name: SPECIAL_ROLES.ADMIN, permissions: getAllPermissions() }, // full access
  { name: "Manager", permissions: MANAGER_PERMISSIONS },            // admin panel, day-to-day ops
  { name: "Support Staff", permissions: SUPPORT_PERMISSIONS },      // admin panel, mostly read-only
  { name: SPECIAL_ROLES.FRANCHISE, permissions: FRANCHISE_PERMISSIONS },
  { name: "User", permissions: [] },                                // app customers (constRoleId 1)
  { name: "Seller", permissions: [] },                              // bulk buyers  (constRoleId 3)
];

// Seeder --------------------------------------------------------------------

const seedRoles = async ({ sync = false } = {}) => {
  try {
    console.log("Starting role seeding...");
    const roles = {};
    let createdCount = 0;

    for (const def of buildRoleDefinitions()) {
      let role = await Role.findOne({ name: def.name });

      if (!role) {
        role = await Role.create({
          name: def.name,
          permissions: def.permissions,
          isActive: true,
        });
        createdCount++;
        console.log(`  + Role created: ${def.name} (${def.permissions.length} permissions)`);
      } else if (sync) {
        role.permissions = def.permissions;
        role.isActive = true;
        await role.save();
        console.log(`  ~ Role synced: ${def.name} (${def.permissions.length} permissions)`);
      }

      roles[def.name] = role;
    }

    if (createdCount === 0 && !sync) {
      console.log("  All default roles already exist. Nothing to do.");
    }
    console.log("Role seeding completed.");

    return { success: true, message: "Roles seeded successfully", created: createdCount, roles };
  } catch (error) {
    console.error("Error seeding roles:", error);
    return { success: false, message: "Failed to seed roles", error: error.message };
  }
};

/**
 * Give the Admin role every current permission.
 * Run this after adding new permissions to constants/permissions.js.
 */
const updateAdminPermissions = async () => {
  try {
    const adminRole = await Role.findOne({ name: SPECIAL_ROLES.ADMIN });
    if (!adminRole) {
      return { success: false, message: "Admin role not found. Run seedRoles first." };
    }

    adminRole.permissions = getAllPermissions();
    await adminRole.save();
    console.log(`Admin permissions updated (${adminRole.permissions.length}).`);
    return { success: true, message: "Admin permissions updated", permissionCount: adminRole.permissions.length };
  } catch (error) {
    console.error("Error updating admin permissions:", error);
    return { success: false, message: "Failed to update admin permissions", error: error.message };
  }
};

// Run directly: node utils/seedRoles.js [--sync]
if (require.main === module) {
  const connectDb = require("../database");
  const sync = process.argv.includes("--sync");

  connectDb()
    .then(async () => {
      const result = await seedRoles({ sync });
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("Database connection error:", error);
      process.exit(1);
    });
}

module.exports = { seedRoles, updateAdminPermissions };