const sendSMS = require("./sendSMS");
const SMS_TEMPLATES = require("./smsTemplates");

const getCustomerMobile = (user, order) => {
  return (
    user?.mobile ||
    order?.addressId?.mobile ||
    order?.addressId?.phone ||
    ""
  );
};

const sendOrderSMS = async (type, user, order, extra = {}) => {
  const mobile = getCustomerMobile(user, order);

  if (!mobile) {
    console.log(`ℹ️ No mobile number available for ${type} SMS`);

    return {
      success: false,
      skipped: true,
      reason: "No mobile number",
    };
  }

  const template = SMS_TEMPLATES[type];

  if (!template) {
    throw new Error(`Unknown order SMS template: ${type}`);
  }

  let message;

  switch (type) {
    case "ORDER_PLACED":
    case "OUT_FOR_DELIVERY":
    case "ORDER_DELIVERED":
    case "ORDER_CANCELLED":
      message = template.build(order.orderNumber);
      break;

    case "ORDER_STATUS_CHANGED":
      message = template.build(
        order.orderNumber,
        extra.status || order.orderStatus
      );
      break;

    default:
      throw new Error(`Unsupported order SMS template: ${type}`);
  }

  const result = await sendSMS(mobile, message, {
    smsType: template.smsType,
    templateId: template.templateId,
    smsEncoding: "1",
  });

  return {
    success: true,
    data: result,
  };
};

module.exports = {
  sendOrderSMS,
};
