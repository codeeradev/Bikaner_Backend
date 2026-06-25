const City = require("../models/cities");
const Zone = require("../models/zones");

// Get all cities
exports.getAllCities = async (req, res) => {
  try {
    const { isActive, page = 1, limit = 10 } = req.query;
    
    const filter = {};
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const cities = await City.find(filter)
      .sort({ name: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await City.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: cities,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching cities",
      error: error.message
    });
  }
};

// Get single city by ID
exports.getCityById = async (req, res) => {
  try {
    const city = await City.findById(req.params.id);
    
    if (!city) {
      return res.status(404).json({
        success: false,
        message: "City not found"
      });
    }

    res.status(200).json({
      success: true,
      data: city
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching city",
      error: error.message
    });
  }
};

// Create new city
exports.createCity = async (req, res) => {
  try {
    const { name, isActive } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "City name is required"
      });
    }

    const existingCity = await City.findOne({ name: new RegExp(`^${name}$`, 'i') });
    if (existingCity) {
      return res.status(400).json({
        success: false,
        message: "City with this name already exists"
      });
    }

    const city = new City({
      name,
      isActive
    });

    await city.save();

    res.status(201).json({
      success: true,
      message: "City created successfully",
      data: city
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating city",
      error: error.message
    });
  }
};

// Update city
exports.updateCity = async (req, res) => {
  try {
    const { name, isActive } = req.body;

    const city = await City.findById(req.params.id);

    if (!city) {
      return res.status(404).json({
        success: false,
        message: "City not found"
      });
    }

    if (name !== undefined) {
      const existingCity = await City.findOne({ 
        name: new RegExp(`^${name}$`, 'i'),
        _id: { $ne: req.params.id }
      });
      
      if (existingCity) {
        return res.status(400).json({
          success: false,
          message: "City with this name already exists"
        });
      }
      
      city.name = name;
    }
    
    if (isActive !== undefined) city.isActive = isActive;

    await city.save();

    res.status(200).json({
      success: true,
      message: "City updated successfully",
      data: city
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating city",
      error: error.message
    });
  }
};

// Delete city
exports.deleteCity = async (req, res) => {
  try {
    const city = await City.findById(req.params.id);

    if (!city) {
      return res.status(404).json({
        success: false,
        message: "City not found"
      });
    }

    // Check if city has zones
    const zonesCount = await Zone.countDocuments({ cityId: req.params.id });
    if (zonesCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete city. It has ${zonesCount} zone(s) associated with it.`
      });
    }

    await City.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "City deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting city",
      error: error.message
    });
  }
};

// Toggle city status
exports.toggleCityStatus = async (req, res) => {
  try {
    const city = await City.findById(req.params.id);

    if (!city) {
      return res.status(404).json({
        success: false,
        message: "City not found"
      });
    }

    city.isActive = !city.isActive;
    await city.save();

    res.status(200).json({
      success: true,
      message: `City ${city.isActive ? 'activated' : 'deactivated'} successfully`,
      data: city
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error toggling city status",
      error: error.message
    });
  }
};

// Get city with zones
exports.getCityWithZones = async (req, res) => {
  try {
    const city = await City.findById(req.params.id);
    
    if (!city) {
      return res.status(404).json({
        success: false,
        message: "City not found"
      });
    }

    const zones = await Zone.find({ cityId: req.params.id }).sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: {
        city,
        zones
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching city with zones",
      error: error.message
    });
  }
};
