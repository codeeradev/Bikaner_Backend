const Razorpay = require("razorpay");
const crypto = require("crypto");
const Settings = require("../models/settings");

/**
 * Get Razorpay credentials from settings
 */
async function getRazorpayCredentials() {
  const settings = await Settings.findById("site-settings");
  
  if (!settings || !settings.razorpayKeyId || !settings.razorpayKeySecret) {
    throw new Error("Razorpay credentials not configured in settings");
  }
  
  return {
    keyId: settings.razorpayKeyId,
    keySecret: settings.razorpayKeySecret,
    webhookSecret: settings.razorpayWebhookSecret,
  };
}

/**
 * Create Razorpay order
 * @param {number} amount - Amount in smallest currency unit (paise for INR)
 * @param {string} currency - Currency code (default: INR)
 * @param {string} receipt - Unique receipt identifier
 * @returns {Promise<object>} Razorpay order object
 */
async function createRazorpayOrder(amount, currency = "INR", receipt) {
  try {
    const credentials = await getRazorpayCredentials();
    
    const razorpayInstance = new Razorpay({
      key_id: credentials.keyId,
      key_secret: credentials.keySecret,
    });
    
    const options = {
      amount: Math.round(amount * 100), // Convert to paise
      currency,
      receipt,
      payment_capture: 1, // Auto capture payment
    };
    
    const order = await razorpayInstance.orders.create(options);
    return order;
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    throw new Error(`Failed to create Razorpay order: ${error.message}`);
  }
}

/**
 * Verify Razorpay payment signature
 * @param {string} orderId - Razorpay order ID
 * @param {string} paymentId - Razorpay payment ID
 * @param {string} signature - Razorpay signature
 * @returns {Promise<boolean>} True if signature is valid
 */
async function verifyPaymentSignature(orderId, paymentId, signature) {
  try {
    const credentials = await getRazorpayCredentials();
    
    const generatedSignature = crypto
      .createHmac("sha256", credentials.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
    
    return generatedSignature === signature;
  } catch (error) {
    console.error("Error verifying payment signature:", error);
    return false;
  }
}

/**
 * Verify Razorpay webhook signature
 * @param {string} webhookBody - Raw webhook request body
 * @param {string} signature - Signature from x-razorpay-signature header
 * @returns {Promise<boolean>} True if webhook signature is valid
 */
async function verifyWebhookSignature(webhookBody, signature) {
  try {
    const credentials = await getRazorpayCredentials();
    
    if (!credentials.webhookSecret) {
      console.warn("Webhook secret not configured");
      return false;
    }
    
    const generatedSignature = crypto
      .createHmac("sha256", credentials.webhookSecret)
      .update(webhookBody)
      .digest("hex");
    
    return generatedSignature === signature;
  } catch (error) {
    console.error("Error verifying webhook signature:", error);
    return false;
  }
}

module.exports = {
  getRazorpayCredentials,
  createRazorpayOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
};
