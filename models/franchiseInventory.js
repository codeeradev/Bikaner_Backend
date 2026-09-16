const mongoose = require("mongoose");

/**
 * Franchise Inventory Schema
 * ------------------------------------------------------------------
 * Per-store override of a product's stock and price. Stock/MRP/selling
 * price are NOT shared across stores — each (franchise, product) pair
 * gets exactly one document here.
 * ------------------------------------------------------------------
 */
const franchiseInventorySchema = new mongoose.Schema(
  {
    franchiseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "franchises",
      required: true,
    },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "products",
      required: true,
    },

    stock: {
      type: Number,
      required: true,
      default: 0,
      min: 0, // ! negative stock should never reach the DB
    },

    mrp: {
      type: Number,
      required: true,
      min: 0,
    },

    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    // Lets a manager hide a product from this store's catalog without
    // deleting the pricing/stock record underneath it.
    isVisible: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// * One inventory row per product per store — this is the constraint the
// * whole "not shared across stores" requirement rests on.
franchiseInventorySchema.index(
  { franchiseId: 1, productId: 1 },
  { unique: true },
);

module.exports = mongoose.model("franchiseInventory", franchiseInventorySchema);
