const Notification = require("../models/notification");
const sendNotification = require("../firebase/sendNotification");

/**
 * Build notification title and message based on order status
 * @param {Object} order - Order object
 * @param {string} status - New order status
 * @param {string} cancelReason - Cancel reason (if status is cancelled)
 * @returns {Object} { title, message }
 */
function buildNotificationData(order, status, cancelReason) {
  const orderNumber = order.orderNumber;
  let title, message;

  switch (status) {
    case "accepted":
      title = "Order Accepted ✅";
      message = `Your order #${orderNumber} has been accepted and is being prepared`;
      break;
    case "cancelled":
      title = "Order Cancelled ❌";
      message = `Your order #${orderNumber} has been cancelled`;
      if (cancelReason) {
        message += `. Reason: ${cancelReason}`;
      }
      break;
    case "delivered":
      title = "Order Delivered 🎉";
      message = `Your order #${orderNumber} has been delivered successfully`;
      break;
    default:
      title = "Order Status Updated";
      message = `Your order #${orderNumber} status has been updated`;
  }

  return { title, message };
}

/**
 * Send notification with persistence
 * Creates notification in DB and sends FCM push notification
 * @param {Object} user - User object with _id and fcmToken
 * @param {Object} order - Order object with orderNumber and _id
 * @param {string} status - Order status
 * @param {string} cancelReason - Cancel reason (optional)
 * @returns {Promise<Object>} Created notification
 */
exports.sendNotificationWithPersistence = async (
  user,
  order,
  status,
  cancelReason
) => {
  try {
    // Build notification data
    const { title, message } = buildNotificationData(order, status, cancelReason);

    // Create notification record in database
    const notification = await exports.createNotification({
      userId: user._id,
      orderId: order._id,
      title,
      message,
      type: "order_status",
    });

    console.log("✅ Notification record created:", notification._id);

    // Send FCM push notification (non-blocking)
    if (user.fcmToken && user.fcmToken !== "null") {
      try {
        await Promise.race([
          sendNotification(
            user.fcmToken,
            title,
            message,
            "/orders",
            {
              orderId: order._id.toString(),
              orderNumber: order.orderNumber,
              orderStatus: status,
            },
            "default"
          ),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("FCM timeout")), 5000)
          ),
        ]);
        console.log("✅ FCM notification sent successfully");
      } catch (fcmError) {
        console.warn(
          "⚠️ FCM notification failed but continuing:",
          fcmError.message
        );
        // Continue execution - database record persists
      }
    } else {
      console.log("ℹ️ No valid FCM token, skipping push notification");
    }

    return notification;
  } catch (error) {
    console.error("Error in sendNotificationWithPersistence:", error);
    throw error;
  }
};

/**
 * Create a new notification (Internal helper function)
 * @param {Object} data - Notification data
 * @returns {Promise<Object>} Created notification
 */
exports.createNotification = async (data) => {
  try {
    const { userId, title, message, type, orderId, image } = data;

    const notification = await Notification.create({
      userId,
      title,
      message,
      type: type || "general",
      orderId,
      image: image || "",
      read: false,
    });

    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};

/**
 * Get user notifications with pagination
 * Requires authentication - userId extracted from JWT token (req.userId)
 */
exports.getUserNotifications = async (req, res) => {
  try {
    const userId = req.userId; // Set by auth middleware
    const { page = 1, limit = 10 } = req.query;

    // Validation
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // Calculate pagination
    const skip = (pageNum - 1) * limitNum;

    // Fetch notifications for the authenticated user only
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 }) // Newest first
      .skip(skip)
      .limit(limitNum)
      .populate("orderId", "orderNumber orderStatus")
      .lean();

    const total = await Notification.countDocuments({ userId });

    res.json({
      success: true,
      data: notifications,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
      error: error.message,
    });
  }
};

/**
 * Mark a notification as read
 * Requires authentication - userId extracted from JWT token
 */
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.userId; // Set by auth middleware
    const { notificationId } = req.params;

    // Find notification and verify ownership
    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    // Ensure user can only mark their own notifications as read
    if (notification.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to update this notification",
      });
    }

    // Update read status
    notification.read = true;
    await notification.save();

    res.json({
      success: true,
      message: "Notification marked as read",
      data: notification,
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark notification as read",
      error: error.message,
    });
  }
};

/**
 * Delete a notification
 * Requires authentication - userId extracted from JWT token
 */
exports.deleteNotification = async (req, res) => {
  try {
    const userId = req.userId; // Set by auth middleware
    const { notificationId } = req.params;

    // Find notification and verify ownership
    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    // Ensure user can only delete their own notifications
    if (notification.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to delete this notification",
      });
    }

    await Notification.findByIdAndDelete(notificationId);

    res.json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete notification",
      error: error.message,
    });
  }
};
