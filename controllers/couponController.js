const Coupon = require("../models/coupons");
const Cart = require("../models/cart");
const User = require("../models/users");
const {
  calculateOrderTotals,
  normalizeCouponCode,
} = require("../utils/orderTotals");

const couponPayload = (body) => {
  const payload = {};
  const fields = [
    "code",
    "type",
    "value",
    "minOrderAmount",
    "description",
    "isActive",
  ];

  fields.forEach((field) => {
    if (body[field] !== undefined) payload[field] = body[field];
  });

  if (payload.code !== undefined) payload.code = normalizeCouponCode(payload.code);
  if (payload.value !== undefined) payload.value = Number(payload.value);
  if (payload.minOrderAmount !== undefined) {
    payload.minOrderAmount = Number(payload.minOrderAmount);
  }

  return payload;
};

const validateCouponPayload = (payload, isCreate = false) => {
  if (isCreate && !payload.code) return "Coupon code is required";
  if (isCreate && !payload.type) return "Coupon type is required";
  if (isCreate && payload.value === undefined) return "Coupon value is required";

  if (payload.type !== undefined && !["percentage", "flat"].includes(payload.type)) {
    return "Coupon type must be percentage or flat";
  }

  if (payload.value !== undefined && (!Number.isFinite(payload.value) || payload.value < 0)) {
    return "Coupon value must be a positive number";
  }

  if (
    payload.type === "percentage" &&
    payload.value !== undefined &&
    payload.value > 100
  ) {
    return "Percentage coupon value cannot exceed 100";
  }

  if (
    payload.minOrderAmount !== undefined &&
    (!Number.isFinite(payload.minOrderAmount) || payload.minOrderAmount < 0)
  ) {
    return "Minimum order amount must be a positive number";
  }

  return null;
};

exports.createCoupon = async (req, res) => {
  try {
    const payload = couponPayload(req.body);
    const validationError = validateCouponPayload(payload, true);

    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const existingCoupon = await Coupon.findOne({ code: payload.code });
    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: "Coupon code already exists",
      });
    }

    const coupon = await Coupon.create(payload);

    res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      data: coupon,
    });
  } catch (error) {
    console.error("Error creating coupon:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create coupon",
      error: error.message,
    });
  }
};

exports.getCoupons = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, isActive } = req.query;
    const filter = {};

    if (search) filter.code = new RegExp(search, "i");
    if (isActive !== undefined) filter.isActive = isActive === "true";

    const parsedPage = parseInt(page);
    const parsedLimit = parseInt(limit);
    const skip = (parsedPage - 1) * parsedLimit;

    const coupons = await Coupon.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit);
    const total = await Coupon.countDocuments(filter);

    res.json({
      success: true,
      data: coupons,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        pages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (error) {
    console.error("Error fetching coupons:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch coupons",
      error: error.message,
    });
  }
};

exports.updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = couponPayload(req.body);
    const validationError = validateCouponPayload(payload);

    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    if (payload.code && payload.code !== coupon.code) {
      const existingCoupon = await Coupon.findOne({
        code: payload.code,
        _id: { $ne: id },
      });

      if (existingCoupon) {
        return res.status(400).json({
          success: false,
          message: "Coupon code already exists",
        });
      }
    }

    Object.assign(coupon, payload);
    await coupon.save();

    res.json({
      success: true,
      message: "Coupon updated successfully",
      data: coupon,
    });
  } catch (error) {
    console.error("Error updating coupon:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update coupon",
      error: error.message,
    });
  }
};

exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findByIdAndDelete(id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    res.json({
      success: true,
      message: "Coupon deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting coupon:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete coupon",
      error: error.message,
    });
  }
};

exports.getActiveCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find({ isActive: true })
      .select("code type value minOrderAmount description")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: coupons,
    });
  } catch (error) {
    console.error("Error fetching active coupons:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch coupons",
      error: error.message,
    });
  }
};

exports.applyCoupon = async (req, res) => {
  try {
    const userId = req.userId;
    const code = normalizeCouponCode(req.body.code || req.body.couponCode);

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Coupon code is required",
      });
    }

    const [user, cart] = await Promise.all([
      User.findById(userId).select("zoneId"),
      Cart.findOne({ userId }),
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
      couponCode: code,
    });

    res.json({
      success: true,
      message: "Coupon applied successfully",
      data: {
        coupon: {
          id: totals.coupon._id,
          code: totals.coupon.code,
          type: totals.coupon.type,
          value: totals.coupon.value,
          discountAmount: totals.discountAmount,
        },
        subtotal: totals.totalAmount,
        deliveryCharge: totals.deliveryCharge,
        platformFee: totals.platformFee,
        taxPercentage: totals.taxPercentage,
        taxAmount: totals.taxAmount,
        discountAmount: totals.discountAmount,
        grandTotal: totals.grandTotal,
      },
    });
  } catch (error) {
    console.error("Error applying coupon:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Failed to apply coupon",
      error: error.message,
    });
  }
};
