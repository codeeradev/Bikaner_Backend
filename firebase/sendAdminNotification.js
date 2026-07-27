const axios = require("axios");
const getAccessToken = require("./getAccessToken");
const { buildPlatformPushConfig } = require("../utils/pushSoundConfig");


async function sendAdminNotification(
  fcmToken,
  title,
  body,
  clickAction = "/dashboard",
  data = {},
  soundType,
) {
  const token = await getAccessToken();

  const fcmUrl = `https://fcm.googleapis.com/v1/projects/bikaner-bakeryy/messages:send`;

  const message = {
    message: {
      token: fcmToken,
      notification: {
        title,
        body,
      },
      ...buildPlatformPushConfig(title, body, soundType),
      webpush: {
        notification: { title, body, icon: "/assets/favicon.ico" },
        fcmOptions: { link: clickAction },
      },
      data: {
        click_action: clickAction,
        ...data,
      },
    },
  };

  try {
    const response = await axios.post(fcmUrl, message, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

    console.log("✅ Admin notification sent");
  } catch (err) {
    console.error("❌ Admin sending error:", err.message);
  }
}

module.exports = sendAdminNotification;
