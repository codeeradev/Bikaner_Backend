const Settings = require("../models/settings");

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
    if (maintenanceMode !== undefined) settings.maintenanceMode = maintenanceMode;
    if (maintenanceMessage !== undefined) settings.maintenanceMessage = maintenanceMessage;

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
      "siteTitle siteLogo siteDescription contactEmail contactPhone range termsAndConditions privacyPolicy aboutUs refundPolicy shippingPolicy facebookUrl instagramUrl twitterUrl linkedinUrl"
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
