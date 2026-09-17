const express = require("express");

const router = express.Router();

const { authenticateFranchise } = require("../middleware/auth");

const franchiseAuthController = require("../controllers/app/franchiseAuthController");
const franchiseDashboardController = require("../controllers/app/franchiseDashboardController");
const franchiseProductController = require("../controllers/app/franchiseProductController");
const franchiseOrderController = require("../controllers/app/franchiseOrderController");
const franchiseNotificationController = require("../controllers/franchiseNotificationController");

/**
 * Store-Manager App Routes
 * ------------------------------------------------------------------
 * Mounted at `/franchise` (see server.js). Every route below except
 * login requires a valid franchise-scoped JWT — see
 * middleware/auth.js#authenticateFranchise.
 *
 * No UI consumes most of these yet (the store-manager app itself is
 * still deferred), but they're built and testable now via
 * Postman/curl so that app can be built straight against a stable
 * backend later.
 * ------------------------------------------------------------------
 */

// ============= AUTH =============
// Franchise-admin web dashboard: email + password, single step.
router.post("/auth/login", franchiseAuthController.login);

// Store-manager mobile app: mobile number + OTP, two steps.
router.post("/auth/send-otp", franchiseAuthController.sendOtp);
router.post("/auth/verify-otp", franchiseAuthController.verifyOtp);

// ============= DASHBOARD =============
router.get(
  "/dashboard",
  authenticateFranchise,
  franchiseDashboardController.getDashboard,
);

// ============= PRODUCTS / INVENTORY =============
router.get(
  "/products",
  authenticateFranchise,
  franchiseProductController.getStoreProducts,
);

router.put(
  "/products/:productId",
  authenticateFranchise,
  franchiseProductController.updateStoreProduct,
);

// ============= ORDERS =============
router.get(
  "/orders",
  authenticateFranchise,
  franchiseOrderController.getStoreOrders,
);

router.put(
  "/orders/:id/accept",
  authenticateFranchise,
  franchiseOrderController.acceptOrder,
);

router.put(
  "/orders/:id/reject",
  authenticateFranchise,
  franchiseOrderController.rejectOrder,
);

// ============= NOTIFICATIONS =============
router.get(
  "/notifications",
  authenticateFranchise,
  franchiseNotificationController.getFranchiseNotifications,
);

router.put(
  "/notifications/:id/read",
  authenticateFranchise,
  franchiseNotificationController.markFranchiseNotificationRead,
);

router.put(
  "/notifications/read",
  authenticateFranchise,
  franchiseNotificationController.markAllFranchiseNotificationsRead,
);

module.exports = router;
