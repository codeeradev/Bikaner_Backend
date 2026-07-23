/**
 * Migration Script: Convert Existing Coupons to Offers
 * 
 * This script migrates existing coupons to the new offer system.
 * Run this once after deploying the offer system.
 * 
 * Usage:
 *   node scripts/migrateCouponsToOffers.js
 */

const mongoose = require("mongoose");
require("dotenv").config();

const Coupon = require("../models/coupons");
const Offer = require("../models/offers");

async function migrateCouponsToOffers() {
  try {
    console.log("🚀 Starting coupon to offer migration...\n");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/bikaner");
    console.log("✅ Connected to MongoDB\n");

    // Get all coupons
    const coupons = await Coupon.find({});
    console.log(`📦 Found ${coupons.length} coupons to migrate\n`);

    if (coupons.length === 0) {
      console.log("ℹ️  No coupons to migrate. Exiting...");
      process.exit(0);
    }

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const coupon of coupons) {
      try {
        // Check if offer already exists with this coupon code
        const existingOffer = await Offer.findOne({ couponCode: coupon.code });
        
        if (existingOffer) {
          console.log(`⏭️  Skipped: ${coupon.code} (already exists as offer)`);
          skipped++;
          continue;
        }

        // Convert coupon to offer
        const offerData = {
          name: `Coupon: ${coupon.code}`,
          description: coupon.description || `Migrated from legacy coupon ${coupon.code}`,
          offerType: coupon.type === "percentage" ? "percentage_discount" : "flat_discount",
          requiresCoupon: true,
          couponCode: coupon.code,
          discountValue: coupon.value,
          applicableOn: "cart",
          minCartValue: coupon.minOrderAmount || 0,
          minQuantity: 0,
          startDate: new Date(), // Start immediately
          endDate: null, // No end date
          priority: 0,
          isStackable: false,
          autoApply: false,
          isActive: coupon.isActive,
        };

        // Create offer
        await Offer.create(offerData);
        console.log(`✅ Migrated: ${coupon.code} → ${offerData.name}`);
        migrated++;

      } catch (error) {
        console.error(`❌ Error migrating ${coupon.code}:`, error.message);
        errors++;
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log("📊 Migration Summary:");
    console.log("=".repeat(50));
    console.log(`✅ Successfully migrated: ${migrated}`);
    console.log(`⏭️  Skipped (duplicates): ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📦 Total coupons: ${coupons.length}`);
    console.log("=".repeat(50) + "\n");

    if (migrated > 0) {
      console.log("🎉 Migration completed successfully!");
      console.log("\nℹ️  Note: Legacy coupons are still in the database.");
      console.log("   You can keep them for reference or delete them later.");
      console.log("\n💡 Next steps:");
      console.log("   1. Test the new offers in the admin panel");
      console.log("   2. Verify cart application works correctly");
      console.log("   3. Update mobile app to use /offers endpoints");
      console.log("   4. Consider removing legacy coupon routes when ready");
    }

  } catch (error) {
    console.error("💥 Migration failed:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("\n👋 Database connection closed");
    process.exit(0);
  }
}

// Run migration
migrateCouponsToOffers();
