/**
 * Task 3 sanity test — run with: node scripts/testTask3AdminFranchise.js
 * ------------------------------------------------------------------
 * Same approach as Task 2's test: stub the Mongoose model statics
 * (findOne/findById/findByIdAndUpdate/aggregate/countDocuments/create)
 * with in-memory fakes, then call the REAL controller functions and
 * assert on status codes + response shape.
 *
 * ! One thing this test deliberately does NOT cover: whether the
 * ! `$lookup` aggregation pipeline in getFranchises() is syntactically
 * ! valid MongoDB — that needs a real database. This test stubs
 * ! `Franchise.aggregate()` to return a canned result and only checks
 * ! that the controller handles that result correctly. Confirm the
 * ! pipeline itself with one real request after wiring up routes
 * ! (Task 3b) — e.g. `curl http://localhost:9020/franchises -H "Authorization: Bearer <admin token>"`.
 * ------------------------------------------------------------------
 */
const Franchise = require("../models/franchises");
const FranchiseInventory = require("../models/franchiseInventory");
const Order = require("../models/orders");
const controller = require("../controllers/adminFranchiseController");

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

const validPayload = {
  name: "Bikaner Central",
  address: "MG Road",
  cityId: "city1",
  zoneId: "zone1",
  lat: 28.6,
  lng: 77.2,
  managerName: "Ramesh Kumar",
  email: "Ramesh@Example.com", // deliberately mixed-case to check normalization
  password: "s3cret!",
  phone: "9999999999",
};

(async () => {
  console.log("\n1) POST /franchises (createFranchise)");
  {
    const res1 = mockRes();
    await controller.createFranchise({ body: { name: "Only a name" }, userId: "admin1" }, res1);
    check("400 when required fields are missing", res1.statusCode === 400);

    Franchise.findOne = async () => ({ _id: "existing" }); // email already taken
    const res2 = mockRes();
    await controller.createFranchise({ body: validPayload, userId: "admin1" }, res2);
    check("409 when the manager email is already in use", res2.statusCode === 409);

    Franchise.findOne = async () => null;
    let createArgs = null;
    Franchise.create = async (data) => {
      createArgs = data;
      return {
        toObject: () => ({ ...data, _id: "new-id", password: "hashed-in-real-life" }),
      };
    };
    const res3 = mockRes();
    await controller.createFranchise({ body: validPayload, userId: "admin1" }, res3);
    check("201 on valid input", res3.statusCode === 201);
    check("email is lower-cased before saving", createArgs.email === "ramesh@example.com");
    check("createdBy is taken from req.userId, not the body", createArgs.createdBy === "admin1");
    check("password hash is stripped from the response", res3.body?.data?.password === undefined);
  }

  console.log("\n2) GET /franchises (getFranchises)");
  {
    const fakeAggregateResult = [
      { _id: "f1", name: "Store A", productCount: 12, pendingOrders: 2 },
      { _id: "f2", name: "Store B", productCount: 0, pendingOrders: 0 },
    ];
    Franchise.aggregate = async () => fakeAggregateResult;
    Franchise.countDocuments = async () => 2;

    const res = mockRes();
    await controller.getFranchises({ query: {} }, res);
    check("200 on a normal list request", res.statusCode === 200);
    check("returns the aggregated rows as-is", res.body?.data === fakeAggregateResult);
    check("pagination.total reflects countDocuments()", res.body?.pagination?.total === 2);
    check("pagination.pages is computed correctly", res.body?.pagination?.pages === 1);
  }

  console.log("\n3) GET /franchises/:id (getFranchiseById)");
  {
    // `Franchise.findById(id).populate(...).populate(...).populate(...)` is
    // chained 3x before being awaited — the mock has to stay "thenable"
    // through every `.populate()` call and only resolve at the very end.
    const chainableResolvingTo = (finalValue) => {
      const chain = {
        populate: () => chain,
        then: (onResolve) => Promise.resolve(finalValue).then(onResolve),
      };
      return chain;
    };

    Franchise.findById = () => chainableResolvingTo(null);
    const res1 = mockRes();
    await controller.getFranchiseById({ params: { id: "missing" } }, res1);
    check("404 when the store doesn't exist", res1.statusCode === 404);

    const fakeFranchise = {
      _id: "f1",
      toObject: () => ({ _id: "f1", name: "Store A", password: "hash" }),
    };
    Franchise.findById = () => chainableResolvingTo(fakeFranchise);
    FranchiseInventory.find = () => ({
      populate: function populate() {
        return this;
      },
      sort: function sort() {
        return Promise.resolve([{ productId: "p1", stock: 10 }]);
      },
    });
    Order.find = () => ({
      select: function select() {
        return this;
      },
      sort: function sort() {
        return this;
      },
      limit: function limit() {
        return Promise.resolve([{ orderNumber: "ORD001" }]);
      },
    });
    const res2 = mockRes();
    await controller.getFranchiseById({ params: { id: "f1" } }, res2);
    check("200 when the store exists", res2.statusCode === 200);
    check("response bundles profile + inventory + orderHistory", Array.isArray(res2.body?.data?.inventory) && Array.isArray(res2.body?.data?.orderHistory));
    check("password hash is stripped from the detail response", res2.body?.data?.password === undefined);
  }

  console.log("\n4) PUT /franchises/:id (updateFranchise)");
  {
    Franchise.findById = async () => null;
    const res1 = mockRes();
    await controller.updateFranchise({ params: { id: "missing" }, body: {} }, res1);
    check("404 when the store doesn't exist", res1.statusCode === 404);

    let savedState = null;
    const existingFranchise = {
      _id: "f1",
      email: "old@example.com",
      name: "Old Name",
      save: async function save() {
        savedState = { ...this };
        return this;
      },
      toObject: function toObject() {
        return { ...this };
      },
    };
    Franchise.findById = async () => existingFranchise;
    Franchise.findOne = async () => ({ _id: "other-store" }); // email already used by someone else
    const res2 = mockRes();
    await controller.updateFranchise(
      { params: { id: "f1" }, body: { email: "taken@example.com" } },
      res2,
    );
    check("409 when the new email belongs to a different store", res2.statusCode === 409);

    Franchise.findOne = async () => null; // email is free
    const res3 = mockRes();
    await controller.updateFranchise(
      { params: { id: "f1" }, body: { name: "New Name" } },
      res3,
    );
    check("200 on a normal edit", res3.statusCode === 200);
    check("only the submitted field changed", savedState.name === "New Name" && savedState.email === "old@example.com");
    check("password is left untouched when not submitted", savedState.password === undefined);

    const res4 = mockRes();
    await controller.updateFranchise(
      { params: { id: "f1" }, body: { password: "new-plain-password" } },
      res4,
    );
    check("password is reassigned (for the pre-save hook to hash) when submitted", savedState.password === "new-plain-password");
  }

  console.log("\n5) PATCH /franchises/:id/status (setFranchiseStatus)");
  {
    const res1 = mockRes();
    await controller.setFranchiseStatus({ params: { id: "f1" }, body: { status: "banned" } }, res1);
    check("400 for an invalid status value", res1.statusCode === 400);

    Franchise.findByIdAndUpdate = async () => null;
    const res2 = mockRes();
    await controller.setFranchiseStatus({ params: { id: "missing" }, body: { status: "inactive" } }, res2);
    check("404 when the store doesn't exist", res2.statusCode === 404);

    Franchise.findByIdAndUpdate = async (id, update) => ({
      toObject: () => ({ _id: id, status: update.status }),
    });
    const res3 = mockRes();
    await controller.setFranchiseStatus({ params: { id: "f1" }, body: { status: "inactive" } }, res3);
    check("200 on a valid status change", res3.statusCode === 200);
    check("returned document reflects the new status", res3.body?.data?.status === "inactive");
  }

  console.log("\n6) DELETE /franchises/:id (deleteFranchise, soft-delete)");
  {
    Franchise.findByIdAndUpdate = async () => null;
    const res1 = mockRes();
    await controller.deleteFranchise({ params: { id: "missing" } }, res1);
    check("404 when the store doesn't exist", res1.statusCode === 404);

    let updateArgs = null;
    Franchise.findByIdAndUpdate = async (id, update) => {
      updateArgs = update;
      return { toObject: () => ({ _id: id, status: update.status }) };
    };
    const res2 = mockRes();
    await controller.deleteFranchise({ params: { id: "f1" } }, res2);
    check("200 on delete", res2.statusCode === 200);
    check("delete is implemented as a soft status change, not a real removal", updateArgs.status === "inactive");
  }

  console.log(
    failures === 0
      ? "\n🎉 Task 3 controller logic looks correct — safe to move on to Task 4 (order assignment + notification triggers).\n"
      : `\n⚠️  ${failures} check(s) failed — fix the issue(s) above before continuing.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
})();
