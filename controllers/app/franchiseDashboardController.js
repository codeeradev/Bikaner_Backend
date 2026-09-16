const FranchiseInventory = require("../../models/franchiseInventory");
const Order = require("../../models/orders");

/**
 * Store-Manager Dashboard Controller
 * ------------------------------------------------------------------
 * Powers the Home screen of the (future) store-manager app: stock
 * health at a glance, plus what needs the manager's attention right
 * now (incoming assignments) and what happened recently.
 * ------------------------------------------------------------------
 */

// Stock at or below this quantity is surfaced as "running low" so a
// manager can restock before it hits zero. Kept as a named constant
// rather than a magic number so the threshold is easy to find and tune.
const LOW_STOCK_THRESHOLD = 5;

// How many recent orders to show on the Home screen — a dashboard is a
// glance, not a list; the full history lives behind GET /franchise/orders.
const RECENT_ORDERS_LIMIT = 5;

/**
 * GET /franchise/dashboard
 * Requires `authenticateFranchise` — reads the store from `req.franchiseId`.
 */
exports.getDashboard = async (req, res) => {
  try {
    const franchiseId = req.franchiseId;

    const [
      totalProductCount,
      outOfStockCount,
      lowStockCount,
      pendingAssignmentCount,
      recentOrders,
    ] = await Promise.all([
      FranchiseInventory.countDocuments({ franchiseId }),
      FranchiseInventory.countDocuments({ franchiseId, stock: 0 }),
      FranchiseInventory.countDocuments({
        franchiseId,
        stock: { $gt: 0, $lte: LOW_STOCK_THRESHOLD },
      }),
      Order.countDocuments({
        "franchiseAssignment.franchiseId": franchiseId,
        "franchiseAssignment.status": "pending",
      }),
      Order.find({ "franchiseAssignment.franchiseId": franchiseId })
        .select("orderNumber grandTotal orderStatus franchiseAssignment createdAt")
        .sort({ "franchiseAssignment.assignedAt": -1 })
        .limit(RECENT_ORDERS_LIMIT),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        inventory: {
          totalProducts: totalProductCount,
          outOfStock: outOfStockCount,
          lowStock: lowStockCount,
        },
        // "Incoming" = assigned to this store and still awaiting a
        // response — the number a manager most needs to see first.
        incomingOrderCount: pendingAssignmentCount,
        recentOrders,
      },
    });
  } catch (error) {
    console.error("Error fetching franchise dashboard:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard data",
      error: error.message,
    });
  }
};
