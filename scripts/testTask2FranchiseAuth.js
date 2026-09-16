/**
 * Task 2 sanity test — run with: node scripts/testTask2FranchiseAuth.js
 * ------------------------------------------------------------------
 * Exercises the real login controller and the real authenticateFranchise
 * middleware, in-process, without a live MongoDB connection.
 *
 * How: Mongoose model *static* methods (Franchise.findOne / findById)
 * are temporarily swapped for fakes that return an in-memory document.
 * Everything else — bcrypt hashing/comparison, JWT signing/verifying,
 * the controller's and middleware's own logic — runs for real. This is
 * the same "stub the DB boundary, exercise everything else" approach
 * you'd reach for with a mocking library, just dependency-free.
 * ------------------------------------------------------------------
 */
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const Franchise = require("../models/franchises");
const { login } = require("../controllers/app/franchiseAuthController");
const { authenticateFranchise } = require("../middleware/auth");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

let failures = 0;
function check(label, condition) {
  if (condition) {
    console.log(`  ✅ ${label}`);
  } else {
    console.error(`  ❌ ${label}`);
    failures += 1;
  }
}

/** Minimal fake Express req/res so we can call controllers directly. */
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

/** Builds a fake, already-hashed franchise document with a working comparePassword(). */
async function buildFakeFranchise(overrides = {}) {
  const plainPassword = "correct-password";
  const hashed = await bcrypt.hash(plainPassword, 10);

  const doc = {
    _id: "665f1f77bcf86cd799439011",
    name: "Bikaner Central",
    address: "MG Road",
    cityId: "city1",
    zoneId: "zone1",
    managerName: "Ramesh Kumar",
    email: "ramesh@example.com",
    password: hashed,
    phone: "9999999999",
    status: "active",
    fcmToken: null,
    save: async function save() {
      return this;
    },
    comparePassword: function comparePassword(candidate) {
      return bcrypt.compare(candidate, this.password);
    },
    ...overrides,
  };

  return { doc, plainPassword };
}

(async () => {
  console.log("\n1) POST /franchise/auth/login");
  {
    // -- missing fields -------------------------------------------------
    const res1 = mockRes();
    await login({ body: {} }, res1);
    check("400 when email/password missing", res1.statusCode === 400);

    // -- unknown email ----------------------------------------------------
    Franchise.findOne = () => ({ select: () => null });
    const res2 = mockRes();
    await login({ body: { email: "nobody@x.com", password: "x" } }, res2);
    check("401 for an email that doesn't exist", res2.statusCode === 401);

    // -- wrong password ----------------------------------------------------
    const { doc } = await buildFakeFranchise();
    Franchise.findOne = () => ({ select: () => doc });
    const res3 = mockRes();
    await login({ body: { email: doc.email, password: "wrong-password" } }, res3);
    check("401 for a wrong password", res3.statusCode === 401);

    // -- inactive store ----------------------------------------------------
    const { doc: inactiveDoc, plainPassword: inactivePw } = await buildFakeFranchise({
      status: "inactive",
    });
    Franchise.findOne = () => ({ select: () => inactiveDoc });
    const res4 = mockRes();
    await login({ body: { email: inactiveDoc.email, password: inactivePw } }, res4);
    check("403 for a deactivated store", res4.statusCode === 403);

    // -- happy path ----------------------------------------------------
    const { doc: goodDoc, plainPassword: goodPw } = await buildFakeFranchise();
    Franchise.findOne = () => ({ select: () => goodDoc });
    const res5 = mockRes();
    await login({ body: { email: goodDoc.email, password: goodPw, fcmToken: "device-token-abc" } }, res5);
    check("200 on correct credentials", res5.statusCode === 200);
    check("response includes a token", typeof res5.body?.token === "string");
    check("response never leaks the password hash", res5.body?.franchise?.password === undefined);

    const decoded = jwt.verify(res5.body.token, process.env.JWT_SECRET);
    check("token is scoped with type: 'franchise'", decoded.type === "franchise");
    check("token carries the correct franchiseId", decoded.franchiseId === goodDoc._id);
    check("fcmToken from the request body was stored on the document", goodDoc.fcmToken === "device-token-abc");
  }

  console.log("\n2) authenticateFranchise middleware");
  {
    const { doc: activeDoc, plainPassword } = await buildFakeFranchise();
    void plainPassword;

    const validToken = jwt.sign(
      { franchiseId: activeDoc._id, type: "franchise" },
      process.env.JWT_SECRET,
    );

    // -- no header at all ----------------------------------------------------
    const res1 = mockRes();
    await authenticateFranchise({ headers: {} }, res1, () => {
      throw new Error("next() should NOT be called without a token");
    });
    check("401 when no Authorization header is present", res1.statusCode === 401);

    // -- garbage token ----------------------------------------------------
    const res2 = mockRes();
    await authenticateFranchise(
      { headers: { authorization: "Bearer not-a-real-token" } },
      res2,
      () => {
        throw new Error("next() should NOT be called with a garbage token");
      },
    );
    check("401 for a malformed token", res2.statusCode === 401);

    // -- token signed for a DIFFERENT scope (e.g. admin) --------------------
    const wrongScopeToken = jwt.sign({ userId: "someAdminId" }, process.env.JWT_SECRET);
    const res3 = mockRes();
    await authenticateFranchise(
      { headers: { authorization: `Bearer ${wrongScopeToken}` } },
      res3,
      () => {
        throw new Error("next() should NOT be called for a non-franchise token");
      },
    );
    check("401 for a well-formed but wrong-scope token", res3.statusCode === 401);

    // -- valid token, but the store has since been deactivated --------------
    const { doc: nowInactiveDoc } = await buildFakeFranchise({ status: "inactive" });
    const inactiveToken = jwt.sign(
      { franchiseId: nowInactiveDoc._id, type: "franchise" },
      process.env.JWT_SECRET,
    );
    Franchise.findById = () => nowInactiveDoc;
    const res4 = mockRes();
    await authenticateFranchise(
      { headers: { authorization: `Bearer ${inactiveToken}` } },
      res4,
      () => {
        throw new Error("next() should NOT be called for a deactivated store");
      },
    );
    check("403 when the store was deactivated after the token was issued", res4.statusCode === 403);

    // -- happy path ----------------------------------------------------
    Franchise.findById = () => activeDoc;
    let nextCalled = false;
    const req5 = { headers: { authorization: `Bearer ${validToken}` } };
    const res5 = mockRes();
    await authenticateFranchise(req5, res5, () => {
      nextCalled = true;
    });
    check("calls next() for a valid token + active store", nextCalled);
    check("attaches req.franchiseId", String(req5.franchiseId) === String(activeDoc._id));
  }

  console.log(
    failures === 0
      ? "\n🎉 Task 2 auth looks correct — safe to move on to Task 3 (admin franchise-management APIs).\n"
      : `\n⚠️  ${failures} check(s) failed — fix the issue(s) above before continuing.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
})();
