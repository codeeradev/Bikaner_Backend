/**
 * Task 1 sanity test — run with: node scripts/testTask1Models.js
 * ------------------------------------------------------------------
 * Confirms the new/edited models load without errors and their
 * validation rules behave as expected. Deliberately does NOT connect
 * to MongoDB — `validateSync()` checks required/type/enum/min rules
 * in-memory, which is enough to catch typos before you wire up routes.
 * `unique` indexes are NOT checked here (that needs a live DB) — they
 * get exercised for real in Task 2's API tests.
 * ------------------------------------------------------------------
 */
const mongoose = require("../models/franchises") && require("mongoose");
const Franchise = require("../models/franchises");
const FranchiseInventory = require("../models/franchiseInventory");
const FranchiseNotification = require("../models/franchiseNotification");
const Order = require("../models/orders");

let failures = 0;

/**
 * Small assertion helper so failures print clearly and the script
 * keeps checking the rest instead of stopping at the first problem.
 */
function check(label, condition) {
  if (condition) {
    console.log(`  ✅ ${label}`);
  } else {
    console.error(`  ❌ ${label}`);
    failures += 1;
  }
}

console.log("\n1) Franchise model");
{
  // Missing required fields (name, address, cityId, etc.) should fail validation.
  const empty = new Franchise({});
  const err = empty.validateSync();
  check("rejects an empty document", !!err);
  check("flags missing email", !!err?.errors?.email);
  check("flags missing password", !!err?.errors?.password);

  const valid = new Franchise({
    name: "Bikaner Central",
    address: "MG Road",
    cityId: new mongoose.Types.ObjectId(),
    zoneId: new mongoose.Types.ObjectId(),
    lat: 28.6,
    lng: 77.2,
    managerName: "Ramesh Kumar",
    email: "ramesh@example.com",
    password: "plainTextForNow123", // hashed by the pre("save") hook, not here
    phone: "9999999999",
    createdBy: new mongoose.Types.ObjectId(),
  });
  check("accepts a fully-populated document", !valid.validateSync());
  check("has comparePassword() instance method", typeof valid.comparePassword === "function");
}

console.log("\n2) FranchiseInventory model");
{
  const negativeStock = new FranchiseInventory({
    franchiseId: new mongoose.Types.ObjectId(),
    productId: new mongoose.Types.ObjectId(),
    stock: -5,
    mrp: 100,
    sellingPrice: 90,
  });
  check("rejects negative stock", !!negativeStock.validateSync()?.errors?.stock);

  const valid = new FranchiseInventory({
    franchiseId: new mongoose.Types.ObjectId(),
    productId: new mongoose.Types.ObjectId(),
    stock: 20,
    mrp: 100,
    sellingPrice: 90,
  });
  check("accepts a valid document", !valid.validateSync());
  check("defaults isVisible to true", valid.isVisible === true);
}

console.log("\n3) FranchiseNotification model");
{
  const badType = new FranchiseNotification({
    franchiseId: new mongoose.Types.ObjectId(),
    title: "Order assigned",
    message: "Order #ORD001 was assigned to your store.",
    type: "not_a_real_type",
  });
  check("rejects an invalid `type` enum value", !!badType.validateSync()?.errors?.type);

  const valid = new FranchiseNotification({
    franchiseId: new mongoose.Types.ObjectId(),
    title: "Order assigned",
    message: "Order #ORD001 was assigned to your store.",
    type: "order_assigned",
  });
  check("accepts a valid document", !valid.validateSync());
  check("defaults read to false", valid.read === false);
}

console.log("\n4) Order model (franchiseAssignment addition)");
{
  const order = new Order({
    userId: new mongoose.Types.ObjectId(),
    items: [
      {
        productId: new mongoose.Types.ObjectId(),
        quantity: 1,
        price: 50,
        priceType: "selling",
        subtotal: 50,
      },
    ],
    totalAmount: 50,
    grandTotal: 50,
    orderType: "normal",
    addressId: new mongoose.Types.ObjectId(),
  });
  check("franchiseAssignment sub-object exists with no default franchiseId", order.franchiseAssignment.franchiseId === null);
  check("franchiseAssignment.status is unset by default", order.franchiseAssignment.status === null);

  order.franchiseAssignment.franchiseId = new mongoose.Types.ObjectId();
  order.franchiseAssignment.status = "not_a_real_status";
  check("rejects an invalid franchiseAssignment.status", !!order.validateSync()?.errors?.["franchiseAssignment.status"]);
}

console.log(
  failures === 0
    ? "\n🎉 Task 1 models look correct — safe to move on to Task 2 (auth + admin APIs).\n"
    : `\n⚠️  ${failures} check(s) failed — fix the model(s) above before continuing.\n`,
);
process.exit(failures === 0 ? 0 : 1);
