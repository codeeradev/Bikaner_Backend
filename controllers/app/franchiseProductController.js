const FranchiseInventory = require("../../models/franchiseInventory");
const Product = require("../../models/products");

/**
 * Store-Manager Product Controller
 * ------------------------------------------------------------------
 * A store's catalog is its FranchiseInventory rows, each one a
 * per-store override of a product's stock/mrp/sellingPrice/isVisible
 * (see models/franchiseInventory.js — stock and pricing are never
 * shared across stores).
 * ------------------------------------------------------------------
 */

/**
 * GET /franchise/products
 * Query: { search?, isVisible?, page=1, limit=20 }
 *
 * `search` matches against the linked product's name. Since that name
 * lives on a different collection, the search is resolved in two
 * steps (find matching product ids, then filter inventory by them)
 * rather than an aggregation `$lookup` — simpler to read and fast
 * enough at a single store's catalog size.
 */
exports.getStoreProducts = async (req, res) => {
  try {
    const franchiseId = req.franchiseId;
    const { search, isVisible, page = 1, limit = 20 } = req.query;

    const filter = { franchiseId };
    if (isVisible !== undefined) {
      filter.isVisible = isVisible === "true";
    }

    if (search) {
      const matchingProductIds = await Product.find({
        name: new RegExp(search, "i"),
      }).distinct("_id");
      filter.productId = { $in: matchingProductIds };
    }

    const pageNum = Math.max(parseInt(page), 1);
    const limitNum = Math.max(parseInt(limit), 1);
    const skip = (pageNum - 1) * limitNum;

    const [inventoryItems, total] = await Promise.all([
      FranchiseInventory.find(filter)
        .populate("productId", "name sku image")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limitNum),
      FranchiseInventory.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: inventoryItems,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Error fetching store products:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch store products",
      error: error.message,
    });
  }
};

/**
 * PUT /franchise/products/:productId
 * Body: { stock?, mrp?, sellingPrice?, isVisible? }
 *
 * Updates this store's override for a product, creating the
 * FranchiseInventory row on first edit if one doesn't exist yet
 * (Admin doesn't necessarily seed every product for every store up
 * front — see A1's "Manager (or Admin) sets initial stock/pricing").
 */
exports.updateStoreProduct = async (req, res) => {
  try {
    const franchiseId = req.franchiseId;
    const { productId } = req.params;
    const { stock, mrp, sellingPrice, isVisible } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    let inventoryItem = await FranchiseInventory.findOne({
      franchiseId,
      productId,
    });

    if (inventoryItem) {
      // -- Editing an existing row: only touch fields actually sent --
      if (stock !== undefined) inventoryItem.stock = stock;
      if (mrp !== undefined) inventoryItem.mrp = mrp;
      if (sellingPrice !== undefined) inventoryItem.sellingPrice = sellingPrice;
      if (isVisible !== undefined) inventoryItem.isVisible = isVisible;
    } else {
      // -- First time this store is pricing this product: mrp and --
      // -- sellingPrice are required by the schema, so they must   --
      // -- both be supplied on the very first write.               --
      if (mrp === undefined || sellingPrice === undefined) {
        return res.status(400).json({
          success: false,
          message:
            "mrp and sellingPrice are required the first time you set this product's pricing",
        });
      }

      inventoryItem = new FranchiseInventory({
        franchiseId,
        productId,
        stock: stock ?? 0,
        mrp,
        sellingPrice,
        isVisible: isVisible ?? true,
      });
    }

    await inventoryItem.save();

    const populatedItem = await inventoryItem.populate(
      "productId",
      "name sku image",
    );

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: populatedItem,
    });
  } catch (error) {
    console.error("Error updating store product:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update store product",
      error: error.message,
    });
  }
};
