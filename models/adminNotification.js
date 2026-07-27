const mongoose = require("mongoose");

const adminNotificationSchema = new mongoose.Schema(
  {
    recipientConstRoleId: {
      type: Number,
      required: true,
      default: 2,
      index: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 120,
    },
    message: {
      type: String,
      required: true,
      maxlength: 500,
    },
    type: {
      type: String,
      enum: ["new_order", "bulk_order", "seller_application", "general"],
      required: true,
      default: "general",
    },
    link: {
      type: String,
      default: "",
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "orders",
      default: null,
    },
    sellerApplicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "sellerApplications",
      default: null,
    },
    sourceKey: {
      type: String,
      unique: true,
      sparse: true,
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
      },
    ],
  },
  {
    timestamps: true,
  },
);

adminNotificationSchema.index({
  recipientConstRoleId: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "adminnotifications",
  adminNotificationSchema,
);
