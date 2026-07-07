const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    identifier: {
      type: String,
      required: true,
      index: true,
    },
    identifierType: {
      type: String,
      enum: ["email", "mobile"],
      required: true,
    },
    otp: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
      index: { expires: 0 }, // TTL index - MongoDB will auto-delete when expiresAt is reached
    },
    verified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster lookups
otpSchema.index({ identifier: 1, identifierType: 1, verified: 1 });

module.exports = mongoose.model("otps", otpSchema);
