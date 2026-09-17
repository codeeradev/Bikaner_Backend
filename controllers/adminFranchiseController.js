const Franchise = require("../models/franchises");
const FranchiseInventory = require("../models/franchiseInventory");
const FranchiseNotification = require("../models/franchiseNotification");
const Order = require("../models/orders");
const Product = require("../models/products");

/**
 * Admin Franchise Controller
 * ------------------------------------------------------------------
 * Admin-only CRUD over franchise stores. A "franchise" here is a
 * physical store + its manager login — there is no public sign-up,
 * so every store in this collection was created by an Admin.
 * ------------------------------------------------------------------
 */

/**
 * Strip fields a client should never receive (currently just the
 * password hash — `select: false` on the schema already keeps it out
 * of query results, but `.create()`/`.save()` return the in-memory
 * document with every field, so this is the belt-and-braces version).
 * @param {import("mongoose").Document} franchise
 */
const toPublicFranchise = (franchise) => {
  const obj = franchise.toObject ? franchise.toObject() : franchise;
  delete obj.password;
  return obj;
};

/**
 * POST /franchises
 * Create a store + its manager login in one call.
 * Body: { name, address, cityId, zoneId, lat, lng, managerName, email, password, phone }
 */
exports.createFranchise = async (req, res) => {
  try {
    const {
      name,
      address,
      cityId,
      zoneId,
      lat,
      lng,
      managerName,
      email,
      password,
      phone,
    } = req.body;

    // -- Validation --------------------------------------------------
    const requiredFields = {
      name,
      address,
      cityId,
      zoneId,
      managerName,
      email,
      password,
      phone,
    };
    const missingField = Object.entries(requiredFields).find(
      ([, value]) => value === undefined || value === null || value === "",
    );
    if (missingField || lat === undefined || lng === undefined) {
      return res.status(400).json({
        success: false,
        message: "All store and manager fields are required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingByEmail = await Franchise.findOne({ email: normalizedEmail });
    if (existingByEmail) {
      return res.status(409).json({
        success: false,
        message: "A store manager with this email already exists",
      });
    }

    // Password hashing happens in the model's pre("save") hook — this
    // controller only ever handles the plain-text value the admin typed.
    const franchise = await Franchise.create({
      name,
      address,
      cityId,
      zoneId,
      lat,
      lng,
      managerName,
      email: normalizedEmail,
      password,
      phone,
      createdBy: req.userId,
    });

    return res.status(201).json({
      success: true,
      message: "Franchise store created successfully",
      data: toPublicFranchise(franchise),
    });
  } catch (error) {
    console.error("Error creating franchise:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create franchise store",
      error: error.message,
    });
  }
};

/**
 * GET /franchises
 * List every store with basic stats: how many products it carries and
 * how many orders are currently waiting on its response.
 * Query: { status?, search?, page=1, limit=10 }
 */
exports.getFranchises = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter.$or = [
        { name: searchRegex },
        { managerName: searchRegex },
        { email: searchRegex },
      ];
    }

    const pageNum = Math.max(parseInt(page), 1);
    const limitNum = Math.max(parseInt(limit), 1);
    const skip = (pageNum - 1) * limitNum;

    // * A single aggregation (rather than an N+1 query per store) keeps
    // * this list page fast as the store count grows. `$lookup` pulls in
    // * just the counts we need from the two related collections.
    const franchises = await Franchise.aggregate([
      { $match: filter },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limitNum },
      {
        $lookup: {
          from: FranchiseInventory.collection.name,
          localField: "_id",
          foreignField: "franchiseId",
          as: "inventory",
        },
      },
      {
        $lookup: {
          from: Order.collection.name,
          let: { storeId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$franchiseAssignment.franchiseId", "$$storeId"] },
                    { $eq: ["$franchiseAssignment.status", "pending"] },
                  ],
                },
              },
            },
            { $count: "count" },
          ],
          as: "pendingOrderStats",
        },
      },
      {
        // Pure inclusion projection. MongoDB doesn't allow mixing
        // exclusions (password: 0, etc.) with computed expressions
        // ($size, $ifNull) in the same $project — anything not listed
        // here (password, the full inventory array, pendingOrderStats)
        // is dropped automatically, so no exclusions are needed.
        $project: {
          name: 1,
          slug: 1,
          address: 1,
          cityId: 1,
          zoneId: 1,
          lat: 1,
          lng: 1,
          managerName: 1,
          email: 1,
          phone: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          productCount: { $size: "$inventory" },
          pendingOrders: {
            $ifNull: [{ $arrayElemAt: ["$pendingOrderStats.count", 0] }, 0],
          },
        },
      },
    ]);

    const total = await Franchise.countDocuments(filter);

    return res.status(200).json({
      success: true,
      data: franchises,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Error fetching franchises:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch franchises",
      error: error.message,
    });
  }
};

/**
 * GET /franchises/:id
 * Store detail: profile + its inventory + its order history.
 */
exports.getFranchiseById = async (req, res) => {
  try {
    const franchise = await Franchise.findById(req.params.id)
      .populate("cityId", "name")
      .populate("zoneId", "name")
      .populate("createdBy", "name email");

    if (!franchise) {
      return res.status(404).json({
        success: false,
        message: "Franchise store not found",
      });
    }

    const [inventory, orderHistory] = await Promise.all([
      FranchiseInventory.find({ franchiseId: franchise._id })
        .populate("productId", "name sku image")
        .sort({ updatedAt: -1 }),
      Order.find({ "franchiseAssignment.franchiseId": franchise._id })
        .select(
          "orderNumber grandTotal orderStatus franchiseAssignment createdAt",
        )
        .sort({ createdAt: -1 })
        .limit(50), // most recent 50 — the detail page shows a history, not a full export
    ]);

    return res.status(200).json({
      success: true,
      data: {
        ...toPublicFranchise(franchise),
        inventory,
        orderHistory,
      },
    });
  } catch (error) {
    console.error("Error fetching franchise detail:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch franchise store",
      error: error.message,
    });
  }
};

/**
 * GET /franchises/slug/:slug
 * Same response shape as getFranchiseById — used by the admin detail
 * page so the browser URL shows a readable slug instead of the raw
 * Mongo _id. Sub-resource calls made from that page (edit, status,
 * delete, inventory) still use the real _id returned in `data.id`.
 */
exports.getFranchiseBySlug = async (req, res) => {
  try {
    const franchise = await Franchise.findOne({ slug: req.params.slug })
      .populate("cityId", "name")
      .populate("zoneId", "name")
      .populate("createdBy", "name email");

    if (!franchise) {
      return res.status(404).json({
        success: false,
        message: "Franchise store not found",
      });
    }

    const [inventory, orderHistory] = await Promise.all([
      FranchiseInventory.find({ franchiseId: franchise._id })
        .populate("productId", "name sku image")
        .sort({ updatedAt: -1 }),
      Order.find({ "franchiseAssignment.franchiseId": franchise._id })
        .select(
          "orderNumber grandTotal orderStatus franchiseAssignment createdAt",
        )
        .sort({ createdAt: -1 })
        .limit(50),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        ...toPublicFranchise(franchise),
        inventory,
        orderHistory,
      },
    });
  } catch (error) {
    console.error("Error fetching franchise detail by slug:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch franchise store",
      error: error.message,
    });
  }
};

/**
 * PUT /franchises/:id
 * Edit store/manager details. `password` is optional — only present
 * when Admin explicitly wants to reset the manager's login.
 */
exports.updateFranchise = async (req, res) => {
  try {
    const {
      name,
      address,
      cityId,
      zoneId,
      lat,
      lng,
      managerName,
      email,
      phone,
      password,
    } = req.body;

    // `.select("+password")` isn't actually needed here since we're not
    // reading the existing hash — but loading the full Mongoose document
    // (instead of findByIdAndUpdate) is what lets the pre("save") hook
    // re-hash `password` below when a reset is requested.
    const franchise = await Franchise.findById(req.params.id);
    if (!franchise) {
      return res.status(404).json({
        success: false,
        message: "Franchise store not found",
      });
    }

    if (email && email.toLowerCase().trim() !== franchise.email) {
      const normalizedEmail = email.toLowerCase().trim();
      const emailTaken = await Franchise.findOne({
        email: normalizedEmail,
        _id: { $ne: franchise._id },
      });
      if (emailTaken) {
        return res.status(409).json({
          success: false,
          message: "Another store manager already uses this email",
        });
      }
      franchise.email = normalizedEmail;
    }

    if (name !== undefined) franchise.name = name;
    if (address !== undefined) franchise.address = address;
    if (cityId !== undefined) franchise.cityId = cityId;
    if (zoneId !== undefined) franchise.zoneId = zoneId;
    if (lat !== undefined) franchise.lat = lat;
    if (lng !== undefined) franchise.lng = lng;
    if (managerName !== undefined) franchise.managerName = managerName;
    if (phone !== undefined) franchise.phone = phone;

    // * Only touch the password when the admin actually sent one — an
    // * empty/omitted field must never accidentally wipe the login.
    if (password) {
      franchise.password = password; // re-hashed by the pre("save") hook
    }

    await franchise.save();

    return res.status(200).json({
      success: true,
      message: "Franchise store updated successfully",
      data: toPublicFranchise(franchise),
    });
  } catch (error) {
    console.error("Error updating franchise:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update franchise store",
      error: error.message,
    });
  }
};

/**
 * PATCH /franchises/:id/status
 * Activate / deactivate a store. A deactivated store's manager can no
 * longer log in (see authenticateFranchise) or receive new assignments.
 * Body: { status: "active" | "inactive" }
 */
exports.setFranchiseStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be either 'active' or 'inactive'",
      });
    }

    const franchise = await Franchise.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true },
    );

    if (!franchise) {
      return res.status(404).json({
        success: false,
        message: "Franchise store not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Franchise store marked as ${status}`,
      data: toPublicFranchise(franchise),
    });
  } catch (error) {
    console.error("Error updating franchise status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update franchise status",
      error: error.message,
    });
  }
};

/**
 * DELETE /franchises/:id
 * Hard-delete: permanently removes the store document itself, its
 * manager login, its full inventory (FranchiseInventory rows), and
 * its notification history (franchiseNotifications rows). This is
 * destructive and cannot be undone — the Admin UI's confirmation
 * dialog warns the user before this endpoint is ever called.
 *
 * Past Orders that reference this store (`franchiseAssignment.franchiseId`)
 * are deliberately left untouched: an order is a financial/transaction
 * record with its own reporting value, so we don't want deleting a
 * store to silently rewrite revenue history. Those orders simply keep
 * a franchiseId that no longer resolves to a live document — the same
 * pattern already used elsewhere for "referenced but since-removed"
 * relations (e.g. createdBy).
 */
exports.deleteFranchise = async (req, res) => {
  try {
    const franchise = await Franchise.findById(req.params.id);

    if (!franchise) {
      return res.status(404).json({
        success: false,
        message: "Franchise store not found",
      });
    }

    // Inventory + notifications are wholly owned by this store — no
    // other record's integrity depends on them, so they're safe to
    // hard-delete alongside the franchise itself.
    await Promise.all([
      FranchiseInventory.deleteMany({ franchiseId: franchise._id }),
      FranchiseNotification.deleteMany({ franchiseId: franchise._id }),
    ]);

    await Franchise.deleteOne({ _id: franchise._id });

    return res.status(200).json({
      success: true,
      message: "Franchise store and all its data were permanently deleted",
      data: toPublicFranchise(franchise),
    });
  } catch (error) {
    console.error("Error deleting franchise:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete franchise store",
      error: error.message,
    });
  }
};

/**
 * POST /franchises/:franchiseId/products
 * Body: { productId, stock?, mrp, sellingPrice, isVisible? }
 *
 * Admin-side equivalent of the store-manager's own "add to my catalog"
 * flow (see controllers/app/franchiseProductController.js) — this one
 * lets Admin seed a store's catalog on the manager's behalf, from the
 * franchise detail page. One FranchiseInventory row per (store,
 * product) pair; the unique index on the model is the real guard, the
 * findOne check below just gives a friendlier error message first.
 */
exports.addFranchiseProduct = async (req, res) => {
  try {
    const { franchiseId } = req.params;
    const { productId, stock, mrp, sellingPrice, isVisible } = req.body;

    if (!productId || mrp === undefined || sellingPrice === undefined) {
      return res.status(400).json({
        success: false,
        message: "productId, mrp and sellingPrice are required",
      });
    }

    const [franchise, product] = await Promise.all([
      Franchise.findById(franchiseId),
      Product.findById(productId),
    ]);

    if (!franchise) {
      return res.status(404).json({
        success: false,
        message: "Franchise store not found",
      });
    }
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const existing = await FranchiseInventory.findOne({
      franchiseId,
      productId,
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "This product is already in the store's catalog",
      });
    }

    const inventoryItem = await FranchiseInventory.create({
      franchiseId,
      productId,
      stock: stock ?? 0,
      mrp,
      sellingPrice,
      isVisible: isVisible ?? true,
    });
    await inventoryItem.populate("productId", "name sku image");

    return res.status(201).json({
      success: true,
      message: "Product added to store successfully",
      data: inventoryItem,
    });
  } catch (error) {
    console.error("Error adding franchise product:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add product to store",
      error: error.message,
    });
  }
};

/**
 * PUT /franchises/:franchiseId/products/:productId
 * Body: { stock?, mrp?, sellingPrice?, isVisible? }
 * Edits this store's stock/pricing override for a product that's
 * already in its catalog. Which product is linked can't be changed
 * here — see the FranchiseDetailPage note on why that's a remove+add.
 */
exports.updateFranchiseProduct = async (req, res) => {
  try {
    const { franchiseId, productId } = req.params;
    const { stock, mrp, sellingPrice, isVisible } = req.body;

    const inventoryItem = await FranchiseInventory.findOne({
      franchiseId,
      productId,
    });
    if (!inventoryItem) {
      return res.status(404).json({
        success: false,
        message: "This product is not in the store's catalog",
      });
    }

    if (stock !== undefined) inventoryItem.stock = stock;
    if (mrp !== undefined) inventoryItem.mrp = mrp;
    if (sellingPrice !== undefined) inventoryItem.sellingPrice = sellingPrice;
    if (isVisible !== undefined) inventoryItem.isVisible = isVisible;

    await inventoryItem.save();
    await inventoryItem.populate("productId", "name sku image");

    return res.status(200).json({
      success: true,
      message: "Store product updated successfully",
      data: inventoryItem,
    });
  } catch (error) {
    console.error("Error updating franchise product:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update store product",
      error: error.message,
    });
  }
};

/**
 * DELETE /franchises/:franchiseId/products/:productId
 * Removes a product from a store's catalog entirely (not a visibility
 * toggle — the FranchiseInventory row itself is deleted).
 */
exports.removeFranchiseProduct = async (req, res) => {
  try {
    const { franchiseId, productId } = req.params;

    const inventoryItem = await FranchiseInventory.findOneAndDelete({
      franchiseId,
      productId,
    });
    if (!inventoryItem) {
      return res.status(404).json({
        success: false,
        message: "This product is not in the store's catalog",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product removed from store",
    });
  } catch (error) {
    console.error("Error removing franchise product:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to remove product from store",
      error: error.message,
    });
  }
};
