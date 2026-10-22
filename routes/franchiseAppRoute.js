const express = require("express");

const router = express.Router();

const { authenticateFranchise } = require("../middleware/auth");

const franchiseAuthController = require("../controllers/app/franchiseAuthController");
const franchiseDashboardController = require("../controllers/app/franchiseDashboardController");
const franchiseProductController = require("../controllers/app/franchiseProductController");
const franchiseOrderController = require("../controllers/app/franchiseOrderController");
const franchiseReportController = require("../controllers/app/franchiseReportController");
const franchiseNotificationController = require("../controllers/franchiseNotificationController");

/**
 * Store-Manager App Routes
 * ------------------------------------------------------------------
 * Mounted at `/franchise` (see server.js). Every route below except
 * login requires a valid franchise-scoped JWT — see
 * middleware/auth.js#authenticateFranchise.
 *
 * Consumed by the separate React web application in ../Franchise.
 * Store identity always comes from authenticateFranchise, never a
 * client-supplied store id.
 * ------------------------------------------------------------------
 */

// ============= AUTH =============
// Franchise-admin web dashboard: email + password, single step.
router.post("/auth/login", franchiseAuthController.login);

// Store-manager mobile app: mobile number + OTP, two steps.
router.post("/auth/send-otp", franchiseAuthController.sendOtp);
router.post("/auth/verify-otp", franchiseAuthController.verifyOtp);

// Requires a valid franchise token — logs out whichever device sends it.
router.post(
  "/auth/logout",
  authenticateFranchise,
  franchiseAuthController.logout,
);

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

// ============= REPORTS =============
// Query: { range: "today"|"week"|"month"|"custom", startDate?, endDate? }
router.get(
  "/reports",
  authenticateFranchise,
  franchiseReportController.getReports,
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

const stockRequests = require("../controllers/franchiseStockRequestController");
router.get("/stock-requests", authenticateFranchise, stockRequests.list);
router.post("/stock-requests", authenticateFranchise, stockRequests.create);
router.put("/stock-requests/:id/receive", authenticateFranchise, stockRequests.receive);

module.exports = router;
