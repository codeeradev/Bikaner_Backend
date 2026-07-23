const Offer = require("../models/offers");
const Cart = require("../models/cart");
const User = require("../models/users");
const Product = require("../models/products");
const {
  calculateOrderTotals,
  normalizeOfferCode,
} = require("../utils/orderTotals");

const offerPayload = (body) => {
  const payload = {};
  const fields = [
    "name",
    "description",
    "offerType",
    "requiresCoupon",
    "couponCode",
    "discountValue",
    "maxDiscountAmount",
    "bogoConfig",
    "buyXGetYConfig",
    "comboConfig",
    "freeProductConfig",
    "applicableOn",
    "specificProducts",
    "specificCategories",
    "minCartValue",
    "maxUsagePerUser",
    "totalUsageLimit",
    "startDate",
    "endDate",
    "priority",
    "isStackable",
    "autoApply",
    "isActive",
  ];

  fields.forEach((field) => {
    if (body[field] !== undefined) payload[field] = body[field];
  });

  if (payload.couponCode !== undefined) {
    payload.couponCode = normalizeOfferCode(payload.couponCode);
  }
  
  if (payload.discountValue !== undefined) {
    payload.discountValue = Number(payload.discountValue);
  }
  
  if (payload.maxDiscountAmount !== undefined) {
    payload.maxDiscountAmount = Number(payload.maxDiscountAmount);
  }
  
  if (payload.minCartValue !== undefined) {
    payload.minCartValue = Number(payload.minCartValue);
  }

  return payload;
};

const validateOfferPayload = (payload, isCreate = false) => {
  if (isCreate && !payload.name) return "Offer name is required";
  if (isCreate && !payload.offerType) return "Offer type is required";
  if (isCreate && payload.applicableOn === undefined) {
    return "Applicability is required";
  }
  if (isCreate && !payload.startDate) return "Start date is required";

  const validOfferTypes = [
    "flat_discount",
    "percentage_discount",
    "bogo",
  ];

  if (payload.offerType && !validOfferTypes.includes(payload.offerType)) {
    return `Offer type must be one of: ${validOfferTypes.join(", ")}`;
  }

  const validApplicableOn = ["cart", "specific_products", "category"];
  if (payload.applicableOn && !validApplicableOn.includes(payload.applicableOn)) {
    return `Applicable on must be one of: ${validApplicableOn.join(", ")}`;
  }

  if (payload.requiresCoupon && !payload.couponCode) {
    return "Coupon code is required when requiresCoupon is true";
  }

  if (
    payload.discountValue !== undefined &&
    (!Number.isFinite(payload.discountValue) || payload.discountValue < 0)
  ) {
    return "Discount value must be a positive number";
  }

  if (
    payload.offerType === "percentage_discount" &&
    payload.discountValue !== undefined &&
    payload.discountValue > 100
  ) {
    return "Percentage discount cannot exceed 100";
  }

  if (
    payload.minCartValue !== undefined &&
    (!Number.isFinite(payload.minCartValue) || payload.minCartValue < 0)
  ) {
    return "Minimum cart value must be a positive number";
  }

  return null;
};

exports.createOffer = async (req, res) => {
  try {
    const payload = offerPayload(req.body);
    const validationError = validateOfferPayload(payload, true);

    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    // Check for duplicate coupon code
    if (payload.couponCode) {
      const existingOffer = await Offer.findOne({ couponCode: payload.couponCode });
      if (existingOffer) {
        return res.status(400).json({
          success: false,
          message: "Coupon code already exists",
        });
      }
    }

    const offer = await Offer.create(payload);

    res.status(201).json({
      success: true,
      message: "Offer created successfully",
      data: offer,
    });
  } catch (error) {
    console.error("Error creating offer:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create offer",
      error: error.message,
    });
  }
};

exports.getOffers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, isActive, offerType } = req.query;
    const filter = {};

    if (search) {
      filter.$or = [
        { name: new RegExp(search, "i") },
        { couponCode: new RegExp(search, "i") },
      ];
    }
    if (isActive !== undefined) filter.isActive = isActive === "true";
    if (offerType) filter.offerType = offerType;

    const parsedPage = parseInt(page);
    const parsedLimit = parseInt(limit);
    const skip = (parsedPage - 1) * parsedLimit;

    const offers = await Offer.find(filter)
      .sort({ priority: -1, createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .populate("specificProducts", "name images")
      .populate("specificCategories", "name")
      .populate("bogoConfig.freeProductId", "name images")
      .populate("buyXGetYConfig.buyProducts.productId", "name images")
      .populate("buyXGetYConfig.getProducts.productId", "name images")
      .populate("comboConfig.products.productId", "name images")
      .populate("freeProductConfig.productId", "name images");

    const total = await Offer.countDocuments(filter);

    res.json({
      success: true,
      data: offers,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        pages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (error) {
    console.error("Error fetching offers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch offers",
      error: error.message,
    });
  }
};

exports.getOfferById = async (req, res) => {
  try {
    const { id } = req.params;
    const offer = await Offer.findById(id)
      .populate("specificProducts", "name images sellingPrice")
      .populate("specificCategories", "name")
      .populate("bogoConfig.freeProductId", "name images sellingPrice")
      .populate("buyXGetYConfig.buyProducts.productId", "name images sellingPrice")
      .populate("buyXGetYConfig.getProducts.productId", "name images sellingPrice")
      .populate("comboConfig.products.productId", "name images sellingPrice")
      .populate("freeProductConfig.productId", "name images sellingPrice");

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: "Offer not found",
      });
    }

    res.json({
      success: true,
      data: offer,
    });
  } catch (error) {
    console.error("Error fetching offer:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch offer",
      error: error.message,
    });
  }
};

exports.updateOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = offerPayload(req.body);
    const validationError = validateOfferPayload(payload);

    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const offer = await Offer.findById(id);
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: "Offer not found",
      });
    }

    // Check for duplicate coupon code
    if (payload.couponCode && payload.couponCode !== offer.couponCode) {
      const existingOffer = await Offer.findOne({
        couponCode: payload.couponCode,
        _id: { $ne: id },
      });

      if (existingOffer) {
        return res.status(400).json({
          success: false,
          message: "Coupon code already exists",
        });
      }
    }

    Object.assign(offer, payload);
    await offer.save();

    res.json({
      success: true,
      message: "Offer updated successfully",
      data: offer,
    });
  } catch (error) {
    console.error("Error updating offer:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update offer",
      error: error.message,
    });
  }
};

exports.deleteOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const offer = await Offer.findByIdAndDelete(id);

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: "Offer not found",
      });
    }

    res.json({
      success: true,
      message: "Offer deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting offer:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete offer",
      error: error.message,
    });
  }
};

exports.getActiveOffers = async (req, res) => {
  try {
    const now = new Date();
    const offers = await Offer.find({
      isActive: true,
      startDate: { $lte: now },
      $or: [{ endDate: { $gte: now } }, { endDate: null }],
    })
      .select("name description offerType requiresCoupon couponCode discountValue minCartValue startDate endDate")
      .sort({ priority: -1, createdAt: -1 });

    const validOffers = offers.filter(offer => offer.isValid());

    res.json({
      success: true,
      data: validOffers,
    });
  } catch (error) {
    console.error("Error fetching active offers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch offers",
      error: error.message,
    });
  }
};

exports.applyOffer = async (req, res) => {
  try {
    const userId = req.userId;
    const code = normalizeOfferCode(req.body.code || req.body.couponCode);

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Offer code is required",
      });
    }

    const [user, cart] = await Promise.all([
      User.findById(userId).select("zoneId"),
      Cart.findOne({ userId }).populate("items.productId"),
    ]);

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty",
      });
    }

    const totals = await calculateOrderTotals({
      subtotal: cart.totalAmount || 0,
      user,
      offerCode: code,
      cartItems: cart.items,
    });

    cart.offerId = totals.offer._id;
    cart.offerCode = totals.offer.couponCode || totals.offer.name;
    await cart.save();

    res.json({
      success: true,
      message: "Offer applied successfully",
      data: {
        offer: {
          id: totals.offer._id,
          name: totals.offer.name,
          code: totals.offer.couponCode,
          type: totals.offer.offerType,
          discountAmount: totals.discountAmount,
        },
        subtotal: totals.totalAmount,
        deliveryCharge: totals.deliveryCharge,
        platformFee: totals.platformFee,
        taxPercentage: totals.taxPercentage,
        taxAmount: totals.taxAmount,
        discountAmount: totals.discountAmount,
        freeProducts: totals.freeProducts || [],
        grandTotal: totals.grandTotal,
      },
    });
  } catch (error) {
    console.error("Error applying offer:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Failed to apply offer",
      error: error.message,
    });
  }
};

exports.removeOffer = async (req, res) => {
  try {
    const userId = req.userId;
    const cart = await Cart.findOne({ userId });

    if (!cart || !cart.offerId) {
      return res.status(400).json({
        success: false,
        message: "No offer applied to the cart",
      });
    }

    cart.offerId = null;
    cart.offerCode = null;
    await cart.save();

    res.json({
      success: true,
      message: "Offer removed successfully",
    });
  } catch (error) {
    console.error("Error removing offer:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove offer",
      error: error.message,
    });
  }
};

exports.validateOffer = async (req, res) => {
  try {
    const { code } = req.params;
    const userId = req.userId;

    const normalizedCode = normalizeOfferCode(code);
    if (!normalizedCode) {
      return res.status(400).json({
        success: false,
        message: "Offer code is required",
      });
    }

    const offer = await Offer.findOne({
      couponCode: normalizedCode,
      isActive: true,
    });

    if (!offer || !offer.isValid()) {
      return res.status(404).json({
        success: false,
        message: "Invalid or expired offer code",
      });
    }

    res.json({
      success: true,
      message: "Offer is valid",
      data: {
        id: offer._id,
        name: offer.name,
        description: offer.description,
        offerType: offer.offerType,
        discountValue: offer.discountValue,
        minCartValue: offer.minCartValue,
      },
    });
  } catch (error) {
    console.error("Error validating offer:", error);
    res.status(500).json({
      success: false,
      message: "Failed to validate offer",
      error: error.message,
    });
  }
};
