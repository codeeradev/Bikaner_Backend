const Order = require("../../models/orders");
const Franchise = require("../../models/franchises");
const adminNotificationController = require("../adminNotificationController");

/**
 * Store-Manager Order Controller
 * ------------------------------------------------------------------
 * Orders a store manager can see are exactly the ones Admin has
 * assigned to their store (`franchiseAssignment.franchiseId`). Accept
 * and reject only ever change `franchiseAssignment` — the order's own
 * `orderStatus` pipeline is untouched, matching the flow summary in
 * the task plan.
 * ------------------------------------------------------------------
 */

/**
 * GET /franchise/orders
 * Query: { status?: "pending" | "accepted" | "rejected", page=1, limit=10 }
 */
exports.getStoreOrders = async (req, res) => {
  try {
    const franchiseId = req.franchiseId;
    const { status, page = 1, limit = 10 } = req.query;

    const filter = { "franchiseAssignment.franchiseId": franchiseId };
    if (status) {
      filter["franchiseAssignment.status"] = status;
    }

    const pageNum = Math.max(parseInt(page), 1);
    const limitNum = Math.max(parseInt(limit), 1);
    const skip = (pageNum - 1) * limitNum;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate("userId", "name mobile")
        .populate("items.productId", "name image sku")
        .sort({ "franchiseAssignment.assignedAt": -1 })
        .skip(skip)
        .limit(limitNum),
      Order.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Error fetching store orders:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch store orders",
      error: error.message,
    });
  }
};

/**
 * Shared lookup + ownership + state guard for accept/reject.
 *
 * Returns `{ order }` on success, or `{ errorResponse }` describing the
 * status code and message to send back — callers just check which key
 * came back rather than duplicating this guard in both handlers.
 *
 * @param {string} orderId
 * @param {string} franchiseId
 * @returns {Promise<{ order?: import("mongoose").Document, errorResponse?: { status: number, message: string } }>}
 */
const findRespondableAssignedOrder = async (orderId, franchiseId) => {
  // Ownership is part of the query itself, not a check after the fact —
  // a store manager gets a 404 for another store's order, not a 403
  // that would confirm the order exists at all.
  const order = await Order.findOne({
    _id: orderId,
    "franchiseAssignment.franchiseId": franchiseId,
  });

  if (!order) {
    return {
      errorResponse: {
        status: 404,
        message: "Order not found for your store",
      },
    };
  }

  if (order.franchiseAssignment.status !== "pending") {
    return {
      errorResponse: {
        status: 400,
        message: `This order was already ${order.franchiseAssignment.status}`,
      },
    };
  }

  return { order };
};

/**
 * PUT /franchise/orders/:id/accept
 */
exports.acceptOrder = async (req, res) => {
  try {
    const { order, errorResponse } = await findRespondableAssignedOrder(
      req.params.id,
      req.franchiseId,
    );
    if (errorResponse) {
      return res.status(errorResponse.status).json({
        success: false,
        message: errorResponse.message,
      });
    }

    order.franchiseAssignment.status = "accepted";
    order.franchiseAssignment.respondedAt = new Date();
    await order.save();

    await notifyAdminOfStoreResponse(order, req.franchiseId, "accepted");

    return res.status(200).json({
      success: true,
      message: "Order accepted",
      data: order,
    });
  } catch (error) {
    console.error("Error accepting order:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to accept order",
      error: error.message,
    });
  }
};

/**
 * PUT /franchise/orders/:id/reject
 *
 * Rejecting just marks this store's assignment as "rejected" — it does
 * NOT clear `franchiseAssignment.franchiseId` or touch `orderStatus`.
 * Admin's reassignment queue and `PUT /orders/:id/assign-franchise`
 * (Task 4) both already treat a "rejected" assignment the same as an
 * unassigned one, so no separate "unassign" step is needed here.
 */
exports.rejectOrder = async (req, res) => {
  try {
    const { order, errorResponse } = await findRespondableAssignedOrder(
      req.params.id,
      req.franchiseId,
    );
    if (errorResponse) {
      return res.status(errorResponse.status).json({
        success: false,
        message: errorResponse.message,
      });
    }

    order.franchiseAssignment.status = "rejected";
    order.franchiseAssignment.respondedAt = new Date();
    await order.save();

    await notifyAdminOfStoreResponse(order, req.franchiseId, "rejected");

    return res.status(200).json({
      success: true,
      message: "Order rejected and returned to Admin's queue",
      data: order,
    });
  } catch (error) {
    console.error("Error rejecting order:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reject order",
      error: error.message,
    });
  }
};

/**
 * Tell Admin how a store responded to an assignment. A notification
 * failure must never fail the accept/reject request itself — the
 * order's assignment status is already correctly saved by the time
 * this runs, so log and continue rather than throw.
 *
 * @param {import("mongoose").Document} order
 * @param {import("mongoose").Types.ObjectId|string} franchiseId
 * @param {"accepted"|"rejected"} status
 */
const notifyAdminOfStoreResponse = async (order, franchiseId, status) => {
  try {
    const franchise = await Franchise.findById(franchiseId).select("name");
    await adminNotificationController.notifyAdminFranchiseResponse(
      order,
      franchise,
      status,
    );
  } catch (notificationError) {
    console.error(
      `⚠️ Admin notification for franchise ${status} response failed:`,
      notificationError,
    );
  }
};
