const mongoose = require("mongoose");

/**
 * Franchise Notification Schema
 * ------------------------------------------------------------------
 * One row per event sent TO a store manager (e.g. "an order was
 * assigned to your store"). Modeled on the simpler *customer*
 * notification schema (single recipient -> boolean `read`), NOT the
 * admin one (multi-recipient -> `readBy[]`) — a store has exactly one
 * manager login, so a read-tracking array would be overkill.
 * ------------------------------------------------------------------
 */
const franchiseNotificationSchema = new mongoose.Schema(
  {
    franchiseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "franchises",
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

    type: {
      type: String,
      enum: ["order_assigned", "order_reassigned", "general"],
      required: true,
      default: "general",
    },

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "orders",
      default: null,
    },

    read: {
      type: Boolean,
      default: false,
    },

    // * Idempotency key (e.g. `order:{orderId}:assigned:{franchiseId}:{assignedAt}`)
    // * so a retried request can't create a duplicate notification row.
    // * `sparse: true` because not every notification needs one.
    sourceKey: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
  },
);

// Powers the store manager's notification list (newest first) and the
// unread-count badge in one covered query.
franchiseNotificationSchema.index({ franchiseId: 1, createdAt: -1 });

module.exports = mongoose.model(
  "franchiseNotifications",
  franchiseNotificationSchema,
);
