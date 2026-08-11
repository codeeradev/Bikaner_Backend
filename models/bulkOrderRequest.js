const mongoose = require("mongoose");

const bulkOrderRequestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "products", required: true },
    quantity: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["pending", "contacted", "closed"],
      default: "pending",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("bulkOrderRequests", bulkOrderRequestSchema);
