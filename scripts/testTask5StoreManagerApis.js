/**
 * Task 5 sanity test — run with: node scripts/testTask5StoreManagerApis.js
 * ------------------------------------------------------------------
 * Same approach as Tasks 2, 3 & 4: stub the Mongoose model statics
 * with in-memory fakes, then call the REAL controller functions and
 * assert on status codes + response shape.
 *
 * ! Not covered here: the real MongoDB behavior of the two-step
 * ! product search in franchiseProductController (Product.find().distinct()
 * ! followed by an $in filter) and every aggregate/populate call —
 * ! same caveat as Tasks 3 & 4. Confirm with real requests once routes
 * ! are live, e.g.:
 * !   curl http://localhost:9020/franchise/dashboard -H "Authorization: Bearer <franchise token>"
 * ------------------------------------------------------------------
 */
const FranchiseInventory = require("../models/franchiseInventory");
const Order = require("../models/orders");
const Product = require("../models/products");
const Franchise = require("../models/franchises");
const FranchiseNotification = require("../models/franchiseNotification");

const dashboardController = require("../controllers/app/franchiseDashboardController");
const productController = require("../controllers/app/franchiseProductController");
const orderController = require("../controllers/app/franchiseOrderController");
const notificationController = require("../controllers/franchiseNotificationController");
const adminNotificationController = require("../controllers/adminNotificationController");

let failures = 0;
function check(label, condition) {
   if (condition) {
      console.log(`  ✅ ${label}`);
   } else {
      console.error(`  ❌ ${label}`);
      failures += 1;
   }
}

function mockRes() {
   const res = {};
   res.statusCode = 200;
   res.status = (code) => {
      res.statusCode = code;
      return res;
   };
   res.json = (payload) => {
      res.body = payload;
      return res;
   };
   return res;
}

(async () => {
   console.log("\n1) GET /franchise/dashboard (getDashboard)");
   {
      FranchiseInventory.countDocuments = async (filter) => {
         if (filter.stock === 0) return 2; // out of stock
         if (filter.stock) return 5; // low stock ($gt/$lte branch)
         return 40; // total products
      };
      Order.countDocuments = async () => 3; // pending assignments
      Order.find = () => ({
         select: function select() {
            return this;
         },
         sort: function sort() {
            return this;
         },
         limit: function limit() {
            return Promise.resolve([{ orderNumber: "ORD-1" }, { orderNumber: "ORD-2" }]);
         },
      });

      const res = mockRes();
      await dashboardController.getDashboard({ franchiseId: "f1" }, res);
      check("200 on a normal dashboard request", res.statusCode === 200);
      check("inventory counts are present", res.body?.data?.inventory?.totalProducts === 40);
      check("incomingOrderCount reflects pending assignments", res.body?.data?.incomingOrderCount === 3);
      check("recentOrders is returned as an array", Array.isArray(res.body?.data?.recentOrders));
   }

   console.log("\n2) GET /franchise/products (getStoreProducts)");
   {
      FranchiseInventory.find = () => ({
         populate: function populate() {
            return this;
         },
         sort: function sort() {
            return this;
         },
         skip: function skip() {
            return this;
         },
         limit: function limit() {
            return Promise.resolve([{ productId: "p1", stock: 10 }]);
         },
      });
      FranchiseInventory.countDocuments = async () => 1;

      const res = mockRes();
      await productController.getStoreProducts({ franchiseId: "f1", query: {} }, res);
      check("200 on a normal product list request", res.statusCode === 200);
      check("returns inventory rows", res.body?.data?.length === 1);
   }

   console.log("\n3) PUT /franchise/products/:productId (updateStoreProduct)");
   {
      Product.findById = async () => null;
      const res1 = mockRes();
      await productController.updateStoreProduct(
         { franchiseId: "f1", params: { productId: "missing" }, body: {} },
         res1,
      );
      check("404 when the product doesn't exist", res1.statusCode === 404);

      Product.findById = async () => ({ _id: "p1", name: "Rusk" });
      FranchiseInventory.findOne = async () => null; // no existing row yet
      const res2 = mockRes();
      await productController.updateStoreProduct(
         { franchiseId: "f1", params: { productId: "p1" }, body: { stock: 20 } },
         res2,
      );
      check(
         "400 when mrp/sellingPrice are missing on the very first write",
         res2.statusCode === 400,
      );

      let savedDoc = null;
      // Real Mongoose documents already support `new FranchiseInventory(data)`
      // AND static calls like `FranchiseInventory.findOne(...)` on the same
      // constructor — no need to swap the whole model. The only thing that
      // would actually hit a (nonexistent) database here is `.save()`, so
      // that's the only piece worth stubbing.
      const originalSave = FranchiseInventory.prototype.save;
      const originalPopulate = FranchiseInventory.prototype.populate;
      FranchiseInventory.prototype.save = async function fakeSave() {
         savedDoc = { ...this.toObject() };
         return this;
      };
      FranchiseInventory.prototype.populate = async function fakePopulate() {
         return this; // no real DB to populate against in this mock test
      };
      Product.findById = async () => ({ _id: "p1", name: "Rusk" });
      FranchiseInventory.findOne = async () => null;

      const res3 = mockRes();
      await productController.updateStoreProduct(
         {
            franchiseId: "507f1f77bcf86cd799439011",
            params: { productId: "507f1f77bcf86cd799439012" },
            body: { stock: 20, mrp: 50, sellingPrice: 45 },
         },
         res3,
      );
      check("200 when creating a first-time inventory row with full data", res3.statusCode === 200);
      check(
         "new row carries franchiseId + productId + submitted values",
         String(savedDoc?.franchiseId) === "507f1f77bcf86cd799439011" &&
         savedDoc?.sellingPrice === 45,
      );
      FranchiseInventory.prototype.save = originalSave;
      FranchiseInventory.prototype.populate = originalPopulate;

      // -- Editing an existing row only changes submitted fields --------
      const existingItem = {
         franchiseId: "f1",
         productId: "p1",
         stock: 20,
         mrp: 50,
         sellingPrice: 45,
         isVisible: true,
         save: async function save() {
            savedDoc = { ...this };
            return this;
         },
         populate: async function populate() {
            return this;
         },
      };
      FranchiseInventory.findOne = async () => existingItem;
      const res4 = mockRes();
      await productController.updateStoreProduct(
         { franchiseId: "f1", params: { productId: "p1" }, body: { stock: 5 } },
         res4,
      );
      check("200 on editing an existing row", res4.statusCode === 200);
      check("only the submitted field changed", savedDoc.stock === 5 && savedDoc.mrp === 50);
   }

   console.log("\n4) GET /franchise/orders (getStoreOrders)");
   {
      Order.find = () => ({
         populate: function populate() {
            return this;
         },
         sort: function sort() {
            return this;
         },
         skip: function skip() {
            return this;
         },
         limit: function limit() {
            return Promise.resolve([{ orderNumber: "ORD-1" }]);
         },
      });
      Order.countDocuments = async () => 1;

      const res = mockRes();
      await orderController.getStoreOrders(
         { franchiseId: "f1", query: { status: "pending" } },
         res,
      );
      check("200 on a normal order list request", res.statusCode === 200);
   }

   console.log("\n5) PUT /franchise/orders/:id/accept and /reject");
   {
      Order.findOne = async () => null;
      const res1 = mockRes();
      await orderController.acceptOrder(
         { franchiseId: "f1", params: { id: "missing" } },
         res1,
      );
      check("404 when the order isn't assigned to this store", res1.statusCode === 404);

      const alreadyRespondedOrder = {
         franchiseAssignment: { status: "accepted" },
      };
      Order.findOne = async () => alreadyRespondedOrder;
      const res2 = mockRes();
      await orderController.acceptOrder(
         { franchiseId: "f1", params: { id: "order1" } },
         res2,
      );
      check("400 when the order was already responded to", res2.statusCode === 400);

      let notifyArgs = null;
      adminNotificationController.notifyAdminFranchiseResponse = async (
         order,
         franchise,
         status,
      ) => {
         notifyArgs = { order, franchise, status };
         return { _id: "adminNotif1" };
      };
      Franchise.findById = () => ({
         select: () => Promise.resolve({ _id: "f1", name: "Bikaner Central" }),
      });

      const pendingOrder = {
         franchiseAssignment: { status: "pending" },
         save: async function save() {
            return this;
         },
      };
      Order.findOne = async () => pendingOrder;
      const res3 = mockRes();
      await orderController.acceptOrder(
         { franchiseId: "f1", params: { id: "order1" } },
         res3,
      );
      check("200 on accepting a pending order", res3.statusCode === 200);
      check(
         "franchiseAssignment.status becomes 'accepted'",
         pendingOrder.franchiseAssignment.status === "accepted",
      );
      check("respondedAt was set", pendingOrder.franchiseAssignment.respondedAt instanceof Date);
      check(
         "notifyAdminFranchiseResponse was called with status 'accepted'",
         notifyArgs?.status === "accepted",
      );

      const pendingOrder2 = {
         franchiseAssignment: { status: "pending" },
         save: async function save() {
            return this;
         },
      };
      Order.findOne = async () => pendingOrder2;
      const res4 = mockRes();
      await orderController.rejectOrder(
         { franchiseId: "f1", params: { id: "order2" } },
         res4,
      );
      check("200 on rejecting a pending order", res4.statusCode === 200);
      check(
         "franchiseAssignment.status becomes 'rejected'",
         pendingOrder2.franchiseAssignment.status === "rejected",
      );
      check(
         "notifyAdminFranchiseResponse was called with status 'rejected'",
         notifyArgs?.status === "rejected",
      );
   }

   console.log("\n6) notifyAdminFranchiseResponse (adminNotificationController)");
   {
      // Re-require to get the real (non-monkey-patched) implementation.
      delete require.cache[require.resolve("../controllers/adminNotificationController")];
      const realAdminNotificationController = require("../controllers/adminNotificationController");
      const AdminNotification = require("../models/adminNotification");
      const Role = require("../models/roles");
      const User = require("../models/users");

      let createArgs = null;
      AdminNotification.findOne = async () => null;
      AdminNotification.create = async (data) => {
         createArgs = data;
         return { ...data, _id: "notif1" };
      };
      // Stub the push-token lookup chain so it resolves instantly instead
      // of hitting a (nonexistent) database and timing out after 10s.
      Role.findOne = () => ({ select: async () => null });
      User.find = () => ({ select: async () => [] });

      const fakeOrder = {
         _id: "order1",
         orderNumber: "ORD-1001",
         orderType: "normal",
         franchiseAssignment: { respondedAt: new Date("2026-03-01T00:00:00Z") },
      };
      const fakeFranchise = { name: "Bikaner Central" };

      await realAdminNotificationController.notifyAdminFranchiseResponse(
         fakeOrder,
         fakeFranchise,
         "accepted",
      );
      check("type is 'franchise_order_accepted'", createArgs.type === "franchise_order_accepted");
      check("message names the store and order", createArgs.message.includes("Bikaner Central") && createArgs.message.includes("ORD-1001"));
      check("link points at the normal-orders admin route", createArgs.link === "/orders/normal");

      await realAdminNotificationController.notifyAdminFranchiseResponse(
         fakeOrder,
         fakeFranchise,
         "rejected",
      );
      check("type is 'franchise_order_rejected'", createArgs.type === "franchise_order_rejected");
   }

   console.log("\n7) GET/PUT /franchise/notifications (franchiseNotificationController)");
   {
      FranchiseNotification.find = () => ({
         sort: function sort() {
            return this;
         },
         skip: function skip() {
            return this;
         },
         limit: function limit() {
            return this;
         },
         populate: function populate() {
            return Promise.resolve([{ title: "New Order Assigned" }]);
         },
      });
      FranchiseNotification.countDocuments = async (filter) =>
         filter.read === false ? 1 : 3;

      const res1 = mockRes();
      await notificationController.getFranchiseNotifications(
         { franchiseId: "f1", query: {} },
         res1,
      );
      check("200 on a normal notification list request", res1.statusCode === 200);
      check("unreadCount reflects the unread filter", res1.body?.unreadCount === 1);

      FranchiseNotification.findOneAndUpdate = async () => null;
      const res2 = mockRes();
      await notificationController.markFranchiseNotificationRead(
         { franchiseId: "f1", params: { id: "missing" } },
         res2,
      );
      check("404 when the notification doesn't belong to this store", res2.statusCode === 404);

      FranchiseNotification.findOneAndUpdate = async () => ({ _id: "n1", read: true });
      const res3 = mockRes();
      await notificationController.markFranchiseNotificationRead(
         { franchiseId: "f1", params: { id: "n1" } },
         res3,
      );
      check("200 when marking a single notification as read", res3.statusCode === 200);

      FranchiseNotification.updateMany = async () => ({ modifiedCount: 4 });
      const res4 = mockRes();
      await notificationController.markAllFranchiseNotificationsRead(
         { franchiseId: "f1" },
         res4,
      );
      check("200 when marking all as read", res4.statusCode === 200);
      check("modifiedCount is passed through", res4.body?.modifiedCount === 4);
   }

   console.log(
      failures === 0
         ? "\n🎉 Task 5 store-manager API logic looks correct — safe to move on to Task 6 (Admin frontend).\n"
         : `\n⚠️  ${failures} check(s) failed — fix the issue(s) above before continuing.\n`,
   );
   process.exit(failures === 0 ? 0 : 1);
})();
