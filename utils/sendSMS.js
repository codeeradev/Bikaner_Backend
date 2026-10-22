const axios = require("axios");

/**
 * Send an SMS through BulkSMSPlans.
 *
 * options:
 * - smsType: OTP | Transactional | Promotional
 * - templateId: approved BulkSMSPlans template ID
 * - smsEncoding: 1 Text | 2 Unicode | 3 Flash | 4 Unicode Flash
 */
const sendSMS = async (mobile, message, options = {}) => {
  try {
    const {
      smsType = "Transactional",
      templateId,
      smsEncoding = "1",
    } = options;

    const params = new URLSearchParams({
      api_id: process.env.BULKSMS_API_ID,
      api_password: process.env.BULKSMS_API_PASSWORD,
      sms_type: smsType,
      sms_encoding: String(smsEncoding),
      sender: process.env.BULKSMS_SENDER_ID,
      number: mobile,
      message,
    });

    if (templateId) {
      params.append("template_id", String(templateId));
    }

    const response = await axios.post(
      process.env.BULKSMS_API_URL,
      params.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    console.log("📱 BulkSMS Response:", response.data);

    if (
      response.data?.code &&
      Number(response.data.code) !== 200
    ) {
      const providerError = new Error(
        response.data.message ||
          "BulkSMS provider rejected the SMS"
      );

      providerError.response = {
        data: response.data,
      };

      throw providerError;
    }

    return response.data;
  } catch (error) {
    console.error(
      "❌ SMS Error:",
      error.response?.data || error.message
    );

    throw error;
  }
};

module.exports = sendSMS;