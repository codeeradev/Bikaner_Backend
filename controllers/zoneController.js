const Zone = require("../models/zones");
const City = require("../models/cities");

// Get all zones
exports.getAllZones = async (req, res) => {
  try {
    const { cityId, isActive, page = 1, limit = 10 } = req.query;
    
    const filter = {};
    if (cityId) filter.cityId = cityId;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const zones = await Zone.find(filter)
      .populate('cityId', 'name')
      .sort({ name: 1 })
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

// Get single zone by ID
exports.getZoneById = async (req, res) => {
  try {
    const zone = await Zone.findById(req.params.id).populate('cityId', 'name');
    
    if (!zone) {
      return res.status(404).json({
        success: false,
        message: "Zone not found"
      });
    }

    res.status(200).json({
      success: true,
      data: zone
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching zone",
      error: error.message
    });
  }
};

// Get zones by city
exports.getZonesByCity = async (req, res) => {
  try {
    const { isActive } = req.query;
    
    const filter = { cityId: req.params.cityId };
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const zones = await Zone.find(filter)
      .populate('cityId', 'name')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: zones,
      total: zones.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching zones by city",
      error: error.message
    });
  }
};

// Create new zone
exports.createZone = async (req, res) => {
  try {
    const { 
      cityId, 
      name, 
      code, 
      deliveryCharge, 
      minimumOrderAmount, 
      estimatedDeliveryTime, 
      isActive 
    } = req.body;

    if (!cityId || !name) {
      return res.status(400).json({
        success: false,
        message: "City ID and zone name are required"
      });
    }

    // Verify city exists
    const city = await City.findById(cityId);
    if (!city) {
      return res.status(404).json({
        success: false,
        message: "City not found"
      });
    }

    // Check for duplicate zone name in same city
    const existingZone = await Zone.findOne({ 
      cityId, 
      name: new RegExp(`^${name}$`, 'i') 
    });
    
    if (existingZone) {
      return res.status(400).json({
        success: false,
        message: "Zone with this name already exists in the city"
      });
    }

    const zone = new Zone({
      cityId,
      name,
      code,
      deliveryCharge,
      minimumOrderAmount,
      estimatedDeliveryTime,
      isActive
    });

    await zone.save();
    await zone.populate('cityId', 'name');

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
      cityId, 
      name, 
      code, 
      deliveryCharge, 
      minimumOrderAmount, 
      estimatedDeliveryTime, 
      isActive 
    } = req.body;

    const zone = await Zone.findById(req.params.id);

    if (!zone) {
      return res.status(404).json({
        success: false,
        message: "Zone not found"
      });
    }

    // If cityId is being changed, verify new city exists
    if (cityId !== undefined && cityId !== zone.cityId.toString()) {
      const city = await City.findById(cityId);
      if (!city) {
        return res.status(404).json({
          success: false,
          message: "City not found"
        });
      }
      zone.cityId = cityId;
    }

    // Check for duplicate zone name if name is being changed
    if (name !== undefined && name !== zone.name) {
      const existingZone = await Zone.findOne({ 
        cityId: cityId || zone.cityId,
        name: new RegExp(`^${name}$`, 'i'),
        _id: { $ne: req.params.id }
      });
      
      if (existingZone) {
        return res.status(400).json({
          success: false,
          message: "Zone with this name already exists in the city"
        });
      }
      
      zone.name = name;
    }

    if (code !== undefined) zone.code = code;
    if (deliveryCharge !== undefined) zone.deliveryCharge = deliveryCharge;
    if (minimumOrderAmount !== undefined) zone.minimumOrderAmount = minimumOrderAmount;
    if (estimatedDeliveryTime !== undefined) zone.estimatedDeliveryTime = estimatedDeliveryTime;
    if (isActive !== undefined) zone.isActive = isActive;

    await zone.save();
    await zone.populate('cityId', 'name');

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
    const zone = await Zone.findById(req.params.id).populate('cityId', 'name');

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
