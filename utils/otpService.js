const nodemailer = require("nodemailer");

/**
 * Generate 6-digit OTP
 */
const generateOTP = () => {
  // For development, always return 123456
  return "123456";

  // For production, uncomment below to generate random OTP
  // return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send OTP via Email using Nodemailer
 */
const sendOTPEmail = async (email, otp) => {
  try {
    // TODO: Configure with your email credentials
    // For now, this is a placeholder structure

    // Uncomment and configure when you have email credentials
    const transporter = nodemailer.createTransport({
      host: "smtp.hostinger.com", // Or use the server IP if given: 172.93.223.239
      port: 465,
      auth: {
        user: process.env.EMAIL_USER, // Your email
        pass: process.env.EMAIL_PASS, // Your email password or app password
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP Code - Bikaner Biscuit",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Your OTP Code</h2>
          <p>Your OTP code is: <strong style="font-size: 24px; color: #4CAF50;">${otp}</strong></p>
          <p>This code will expire in 5 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully:", info.messageId);
    return { success: true, messageId: info.messageId };

    // For development: Just log the OTP
    console.log(`📧 [DEV MODE] OTP for ${email}: ${otp}`);
    return { success: true, message: "OTP logged (dev mode)" };
  } catch (error) {
    console.error("❌ Error sending email:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Send OTP via SMS
 */
const sendOTPSMS = async (mobile, otp) => {
  try {
    // TODO: Integrate SMS gateway (Twilio, AWS SNS, or Indian SMS provider)
    // Placeholder for future SMS integration

    /*
    // Example with Twilio (uncomment when configured)
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const client = require('twilio')(accountSid, authToken);

    const message = await client.messages.create({
      body: `Your Bikaner Biscuit OTP is: ${otp}. Valid for 5 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: mobile,
    });

    console.log("✅ SMS sent successfully:", message.sid);
    return { success: true, messageSid: message.sid };
    */

    // For development: Just log the OTP
    console.log(`📱 [DEV MODE] OTP for ${mobile}: ${otp}`);
    return { success: true, message: "OTP logged (dev mode)" };
  } catch (error) {
    console.error("❌ Error sending SMS:", error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  generateOTP,
  sendOTPEmail,
  sendOTPSMS,
};
