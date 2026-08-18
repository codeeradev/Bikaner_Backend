const mongoose = require("mongoose");
const Product = require("../models/products");
const BulkOrderRequest = require("../models/bulkOrderRequest");

exports.createBulkOrderRequest = async (req, res) => {
  try {
    const { productId, quantity, notes } = req.body;
    const parsedQuantity = Number(quantity);

    if (!mongoose.isValidObjectId(productId) || !Number.isInteger(parsedQuantity) || parsedQuantity < 1) {
      return res.status(400).json({ success: false, message: "A valid productId and quantity of at least 1 are required" });
    }

    const product = await Product.findOne({ _id: productId, isActive: true });
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found or unavailable" });
    }

    const request = await BulkOrderRequest.create({
      userId: req.userId,
      productId,
      quantity: parsedQuantity,
      notes: typeof notes === "string" ? notes.trim() : "",
    });
    await request.populate([
      { path: "productId", select: "name image sku description unitValue unit mrp sellingPrice stock bulkPrice categoryId", populate: { path: "categoryId", select: "name" } },
      { path: "userId", select: "name mobile email profileImage cityId zoneId lat lng", populate: [{ path: "cityId", select: "name" }, { path: "zoneId", select: "name" }] },
    ]);

    return res.status(201).json({ success: true, message: "Bulk order request submitted", data: request });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to submit bulk order request", error: error.message });
  }
};

exports.getBulkOrderRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const filter = status ? { status } : {};
    const requests = await BulkOrderRequest.find(filter)
      .populate({ path: "productId", select: "name image sku description unitValue unit mrp sellingPrice stock bulkPrice categoryId", populate: { path: "categoryId", select: "name" } })
      .populate({ path: "userId", select: "name mobile email profileImage cityId zoneId lat lng", populate: [{ path: "cityId", select: "name" }, { path: "zoneId", select: "name" }] })
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));
    const total = await BulkOrderRequest.countDocuments(filter);
    return res.json({ success: true, data: requests, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch bulk order requests", error: error.message });
  }
};

exports.updateBulkOrderRequestStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;
    if (!["pending", "delivered", "cancelled"].includes(status)) {
      return res.status(400).json({ success: false, message: "Status must be pending, delivered, or cancelled" });
    }
    const update = { status };
    if (typeof notes === "string") update.notes = notes.trim();
    const request = await BulkOrderRequest.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate({ path: "productId", select: "name image sku description unitValue unit mrp sellingPrice stock bulkPrice categoryId", populate: { path: "categoryId", select: "name" } })
      .populate({ path: "userId", select: "name mobile email profileImage cityId zoneId lat lng", populate: [{ path: "cityId", select: "name" }, { path: "zoneId", select: "name" }] });
    if (!request) return res.status(404).json({ success: false, message: "Bulk order request not found" });
    return res.json({ success: true, message: "Request status updated", data: request });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update request", error: error.message });
  }
};
