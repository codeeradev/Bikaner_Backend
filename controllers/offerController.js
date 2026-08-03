const Offer = require("../models/offers");
const Cart = require("../models/cart");
const User = require("../models/users");
const Product = require("../models/products");
const { calculateOrderTotals } = require("../utils/orderTotals");

const offerPayload = (body) => {
  const payload = {};
  const fields = [
    "name",
    "description",
    "offerType",
    "discountValue",
    "maxDiscountAmount",
    "bogoConfig",
    "applicableOn",
    "specificProducts",
    "minCartValue",
    "startDate",
    "endDate",
    "priority",
    "autoApply",
    "isActive",
  ];

  fields.forEach((field) => {
    if (body[field] !== undefined) payload[field] = body[field];
  });

  // Convert numeric fields
  if (payload.discountValue !== undefined) {
    payload.discountValue = Number(payload.discountValue);
  }

  if (payload.maxDiscountAmount !== undefined) {
    payload.maxDiscountAmount = Number(payload.maxDiscountAmount);
  }

  if (payload.minCartValue !== undefined) {
    payload.minCartValue = Number(payload.minCartValue);
  }

  if (payload.priority !== undefined) {
    payload.priority = Number(payload.priority);
    // Ensure priority is at least 1
    if (payload.priority < 1) {
      payload.priority = 1;
    }
  }

  // Handle BOGO config
  if (payload.bogoConfig) {
    if (payload.bogoConfig.buyQuantity !== undefined) {
      payload.bogoConfig.buyQuantity = Number(payload.bogoConfig.buyQuantity);
    }
    if (payload.bogoConfig.getQuantity !== undefined) {
      payload.bogoConfig.getQuantity = Number(payload.bogoConfig.getQuantity);
    }
  }

  return payload;
};

const validateOfferPayload = (payload, isCreate = false) => {
  // Required fields on create
  if (isCreate && !payload.name) return "Offer name is required";
  if (isCreate && !payload.offerType) return "Offer type is required";
  if (isCreate && payload.applicableOn === undefined) {
    return "Applicability is required";
  }
  if (isCreate && !payload.startDate) return "Start date is required";

  // Validate offer type
  const validOfferTypes = ["flat_discount", "percentage_discount", "bogo"];
  if (payload.offerType && !validOfferTypes.includes(payload.offerType)) {
    return `Offer type must be one of: ${validOfferTypes.join(", ")}`;
  }

  // Validate applicableOn
  const validApplicableOn = ["cart", "specific_products"];
  if (
    payload.applicableOn &&
    !validApplicableOn.includes(payload.applicableOn)
  ) {
    return `Applicable on must be one of: ${validApplicableOn.join(", ")}`;
  }

  // Validate specific products
  if (
    payload.applicableOn === "specific_products" &&
    (!payload.specificProducts || payload.specificProducts.length === 0)
  ) {
    return "At least one product must be specified when applicable on specific products";
  }

  // Validate discount value for flat/percentage discounts
  if (
    (payload.offerType === "flat_discount" ||
      payload.offerType === "percentage_discount") &&
    payload.discountValue !== undefined
  ) {
    if (!Number.isFinite(payload.discountValue) || payload.discountValue <= 0) {
      return "Discount value must be a positive number";
    }
  }

  // Validate percentage discount range
  if (
    payload.offerType === "percentage_discount" &&
    payload.discountValue !== undefined &&
    (payload.discountValue > 100 || payload.discountValue <= 0)
  ) {
    return "Percentage discount must be between 1 and 100";
  }

  // Validate minimum cart value
  if (
    payload.minCartValue !== undefined &&
    (!Number.isFinite(payload.minCartValue) || payload.minCartValue < 0)
  ) {
    return "Minimum cart value must be a non-negative number";
  }

  // Validate date range
  if (payload.startDate && payload.endDate) {
    const start = new Date(payload.startDate);
    const end = new Date(payload.endDate);
    if (end < start) {
      return "End date must be after start date";
    }
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
        { description: new RegExp(search, "i") },
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
      .populate("specificProducts", "name images sellingPrice");

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
    const offer = await Offer.findById(id).populate(
      "specificProducts",
      "name images sellingPrice",
    );

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

    if (payload.specificProducts?.length) {
      payload.specificProducts = [
        ...new Set(
          payload.specificProducts.map((item) => {
            if (typeof item === "string") return item;
            return item.id || item._id;
          }),
        ),
      ];
    }

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
    const userId = req.userId;
    const now = new Date();

    // Get all active offers
    const offers = await Offer.find({
      isActive: true,
      startDate: { $lte: now },
      $or: [{ endDate: { $gte: now } }, { endDate: null }],
    })
      .select(
        "name description offerType discountValue maxDiscountAmount applicableOn specificProducts minCartValue autoApply isActive startDate endDate priority",
      )
      .populate("specificProducts", "name images sellingPrice")
      .sort({ priority: -1, createdAt: -1 });

    // Get user's cart to check for specific products
    const cart = await Cart.findOne({ userId }).select("items.productId");

    const cartProductIds = cart
      ? cart.items.map((item) => item.productId.toString())
      : [];

    // Filter offers based on applicability
    const validOffers = offers.filter((offer) => {
      // Check if offer is valid
      if (!offer.isValid()) return false;

      // If offer is applicable on entire cart, include it
      if (offer.applicableOn === "cart") return true;

      // If offer is for specific products, check if any of those products are in cart
      if (offer.applicableOn === "specific_products") {
        const offerProductIds = offer.specificProducts.map((p) =>
          p._id.toString(),
        );
        const hasMatchingProduct = offerProductIds.some((productId) =>
          cartProductIds.includes(productId),
        );
        return hasMatchingProduct;
      }

      return false;
    });

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
    const { offerId } = req.body;

    if (!offerId) {
      return res.status(400).json({
        success: false,
        message: "Offer ID is required",
      });
    }

    const [user, cart, offer] = await Promise.all([
      User.findById(userId).select("zoneId"),
      Cart.findOne({ userId }).populate("items.productId"),
      Offer.findById(offerId),
    ]);

    if (!offer || !offer.isActive || !offer.isValid()) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired offer",
      });
    }

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty",
      });
    }

    const totals = await calculateOrderTotals({
      subtotal: cart.totalAmount || 0,
      user,
      offerId: offer._id,
      cartItems: cart.items,
    });

    if (offer.offerType === "bogo") {
      const buyQty = offer.bogoConfig?.buyQuantity || 1;
      const getQty = offer.bogoConfig?.getQuantity || 1;

      cart.items.forEach((cartItem) => {
        const productId = cartItem.productId?._id || cartItem.productId;

        const isApplicable = offer.specificProducts.some(
          (id) => id.toString() === productId.toString(),
        );

        if (!isApplicable) return;

        if (cartItem.quantity >= buyQty) {
          const freeQty = Math.floor(cartItem.quantity / buyQty) * getQty;

          // Store original quantity once
          if (!cartItem.originalQuantity) {
            cartItem.originalQuantity = cartItem.quantity;
          }

          cartItem.quantity = cartItem.originalQuantity + freeQty;
        }
      });
    }
    cart.markModified("items");
    // Store the applied offer ID in cart
    cart.offerId = totals.offer._id;
    await cart.save();

    res.json({
      success: true,
      message: "Offer applied successfully",
      data: {
        offer: {
          id: totals.offer._id,
          name: totals.offer.name,
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

    if (!cart) {
      return res.status(400).json({
        success: false,
        message: "Cart not found",
      });
    }

    if (cart.offerId) {
      const offer = await Offer.findById(cart.offerId);

      if (offer && offer.offerType === "bogo") {
        cart.items.forEach((item) => {
          if (item.originalQuantity) {
            item.quantity = item.originalQuantity;
            item.originalQuantity = undefined;
          }
        });
      }
    }

    // Clear offer fields
    cart.offerId = null;
    cart.couponId = null;
    await cart.save();

    res.json({
      success: true,
      message: "Offer removed successfully.",
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
    const { id } = req.params;
    const userId = req.userId;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Offer ID is required",
      });
    }

    const offer = await Offer.findById(id);

    if (!offer || !offer.isActive || !offer.isValid()) {
      return res.status(404).json({
        success: false,
        message: "Invalid or expired offer",
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
