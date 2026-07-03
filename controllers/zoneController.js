const Zone = require("../models/zones");

// Get all zones
exports.getAllZones = async (req, res) => {
  try {
    const { isActive, page = 1, limit = 10 } = req.query;
    
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const zones = await Zone.find(filter)
      .sort({ name: 1 })
      .populate("cityId", "name")
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Zone.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: zones,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching zones",
      error: error.message
    });
  }
};

// Get zones by city (deprecated but kept for compatibility)
exports.getActiveZones = async (req, res) => {
  try {
    const { isActive } = req.query;
    
    const filter = {};
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const zones = await Zone.find(filter).sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: zones,
      total: zones.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching zones",
      error: error.message
    });
  }
};

// Create new zone
exports.createZone = async (req, res) => {
  try {
    const { 
      name, 
      description,
      deliveryCharge, 
      minimumOrderAmount, 
      estimatedDeliveryTime, 
      isActive,
      lat,
      lng,
      cityId
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Zone name is required"
      });
    }

    // Check for duplicate zone name
    const existingZone = await Zone.findOne({ 
      name: new RegExp(`^${name}$`, 'i') 
    });
    
    if (existingZone) {
      return res.status(400).json({
        success: false,
        message: "Zone with this name already exists"
      });
    }

    const zone = new Zone({
      name,
      description,
      deliveryCharge,
      minimumOrderAmount,
      estimatedDeliveryTime,
      isActive,
      lat,
      lng,
      cityId
    });

    await zone.save();

    res.status(201).json({
      success: true,
      message: "Zone created successfully",
      data: zone
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating zone",
      error: error.message
    });
  }
};

// Update zone
exports.updateZone = async (req, res) => {
  try {
    const { 
      name, 
      description,
      deliveryCharge, 
      minimumOrderAmount, 
      estimatedDeliveryTime, 
      isActive,
      lat,
      lng,
      cityId
    } = req.body;

    const zone = await Zone.findById(req.params.id);

    if (!zone) {
      return res.status(404).json({
        success: false,
        message: "Zone not found"
      });
    }

    // Check for duplicate zone name if name is being changed
    if (name !== undefined && name !== zone.name) {
      const existingZone = await Zone.findOne({ 
        name: new RegExp(`^${name}$`, 'i'),
        _id: { $ne: req.params.id }
      });
      
      if (existingZone) {
        return res.status(400).json({
          success: false,
          message: "Zone with this name already exists"
        });
      }
      
      zone.name = name;
    }

    if (description !== undefined) zone.description = description;
    if (deliveryCharge !== undefined) zone.deliveryCharge = deliveryCharge;
    if (minimumOrderAmount !== undefined) zone.minimumOrderAmount = minimumOrderAmount;
    if (estimatedDeliveryTime !== undefined) zone.estimatedDeliveryTime = estimatedDeliveryTime;
    if (isActive !== undefined) zone.isActive = isActive;
    if (lat !== undefined) zone.lat = lat;
    if (lng !== undefined) zone.lng = lng;
    if (cityId !== undefined) zone.cityId = cityId;

    await zone.save();

    res.status(200).json({
      success: true,
      message: "Zone updated successfully",
      data: zone
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating zone",
      error: error.message
    });
  }
};

// Delete zone
exports.deleteZone = async (req, res) => {
  try {
    const zone = await Zone.findByIdAndDelete(req.params.id);

    if (!zone) {
      return res.status(404).json({
        success: false,
        message: "Zone not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Zone deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting zone",
      error: error.message
    });
  }
};

// Toggle zone status
exports.toggleZoneStatus = async (req, res) => {
  try {
    const zone = await Zone.findById(req.params.id);

    if (!zone) {
      return res.status(404).json({
        success: false,
        message: "Zone not found"
      });
    }

    zone.isActive = !zone.isActive;
    await zone.save();

    res.status(200).json({
      success: true,
      message: `Zone ${zone.isActive ? 'activated' : 'deactivated'} successfully`,
      data: zone
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error toggling zone status",
      error: error.message
    });
  }
};

exports.updateLocation = async (req, res) => {
  try {
    const { id } = req.user; // get from token or body
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude || !id) {
      return res.status(400).json({ message: "Missing userId or coordinates" });
    }

    const user = await User.findById(id);

    const updatedUser = await User.findByIdAndUpdate(
      id,
      {
        $set: {
          lat: Number(latitude),
          lng: Number(longitude),
        },
      },
      { new: true },
    );

    // Get all user addresses
    const addresses = await Address.find({ userId: id });
    if (addresses.length > 0) {
      // Compute nearest one using haversine distance
      let nearestAddress = null;
      let shortestDistance = Infinity;

      addresses.forEach((addr) => {
        if (addr.lat && addr.lng) {
          const distance = haversine(
            { lat: latitude, lon: longitude },
            { lat: addr.lat, lon: addr.lng },
          );
          if (distance < shortestDistance) {
            shortestDistance = distance;
            nearestAddress = addr;
          }
        }
      });

      if (nearestAddress) {
        await Address.updateMany({ userId: id }, { $set: { default: false } });
        await Address.findByIdAndUpdate(
          nearestAddress._id,
          { $set: { default: true } },
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
    });
  } catch (error) {
    console.error("❌ Location update error:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

exports.addAddress = async (req, res) => {
  try {
    const { id } = req.user;
    // console.log(id);

    const {
      name,
      alternateNumber,
      house_No,
      address,
      lat,
      lng,
      city,
      addressType,
      floor,
      landmark,
    } = req.body;

    const user = await User.findById(id);
    // ✅ Step 1: Fetch all stores

    const userLat = lat;
    const userLng = lng;
    const { zoneAvailable, matchedStores } = await getStoresWithinRadius(
      userLat,
      userLng,
    );

    if (!zoneAvailable) {
      return res.status(200).json({
        status: false,
        message: "Service area not available.",
      });
    }

    if (matchedStores.length === 0) {
      return res.status(200).json({
        status: false,
        message:
          "No store available in your area. Please try a different address.",
      });
    }

    const newAddress = await Address.create({
      userId: user._id,
      name: user.name,
      mobile: user.mobile,
      alternateNumber,
      pincode,
      house_No,
      address,
      state,
      range,
      lat,
      lng,
      city,
      addressType,
      floor,
      landmark,
    });

    return res.status(200).json({
      status: true,
      message: "Address added successfully",
      newAddress,
    });
  } catch (error) {
    console.error("❌ Error adding address:", error);
    return res.status(500).json({
      status: false,
      message: "Server error",
      error: error.message,
    });
  }
};