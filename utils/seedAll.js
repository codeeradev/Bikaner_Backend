/**
 * Seed everything in the right order: roles first, then users.
 *
 *   npm run seed:all                 -> create anything missing, refresh seed users
 *   npm run seed:all -- --sync       -> also reset seeded roles to default permissions
 */
const connectDb = require("../database");
const { seedRoles } = require("./seedRoles");
const { seedUsers } = require("./seedUsers");

(async () => {
  try {
    await connectDb();
    const sync = process.argv.includes("--sync");

    const roles = await seedRoles({ sync });
    if (!roles.success) process.exit(1);

    const users = await seedUsers();
    if (!users.success) process.exit(1);

    console.log("\nAll seeding finished.");
    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
})();
