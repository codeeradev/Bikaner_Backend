/**
 * Migration Script: Backfill Franchise Slugs
 *
 * Any franchise store created before the `slug` field was added has
 * `slug: undefined`. This script loads each one and calls .save(), which
 * runs the model's pre("validate") hook and generates a unique slug from
 * its `name` — same logic new stores get automatically on create.
 *
 * Safe to re-run: stores that already have a slug are skipped.
 *
 * Usage:
 *   node scripts/backfillFranchiseSlugs.js
 */

const mongoose = require("mongoose");
require("dotenv").config();

const Franchise = require("../models/franchises");

async function backfillFranchiseSlugs() {
  try {
    console.log("🚀 Starting franchise slug backfill...\n");

    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/bikaner");
    console.log("✅ Connected to MongoDB\n");

    // $or covers both "field never set" and "field explicitly null/empty".
    const franchises = await Franchise.find({
      $or: [{ slug: { $exists: false } }, { slug: null }, { slug: "" }],
    });
    console.log(`📦 Found ${franchises.length} store(s) missing a slug\n`);

    if (franchises.length === 0) {
      console.log("ℹ️  Nothing to backfill. Exiting...");
      process.exit(0);
    }

    let migrated = 0;
    let errors = 0;

    for (const franchise of franchises) {
      try {
        // .save() (not findByIdAndUpdate) so the pre("validate") slug
        // generator actually runs.
        await franchise.save();
        console.log(`✅ ${franchise.name} → ${franchise.slug}`);
        migrated++;
      } catch (error) {
        console.error(`❌ Error backfilling "${franchise.name}":`, error.message);
        errors++;
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log("📊 Backfill Summary:");
    console.log("=".repeat(50));
    console.log(`✅ Successfully backfilled: ${migrated}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📦 Total processed: ${franchises.length}`);
    console.log("=".repeat(50) + "\n");
  } catch (error) {
    console.error("💥 Backfill failed:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("👋 Database connection closed");
    process.exit(0);
  }
}

backfillFranchiseSlugs();
