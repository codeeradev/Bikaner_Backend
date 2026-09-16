const jwt = require("jsonwebtoken");
const Franchise = require("../../models/franchises");

/**
 * Franchise Auth Controller
 * ------------------------------------------------------------------
 * Login for a STORE MANAGER (not an admin/staff user, not a customer).
 * Mirrors the shape of `controllers/authController.js` (email + password,
 * a signed JWT, a user-data payload in the response) rather than the
 * customer OTP flow in `controllers/app/appAuthController.js` — a store
 * manager account is created by Admin up front, so there's no OTP step.
 * ------------------------------------------------------------------
 */

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