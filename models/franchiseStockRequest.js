const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  franchiseId: { type: mongoose.Schema.Types.ObjectId, ref: 'franchises', required: true },
  inventoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'franchiseInventory', required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'products', required: true },
  productName: { type: String, required: true },
  stockAtRequest: { type: Number, required: true },
  requestedQuantity: { type: Number, required: true, min: 1 },
  approvedQuantity: { type: Number, min: 1 },
  note: { type: String, maxlength: 500, default: '' },
  adminNote: { type: String, maxlength: 500, default: '' },
  status: { type: String, enum: ['pending','approved','dispatched','received','rejected'], default: 'pending' },
  open: { type: Boolean, default: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
  reviewedAt: Date,
  dispatchedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
  dispatchedAt: Date,
  receivedAt: Date,
}, { timestamps: true });
// Keep one unresolved request per store/product, including concurrent submissions.
schema.index({ franchiseId: 1, productId: 1 }, { unique: true, partialFilterExpression: { open: true } });
schema.index({ franchiseId: 1, createdAt: -1 });
module.exports = mongoose.model('franchiseStockRequests', schema);
