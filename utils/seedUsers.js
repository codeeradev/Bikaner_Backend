const Role = require("../models/roles");
const User = require("../models/users");
const { SPECIAL_ROLES } = require("../constants/permissions");
const { seedRoles } = require("./seedRoles");

/**
 * Seed login users.
 *
 * Usage:
 *   npm run seed:users
 *
 * Options (when called from code):
 *   seedUsers({ onlyMissing: true })        -> never modify an existing user
 *   seedUsers({ only: ["admin"] })          -> seed just these keys
 *
 * server.js uses { onlyMissing: true, only: ["admin"] } on startup so a fresh
 * database always has an admin, without ever resetting an existing password.
 *
 * Credentials can be overridden from .env:
 *   SEED_ADMIN_MOBILE / SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
 *   SEED_USER_MOBILE  / SEED_USER_EMAIL  / SEED_USER_PASSWORD
 *   (defaults below are for local development only)
 *
 * constRoleId meaning (see constants/roles.json and the controllers):
 *   1 = app customer, 3 = seller / bulk buyer, 4 = admin-panel user
 *   (authController.login only accepts 4)
 *
 * NOTE: authController.login compares passwords as PLAIN TEXT, so the seed
 * stores them the same way. When login moves to bcrypt.compare, set
 * HASH_PASSWORDS = true and re-run `npm run seed:users`.
 */
const HASH_PASSWORDS = false;

const buildSeedUsers = () => [
  {
    key: "admin",
    label: "Super Admin",
    roleName: SPECIAL_ROLES.ADMIN,
    data: {
      name: "Super Admin",
      mobile: process.env.SEED_ADMIN_MOBILE || "9999999998",
      email: process.env.SEED_ADMIN_EMAIL || "admin@bikanerbiscuit.com",
      password: process.env.SEED_ADMIN_PASSWORD || "admin123",
      constRoleId: 4,
    },
  },
  {
    key: "manager",
    label: "Manager (panel)",
    roleName: "Manager",
    data: {
      name: "Demo Manager",
      mobile: "9999999991",
      email: "manager@bikanerbiscuit.com",
      password: "Manager@123",
      constRoleId: 4,
    },
  },
  {
    key: "support",
    label: "Support Staff (panel)",
    roleName: "Support Staff",
    data: {
      name: "Demo Support",
      mobile: "9999999997",
      email: "support@bikanerbiscuit.com",
      password: "Support@123",
      constRoleId: 4,
    },
  },
  {
    key: "seller",
    label: "Seller / bulk buyer (app)",
    roleName: "Seller",
    data: {
      name: "Demo Seller",
      mobile: "8888888887",
      email: "seller@gmail.com",
      password: "Seller@123",
      constRoleId: 3,
    },
  },
  {
    key: "user",
    label: "Customer (app)",
    roleName: "User",
    data: {
      name: "Demo User",
      mobile: process.env.SEED_USER_MOBILE || "8888888888",
      email: process.env.SEED_USER_EMAIL || "user@gmail.com",
      password: process.env.SEED_USER_PASSWORD || "User@123",
      constRoleId: 1,
    },
  },
];

const seedUsers = async ({ onlyMissing = false, only = null } = {}) => {
  try {
    console.log("Starting user seeding...");

    // Roles must exist first. This only creates missing ones.
    const rolesResult = await seedRoles();
    if (!rolesResult.success) {
      return { success: false, message: "Could not seed roles first" };
    }

    const bcrypt = HASH_PASSWORDS ? require("bcryptjs") : null;
    const summary = [];

    for (const item of buildSeedUsers()) {
      if (only && !only.includes(item.key)) continue;

      const role = await Role.findOne({ name: item.roleName });
      if (!role) {
        throw new Error(`Role "${item.roleName}" not found`);
      }

      const password = bcrypt
        ? await bcrypt.hash(item.data.password, 10)
        : item.data.password;

      const fields = {
        ...item.data,
        password,
        roleId: role._id,
        status: "active",
        isBlocked: false,
      };

      const existing = await User.findOne({ mobile: item.data.mobile });
      let action;

      if (!existing) {
        await User.create(fields);
        action = "created";
      } else if (onlyMissing) {
        action = "kept";
      } else {
        existing.set(fields);
        await existing.save();
        action = "updated";
      }

      console.log(`  ${action === "created" ? "+" : action === "updated" ? "~" : "="} ${action}: ${item.label} (${item.data.mobile})`);
      summary.push({
        user: item.label,
        mobile: item.data.mobile,
        email: item.data.email,
        password: action === "kept" ? "(unchanged)" : item.data.password,
        result: action,
      });
    }

    if (!onlyMissing) {
      console.log("\nLogin credentials (local/dev only):");
      console.table(summary);
      console.log("Change these passwords before deploying anywhere public.");
    }

    return { success: true, users: summary };
  } catch (error) {
    console.error("Error seeding users:", error);
    return { success: false, message: error.message };
  }
};

// Run directly: node utils/seedUsers.js
if (require.main === module) {
  const connectDb = require("../database");

  connectDb()
    .then(async () => {
      const result = await seedUsers();
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {a
      console.error("Database connection error:", error);
      process.exit(1);
    });
}

module.exports = { seedUsers };
