const Settings = require("../models/settings");

const parseNumberSetting = (value, fieldLabel, { min = 0, max } = {}) => {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < min) {
    return {
      error: `${fieldLabel} must be a number greater than or equal to ${min}`,
    };
  }

  if (max !== undefined && parsedValue > max) {
    return {
      error: `${fieldLabel} must be less than or equal to ${max}`,
    };
  }

  return { value: parsedValue };
};

const parseBooleanSetting = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  return Boolean(value);
};

/**
 * Get site settings
 */
exports.getSettings = async (req, res) => {
  try {
    let settings = await Settings.findById("site-settings");

    // Create default settings if none exist
    if (!settings) {
      settings = new Settings({ _id: "site-settings" });
      await settings.save();
    }

    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch settings",
      error: error.message,
    });
  }
};

/**
 * Update site settings (Admin only)
 */
exports.updateSettings = async (req, res) => {
  try {
    const {
      siteTitle,
      siteLogo,
      siteDescription,
      contactEmail,
      contactPhone,
      range,
      termsAndConditions,
      privacyPolicy,
      aboutUs,
      refundPolicy,
      shippingPolicy,
      facebookUrl,
      instagramUrl,
      twitterUrl,
      linkedinUrl,
      maintenanceMode,
      maintenanceMessage,
      razorpayKeyId,
      razorpayKeySecret,
      razorpayWebhookSecret,
      globalDeliveryCharges,
      platformFee,
      globalTax,
    } = req.body;

    let settings = await Settings.findById("site-settings");

    // Create if doesn't exist
    if (!settings) {
      settings = new Settings({ _id: "site-settings" });
    }

    // Update fields
    if (siteTitle !== undefined) settings.siteTitle = siteTitle;
    if (siteLogo !== undefined) settings.siteLogo = siteLogo;
    if (siteDescription !== undefined) settings.siteDescription = siteDescription;
    if (contactEmail !== undefined) settings.contactEmail = contactEmail;
    if (contactPhone !== undefined) settings.contactPhone = contactPhone;
    if (range !== undefined) {
      const parsedRange = Number(range);

      if (
        !Number.isInteger(parsedRange) ||
        parsedRange < 100 ||
        parsedRange > 100000
      ) {
        return res.status(400).json({
          success: false,
          message: "Delivery radius must be a whole number between 100 and 100000 meters",
        });
      }

      settings.range = parsedRange;
    }
    if (termsAndConditions !== undefined) settings.termsAndConditions = termsAndConditions;
    if (privacyPolicy !== undefined) settings.privacyPolicy = privacyPolicy;
    if (aboutUs !== undefined) settings.aboutUs = aboutUs;
    if (refundPolicy !== undefined) settings.refundPolicy = refundPolicy;
    if (shippingPolicy !== undefined) settings.shippingPolicy = shippingPolicy;
    if (facebookUrl !== undefined) settings.facebookUrl = facebookUrl;
    if (instagramUrl !== undefined) settings.instagramUrl = instagramUrl;
    if (twitterUrl !== undefined) settings.twitterUrl = twitterUrl;
    if (linkedinUrl !== undefined) settings.linkedinUrl = linkedinUrl;
    if (maintenanceMode !== undefined) {
      settings.maintenanceMode = parseBooleanSetting(maintenanceMode);
    }
    if (maintenanceMessage !== undefined) settings.maintenanceMessage = maintenanceMessage;
    if (razorpayKeyId !== undefined) settings.razorpayKeyId = razorpayKeyId;
    if (razorpayKeySecret !== undefined) settings.razorpayKeySecret = razorpayKeySecret;
    if (razorpayWebhookSecret !== undefined) settings.razorpayWebhookSecret = razorpayWebhookSecret;
    if (globalDeliveryCharges !== undefined) {
      const result = parseNumberSetting(
        globalDeliveryCharges,
        "Global delivery charges",
      );

      if (result.error) {
        return res.status(400).json({ success: false, message: result.error });
      }

      settings.globalDeliveryCharges = result.value;
    }
    if (platformFee !== undefined) {
      const result = parseNumberSetting(platformFee, "Platform fee", {
        min: 0,
        max: 100,
      });

      if (result.error) {
        return res.status(400).json({ success: false, message: result.error });
      }

      settings.platformFee = result.value;
    }
    if (globalTax !== undefined) {
      const result = parseNumberSetting(globalTax, "Global tax", {
        min: 0,
        max: 100,
      });

      if (result.error) {
        return res.status(400).json({ success: false, message: result.error });
      }

      settings.globalTax = result.value;
    }

    // Handle logo upload
    if (req.file) {
      settings.siteLogo = `/uploads/${req.file.filename}`;
    }

    await settings.save();

    res.json({
      success: true,
      message: "Settings updated successfully",
      data: settings,
    });
  } catch (error) {
    console.error("Error updating settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update settings",
      error: error.message,
    });
  }
};

/**
 * Get public settings (for app users - no auth required)
 */
exports.getPublicSettings = async (req, res) => {
  try {
    let settings = await Settings.findById("site-settings").select(
      "siteTitle siteLogo siteDescription contactEmail contactPhone range termsAndConditions privacyPolicy aboutUs refundPolicy shippingPolicy facebookUrl instagramUrl twitterUrl linkedinUrl maintenanceMode maintenanceMessage globalDeliveryCharges platformFee globalTax"
    );

    // Create default settings if none exist
    if (!settings) {
      settings = new Settings({ _id: "site-settings" });
      await settings.save();
    }

    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error("Error fetching public settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch settings",
      error: error.message,
    });
  }
};
