const Order = require("../../models/orders");
const Cart = require("../../models/cart");
const Product = require("../../models/products");
const User = require("../../models/users");
const Address = require("../../models/address");
const { calculateOrderTotals } = require("../../utils/orderTotals");
const Settings = require("../../models/settings");
const { notifyAdminNewOrder } = require("../adminNotificationController");

const {
  getRazorpayCredentials,
  createRazorpayOrder,
  verifyPaymentSignature,
} = require("../../utils/razorpay");

/**
 * Initiate payment - Create Razorpay order
 */
exports.initiatePayment = async (req, res) => {
  try {
    const userId = req.userId;
    const {
      addressId,
      notes,
      paymentMethod: requestedPaymentMethod = "razorpay",
      couponCode,
    } = req.body;

    let paymentMethod = requestedPaymentMethod;
    // Validation
    if (!addressId) {
      return res.status(400).json({
        success: false,
        message: "Address ID is required",
      });
    }

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const cartType = user.constRoleId === 3 ? "bulk" : "selling";

    // Verify address belongs to user
    const address = await Address.findOne({ _id: addressId });
    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // Get cart
    const cart = await Cart.findOne({
      userId,
      cartType,
    }).populate("items.productId");

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty",
      });
    }

    // Validate all products are active
    for (const item of cart.items) {
      if (!item.productId.isActive) {
        return res.status(400).json({
          success: false,
          message: `Product "${item.productId.name}" is no longer available`,
        });
      }
    }

    // Determine order type
    const isBulkOrder = cart.items.some((item) => item.priceType === "bulk");
    const orderType = isBulkOrder ? "bulk" : "normal";

    console.log(isBulkOrder);
    
    // Get settings for payment validation
    const settings = await Settings.findById("site-settings").select(
      "enableRazorpayForSellers codLimit",
    );
    
    // Check whether Razorpay is enabled for bulk/seller orders
    if (isBulkOrder) {
      // Default false: bulk orders become COD unless explicitly enabled
      if (!settings?.enableRazorpayForSellers) {
        paymentMethod = "cod";
      }
    } else {
      // For normal users (constRoleId 1), check COD limit
      if (user.constRoleId === 1 && paymentMethod === "cod") {
        const codLimit = settings?.codLimit || 10000;
        
        // Calculate preliminary totals to check against COD limit
        const orderItems = cart.items.map((item) => ({
          productId: item.productId._id,
          quantity: item.quantity,
          price: item.price,
          priceType: item.priceType,
          subtotal: item.price * item.quantity,
        }));

        const totalAmount = orderItems.reduce(
          (sum, item) => sum + item.subtotal,
          0,
        );

        const preliminaryTotals = await calculateOrderTotals({
          subtotal: totalAmount,
          user,
          couponCode,
          offerId: cart.offerId,
          cartItems: orderItems,
        });

        if (preliminaryTotals.grandTotal > codLimit) {
          return res.status(400).json({
            success: false,
            message: `Order total ₹${preliminaryTotals.grandTotal.toFixed(2)} exceeds COD limit of ₹${codLimit}. Please use online payment via Razorpay.`,
          });
        }
      }
    }
    
    // Prepare order items
    const orderItems = cart.items.map((item) => ({
      productId: item.productId._id,
      quantity: item.quantity,
      price: item.price,
      priceType: item.priceType,
      subtotal: item.price * item.quantity,
    }));

    // Calculate totals
    const totalAmount = orderItems.reduce(
      (sum, item) => sum + item.subtotal,
      0,
    );

    const totals = await calculateOrderTotals({
      subtotal: totalAmount,
      user,
      couponCode,
      offerId: cart.offerId,
      cartItems: orderItems, // Pass order items for offer evaluation
    });

    // Create order
    const order = new Order({
      userId,
      items: orderItems,
      totalAmount,
      deliveryCharge: totals.deliveryCharge,
      platformFee: totals.platformFee,
      taxPercentage: totals.taxPercentage,
      taxAmount: totals.taxAmount,
      discountAmount: totals.discountAmount,
      coupon: totals.coupon
        ? {
            couponId: totals.coupon._id,
            code: totals.coupon.code,
            type: totals.coupon.type,
            value: totals.coupon.value,
            discountAmount: totals.discountAmount,
          }
        : undefined,
      grandTotal: totals.grandTotal,
      orderType,
      addressId,
      notes: notes || "",
      paymentMethod,
      orderStatus: "pending",
      paymentStatus: "pending",
    });

    await order.save();

    // If payment method is COD, clear cart and return order
    if (paymentMethod === "cod") {
      cart.items = [];
      cart.offerId = null;
      await cart.save();

      const populatedOrder = await Order.findById(order._id)
        .populate("items.productId", "name image sku")
        .populate("addressId");

      try {
        await notifyAdminNewOrder(populatedOrder);
      } catch (notificationError) {
        console.error(
          "⚠️ Admin notification creation failed:",
          notificationError,
        );
      }

      return res.status(201).json({
        success: true,
        message: "Order created successfully (COD)",
        data: populatedOrder,
      });
    }

    // For Razorpay payment, create Razorpay order
    try {
      const razorpayOrder = await createRazorpayOrder(
        totals.grandTotal,
        "INR",
        order._id.toString(),
      );

      // Update order with Razorpay order ID
      order.razorpayOrderId = razorpayOrder.id;
      await order.save();

      // Get Razorpay key for frontend
      const credentials = await getRazorpayCredentials();

      res.status(201).json({
        success: true,
        message: "Payment initiated successfully",
        data: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          amount: totals.grandTotal,
          razorpayOrderId: razorpayOrder.id,
          currency: "INR",
        },
      });
    } catch (razorpayError) {
      // If Razorpay order creation fails, delete the order
      await Order.findByIdAndDelete(order._id);
      throw razorpayError;
    }
  } catch (error) {
    console.error("Error initiating payment:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Failed to initiate payment",
      error: error.message,
    });
  }
};

/**
 * Verify payment and complete order
 */
exports.verifyPayment = async (req, res) => {
  try {
    const userId = req.userId;
    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } =
      req.body;

    // Validation
    if (
      !orderId ||
      !razorpayOrderId ||
      !razorpayPaymentId ||
      !razorpaySignature
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing payment verification parameters",
      });
    }

    // Find order
    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if already verified
    if (order.paymentStatus === "paid") {
      return res.json({
        success: true,
        message: "Payment already verified",
        data: order,
      });
    }

    // Verify signature
    const isValid = await verifyPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    );

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed - invalid signature",
      });
    }

    // Update order with payment details
    order.razorpayPaymentId = razorpayPaymentId;
    order.razorpaySignature = razorpaySignature;
    order.paymentStatus = "paid";
    order.transactionDate = new Date();
    await order.save();

    // Clear cart
    const user = await User.findById(userId).select("constRoleId");

    const cartType = user.constRoleId === 3 ? "bulk" : "selling";

    const cart = await Cart.findOne({
      userId,
      cartType,
    });

    if (cart) {
      cart.items = [];
      cart.offerId = null;
      await cart.save();
    }

    // Populate and return order
    const populatedOrder = await Order.findById(order._id)
      .populate("items.productId", "name image sku")
      .populate("addressId");

    try {
      await notifyAdminNewOrder(populatedOrder);
    } catch (notificationError) {
      console.error(
        "⚠️ Admin notification creation failed:",
        notificationError,
      );
    }

    res.json({
      success: true,
      message: "Payment verified successfully",
      data: populatedOrder,
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify payment",
      error: error.message,
    });
  }
};

/**
 * Get user's orders
 */
exports.getOrders = async (req, res) => {
  try {
    const userId = req.userId;
    const {
      page = 1,
      limit = 10,
      orderType,
      orderStatus,
      paymentStatus,
    } = req.query;

    // Build filter
    const filter = { userId };
    if (orderType) filter.orderType = orderType;
    if (orderStatus) filter.orderStatus = orderStatus;
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch orders
    const orders = await Order.find(filter)
      .populate("items.productId", "name image sku")
      .populate("addressId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(filter);

    res.json({
      success: true,
      data: orders,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message,
    });
  }
};

/**
 * Get single order details
 */
exports.getOrderById = async (req, res) => {
  try {
    const userId = req.userId;
    const { orderId } = req.params;

    const order = await Order.findOne({ _id: orderId, userId })
      .populate("items.productId", "name image sku")
      .populate("addressId");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order",
      error: error.message,
    });
  }
};

/**
 * Cancel order
 */
exports.cancelOrder = async (req, res) => {
  try {
    const userId = req.userId;
    const { orderId } = req.params;
    const { cancelReason } = req.body;

    const order = await Order.findOne({ _id: orderId, userId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if order can be cancelled
    if (["delivered", "cancelled", "shipped"].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel order with status: ${order.orderStatus}`,
      });
    }

    order.orderStatus = "cancelled";
    order.cancelReason = cancelReason || "Cancelled by user";
    order.cancelledAt = new Date();

    await order.save();

    res.json({
      success: true,
      message: "Order cancelled successfully",
      data: order,
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel order",
      error: error.message,
    });
  }
};
