const FranchiseNotification = require("../models/franchiseNotification");
const sendFranchiseNotification = require("../firebase/sendFranchiseNotification");

/**
 * Franchise Notification Controller
 * ------------------------------------------------------------------
 * Notifications sent TO a store manager. This is the third channel in
 * the app's notification system, modeled on the existing customer
 * channel (controllers/notificationController.js) and admin channel
 * (controllers/adminNotificationController.js) — same shape: a Mongo
 * model, a `notifyX(...)` helper called from the triggering action,
 * and a dedup key so a retried request can't create duplicate rows.
 * ------------------------------------------------------------------
 */

/**
 * Persist a franchise notification, guarding against duplicates.
 *
 * If `sourceKey` is supplied and a notification with that key already
 * exists, the existing document is returned instead of creating a
 * second one — this makes the caller safe to invoke more than once
 * for what is logically the same event (e.g. a retried request after
 * a network timeout).
 *
 * @param {object} notificationData
 * @param {import("mongoose").Types.ObjectId|string} notificationData.franchiseId
 * @param {string} notificationData.title
 * @param {string} notificationData.message
 * @param {"order_assigned"|"order_reassigned"|"general"} notificationData.type
 * @param {import("mongoose").Types.ObjectId|string} [notificationData.orderId]
 * @param {string} [notificationData.sourceKey]
 * @returns {Promise<import("mongoose").Document>} The created (or pre-existing) notification.
 */
const createFranchiseNotification = async (notificationData) => {
  const { franchiseId, title, message, type, orderId, sourceKey } =
    notificationData;

  if (sourceKey) {
    const existingNotification = await FranchiseNotification.findOne({
      sourceKey,
    });
    if (existingNotification) {
      return existingNotification;
    }
  }

  try {
    return await FranchiseNotification.create({
      franchiseId,
      title,
      message,
      type,
      orderId: orderId || null,
      sourceKey,
    });
  } catch (error) {
    // A duplicate-key race (two requests for the same event landing at
    // almost the same time) is not a real failure — just hand back
    // whichever copy won the race.
    if (error.code === 11000 && sourceKey) {
      return FranchiseNotification.findOne({ sourceKey });
    }
    throw error;
  }
};

/**
 * Best-effort push delivery for a franchise notification.
 *
 * No-ops when the store has no registered device token, which is true
 * for every store in this phase (no store-manager app exists yet to
 * register one) — this function still runs so nothing needs to change
 * here once that app exists and starts populating `franchise.fcmToken`.
 *
 * @param {import("mongoose").Document} franchise - Must have `fcmToken`.
 * @param {import("mongoose").Document} notification - The saved franchiseNotification.
 * @returns {Promise<void>}
 */
const sendFranchisePush = async (franchise, notification) => {
  if (!franchise?.fcmToken) {
    return; // Nothing to deliver to — see note above.
  }

  try {
    await sendFranchiseNotification(
      franchise.fcmToken,
      notification.title,
      notification.message,
      "/orders",
      {
        notificationId: notification._id.toString(),
        type: notification.type,
        ...(notification.orderId && {
          orderId: notification.orderId.toString(),
        }),
      },
    );
  } catch (error) {
    // A push failure must never fail the request that triggered it —
    // the DB record (the source of truth for the in-app list) is
    // already saved by the time this runs.
    console.error("⚠️ Franchise push notification failed:", error);
  }
};

/**
 * Notify a store that an order has been assigned (or reassigned) to it.
 *
 * Called from the order-assignment handler right after
 * `order.franchiseAssignment` is saved. Covers both directions of the
 * accept/reject flow described in the task plan:
 *   - First assignment  → `wasPreviouslyAssigned = false` → "order_assigned"
 *   - Reassignment after a rejection (or a manual re-pick while still
 *     pending) → `wasPreviouslyAssigned = true` → "order_reassigned"
 *
 * @param {import("mongoose").Document} franchise - The store now assigned to the order.
 * @param {import("mongoose").Document} order - The order, already saved with the new `franchiseAssignment`.
 * @param {boolean} wasPreviouslyAssigned - Whether this store (or any store)
 *   was already on this order before this call — decides the notification `type`.
 * @returns {Promise<import("mongoose").Document>} The created (or deduped) notification.
 */
exports.notifyFranchiseOrderAssigned = async (
  franchise,
  order,
  wasPreviouslyAssigned,
) => {
  const notificationType = wasPreviouslyAssigned
    ? "order_reassigned"
    : "order_assigned";

  const orderNumber = order.orderNumber || order._id;
  const title = wasPreviouslyAssigned
    ? "Order Reassigned To Your Store"
    : "New Order Assigned To Your Store";
  const message = `Order #${orderNumber} has been assigned to ${franchise.name} for fulfillment.`;

  // Including `assignedAt` in the key means a genuine reassignment
  // (which sets a fresh `assignedAt`) always produces a new row rather
  // than being silently deduped against an earlier assignment to the
  // same store.
  const assignedAtTimestamp = order.franchiseAssignment.assignedAt
    ? new Date(order.franchiseAssignment.assignedAt).getTime()
    : Date.now();
  const sourceKey = `order:${order._id}:assigned:${franchise._id}:${assignedAtTimestamp}`;

  const notification = await createFranchiseNotification({
    franchiseId: franchise._id,
    title,
    message,
    type: notificationType,
    orderId: order._id,
    sourceKey,
  });

  await sendFranchisePush(franchise, notification);

  return notification;
};

/**
 * GET /franchise/notifications
 * Query: { page=1, limit=10 }
 * Requires `authenticateFranchise` — reads the store from `req.franchiseId`.
 */
exports.getFranchiseNotifications = async (req, res) => {
  try {
    const franchiseId = req.franchiseId;
    const { page = 1, limit = 10 } = req.query;

    const pageNum = Math.max(parseInt(page), 1);
    const limitNum = Math.max(parseInt(limit), 1);
    const skip = (pageNum - 1) * limitNum;

    const [notifications, total, unreadCount] = await Promise.all([
      FranchiseNotification.find({ franchiseId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("orderId", "orderNumber orderStatus grandTotal"),
      FranchiseNotification.countDocuments({ franchiseId }),
      FranchiseNotification.countDocuments({ franchiseId, read: false }),
    ]);

    return res.status(200).json({
      success: true,
      data: notifications,
      unreadCount,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Error fetching franchise notifications:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
      error: error.message,
    });
  }
};

/**
 * PUT /franchise/notifications/:id/read
 * Marks a single notification as read. Ownership is enforced in the
 * query itself, same reasoning as the order accept/reject guard: a
 * manager gets a 404 for another store's notification, never a 403
 * that would confirm it exists.
 */
exports.markFranchiseNotificationRead = async (req, res) => {
  try {
    const notification = await FranchiseNotification.findOneAndUpdate(
      { _id: req.params.id, franchiseId: req.franchiseId },
      { read: true },
      { new: true },
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: notification,
    });
  } catch (error) {
    console.error("Error marking franchise notification as read:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark notification as read",
      error: error.message,
    });
  }
};

/**
 * PUT /franchise/notifications/read
 * Marks every unread notification for this store as read.
 */
exports.markAllFranchiseNotificationsRead = async (req, res) => {
  try {
    const result = await FranchiseNotification.updateMany(
      { franchiseId: req.franchiseId, read: false },
      { read: true },
    );

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error marking all franchise notifications as read:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark all notifications as read",
      error: error.message,
    });
  }
};
