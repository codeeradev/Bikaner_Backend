/**
 * Approved BulkSMSPlans template IDs and message builders.
 * Keep the message text aligned with the approved DLT templates.
 */

const SMS_TEMPLATES = Object.freeze({
  LOGIN_OTP: {
    templateId: "196107",
    smsType: "OTP",
    build: (otp) =>
      `Your Bikaner Bakeryy login OTP is ${otp}. This OTP is valid for 10 minutes. Do not share it with anyone.`,
  },

  ORDER_PLACED: {
    templateId: "196112",
    smsType: "Transactional",
    build: (orderNumber) =>
      `Your order ${orderNumber} has been placed successfully. Thank you for shopping with Bikaner Bakery. We'll notify you when your order is shipped.`,
  },

  OUT_FOR_DELIVERY: {
    templateId: "196111",
    smsType: "Transactional",
    build: (orderNumber) =>
      `Your order ${orderNumber} is out for delivery. Please keep your phone available and be ready to receive your order. -Bikaner Bakeryy`,
  },

  ORDER_STATUS_CHANGED: {
    templateId: "196110",
    smsType: "Transactional",
    build: (orderNumber, status) =>
      `Update: Your order ${orderNumber} status has been changed to ${status}. Track your order in the Bikaner Bakeryy app.`,
  },

  ORDER_DELIVERED: {
    templateId: "196109",
    smsType: "Transactional",
    build: (orderNumber) =>
      `Your order ${orderNumber} has been delivered successfully. Thank you for choosing Bikaner Bakeryy!`,
  },

  ORDER_CANCELLED: {
    templateId: "196108",
    smsType: "Transactional",
    build: (orderNumber) =>
      `Your order ${orderNumber} has been cancelled. If applicable, your refund will be processed as per our refund policy. Bikaner Bakeryy!`,
  },
});

module.exports = SMS_TEMPLATES;
