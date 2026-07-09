const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    // Site Information
    siteTitle: {
      type: String,
      default: "Bikaner Biscuit",
    },
    siteLogo: {
      type: String,
      default: "",
    },
    siteDescription: {
      type: String,
      default: "Complete franchise management solution",
    },
    contactEmail: {
      type: String,
      default: "support@bikanerbiscuit.com",
    },
    contactPhone: {
      type: String,
      default: "",
    },
    
    // Legal Documents
    termsAndConditions: {
      type: String,
      default: "",
    },
    privacyPolicy: {
      type: String,
      default: "",
    },
    aboutUs: {
      type: String,
      default: "",
    },
    refundPolicy: {
      type: String,
      default: "",
    },
    shippingPolicy: {
      type: String,
      default: "",
    },
    
    // Social Media Links
    facebookUrl: {
      type: String,
      default: "",
    },
    instagramUrl: {
      type: String,
      default: "",
    },
    twitterUrl: {
      type: String,
      default: "",
    },
    linkedinUrl: {
      type: String,
      default: "",
    },
    
    // App Settings
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    maintenanceMessage: {
      type: String,
      default: "We are currently under maintenance. Please check back soon.",
    },
    
    // Razorpay Payment Gateway Settings
    razorpayKeyId: {
      type: String,
      default: "",
    },
    razorpayKeySecret: {
      type: String,
      default: "",
    },
    razorpayWebhookSecret: {
      type: String,
      default: "",
    },
    
    // Single document pattern - only one settings document exists
    _id: {
      type: String,
      default: "site-settings",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("settings", settingsSchema);
