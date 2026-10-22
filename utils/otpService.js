const nodemailer = require("nodemailer");
const sendSMS = require("./sendSMS");
const SMS_TEMPLATES = require("./smsTemplates");

/**
 * Generate 6-digit OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send OTP via Email using Nodemailer
 */
const sendOTPEmail = async (email, otp) => {
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.hostinger.com",
      port: 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP Code - Bikaner Biscuit",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Your OTP Code</h2>

          <p>
            Your OTP code is:
            <strong style="font-size: 24px; color: #4CAF50;">
              ${otp}
            </strong>
          </p>

          <p>This code will expire in 10 minutes.</p>

          <p>
            If you didn't request this code, please ignore this email.
          </p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(
      "✅ Email sent successfully:",
      info.messageId
    );

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("❌ Error sending email:", error);

    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Send Login OTP via approved BulkSMSPlans DLT template
 */
const sendOTPSMS = async (mobile, otp) => {
  try {
    const template = SMS_TEMPLATES.LOGIN_OTP;

    const message = template.build(otp);

    const result = await sendSMS(
      mobile,
      message,
      {
        smsType: template.smsType,
        templateId: template.templateId,
        smsEncoding: "1",
      }
    );

    console.log(
      "✅ SMS sent successfully:",
      result
    );

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error(
      "❌ Error sending SMS:",
      error
    );

    return {
      success: false,
      error:
        error.response?.data ||
        error.message,
    };
  }
};

module.exports = {
  generateOTP,
  sendOTPEmail,
  sendOTPSMS,
};