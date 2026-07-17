const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    type: {
      type: String,
      enum: ["percentage", "flat"],
      required: true,
    },
    value: {
      type: Number,
      required: true,
      min: 0,
    },
    minOrderAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    description: {
      type: String,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

couponSchema.pre("validate", function (next) {
  if (this.code) {
    this.code = this.code.trim().toUpperCase();
  }

  if (this.type === "percentage" && this.value > 100) {
    this.invalidate("value", "Percentage coupon value cannot exceed 100");
  }
});

module.exports = mongoose.model("coupons", couponSchema);
