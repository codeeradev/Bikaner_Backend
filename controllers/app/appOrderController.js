const Order = require("../../models/orders");
const Cart = require("../../models/cart");
const Product = require("../../models/products");
const User = require("../../models/users");
const Zone = require("../../models/zones");
const Address = require("../../models/address");

/**
 * Create order from cart
 */
exports.createOrder = async (req, res) => {
  try {
    const userId = req.userId;
    const { addressId, notes } = req.body;

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

    // Verify address belongs to user
    const address = await Address.findOne({ _id: addressId, userId });
    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found or does not belong to you",
      });
    }

    // Get cart
    const cart = await Cart.findOne({ userId }).populate("items.productId");
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

    // Calculate delivery charge (you can implement zone-based logic here if needed)
    let deliveryCharge = 0;
    // Future: Get zone from address.city and calculate delivery charge

    // Prepare order items
    const orderItems = cart.items.map((item) => ({
      productId: item.productId._id,
      name: item.productId.name,
      image: item.productId.image,
      quantity: item.quantity,
      price: item.price,
      priceType: item.priceType,
      subtotal: item.price * item.quantity,
    }));

    // Calculate totals
    const totalAmount = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
    const grandTotal = totalAmount + deliveryCharge;

    // Create order
    const order = new Order({
      userId,
      items: orderItems,
      totalAmount,
      deliveryCharge,
      grandTotal,
      orderType,
      addressId,
      notes: notes || "",
      orderStatus: "pending",
      paymentStatus: "pending",
    });

    await order.save();

    // Clear cart
    cart.items = [];
    await cart.save();

    // Populate order
    const populatedOrder = await Order.findById(order._id)
      .populate("items.productId", "name image sku")
      .populate("addressId");

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: populatedOrder,
    });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create order",
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
    if (
      ["delivered", "cancelled", "shipped"].includes(order.orderStatus)
    ) {
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
