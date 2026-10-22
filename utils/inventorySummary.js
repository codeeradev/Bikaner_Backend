const Inventory = require('../models/franchiseInventory');
exports.getInventorySummary = async (franchiseId) => {
  const rows = await Inventory.aggregate([
    { $match: { franchiseId } },
    { $group: { _id: null, totalProducts: { $sum: 1 }, totalStock: { $sum: '$stock' } } },
    { $project: { _id: 0, totalProducts: 1, totalStock: 1 } },
  ]);
  return rows[0] || { totalProducts: 0, totalStock: 0 };
};
