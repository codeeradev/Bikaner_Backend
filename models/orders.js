const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
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
  subtotal: {
    type: Number,
    required: true,
  },
});

/**
 * Franchise Assignment Sub-schema
 * ------------------------------------------------------------------
 * Tracks Admin's manual hand-off of an order to a store for fulfillment.
 *
 * * This is deliberately separate from `orderStatus` below — accepting
 * * or rejecting an assignment never touches the order's main status.
 * * A rejection just resets `status` back to null so Admin's "unassigned"
 * * queue picks it up again for reassignment to a different store.
 * ------------------------------------------------------------------
 */
const franchiseAssignmentSchema = new mongoose.Schema(
  {
    franchiseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "franchises",
      default: null,
    },

    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: null,
    },

    assignedAt: {
      type: Date,
      default: null,
    },

    // Admin user who made the assignment — kept for an audit trail on
    // the franchise detail page's order history.
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null,
    },

    respondedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }, // it's a single embedded status object, not a list — no need for its own _id
);

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    orderNumber: {
      type: String,
      unique: true,
    },
    items: [orderItemSchema],
    totalAmount: {
      type: Number,
      required: true,
    },
    deliveryCharge: {
      type: Number,
      default: 0,
    },
    platformFee:Number,
    taxPercentage: {
      type: Number,
      default: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
    },
    coupon: {
      couponId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "coupons",
      },
      code: String,
      type: {
        type: String,
        enum: ["percentage", "flat"],
      },
      value: Number,
      discountAmount: {
        type: Number,
        default: 0,
      },
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
    },
    orderType: {
      type: String,
      enum: ["normal", "bulk"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    orderStatus: {
      type: String,
      enum: ["pending", "accepted", "cancelled", "delivered"],
      default: "pending",
    },
    addressId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "addresses",
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["razorpay", "cod"],
      default: "cod",
    },
    razorpayOrderId: {
      type: String,
      default: "",
    },
    razorpayPaymentId: {
      type: String,
      default: "",
    },
    razorpaySignature: {
      type: String,
      default: "",
    },
    transactionDate: {
      type: Date,
    },
    notes: String,
    cancelReason: String,
    cancelledAt: Date,

    // * NEW — franchise hand-off tracking. See franchiseAssignmentSchema above.
    franchiseAssignment: {
      type: franchiseAssignmentSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  },
);

// Generate order number before saving
// (Async pre-hooks in Mongoose don't receive a `next` callback — the
// function's own resolution/rejection controls the save — so none is
// declared here. See franchises.js's hashPasswordBeforeSave for the
// bug that happens if you declare one anyway and call it.)
orderSchema.pre("save", async function () {
  if (!this.orderNumber) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    
    // Find last order of the day
    const lastOrder = await mongoose
      .model("orders")
      .findOne({
        orderNumber: new RegExp(`^ORD${year}${month}${day}`),
      })
      .sort({ orderNumber: -1 });

    let sequence = 1;
    if (lastOrder) {
      const lastSequence = parseInt(lastOrder.orderNumber.slice(-4));
      sequence = lastSequence + 1;
    }

    this.orderNumber = `ORD${year}${month}${day}${sequence.toString().padStart(4, "0")}`;
  }
});

// * Lets Admin's "unassigned orders" queue and a store's "my orders" list
// * both query efficiently without a full collection scan.
orderSchema.index({ "franchiseAssignment.franchiseId": 1, "franchiseAssignment.status": 1 });

module.exports = mongoose.model("orders", orderSchema);
