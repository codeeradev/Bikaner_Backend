const AdminNotification = require("../models/adminNotification");
const Role = require("../models/roles");
const User = require("../models/users");
const sendAdminNotification = require("../firebase/sendAdminNotification");
const { SPECIAL_ROLES } = require("../constants/permissions");

const ADMIN_CONST_ROLE_ID = 2;

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const canAccessAdminNotifications = (req) =>
  req.user?.constRoleId === ADMIN_CONST_ROLE_ID ||
  req.role?.name === SPECIAL_ROLES.ADMIN;

const mapNotificationForUser = (notification, userId) => {
  const data = notification.toObject ? notification.toObject() : notification;
  const readBy = data.readBy || [];

  return {
    ...data,
    read: readBy.some((readerId) => readerId.toString() === userId.toString()),
  };
};

const createAdminNotification = async (data) => {
  const payload = {
    recipientConstRoleId: ADMIN_CONST_ROLE_ID,
    title: data.title,
    message: data.message,
    type: data.type || "general",
    link: data.link || "",
    orderId: data.orderId || null,
    sellerApplicationId: data.sellerApplicationId || null,
    sourceKey: data.sourceKey,
  };

  if (payload.sourceKey) {
    const existingNotification = await AdminNotification.findOne({
      sourceKey: payload.sourceKey,
    });

    if (existingNotification) {
      return existingNotification;
    }
  }

  try {
    const notification = await AdminNotification.create(payload);
    await sendAdminPushNotification(notification);
    return notification;
  } catch (error) {
    if (error.code === 11000 && payload.sourceKey) {
      return AdminNotification.findOne({ sourceKey: payload.sourceKey });
    }

    throw error;
  }
};

const getAdminPushTokens = async () => {
  const adminRole = await Role.findOne({ name: SPECIAL_ROLES.ADMIN }).select(
    "_id",
  );
  const adminFilters = [{ constRoleId: ADMIN_CONST_ROLE_ID }];

  if (adminRole?._id) {
    adminFilters.push({ roleId: adminRole._id });
  }

  const admins = await User.find({
    $or: adminFilters,
    status: "active",
    isBlocked: false,
    adminFcmToken: { $nin: [null, "", "null"] },
  }).select("adminFcmToken");

  return [
    ...new Set(admins.map((admin) => admin.adminFcmToken).filter(Boolean)),
  ];
};

const sendAdminPushNotification = async (notification) => {
  try {
    const tokens = await getAdminPushTokens();

    if (tokens.length === 0) {
      return;
    }

    const data = {
      notificationId: notification._id.toString(),
      type: notification.type,
    };

    if (notification.orderId) {
      data.orderId = notification.orderId.toString();
    }

    if (notification.sellerApplicationId) {
      data.sellerApplicationId = notification.sellerApplicationId.toString();
    }

    await Promise.allSettled(
      tokens.map((token) =>
        sendAdminNotification(
          token,
          notification.title,
          notification.message,
          notification.link || "/dashboard",
          data,
          "default",
        ),
      ),
    );
  } catch (error) {
    console.error("⚠️ Admin FCM push failed:", error);
  }
};

exports.notifyAdminNewOrder = async (order) => {
  const isBulkOrder = order.orderType === "bulk";
  const orderNumber = order.orderNumber || order._id;

  return createAdminNotification({
    title: isBulkOrder ? "New Bulk Order" : "New Order",
    message: `Order #${orderNumber} for ${formatCurrency(order.grandTotal)} is waiting for review.`,
    type: isBulkOrder ? "bulk_order" : "new_order",
    link: isBulkOrder ? "/orders/bulk" : "/orders/normal",
    orderId: order._id,
    sourceKey: `order:${order._id}:created`,
  });
};

exports.notifyAdminSellerApplication = async (application) => {
  const applicantName = application.name || "A user";

  return createAdminNotification({
    title: "New Seller Application",
    message: `${applicantName} submitted a seller application for approval.`,
    type: "seller_application",
    link: "/approvals/sellers",
    sellerApplicationId: application._id,
    sourceKey: `seller-application:${application._id}:created`,
  });
};

exports.getAdminNotifications = async (req, res) => {
  try {
    if (!canAccessAdminNotifications(req)) {
      return res.status(403).json({
        success: false,
        message: "Admin notification access required",
      });
    }

    const page = Math.max(parseInt(req.query.page || "1"), 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit || "10"), 1),
      50,
    );
    const skip = (page - 1) * limit;
    const filter = { recipientConstRoleId: ADMIN_CONST_ROLE_ID };

    const [notifications, total, unreadCount] = await Promise.all([
      AdminNotification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("orderId", "orderNumber orderStatus orderType grandTotal")
        .populate("sellerApplicationId", "name mobile status")
        .lean(),
      AdminNotification.countDocuments(filter),
      AdminNotification.countDocuments({
        ...filter,
        readBy: { $ne: req.userId },
      }),
    ]);

    res.json({
      success: true,
      data: notifications.map((notification) =>
        mapNotificationForUser(notification, req.userId),
      ),
      unreadCount,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching admin notifications:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch admin notifications",
      error: error.message,
    });
  }
};

exports.markAdminNotificationAsRead = async (req, res) => {
  try {
    if (!canAccessAdminNotifications(req)) {
      return res.status(403).json({
        success: false,
        message: "Admin notification access required",
      });
    }

    const notification = await AdminNotification.findOneAndUpdate(
      {
        _id: req.params.notificationId,
        recipientConstRoleId: ADMIN_CONST_ROLE_ID,
      },
      { $addToSet: { readBy: req.userId } },
      { new: true },
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.json({
      success: true,
      message: "Notification marked as read",
      data: mapNotificationForUser(notification, req.userId),
    });
  } catch (error) {
    console.error("Error marking admin notification as read:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark notification as read",
      error: error.message,
    });
  }
};

exports.markAllAdminNotificationsAsRead = async (req, res) => {
  try {
    if (!canAccessAdminNotifications(req)) {
      return res.status(403).json({
        success: false,
        message: "Admin notification access required",
      });
    }

    const result = await AdminNotification.updateMany(
      {
        recipientConstRoleId: ADMIN_CONST_ROLE_ID,
        readBy: { $ne: req.userId },
      },
      { $addToSet: { readBy: req.userId } },
    );

    res.json({
      success: true,
      message: "All admin notifications marked as read",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error marking all admin notifications as read:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark all notifications as read",
      error: error.message,
    });
  }
};

exports.deleteAdminNotification = async (req, res) => {
  try {
    if (!canAccessAdminNotifications(req)) {
      return res.status(403).json({
        success: false,
        message: "Admin notification access required",
      });
    }

    const notification = await AdminNotification.findOneAndDelete({
      _id: req.params.notificationId,
      recipientConstRoleId: ADMIN_CONST_ROLE_ID,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting admin notification:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete notification",
      error: error.message,
    });
  }
};
