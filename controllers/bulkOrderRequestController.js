const mongoose = require("mongoose");
const Product = require("../models/products");
const BulkOrderRequest = require("../models/bulkOrderRequest");

exports.createBulkOrderRequest = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
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
    });
    await request.populate([{ path: "productId", select: "name image sku" }, { path: "userId", select: "name phone email" }]);

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
      .populate("productId", "name image sku")
      .populate("userId", "name phone email")
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
    const { status } = req.body;
    if (!["pending", "contacted", "closed"].includes(status)) {
      return res.status(400).json({ success: false, message: "Status must be pending, contacted, or closed" });
    }
    const request = await BulkOrderRequest.findByIdAndUpdate(req.params.id, { status }, { new: true })
      .populate("productId", "name image sku")
      .populate("userId", "name phone email");
    if (!request) return res.status(404).json({ success: false, message: "Bulk order request not found" });
    return res.json({ success: true, message: "Request status updated", data: request });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update request", error: error.message });
  }
};
