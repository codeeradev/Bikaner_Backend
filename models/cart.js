const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "products",
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  price: {
    type: Number,
    required: true,
  },
  priceType: {
    type: String,
    enum: ["selling", "bulk"],
    required: true,
  },
  originalQuantity: {
    type: Number,
    default: null,
  },
});

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    items: [cartItemSchema],
    totalAmount: {
      type: Number,
      default: 0,
    },
    totalItems: {
      type: Number,
      default: 0,
    },
    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "coupons",
    },
    // Offer system
    offerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "offers",
    },
    cartType: {
      type: String,
      enum: ["selling", "bulk"],
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Calculate totals before saving
cartSchema.pre("save", function (next) {
  // Calculate total items (all quantities including free)
  this.totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);
  
  // Calculate total amount - only count original quantities, not free BOGO items
  this.totalAmount = this.items.reduce((sum, item) => {
    // If originalQuantity exists, it means BOGO is applied
    // So we only count the original quantity for price calculation
    const quantityToCharge = item.originalQuantity || item.quantity;
    return sum + item.price * quantityToCharge;
  }, 0);
  
});

module.exports = mongoose.model("cart", cartSchema);
