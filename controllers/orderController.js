const Order = require("../models/orders");
const User = require("../models/users");
const Settings = require("../models/settings");
const {
  sendNotificationWithPersistence,
} = require("./notificationController");

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "";

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
 * Generate printable invoice for an order (Admin only)
 */
exports.generateInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;

    const [order, settings] = await Promise.all([
      Order.findById(orderId)
        .populate("userId", "name email mobile")
        .populate("items.productId", "name sku")
        .populate("addressId"),
      Settings.findById("site-settings").select(
        "siteTitle siteDescription contactEmail contactPhone",
      ),
    ]);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const customerName =
      order.userId?.name || order.addressId?.name || "Customer";
    const customerMobile = order.userId?.mobile || order.addressId?.mobile || "";
    const customerEmail = order.userId?.email || "";
    const addressLines = [
      order.addressId?.house_No,
      order.addressId?.address,
      order.addressId?.landmark,
      order.addressId?.city,
    ].filter(Boolean);

    const rows = order.items
      .map((item, index) => {
        const product = item.productId || {};
        return `
          <tr>
            <td>${index + 1}</td>
            <td>
              <strong>${escapeHtml(product.name || "Product")}</strong>
              ${product.sku ? `<div class="muted">SKU: ${escapeHtml(product.sku)}</div>` : ""}
            </td>
            <td>${escapeHtml(item.priceType)}</td>
            <td class="num">${item.quantity}</td>
            <td class="num">${formatCurrency(item.price)}</td>
            <td class="num">${formatCurrency(item.subtotal)}</td>
          </tr>
        `;
      })
      .join("");

    const couponRow =
      order.discountAmount > 0
        ? `
          <div class="total-row discount">
            <span>Coupon Discount${order.coupon?.code ? ` (${escapeHtml(order.coupon.code)})` : ""}</span>
            <strong>- ${formatCurrency(order.discountAmount)}</strong>
          </div>
        `
        : "";

    const html = `<!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Invoice ${escapeHtml(order.orderNumber || order._id)}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; color: #111827; font-family: Arial, sans-serif; background: #f3f4f6; }
          .page { max-width: 900px; margin: 24px auto; padding: 36px; background: #fff; border: 1px solid #e5e7eb; }
          .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #111827; padding-bottom: 20px; }
          h1 { margin: 0; font-size: 30px; letter-spacing: 0; }
          h2 { margin: 0 0 8px; font-size: 16px; }
          .muted { color: #6b7280; font-size: 12px; margin-top: 4px; }
          .meta { text-align: right; line-height: 1.6; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 28px 0; }
          .box { border: 1px solid #e5e7eb; padding: 16px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th { background: #111827; color: #fff; text-align: left; padding: 10px; font-size: 12px; }
          td { border-bottom: 1px solid #e5e7eb; padding: 12px 10px; vertical-align: top; }
          .num { text-align: right; white-space: nowrap; }
          .totals { width: 340px; margin-left: auto; margin-top: 24px; }
          .total-row { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid #e5e7eb; }
          .discount { color: #047857; }
          .grand { font-size: 20px; border-bottom: 0; border-top: 2px solid #111827; margin-top: 8px; padding-top: 14px; }
          .footer { margin-top: 36px; color: #6b7280; font-size: 12px; text-align: center; }
          .print { position: fixed; right: 24px; top: 24px; }
          button { border: 1px solid #111827; background: #111827; color: #fff; padding: 10px 14px; cursor: pointer; }
          @media print {
            body { background: #fff; }
            .page { margin: 0; max-width: none; border: 0; }
            .print { display: none; }
          }
        </style>
      </head>
      <body>
        <button class="print" onclick="window.print()">Print Invoice</button>
        <main class="page">
          <section class="header">
            <div>
              <h1>${escapeHtml(settings?.siteTitle || "Bikaner Biscuit")}</h1>
              <div class="muted">${escapeHtml(settings?.siteDescription || "")}</div>
              <div class="muted">${escapeHtml(settings?.contactEmail || "")} ${settings?.contactPhone ? `| ${escapeHtml(settings.contactPhone)}` : ""}</div>
            </div>
            <div class="meta">
              <strong>Invoice</strong><br />
              Order: ${escapeHtml(order.orderNumber || order._id)}<br />
              Date: ${escapeHtml(formatDate(order.createdAt))}<br />
              Payment: ${escapeHtml(order.paymentStatus)} / ${escapeHtml(order.paymentMethod)}
            </div>
          </section>

          <section class="grid">
            <div class="box">
              <h2>Billed To</h2>
              <strong>${escapeHtml(customerName)}</strong><br />
              ${customerMobile ? `${escapeHtml(customerMobile)}<br />` : ""}
              ${customerEmail ? `${escapeHtml(customerEmail)}<br />` : ""}
            </div>
            <div class="box">
              <h2>Delivery Address</h2>
              ${addressLines.map((line) => escapeHtml(line)).join("<br />") || "N/A"}
            </div>
          </section>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>Price Type</th>
                <th class="num">Qty</th>
                <th class="num">Rate</th>
                <th class="num">Amount</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>

          <section class="totals">
            <div class="total-row">
              <span>Subtotal</span>
              <strong>${formatCurrency(order.totalAmount)}</strong>
            </div>
            ${couponRow}
            <div class="total-row">
              <span>Included Tax (${Number(order.taxPercentage || 0)}%)</span>
              <strong>${formatCurrency(order.taxAmount)}</strong>
            </div>
            <div class="total-row">
              <span>Delivery Charge</span>
              <strong>${formatCurrency(order.deliveryCharge)}</strong>
            </div>
            <div class="total-row">
              <span>Platform Fee</span>
              <strong>${formatCurrency(order.platformFee)}</strong>
            </div>
            <div class="total-row grand">
              <span>Grand Total</span>
              <strong>${formatCurrency(order.grandTotal)}</strong>
            </div>
          </section>

          <div class="footer">This is a system generated invoice.</div>
        </main>
      </body>
      </html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (error) {
    console.error("Error generating invoice:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate invoice",
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
