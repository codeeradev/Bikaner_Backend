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
});

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
      unique: true,
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
    couponCode:String,
  },
  {
    timestamps: true,
  },
);

// Calculate totals before saving
cartSchema.pre("save", function (next) {
  this.totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);
  this.totalAmount = this.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
});

module.exports = mongoose.model("cart", cartSchema);
