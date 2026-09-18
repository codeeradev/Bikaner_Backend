const Order = require("../../models/orders");
const FranchiseInventory = require("../../models/franchiseInventory");

/**
 * Store-Manager Report Controller
 * ------------------------------------------------------------------
 * Powers the Reports screen: sales totals, a fixed 7-day trend, the
 * accepted/pending/rejected breakdown, and top-selling products for
 * a selected date range.
 *
 * Every count/sum here is scoped to THIS store
 * (`franchiseAssignment.franchiseId`) and keyed off
 * `franchiseAssignment.assignedAt` — the moment Admin handed the
 * order to this store — so a pending order (no `respondedAt` yet)
 * still falls inside the right day/week/month bucket.
 *
 * "Sales" only ever means accepted orders: a pending or rejected
 * assignment was never fulfilled by this store, so it contributes to
 * `orderStatusBreakdown` but not to totalSales/avgOrderValue/packsSold/
 * topSellingProducts.
 * ------------------------------------------------------------------
 */

// Mirrors the threshold in franchiseDashboardController.js — the
// Reports screen's "N products are low on stock" banner and the
// Home screen's low-stock count should never disagree.
const LOW_STOCK_THRESHOLD = 5;

// How many products to return in the "Top selling products" list —
// matches the 3 rows shown on the Reports screen.
const TOP_PRODUCTS_LIMIT = 3;

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

/**
 * Resolve `range` (+ optional custom bounds) into a concrete
 * [start, end] window, plus the equal-length window immediately
 * before it — used to compute `salesChangePercent`.
 *
 * @param {"today"|"week"|"month"|"custom"} range
 * @param {string} [startDate] - required, YYYY-MM-DD, when range === "custom"
 * @param {string} [endDate] - required, YYYY-MM-DD, when range === "custom"
 * @returns {{ start: Date, end: Date, prevStart: Date, prevEnd: Date }|null} null on bad input
 */
const resolveRange = (range, startDate, endDate) => {
  const now = new Date();

  if (range === "today") {
    const start = startOfDay(now);
    const end = endOfDay(now);
    const prevStart = startOfDay(new Date(start.getTime() - 24 * 60 * 60 * 1000));
    const prevEnd = endOfDay(prevStart);
    return { start, end, prevStart, prevEnd };
  }

  if (range === "week") {
    // Last 7 days inclusive of today, not the ISO calendar week — matches
    // the "Sales trend, last 7 days" chart the screen always shows.
    const start = startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
    const end = endOfDay(now);
    const prevEnd = endOfDay(new Date(start.getTime() - 24 * 60 * 60 * 1000));
    const prevStart = startOfDay(new Date(prevEnd.getTime() - 6 * 24 * 60 * 60 * 1000));
    return { start, end, prevStart, prevEnd };
  }

  if (range === "month") {
    const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    const end = endOfDay(now);
    const prevMonthEnd = endOfDay(new Date(start.getTime() - 24 * 60 * 60 * 1000));
    const prevStart = startOfDay(
      new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 1),
    );
    return { start, end, prevStart, prevEnd: prevMonthEnd };
  }

  if (range === "custom") {
    if (!startDate || !endDate) return null;
    const start = startOfDay(new Date(startDate));
    const end = endOfDay(new Date(endDate));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      return null;
    }
    const spanMs = end.getTime() - start.getTime();
    const prevEnd = endOfDay(new Date(start.getTime() - 24 * 60 * 60 * 1000));
    const prevStart = startOfDay(new Date(prevEnd.getTime() - spanMs));
    return { start, end, prevStart, prevEnd };
  }

  return null;
};

/**
 * Sum of accepted orders' grandTotal for this store in [start, end].
 * Shared by the current-period totals and the previous-period figure
 * `salesChangePercent` is computed against.
 */
const acceptedSalesTotal = async (franchiseId, start, end) => {
  const result = await Order.aggregate([
    {
      $match: {
        "franchiseAssignment.franchiseId": franchiseId,
        "franchiseAssignment.status": "accepted",
        "franchiseAssignment.assignedAt": { $gte: start, $lte: end },
      },
    },
    { $group: { _id: null, total: { $sum: "$grandTotal" } } },
  ]);
  return result[0]?.total || 0;
};

/**
 * GET /franchise/reports
 * Query: { range: "today"|"week"|"month"|"custom", startDate?, endDate? }
 */
exports.getReports = async (req, res) => {
  try {
    const franchiseId = req.franchiseId;
    const { range, startDate, endDate } = req.query;

    const validRanges = ["today", "week", "month", "custom"];
    if (!range || !validRanges.includes(range)) {
      return res.status(400).json({
        success: false,
        message: `range must be one of: ${validRanges.join(", ")}`,
      });
    }

    const resolved = resolveRange(range, startDate, endDate);
    if (!resolved) {
      return res.status(400).json({
        success: false,
        message:
          range === "custom"
            ? "startDate and endDate (YYYY-MM-DD) are required for a custom range, and startDate must not be after endDate"
            : "Invalid date range",
      });
    }
    const { start, end, prevStart, prevEnd } = resolved;

    // 7-day trend is fixed to "today and the 6 days before it" — the
    // chart doesn't change shape when the person switches range tabs.
    const trendStart = startOfDay(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
    const trendEnd = endOfDay(new Date());

    const [
      acceptedOrdersInRange,
      pendingCount,
      rejectedCount,
      trendRows,
      topProductRows,
      lowStockCount,
      previousPeriodSales,
    ] = await Promise.all([
      // Accepted orders in range — source of totalSales, avgOrderValue,
      // packsSold and ordersFulfilled all at once, so they can never
      // drift apart from double-counting a different query per metric.
      Order.aggregate([
        {
          $match: {
            "franchiseAssignment.franchiseId": franchiseId,
            "franchiseAssignment.status": "accepted",
            "franchiseAssignment.assignedAt": { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: null,
            ordersFulfilled: { $sum: 1 },
            totalSales: { $sum: "$grandTotal" },
            packsSold: { $sum: { $sum: "$items.quantity" } },
          },
        },
      ]),

      Order.countDocuments({
        "franchiseAssignment.franchiseId": franchiseId,
        "franchiseAssignment.status": "pending",
        "franchiseAssignment.assignedAt": { $gte: start, $lte: end },
      }),

      Order.countDocuments({
        "franchiseAssignment.franchiseId": franchiseId,
        "franchiseAssignment.status": "rejected",
        "franchiseAssignment.assignedAt": { $gte: start, $lte: end },
      }),

      Order.aggregate([
        {
          $match: {
            "franchiseAssignment.franchiseId": franchiseId,
            "franchiseAssignment.status": "accepted",
            "franchiseAssignment.assignedAt": { $gte: trendStart, $lte: trendEnd },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$franchiseAssignment.assignedAt" },
            },
            sales: { $sum: "$grandTotal" },
          },
        },
      ]),

      Order.aggregate([
        {
          $match: {
            "franchiseAssignment.franchiseId": franchiseId,
            "franchiseAssignment.status": "accepted",
            "franchiseAssignment.assignedAt": { $gte: start, $lte: end },
          },
        },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.productId",
            packsSold: { $sum: "$items.quantity" },
            revenue: { $sum: "$items.subtotal" },
          },
        },
        { $sort: { packsSold: -1 } },
        { $limit: TOP_PRODUCTS_LIMIT },
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },
        {
          $project: {
            _id: 0,
            productId: "$_id",
            name: "$product.name",
            packsSold: 1,
            revenue: 1,
          },
        },
      ]),

      FranchiseInventory.countDocuments({
        franchiseId,
        stock: { $gt: 0, $lte: LOW_STOCK_THRESHOLD },
      }),

      acceptedSalesTotal(franchiseId, prevStart, prevEnd),
    ]);

    const totals = acceptedOrdersInRange[0] || {
      ordersFulfilled: 0,
      totalSales: 0,
      packsSold: 0,
    };

    const avgOrderValue =
      totals.ordersFulfilled > 0
        ? Math.round(totals.totalSales / totals.ordersFulfilled)
        : 0;

    // % change vs the immediately preceding period of the same length.
    // No previous-period sales at all → null rather than a misleading 0%
    // or a divide-by-zero Infinity.
    const salesChangePercent =
      previousPeriodSales > 0
        ? Math.round(((totals.totalSales - previousPeriodSales) / previousPeriodSales) * 100)
        : null;

    // Fill in the 7-day trend with zeros for any day that had no
    // accepted orders, so the chart always renders exactly 7 points.
    const trendByDate = new Map(trendRows.map((row) => [row._id, row.sales]));
    const salesTrend = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      salesTrend.push({ date: key, sales: trendByDate.get(key) || 0 });
    }

    return res.status(200).json({
      success: true,
      data: {
        totalSales: totals.totalSales,
        salesChangePercent,
        ordersFulfilled: totals.ordersFulfilled,
        ordersPending: pendingCount,
        avgOrderValue,
        packsSold: totals.packsSold,
        salesTrend,
        orderStatusBreakdown: {
          accepted: totals.ordersFulfilled,
          pending: pendingCount,
          rejected: rejectedCount,
        },
        topSellingProducts: topProductRows,
        lowStockCount,
      },
    });
  } catch (error) {
    console.error("Error fetching franchise reports:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch reports",
      error: error.message,
    });
  }
};