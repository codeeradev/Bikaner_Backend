const axios = require("axios");
const getAccessToken = require("./getAccessToken");
const { buildPlatformPushConfig } = require("../utils/pushSoundConfig");

/**
 * Send a single push notification to a franchise store manager's device.
 *
 * ------------------------------------------------------------------
 * NOTE ON CURRENT USAGE (phase 1):
 * No store-manager app exists yet, so no `franchises.fcmToken` is ever
 * populated — the caller (franchiseNotificationController) already
 * skips calling this function when the token is missing. This module
 * exists now, alongside the DB-backed notification record, so that
 * "turning on" real push delivery later is just wiring a token into
 * the franchise document — no new send path has to be written then.
 * ------------------------------------------------------------------
 *
 * @param {string} fcmToken - Device token to deliver to (franchises.fcmToken).
 * @param {string} title - Notification title.
 * @param {string} body - Notification body text.
 * @param {string} [clickAction="/orders"] - Deep link opened on tap.
 * @param {Record<string, string>} [data={}] - Extra key/value payload
 *   delivered alongside the notification (e.g. orderId, notificationId).
 * @param {string} [soundType="default"] - Passed through to buildPlatformPushConfig.
 * @returns {Promise<void>} Resolves whether or not the send succeeds —
 *   failures are logged, not thrown, so a push outage never blocks the
 *   record from being created or the API request from completing.
 */
async function sendFranchiseNotification(
  fcmToken,
  title,
  body,
  clickAction = "/orders",
  data = {},
  soundType = "default",
) {
  const accessToken = await getAccessToken();

  const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/bikaner-bakeryy/messages:send`;

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
    await axios.post(fcmEndpoint, message, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    console.log("✅ Franchise notification sent");
  } catch (error) {
    console.error("❌ Franchise push send error:", error.message);
  }
}

module.exports = sendFranchiseNotification;