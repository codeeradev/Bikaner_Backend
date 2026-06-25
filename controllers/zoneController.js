const Zone = require("../models/zones");

// Get all zones
exports.getAllZones = async (req, res) => {
  try {
    const { isActive, page = 1, limit = 10 } = req.query;
    
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const zones = await Zone.find(filter)
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
    const zone = await Zone.findById(req.params.id);
    
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

// Get zones by city (deprecated but kept for compatibility)
exports.getZonesByCity = async (req, res) => {
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
      isActive 
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
      isActive
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
      isActive 
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
