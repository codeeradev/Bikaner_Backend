const Offer = require("../models/offers");
const Settings = require("../models/settings");
const Zone = require("../models/zones");

const normalizeOfferCode = (code) => String(code || "").trim().toUpperCase();

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

  let discountAmount = 0;
  const freeProducts = [];

  switch (offer.offerType) {
    case "flat_discount":
      discountAmount = Math.min(orderSubtotal, Number(offer.discountValue || 0));
      break;

    case "percentage_discount":
      discountAmount = Math.round(
        (orderSubtotal * Number(offer.discountValue || 0)) / 100,
      );
      if (offer.maxDiscountAmount && discountAmount > offer.maxDiscountAmount) {
        discountAmount = offer.maxDiscountAmount;
      }
      discountAmount = Math.min(orderSubtotal, discountAmount);
      break;

    case "free_product":
      if (offer.freeProductConfig && offer.freeProductConfig.productId) {
        freeProducts.push({
          productId: offer.freeProductConfig.productId,
          quantity: offer.freeProductConfig.quantity || 1,
        });
      }
      break;

    case "bogo":
      // BOGO logic would be more complex and depend on cart items
      // Simplified version here
      if (offer.bogoConfig && offer.bogoConfig.applyOn === "free_product") {
        if (offer.bogoConfig.freeProductId) {
          freeProducts.push({
            productId: offer.bogoConfig.freeProductId,
            quantity: offer.bogoConfig.getQuantity || 1,
          });
        }
      }
      break;

    case "buy_x_get_y":
      // Buy X Get Y logic
      if (offer.buyXGetYConfig && offer.buyXGetYConfig.getProducts) {
        offer.buyXGetYConfig.getProducts.forEach((getProduct) => {
          if (getProduct.discountPercentage === 100) {
            freeProducts.push({
              productId: getProduct.productId,
              quantity: getProduct.quantity || 1,
            });
          }
        });
      }
      break;

    case "combo":
      // Combo discount calculation
      if (offer.comboConfig && offer.comboConfig.comboPrice) {
        const comboOriginalPrice = cartItems
          .filter((item) =>
            offer.comboConfig.products.some(
              (p) => p.productId.toString() === item.productId._id.toString(),
            ),
          )
          .reduce((sum, item) => sum + item.price * item.quantity, 0);

        if (comboOriginalPrice > offer.comboConfig.comboPrice) {
          discountAmount = comboOriginalPrice - offer.comboConfig.comboPrice;
        }
      }
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

const calculateOrderTotals = async ({ subtotal, user, couponCode, offerCode, cartItems = [] }) => {
  const settings = await getSettings();
  const totalAmount = Number(subtotal || 0);
  const deliveryCharge = await getDeliveryCharge(user, settings);
  const platformFeePercentage = Number(settings?.platformFee || 0);
  const platformFee = Math.round((totalAmount * platformFeePercentage) / 100);
  const taxPercentage = Number(settings?.globalTax || 0);
  
  // Support both old couponCode and new offerCode parameters
  const code = offerCode || couponCode;
  const offer = code ? await getActiveOffer(code) : null;

  if (code && !offer) {
    const error = new Error("Invalid or inactive offer code");
    error.statusCode = 400;
    throw error;
  }

  const { discountAmount, freeProducts } = calculateOfferDiscount(
    offer,
    totalAmount,
    cartItems,
  );
  
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
};
