const Order = require("../../models/orders");
const { verifyWebhookSignature } = require("../../utils/razorpay");
const {
  notifyAdminNewOrder,
} = require("../adminNotificationController");

/**
 * Handle Razorpay webhook events
 */
exports.handleWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const webhookBody = JSON.stringify(req.body);

    // Verify webhook signature
    const isValid = await verifyWebhookSignature(webhookBody, signature);

    if (!isValid) {
      console.error("Invalid webhook signature");
      return res.status(400).json({
        success: false,
        message: "Invalid signature",
      });
    }

    const event = req.body.event;
    const payload = req.body.payload;

    console.log(`Received Razorpay webhook: ${event}`);

    // Handle different webhook events
    switch (event) {
      case "payment.captured":
        await handlePaymentCaptured(payload);
        break;

      case "payment.failed":
        await handlePaymentFailed(payload);
        break;

      default:
        console.log(`Unhandled webhook event: ${event}`);
    }

    // Always return 200 to acknowledge receipt
    res.json({ success: true, message: "Webhook processed" });
  } catch (error) {
    console.error("Error processing webhook:", error);
    // Still return 200 to prevent Razorpay from retrying
    res.json({ success: false, message: error.message });
  }
};

/**
 * Handle payment.captured event
 */
async function handlePaymentCaptured(payload) {
  try {
    const payment = payload.payment.entity;
    const razorpayOrderId = payment.order_id;
    const razorpayPaymentId = payment.id;

    // Find order by Razorpay order ID
    const order = await Order.findOne({ razorpayOrderId });

    if (!order) {
      console.error(`Order not found for Razorpay order ID: ${razorpayOrderId}`);
      return;
    }

    // Check if already paid
    if (order.paymentStatus === "paid") {
      console.log(`Order ${order.orderNumber} already marked as paid`);
      return;
    }

    // Update order payment status
    order.paymentStatus = "paid";
    order.razorpayPaymentId = razorpayPaymentId;
    order.transactionDate = new Date();

    await order.save();

    try {
      await notifyAdminNewOrder(order);
    } catch (notificationError) {
      console.error(
        "⚠️ Admin notification creation failed:",
        notificationError,
      );
    }

    console.log(`Payment captured for order ${order.orderNumber}`);
  } catch (error) {
    console.error("Error handling payment.captured:", error);
    throw error;
  }
}

/**
 * Handle payment.failed event
 */
async function handlePaymentFailed(payload) {
  try {
    const payment = payload.payment.entity;
    const razorpayOrderId = payment.order_id;

    // Find order by Razorpay order ID
    const order = await Order.findOne({ razorpayOrderId });

    if (!order) {
      console.error(`Order not found for Razorpay order ID: ${razorpayOrderId}`);
      return;
    }

    // Update order payment status
    order.paymentStatus = "failed";

    await order.save();

    console.log(`Payment failed for order ${order.orderNumber}`);
  } catch (error) {
    console.error("Error handling payment.failed:", error);
    throw error;
  }
}
