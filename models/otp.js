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
      // "franchise_mobile" is its own type (rather than reusing "mobile")
      // so a store-manager OTP can never be matched/consumed against a
      // customer-app OTP request for the same number, and vice versa.
      enum: ["email", "mobile", "franchise_mobile"],
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
    // * Failed verify attempts against this specific OTP document.
    // * Lets verifyOTP lock a code out after repeated wrong guesses
    // * instead of allowing unlimited brute-force tries within the
    // * 5-minute expiry window. Unused (stays 0) by flows that don't
    // * check it.
    attempts: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster lookups
otpSchema.index({ identifier: 1, identifierType: 1, verified: 1 });

module.exports = mongoose.model("otps", otpSchema);
