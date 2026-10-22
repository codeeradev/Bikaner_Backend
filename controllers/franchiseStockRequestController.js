const mongoose = require('mongoose');
const StockRequest = require('../models/franchiseStockRequest');
const Inventory = require('../models/franchiseInventory');
const AdminNotification = require('../models/adminNotification');
const FranchiseNotification = require('../models/franchiseNotification');
const validQuantity = value => Number.isSafeInteger(value) && value > 0 && value <= 1000000;
const validNote = value => value === undefined || (typeof value === 'string' && value.length <= 500);
const fail = (res, status, message) => res.status(status).json({ success: false, message });
const statuses = ['pending','approved','dispatched','received','rejected'];

// Notification writes are deduplicated. A notification failure must never turn a
// committed inventory operation into a failed response that invites a duplicate.
async function notify(row, admin) {
  try {
    const sourceKey = `stock:${row._id}:${row.status}`;
    const payload = { sourceKey, type: 'general', title: `Stock request ${row.status}`, message: `${row.productName.slice(0,100)}: ${row.approvedQuantity || row.requestedQuantity} packs — ${row.status}.` };
    const Model = admin ? AdminNotification : FranchiseNotification;
    await Model.updateOne({ sourceKey }, { $setOnInsert: { ...payload, ...(admin ? { recipientConstRoleId: 2, link: '/franchise/stock-requests' } : { franchiseId: row.franchiseId }) } }, { upsert: true, runValidators: true });
  } catch (error) { console.error('Stock request notification failed:', error.message); }
}
exports.create = async (req, res) => {
  const { productId, quantity, note } = req.body || {};
  if (!mongoose.isValidObjectId(productId) || !validQuantity(quantity) || !validNote(note)) return fail(res,400,'Choose a product, a whole-number quantity from 1 to 1,000,000, and a note up to 500 characters.');
  try {
    const inventory = await Inventory.findOne({ franchiseId:req.franchiseId, productId }).populate('productId','name');
    if (!inventory?.productId) return fail(res,404,'Product not found in your inventory');
    const row = await StockRequest.create({ franchiseId:req.franchiseId, inventoryId:inventory._id, productId, productName:inventory.productId.name, stockAtRequest:inventory.stock, requestedQuantity:quantity, note:note?.trim() || '' });
    await notify(row,true);
    return res.status(201).json({success:true,data:row});
  } catch (error) {
    if (error.code === 11000) return fail(res,409,'An open stock request already exists for this product. Check Stock Requests.');
    return fail(res,500,'Could not create stock request');
  }
};
exports.list = async (req,res) => {
  const { status } = req.query;
  if (status && !statuses.includes(status)) return fail(res,400,'Invalid request status');
  const page = Math.max(1,Number.parseInt(req.query.page,10)||1);
  const limit = Math.min(100,Math.max(1,Number.parseInt(req.query.limit,10)||20));
  const filter = { ...(req.franchiseId ? {franchiseId:req.franchiseId} : {}), ...(status ? {status} : {}) };
  try {
    const [rows,total] = await Promise.all([StockRequest.find(filter).populate('franchiseId','name managerName').populate('reviewedBy','name').sort({createdAt:-1}).skip((page-1)*limit).limit(limit),StockRequest.countDocuments(filter)]);
    return res.json({success:true,data:rows,pagination:{page,limit,total,pages:Math.ceil(total/limit)}});
  } catch { return fail(res,500,'Could not load stock requests'); }
};
exports.review = async (req,res) => {
  const { status, quantity, note } = req.body || {};
  if (!mongoose.isValidObjectId(req.params.id) || !['approved','rejected','dispatched'].includes(status) || !validNote(note)) return fail(res,400,'Invalid request update');
  if (status === 'approved' && !validQuantity(quantity)) return fail(res,400,'Approved quantity must be a whole number from 1 to 1,000,000');
  if (status === 'rejected' && !note?.trim()) return fail(res,400,'A rejection reason is required');
  try {
    const changes = status === 'dispatched'
      ? {status,dispatchedBy:req.userId,dispatchedAt:new Date()}
      : {status,open:status !== 'rejected',adminNote:note?.trim() || '',reviewedBy:req.userId,reviewedAt:new Date(),...(status === 'approved' ? {approvedQuantity:quantity} : {})};
    const row = await StockRequest.findOneAndUpdate({_id:req.params.id,status:status === 'dispatched' ? 'approved' : 'pending'},{$set:changes},{new:true,runValidators:true});
    if (!row) return fail(res,409,'Request not found or its status has changed. Refresh the list.');
    await notify(row,false);
    return res.json({success:true,data:row});
  } catch { return fail(res,500,'Could not update stock request'); }
};
exports.receive = async (req,res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return fail(res,400,'Invalid request id');
  try {
    const row = await StockRequest.findOne({_id:req.params.id,franchiseId:req.franchiseId});
    if (!row) return fail(res,404,'Stock request not found');
    if (row.status === 'received') return res.json({success:true,data:row});
    if (row.status !== 'dispatched') return fail(res,409,'Only dispatched requests can be received');
    // The stock increment and receipt marker share one atomic document write.
    // Retrying after a crash between this write and finalization is safe, and
    // works on standalone MongoDB without requiring replica-set transactions.
    const result = await Inventory.updateOne({_id:row.inventoryId,franchiseId:req.franchiseId,receivedStockRequests:{$ne:row._id}},{$inc:{stock:row.approvedQuantity},$addToSet:{receivedStockRequests:row._id}});
    if (!result.matchedCount && !await Inventory.exists({_id:row.inventoryId,franchiseId:req.franchiseId,receivedStockRequests:row._id})) return fail(res,409,'The original inventory entry no longer exists. Contact admin.');
    const received = await StockRequest.findOneAndUpdate({_id:row._id,status:'dispatched'},{$set:{status:'received',open:false,receivedAt:new Date()}},{new:true});
    const finalRow = received || await StockRequest.findById(row._id);
    await notify(finalRow,true);
    return res.json({success:true,data:finalRow});
  } catch { return fail(res,500,'Could not confirm receipt. You can retry safely.'); }
};
exports.validQuantity = validQuantity;
