const Order = require("../models/orders");
const User = require("../models/users");
const {
  sendNotificationWithPersistence,
} = require("./notificationController");

const canEditOrderType = (role, orderType) => {
  if (!role) return false;
  if (role.name === "Admin") return true;

  const permissions = role.permissions || [];
  const typePermission =
    orderType === "bulk" ? "bulkOrders:edit" : "normalOrders:edit";

  return (
    permissions.includes("orders:edit") || permissions.includes(typePermission)
  );
};

/**
 * Get all orders (Admin only)
 */
exports.getAllOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      orderType,
      orderStatus,
      paymentStatus,
      search,
    } = req.query;

    // Build filter
    const filter = {};
    if (orderType) filter.orderType = orderType;
    if (orderStatus) filter.orderStatus = orderStatus;
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    // Search by order number
    if (search) {
      filter.orderNumber = new RegExp(search, "i");
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch orders with user details
    const orders = await Order.find(filter)
      .populate("userId", "name email mobile")
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
 * Get single order details (Admin only)
 */
exports.getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate("userId", "name email mobile")
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
    console.error("Error fetching order details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order details",
      error: error.message,
    });
  }
};

/**
 * Update order status (Admin only)
 */
exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { orderStatus, cancelReason } = req.body;

    // Validation - Only 3 statuses allowed
    const validStatuses = ["accepted", "cancelled", "delivered"];

    if (!validStatuses.includes(orderStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status",
      });
    }

    // Validate cancel reason for cancelled status
    if (
      orderStatus === "cancelled" &&
      (!cancelReason || cancelReason.trim() === "")
    ) {
      return res.status(400).json({
        success: false,
        message: "Cancel reason is required",
      });
    }

    // Find order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (!canEditOrderType(req.role, order.orderType)) {
      return res.status(403).json({
        success: false,
        message: `You don't have permission to update ${order.orderType} orders`,
      });
    }

    // Prevent status update for delivered or cancelled orders (terminal states)
    if (["delivered", "cancelled"].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot update status for ${order.orderStatus} orders`,
      });
    }

    // Update status
    order.orderStatus = orderStatus;

    // Set cancel reason and timestamp if cancelling
    if (orderStatus === "cancelled") {
      order.cancelReason = cancelReason;
      order.cancelledAt = new Date();
    }

    await order.save();

    // Get user for notification
    const user = await User.findById(order.userId);

    // Send notification with persistence (creates DB record + sends FCM)
    try {
      await sendNotificationWithPersistence(
        user,
        order,
        orderStatus,
        cancelReason,
      );
    } catch (notificationError) {
      console.error("⚠️ Notification creation failed:", notificationError);
      // Continue - order is already updated
    }

    // Populate and return
    const populatedOrder = await Order.findById(order._id)
      .populate("userId", "name email mobile")
      .populate("items.productId", "name image sku")
      .populate("addressId");

    res.json({
      success: true,
      message: "Order status updated successfully",
      data: populatedOrder,
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update order status",
      error: error.message,
    });
  }
};

/**
 * Cancel order (Admin only)
 */
exports.cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { cancelReason } = req.body;

    // Find order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (!canEditOrderType(req.role, order.orderType)) {
      return res.status(403).json({
        success: false,
        message: `You don't have permission to update ${order.orderType} orders`,
      });
    }

    // Check if order can be cancelled
    if (["delivered", "cancelled", "shipped"].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel order with status: ${order.orderStatus}`,
      });
    }

    // Cancel order
    order.orderStatus = "cancelled";
    order.cancelReason = cancelReason || "Cancelled by admin";
    order.cancelledAt = new Date();
    await order.save();

    // Populate and return
    const populatedOrder = await Order.findById(order._id)
      .populate("userId", "name email mobile")
      .populate("items.productId", "name image sku")
      .populate("addressId");

    res.json({
      success: true,
      message: "Order cancelled successfully",
      data: populatedOrder,
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

/**
 * Get order statistics (Admin only)
 */
exports.getOrderStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Get statistics
    const totalOrders = await Order.countDocuments(dateFilter);
    const pendingOrders = await Order.countDocuments({
      ...dateFilter,
      orderStatus: "pending",
    });
    const completedOrders = await Order.countDocuments({
      ...dateFilter,
      orderStatus: "delivered",
    });

    // Calculate revenue (only from paid orders)
    const revenueData = await Order.aggregate([
      {
        $match: {
          ...dateFilter,
          paymentStatus: "paid",
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$grandTotal" },
        },
      },
    ]);

    const totalRevenue =
      revenueData.length > 0 ? revenueData[0].totalRevenue : 0;

    res.json({
      success: true,
      data: {
        totalOrders,
        pendingOrders,
        completedOrders,
        totalRevenue,
      },
    });
  } catch (error) {
    console.error("Error fetching order stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order statistics",
      error: error.message,
    });
  }
};
