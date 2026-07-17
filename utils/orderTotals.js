const Coupon = require("../models/coupons");
const Settings = require("../models/settings");
const Zone = require("../models/zones");

const normalizeCouponCode = (code) => String(code || "").trim().toUpperCase();

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

const getActiveCoupon = async (code) => {
  const normalizedCode = normalizeCouponCode(code);
  if (!normalizedCode) return null;

  return Coupon.findOne({ code: normalizedCode, isActive: true });
};

const calculateCouponDiscount = (coupon, subtotal) => {
  if (!coupon) return 0;

  const orderSubtotal = Number(subtotal || 0);

  if (orderSubtotal < Number(coupon.minOrderAmount || 0)) {
    const error = new Error(
      `Coupon requires a minimum order amount of ₹${coupon.minOrderAmount}`,
    );
    error.statusCode = 400;
    throw error;
  }

  if (coupon.type === "percentage") {
    return Math.min(
      orderSubtotal,
      Math.round((orderSubtotal * Number(coupon.value || 0)) / 100),
    );
  }

  return Math.min(orderSubtotal, Number(coupon.value || 0));
};

const calculateOrderTotals = async ({ subtotal, user, couponCode }) => {
  const settings = await getSettings();
  const totalAmount = Number(subtotal || 0);
  const deliveryCharge = await getDeliveryCharge(user, settings);
  const platformFeePercentage = Number(settings?.platformFee || 0);
  const platformFee = Math.round((totalAmount * platformFeePercentage) / 100);
  const taxPercentage = Number(settings?.globalTax || 0);
  const coupon = couponCode ? await getActiveCoupon(couponCode) : null;

  if (couponCode && !coupon) {
    const error = new Error("Invalid or inactive coupon code");
    error.statusCode = 400;
    throw error;
  }

  const discountAmount = calculateCouponDiscount(coupon, totalAmount);
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
    coupon,
    discountAmount,
    grandTotal,
  };
};

module.exports = {
  normalizeCouponCode,
  calculateCouponDiscount,
  calculateOrderTotals,
};
