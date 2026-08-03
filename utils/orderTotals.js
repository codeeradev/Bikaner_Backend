const Offer = require("../models/offers");
const Settings = require("../models/settings");
const Zone = require("../models/zones");

const normalizeOfferCode = (code) =>
  String(code || "")
    .trim()
    .toUpperCase();

// Legacy support
const normalizeCouponCode = normalizeOfferCode;

const getSettings = async () => {
  let settings = await Settings.findById("site-settings").select(
    "globalDeliveryCharges platformFee globalTax",
  );

  if (!settings) {
    settings = new Settings({ _id: "site-settings" });
    await settings.save();
  }

  return settings;
};

const getDeliveryCharge = async (user, settings) => {
  let deliveryCharge = Number(settings?.globalDeliveryCharges || 0);

  if (user?.zoneId) {
    const zone = await Zone.findById(user.zoneId).select("deliveryCharge");

    if (zone?.deliveryCharge != null) {
      deliveryCharge = Number(zone.deliveryCharge || 0);
    }
  }

  return deliveryCharge;
};

const getActiveOffer = async (code) => {
  const normalizedCode = normalizeOfferCode(code);
  if (!normalizedCode) return null;

  const now = new Date();
  const offer = await Offer.findOne({
    couponCode: normalizedCode,
    isActive: true,
    startDate: { $lte: now },
    $or: [{ endDate: { $gte: now } }, { endDate: null }],
  });

  if (offer && !offer.isValid()) return null;

  return offer;
};

// Legacy support for old coupon system
const getActiveCoupon = getActiveOffer;

const calculateOfferDiscount = (offer, subtotal, cartItems = []) => {
  if (!offer) return { discountAmount: 0, freeProducts: [] };

  const orderSubtotal = Number(subtotal || 0);

  // Check minimum cart value
  if (orderSubtotal < Number(offer.minCartValue || 0)) {
    const error = new Error(
      `Offer requires a minimum cart value of ₹${offer.minCartValue}`,
    );
    error.statusCode = 400;
    throw error;
  }

  // Check if offer is applicable to specific products
  let applicableAmount = orderSubtotal;
  let applicableItems = cartItems;

  if (
    offer.applicableOn === "specific_products" &&
    offer.specificProducts &&
    offer.specificProducts.length > 0
  ) {
    // Filter only applicable products
    applicableItems = cartItems.filter((item) => {
      const productId = item.productId?._id || item.productId;
      return offer.specificProducts.some(
        (pid) => pid.toString() === productId.toString(),
      );
    });

    // Calculate subtotal only for specific products
    // Use originalQuantity if it exists (BOGO applied), otherwise use quantity
    applicableAmount = applicableItems.reduce((sum, item) => {
      const price = Number(item.price || 0);
      const quantityToCharge = item.originalQuantity !== null && item.originalQuantity !== undefined 
        ? Number(item.originalQuantity) 
        : Number(item.quantity || 0);
      return sum + price * quantityToCharge;
    }, 0);

    // If no applicable products in cart, offer cannot be applied
    if (applicableAmount === 0) {
      const error = new Error(
        "This offer is only applicable to specific products not currently in your cart",
      );
      error.statusCode = 400;
      throw error;
    }
  }

  let discountAmount = 0;
  let freeProducts = [];

  switch (offer.offerType) {
    case "flat_discount":
      // Simple flat discount - deduct the discount value from applicable amount
      discountAmount = Math.min(
        applicableAmount,
        Number(offer.discountValue || 0),
      );
      break;

    case "percentage_discount":
      // Calculate percentage discount on applicable amount
      discountAmount = Math.round(
        (applicableAmount * Number(offer.discountValue || 0)) / 100,
      );
      // Apply max discount cap if specified
      if (offer.maxDiscountAmount && discountAmount > offer.maxDiscountAmount) {
        discountAmount = offer.maxDiscountAmount;
      }
      // Ensure discount doesn't exceed applicable amount
      discountAmount = Math.min(applicableAmount, discountAmount);
      break;

    case "bogo":
      {
        const buyQty = offer.bogoConfig?.buyQuantity || 1;
        const getQty = offer.bogoConfig?.getQuantity || 1;

        applicableItems.forEach((item) => {
          const productId = item.productId?._id || item.productId;
          const itemQuantity = Number(item.quantity || 0);

          // Offer only once
          if (itemQuantity >= buyQty) {
            freeProducts.push({
              productId,
              quantity: getQty,
              originalItemQuantity: itemQuantity,
            });
          }
        });

        discountAmount = 0;
        break;
      }

      // No monetary discount for BOGO, items are added as free
      discountAmount = 0;
      break;

    default:
      break;
  }

  return { discountAmount, freeProducts };
};

// Legacy support
const calculateCouponDiscount = (coupon, subtotal) => {
  const result = calculateOfferDiscount(coupon, subtotal);
  return result.discountAmount;
};

// Function to find and return the best auto-apply offer (used only in cart operations)
const findBestAutoApplyOffer = async (subtotal, cartItems = []) => {
  const totalAmount = Number(subtotal || 0);
  const now = new Date();

  const autoApplyOffers = await Offer.find({
    isActive: true,
    autoApply: true,
    requiresCoupon: false,
    priority: { $gte: 1 },
    startDate: { $lte: now },
    $or: [{ endDate: { $gte: now } }, { endDate: null }],
  })
    .sort({ priority: -1 })
    .limit(10);

  let bestOffer = null;
  let maxDiscount = 0;

  for (const autoOffer of autoApplyOffers) {
    if (!autoOffer.isValid()) continue;

    if (totalAmount < Number(autoOffer.minCartValue || 0)) continue;

    try {
      const { discountAmount } = calculateOfferDiscount(
        autoOffer,
        totalAmount,
        cartItems,
      );

      if (discountAmount > maxDiscount) {
        maxDiscount = discountAmount;
        bestOffer = autoOffer;
      }
    } catch (error) {
      continue;
    }
  }

  return bestOffer;
};

const calculateOrderTotals = async ({
  subtotal,
  user,
  couponCode,
  offerCode,
  cartItems = [],
  offerId = null,
}) => {
  const settings = await getSettings();
  const totalAmount = Number(subtotal || 0);
  const deliveryCharge = await getDeliveryCharge(user, settings);
  const platformFeePercentage = Number(settings?.platformFee || 0);
  const platformFee = Math.round((totalAmount * platformFeePercentage) / 100);
  const taxPercentage = Number(settings?.globalTax || 0);

  // Support both old couponCode and new offerCode parameters, OR use offerId
  let offer = null;

  if (offerId) {
    // If offerId is provided, fetch that specific offer (from cart)
    offer = await Offer.findById(offerId);
    if (offer && !offer.isValid()) {
      offer = null; // Clear if invalid
    }
  } else {
    const code = offerCode || couponCode;
    if (code) {
      // User provided a coupon code - validate and use it
      offer = await getActiveOffer(code);
      if (!offer) {
        const error = new Error("Invalid or inactive offer code");
        error.statusCode = 400;
        throw error;
      }
    }
    // If no offerId and no code, DO NOT auto-apply anything
  }

  const { discountAmount, freeProducts } = offer
    ? calculateOfferDiscount(offer, totalAmount, cartItems)
    : { discountAmount: 0, freeProducts: [] };

  const taxableAmount = Math.max(totalAmount - discountAmount, 0);
  const taxAmount =
    taxPercentage > 0
      ? Math.round(taxableAmount - taxableAmount / (1 + taxPercentage / 100))
      : 0;
  const grandTotal = taxableAmount + deliveryCharge + platformFee;

  return {
    totalAmount,
    deliveryCharge,
    platformFee,
    taxPercentage,
    taxAmount,
    offer,
    coupon: offer, // Legacy support
    discountAmount,
    freeProducts,
    grandTotal,
  };
};

module.exports = {
  normalizeOfferCode,
  normalizeCouponCode, // Legacy support
  calculateOfferDiscount,
  calculateCouponDiscount, // Legacy support
  calculateOrderTotals,
  findBestAutoApplyOffer, // For cart operations only
};
