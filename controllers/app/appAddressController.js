const Address = require("../../models/address");
const Settings = require("../../models/settings");
const Zone = require("../../models/zones");
const User = require("../../models/users");
const checkUserZone = require("../../utils/zoneChecker");
const haversine = require("haversine-distance");

exports.updateLocation = async (req, res) => {
  try {
    const id = req.userId || req.user?._id || req.user?.id;
    const { latitude, longitude } = req.body;

    if (latitude === undefined || longitude === undefined || !id) {
      return res.status(400).json({ message: "Missing userId or coordinates" });
    }

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ message: "Invalid coordinates" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      {
        $set: {
          lat,
          lng,
        },
      },
      { new: true },
    );

    if (!updatedUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const settings = await Settings.findById("site-settings");
    const zones = await Zone.find({ isActive: true });

    const result = checkUserZone(updatedUser, zones, settings);

    if (!result) {
      return res.status(400).json({
        success: false,
        message: "Service not available in your area.",
      });
    }

    updatedUser.cityId = result.zone.cityId;
    updatedUser.zoneId = result.zone._id;
    await updatedUser.save();

    // Get all user addresses
    const addresses = await Address.find({ userId: id });
    if (addresses.length > 0) {
      // Compute nearest one using haversine distance
      let nearestAddress = null;
      let shortestDistance = Infinity;

      addresses.forEach((addr) => {
        if (addr.lat && addr.lng) {
          const distance = haversine(
            { lat, lon: lng },
            { lat: addr.lat, lon: addr.lng },
          );
          if (distance < shortestDistance) {
            shortestDistance = distance;
            nearestAddress = addr;
          }
        }
      });

      if (nearestAddress) {
        await Address.updateMany({ userId: id }, { $set: { isDefault: false } });
        await Address.findByIdAndUpdate(
          nearestAddress._id,
          { $set: { isDefault: true } },
          { new: true },
        );
      }
    }

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "Location updated successfully!",
      location: {
        lat: updatedUser.lat,
        lng: updatedUser.lng,
      },
      zone: result.zone,
      cityId: updatedUser.cityId,
      zoneId: updatedUser.zoneId,
    });
  } catch (error) {
    console.error("❌ Location update error:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};
/**
 * Get all addresses for current user
 */
exports.getAddresses = async (req, res) => {
  try {
    const userId = req.userId;

    const addresses = await Address.find({ userId }).sort({
      isDefault: -1,
      createdAt: -1,
    });

    res.json({
      success: true,
      data: addresses,
    });
  } catch (error) {
    console.error("Error fetching addresses:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch addresses",
      error: error.message,
    });
  }
};

/**
 * Get single address by ID
 */
exports.getAddressById = async (req, res) => {
  try {
    const userId = req.userId;
    const { addressId } = req.params;

    const address = await Address.findOne({ _id: addressId, userId });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    res.json({
      success: true,
      data: address,
    });
  } catch (error) {
    console.error("Error fetching address:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch address",
      error: error.message,
    });
  }
};

/**
 * Create new address
 */
exports.createAddress = async (req, res) => {
  try {
    const userId = req.userId;
    const {
      name,
      mobile,
      alternateNumber,
      address,
      house_No,
      floor,
      landmark,
      city,
      lat,
      lng,
      addressType,
      isDefault,
    } = req.body;

    // Validation
    if (!address || !lat || !lng) {
      return res.status(400).json({
        success: false,
        message: "Address, latitude, and longitude are required",
      });
    }

    // If this is set as default, unset other defaults
    if (isDefault) {
      await Address.updateMany({ userId }, { isDefault: false });
    }

    // Create address
    const newAddress = new Address({
      userId,
      name,
      mobile,
      alternateNumber,
      address,
      house_No,
      floor,
      landmark,
      city,
      lat,
      lng,
      addressType: addressType || "home",
      isDefault: isDefault || false,
    });

    await newAddress.save();

    res.status(201).json({
      success: true,
      message: "Address created successfully",
      data: newAddress,
    });
  } catch (error) {
    console.error("Error creating address:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create address",
      error: error.message,
    });
  }
};

/**
 * Update address
 */
exports.updateAddress = async (req, res) => {
  try {
    const userId = req.userId;
    const { addressId } = req.params;
    const {
      name,
      mobile,
      alternateNumber,
      address,
      house_No,
      floor,
      landmark,
      city,
      lat,
      lng,
      addressType,
      isDefault,
    } = req.body;

    // Find address
    const existingAddress = await Address.findOne({ _id: addressId, userId });

    if (!existingAddress) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // If setting as default, unset other defaults
    if (isDefault && !existingAddress.isDefault) {
      await Address.updateMany({ userId }, { isDefault: false });
    }

    // Update fields
    if (name !== undefined) existingAddress.name = name;
    if (mobile !== undefined) existingAddress.mobile = mobile;
    if (alternateNumber !== undefined)
      existingAddress.alternateNumber = alternateNumber;
    if (address !== undefined) existingAddress.address = address;
    if (house_No !== undefined) existingAddress.house_No = house_No;
    if (floor !== undefined) existingAddress.floor = floor;
    if (landmark !== undefined) existingAddress.landmark = landmark;
    if (city !== undefined) existingAddress.city = city;
    if (lat !== undefined) existingAddress.lat = lat;
    if (lng !== undefined) existingAddress.lng = lng;
    if (addressType !== undefined) existingAddress.addressType = addressType;
    if (isDefault !== undefined) existingAddress.isDefault = isDefault;

    await existingAddress.save();

    res.json({
      success: true,
      message: "Address updated successfully",
      data: existingAddress,
    });
  } catch (error) {
    console.error("Error updating address:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update address",
      error: error.message,
    });
  }
};

/**
 * Delete address
 */
exports.deleteAddress = async (req, res) => {
  try {
    const userId = req.userId;
    const { addressId } = req.params;

    const address = await Address.findOneAndDelete({ _id: addressId, userId });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // If deleted address was default, set another as default
    if (address.isDefault) {
      const nextAddress = await Address.findOne({ userId }).sort({
        createdAt: -1,
      });
      if (nextAddress) {
        nextAddress.isDefault = true;
        await nextAddress.save();
      }
    }

    res.json({
      success: true,
      message: "Address deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting address:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete address",
      error: error.message,
    });
  }
};

/**
 * Set address as default
 */
exports.setDefaultAddress = async (req, res) => {
  try {
    const userId = req.userId;
    const { addressId } = req.params;

    // Find address
    const address = await Address.findOne({ _id: addressId, userId });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // Unset all other defaults
    await Address.updateMany({ userId }, { isDefault: false });

    // Set this as default
    address.isDefault = true;
    await address.save();

    res.json({
      success: true,
      message: "Default address updated successfully",
      data: address,
    });
  } catch (error) {
    console.error("Error setting default address:", error);
    res.status(500).json({
      success: false,
      message: "Failed to set default address",
      error: error.message,
    });
  }
};
