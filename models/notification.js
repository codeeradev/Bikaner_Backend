const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 100,
    },
    message: {
      type: String,
      required: true,
      maxlength: 500,
    },
    image: {
      type: String,
      default: "",
    },
    type: {
      type: String,
      enum: ["order_status", "general", "promotion", "alert"],
      required: true,
      default: "general",
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "orders",
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Create compound index on userId and createdAt for efficient queries
notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("notifications", notificationSchema);
