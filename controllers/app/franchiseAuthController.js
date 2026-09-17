const jwt = require("jsonwebtoken");
const Franchise = require("../../models/franchises");
const OTP = require("../../models/otp");
const { generateOTP, sendOTPSMS } = require("../../utils/otpService");

/**
 * Franchise Auth Controller
 * ------------------------------------------------------------------
 * Two separate ways a store manager can sign in to the SAME franchise
 * account, for two different clients:
 *
 *  - `login` (email + password): the franchise-admin web dashboard.
 *    Mirrors the shape of `controllers/authController.js`.
 *
 *  - `sendOtp` + `verifyOtp` (mobile number + 6-digit OTP): the
 *    store-manager mobile app. Two-step, modeled on the customer OTP
 *    flow in `controllers/app/appAuthController.js`, but deliberately
 *    NOT auto-registering: a franchise's mobile number must already
 *    match a store Admin created, or the OTP is never sent — there is
 *    no public sign-up path for either login method.
 *
 * Both paths end at the same `generateFranchiseToken` and return the
 * same franchise-shaped payload, so anything downstream (authenticateFranchise,
 * the store-manager app's own state) doesn't need to know or care which
 * one was used.
 * ------------------------------------------------------------------
 */

// * Minimum time between two OTP requests for the same number — stops a
// * malicious or buggy client from hammering the SMS gateway (and
// * running up its bill) by spamming /send-otp.
const OTP_RESEND_COOLDOWN_MS = 30 * 1000;

// * Wrong-code guesses allowed against one issued OTP before it's
// * invalidated outright, forcing a fresh /send-otp. Caps brute-force
// * guessing of the 6-digit code within its 5-minute expiry window.
const MAX_OTP_ATTEMPTS = 5;

/** 10-digit Indian mobile number, no country code / spaces / punctuation
 *  — matches how `phone` is entered on the Admin "Add Franchise" form. */
const MOBILE_REGEX = /^[0-9]{10}$/;

/**
 * Normalize a phone number for comparison: digits only, last 10 kept.
 * Admin's Add/Edit Franchise form doesn't enforce a single format today
 * (a phone could be saved as "9876543210" or "+91 98765 43210"), so an
 * exact-string match against `Franchise.phone` would silently fail for
 * some stores. Comparing on the last 10 digits is robust to that
 * without needing a backfill migration.
 * @param {string} value
 * @returns {string}
 */
const normalizeMobile = (value) => String(value || "").replace(/\D/g, "").slice(-10);

// * 30-day expiry: a store manager is expected to stay signed in on a
// * shared in-store device rather than re-authenticate every session,
// * unlike the 1-day admin token. Override via JWT_FRANCHISE_EXPIRES_IN
// * if that assumption changes later.
const TOKEN_EXPIRES_IN = process.env.JWT_FRANCHISE_EXPIRES_IN || "30d";

/**
 * Sign a JWT scoped to a franchise (store), not a user.
 * `type: "franchise"` lets authenticateFranchise() reject an admin/customer
 * token that happens to be well-formed but was never meant for this scope.
 * @param {import("mongoose").Types.ObjectId|string} franchiseId
 * @returns {string} signed JWT
 */
const generateFranchiseToken = (franchiseId) => {
  return jwt.sign(
    { franchiseId, type: "franchise" },
    process.env.JWT_SECRET || "your-secret-key",
    { expiresIn: TOKEN_EXPIRES_IN },
  );
};

/**
 * Shape the fields safe to send back to the client — never the
 * password hash, even though the model already excludes it by default.
 * @param {import("mongoose").Document} franchise
 */
const toPublicFranchise = (franchise) => ({
  id: franchise._id,
  name: franchise.name,
  address: franchise.address,
  cityId: franchise.cityId,
  zoneId: franchise.zoneId,
  managerName: franchise.managerName,
  email: franchise.email,
  phone: franchise.phone,
  status: franchise.status,
});

/**
 * POST /franchise/auth/login
 * Body: { email, password, fcmToken? }
 */
exports.login = async (req, res) => {
  try {
    const { email, password, fcmToken } = req.body;

    // -- Validation --------------------------------------------------
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Password is `select: false` on the schema, so it has to be opted
    // back in explicitly here — that's the whole point of hiding it.
    const franchise = await Franchise.findOne({
      email: email.toLowerCase().trim(),
    }).select("+password");

    if (!franchise) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const isPasswordValid = await franchise.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (franchise.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "This store has been deactivated. Please contact admin.",
      });
    }

    // Register/refresh the device push token opportunistically — no-op
    // today (nothing sends a push to it yet, see franchiseNotificationController
    // in a later task), but the store's device starts showing up in the
    // DB as soon as the 
    // manager app exists and logs in.
    if (fcmToken && typeof fcmToken === "string") {
      franchise.fcmToken = fcmToken;
      await franchise.save();
    }

    const token = generateFranchiseToken(franchise._id);

    return res.json({
      success: true,
      message: "Login successful",
      token,
      franchise: toPublicFranchise(franchise),
    });
  } catch (error) {
    console.error("Franchise login error:", error);
    return res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message,
    });
  }
};

/**
 * POST /franchise/auth/send-otp
 * Body: { mobile }
 * Step 1 of the mobile-app login. Only ever sends a code to a mobile
 * number that already belongs to an active store — this is a login,
 * not a sign-up, so an unrecognized number is rejected rather than
 * silently creating anything.
 */
exports.sendOtp = async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile || !MOBILE_REGEX.test(String(mobile).trim())) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid 10-digit mobile number",
      });
    }

    const normalizedMobile = normalizeMobile(mobile);

    // findOne + a $expr regex-on-normalized-digits would be nicer than
    // pulling candidates client-side, but the franchise collection is
    // small (physical stores, not customers) and phone isn't indexed
    // for this comparison — a direct query keeps this simple and correct
    // rather than fast at a scale this table will never reach.
    const franchise = await Franchise.findOne({
      phone: { $regex: `${normalizedMobile}$` },
    });

    if (!franchise) {
      return res.status(404).json({
        success: false,
        message: "No store account found for this mobile number",
      });
    }

    if (franchise.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "This store has been deactivated. Please contact admin.",
      });
    }

    // -- Resend cooldown ------------------------------------------------
    const recentOtp = await OTP.findOne({
      identifier: normalizedMobile,
      identifierType: "franchise_mobile",
    }).sort({ createdAt: -1 });

    if (
      recentOtp &&
      Date.now() - recentOtp.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS
    ) {
      const waitSeconds = Math.ceil(
        (OTP_RESEND_COOLDOWN_MS - (Date.now() - recentOtp.createdAt.getTime())) /
          1000,
      );
      return res.status(429).json({
        success: false,
        message: `Please wait ${waitSeconds}s before requesting another OTP`,
      });
    }

    const otp = generateOTP();

    // A fresh code invalidates any still-live one for this number, so
    // only the most recently sent OTP can ever be verified.
    await OTP.deleteMany({
      identifier: normalizedMobile,
      identifierType: "franchise_mobile",
    });

    await OTP.create({
      identifier: normalizedMobile,
      identifierType: "franchise_mobile",
      otp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const sendResult = await sendOTPSMS(normalizedMobile, otp);
    if (!sendResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP. Please try again.",
      });
    }

    return res.json({
      success: true,
      message: "OTP sent successfully to your registered mobile number",
      // ! Never leak the code itself outside development — this is the
      // ! one place a real attacker would look for it.
      ...(process.env.NODE_ENV !== "production" ? { devOTP: otp } : {}),
    });
  } catch (error) {
    console.error("Franchise send-otp error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send OTP",
      error: error.message,
    });
  }
};

/**
 * POST /franchise/auth/verify-otp
 * Body: { mobile, otp, fcmToken? }
 * Step 2 of the mobile-app login. Issues the same franchise-scoped JWT
 * `login` does on success.
 */
exports.verifyOtp = async (req, res) => {
  try {
    const { mobile, otp, fcmToken } = req.body;

    if (!mobile || !otp) {
      return res.status(400).json({
        success: false,
        message: "Mobile number and OTP are required",
      });
    }

    const normalizedMobile = normalizeMobile(mobile);

    const otpDoc = await OTP.findOne({
      identifier: normalizedMobile,
      identifierType: "franchise_mobile",
      verified: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otpDoc) {
      return res.status(401).json({
        success: false,
        message: "OTP expired or not requested. Please request a new one.",
      });
    }

    if (otpDoc.attempts >= MAX_OTP_ATTEMPTS) {
      await otpDoc.deleteOne();
      return res.status(429).json({
        success: false,
        message: "Too many incorrect attempts. Please request a new OTP.",
      });
    }

    if (otpDoc.otp !== String(otp).trim()) {
      otpDoc.attempts += 1;
      await otpDoc.save();
      return res.status(401).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // Consume the code immediately — a verified/expired OTP can never
    // be replayed to mint a second token.
    otpDoc.verified = true;
    await otpDoc.save();
    await otpDoc.deleteOne();

    const franchise = await Franchise.findOne({
      phone: { $regex: `${normalizedMobile}$` },
    });

    if (!franchise) {
      // The store could have been deleted between send-otp and
      // verify-otp — treat it the same as "not found" at login time.
      return res.status(404).json({
        success: false,
        message: "No store account found for this mobile number",
      });
    }

    if (franchise.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "This store has been deactivated. Please contact admin.",
      });
    }

    if (fcmToken && typeof fcmToken === "string") {
      franchise.fcmToken = fcmToken;
      await franchise.save();
    }

    const token = generateFranchiseToken(franchise._id);

    return res.json({
      success: true,
      message: "Login successful",
      token,
      franchise: toPublicFranchise(franchise),
    });
  } catch (error) {
    console.error("Franchise verify-otp error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify OTP",
      error: error.message,
    });
  }
};
