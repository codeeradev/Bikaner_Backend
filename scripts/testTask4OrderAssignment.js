/**
 * Task 4 sanity test — run with: node scripts/testTask4OrderAssignment.js
 * ------------------------------------------------------------------
 * Same approach as Tasks 2 & 3: stub the Mongoose model statics with
 * in-memory fakes, then call the REAL controller functions and assert
 * on status codes + response shape.
 *
 * Covers:
 *   1) orderController.assignOrderToFranchise  — the PUT /orders/:orderId/assign-franchise handler
 *   2) franchiseNotificationController.notifyFranchiseOrderAssigned — the trigger it calls
 *
 * ! Not covered here (same caveat as Task 3's aggregation pipeline):
 * ! this stubs Franchise.findById / Order.findById / FranchiseNotification.findOne
 * ! /create, so it proves the *logic* is right but not that the real
 * ! MongoDB schema/queries behave identically. Confirm with one real
 * ! request after wiring up routes — e.g.
 * !   curl -X PUT http://localhost:9020/orders/<id>/assign-franchise \
 * !     -H "Authorization: Bearer <admin token>" \
 * !     -H "Content-Type: application/json" \
 * !     -d '{"franchiseId":"<franchiseId>"}'
 * ------------------------------------------------------------------
 */
const Order = require("../models/orders");
const Franchise = require("../models/franchises");
const FranchiseNotification = require("../models/franchiseNotification");
const orderController = require("../controllers/orderController");
const franchiseNotificationController = require("../controllers/franchiseNotificationController");

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

// Builds a fake order document that behaves like a Mongoose document
// just enough for the controller under test: readable fields, a
// settable `franchiseAssignment`, and a `.save()` that records what
// was written instead of hitting a real database.
function makeFakeOrder(overrides = {}) {
  const state = {
    _id: "order1",
    orderNumber: "ORD-1001",
    orderStatus: "pending",
    franchiseAssignment: {},
    ...overrides,
  };

  return {
    ...state,
    save: async function save() {
      return this;
    },
  };
}

(async () => {
  console.log("\n1) PUT /orders/:orderId/assign-franchise (assignOrderToFranchise)");
  {
    const res1 = mockRes();
    await orderController.assignOrderToFranchise(
      { params: { orderId: "order1" }, body: {}, userId: "admin1" },
      res1,
    );
    check("400 when franchiseId is missing", res1.statusCode === 400);

    Order.findById = async () => null;
    const res2 = mockRes();
    await orderController.assignOrderToFranchise(
      { params: { orderId: "missing" }, body: { franchiseId: "f1" }, userId: "admin1" },
      res2,
    );
    check("404 when the order doesn't exist", res2.statusCode === 404);

    Order.findById = async () => makeFakeOrder({ orderStatus: "delivered" });
    const res3 = mockRes();
    await orderController.assignOrderToFranchise(
      { params: { orderId: "order1" }, body: { franchiseId: "f1" }, userId: "admin1" },
      res3,
    );
    check("400 when the order is already delivered", res3.statusCode === 400);

    let pendingOrder = makeFakeOrder({ orderStatus: "pending" });
    Order.findById = async (id) =>
      id === "order1" ? pendingOrder : null;
    Franchise.findById = async () => null;
    const res4 = mockRes();
    await orderController.assignOrderToFranchise(
      { params: { orderId: "order1" }, body: { franchiseId: "missing-store" }, userId: "admin1" },
      res4,
    );
    check("404 when the franchise store doesn't exist", res4.statusCode === 404);

    Franchise.findById = async () => ({
      _id: "f1",
      name: "Bikaner Central",
      status: "inactive",
    });
    const res5 = mockRes();
    await orderController.assignOrderToFranchise(
      { params: { orderId: "order1" }, body: { franchiseId: "f1" }, userId: "admin1" },
      res5,
    );
    check("400 when the store is deactivated", res5.statusCode === 400);

    // -- Happy path: first assignment -----------------------------------
    // Section 2 below tests the real notifyFranchiseOrderAssigned
    // implementation directly, so keep a handle on it to restore after
    // this section is done stubbing it out.
    const realNotifyFranchiseOrderAssigned =
      franchiseNotificationController.notifyFranchiseOrderAssigned;
    let notifyCallArgs = null;
    franchiseNotificationController.notifyFranchiseOrderAssigned = async (
      franchise,
      order,
      wasPreviouslyAssigned,
    ) => {
      notifyCallArgs = { franchise, order, wasPreviouslyAssigned };
      return { _id: "notif1" };
    };

    Franchise.findById = async () => ({
      _id: "f1",
      name: "Bikaner Central",
      status: "active",
    });
    pendingOrder = makeFakeOrder({ orderStatus: "pending" }); // franchiseAssignment: {}
    let findByIdCallCount = 0;
    Order.findById = async () => {
      findByIdCallCount += 1;
      return pendingOrder;
    };
    Order.findById = () => ({
      // First call in the handler is a plain findById (no populate chain);
      // the second call (for the response) chains .populate() 3x. Support
      // both shapes by making the returned object thenable AND chainable.
      then: (onResolve) => Promise.resolve(pendingOrder).then(onResolve),
      populate: function populate() {
        return this;
      },
    });

    const res6 = mockRes();
    await orderController.assignOrderToFranchise(
      { params: { orderId: "order1" }, body: { franchiseId: "f1" }, userId: "admin7" },
      res6,
    );
    check("200 on a valid first assignment", res6.statusCode === 200);
    check(
      "franchiseAssignment.status is set to 'pending'",
      pendingOrder.franchiseAssignment.status === "pending",
    );
    check(
      "franchiseAssignment.assignedBy comes from req.userId",
      pendingOrder.franchiseAssignment.assignedBy === "admin7",
    );
    check(
      "notifyFranchiseOrderAssigned was called with wasPreviouslyAssigned = false",
      notifyCallArgs?.wasPreviouslyAssigned === false,
    );
    check(
      "response message reflects a first assignment, not a reassignment",
      res6.body?.message === "Order assigned to store successfully",
    );

    // -- Happy path: reassignment after a rejection ----------------------
    pendingOrder = makeFakeOrder({
      orderStatus: "pending",
      franchiseAssignment: {
        franchiseId: "f1",
        status: "rejected",
        assignedAt: new Date("2026-01-01"),
      },
    });
    Order.findById = () => ({
      then: (onResolve) => Promise.resolve(pendingOrder).then(onResolve),
      populate: function populate() {
        return this;
      },
    });
    notifyCallArgs = null;

    const res7 = mockRes();
    await orderController.assignOrderToFranchise(
      { params: { orderId: "order1" }, body: { franchiseId: "f2" }, userId: "admin7" },
      res7,
    );
    check(
      "notifyFranchiseOrderAssigned was called with wasPreviouslyAssigned = true after a rejection",
      notifyCallArgs?.wasPreviouslyAssigned === true,
    );
    check(
      "response message reflects a reassignment",
      res7.body?.message === "Order reassigned to store successfully",
    );
    franchiseNotificationController.notifyFranchiseOrderAssigned = async () => {
      throw new Error("push provider down");
    };
    const res8 = mockRes();
    await orderController.assignOrderToFranchise(
      { params: { orderId: "order1" }, body: { franchiseId: "f2" }, userId: "admin7" },
      res8,
    );
    check("a notification failure doesn't fail the request", res8.statusCode === 200);

    // Restore the real implementation before Section 2 exercises it directly.
    franchiseNotificationController.notifyFranchiseOrderAssigned =
      realNotifyFranchiseOrderAssigned;
  }

  console.log("\n2) notifyFranchiseOrderAssigned (franchiseNotificationController)");
  {
    const fakeFranchise = { _id: "f1", name: "Bikaner Central", fcmToken: null };
    const fakeOrder = {
      _id: "order1",
      orderNumber: "ORD-1001",
      franchiseAssignment: { assignedAt: new Date("2026-02-01T00:00:00Z") },
    };

    let createArgs = null;
    FranchiseNotification.findOne = async () => null; // no existing dedup match
    FranchiseNotification.create = async (data) => {
      createArgs = data;
      return { ...data, _id: "notif1" };
    };

    const notification =
      await franchiseNotificationController.notifyFranchiseOrderAssigned(
        fakeFranchise,
        fakeOrder,
        false,
      );
    check("type is 'order_assigned' for a first assignment", createArgs.type === "order_assigned");
    check(
      "sourceKey embeds orderId, franchiseId and assignedAt (dedup-safe across reassignments)",
      createArgs.sourceKey ===
        `order:order1:assigned:f1:${new Date("2026-02-01T00:00:00Z").getTime()}`,
    );
    check("no push is attempted when franchise.fcmToken is absent", notification._id === "notif1");

    const reassignNotification =
      await franchiseNotificationController.notifyFranchiseOrderAssigned(
        fakeFranchise,
        fakeOrder,
        true,
      );
    check("type is 'order_reassigned' when wasPreviouslyAssigned is true", createArgs.type === "order_reassigned");

    // Dedup: a repeated call with the same sourceKey returns the existing row.
    const existing = { _id: "notif-existing", sourceKey: createArgs.sourceKey };
    FranchiseNotification.findOne = async () => existing;
    const dedupedResult =
      await franchiseNotificationController.notifyFranchiseOrderAssigned(
        fakeFranchise,
        fakeOrder,
        true,
      );
    check("a duplicate event returns the existing notification instead of creating a new one", dedupedResult === existing);
  }

  console.log(
    failures === 0
      ? "\n🎉 Task 4 order-assignment + notification trigger logic looks correct — safe to move on to Task 5 (store-manager APIs).\n"
      : `\n⚠️  ${failures} check(s) failed — fix the issue(s) above before continuing.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
})();
