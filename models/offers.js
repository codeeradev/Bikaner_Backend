const mongoose = require("mongoose");

const offerSchema = new mongoose.Schema(
  {
    // Basic Information
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    
    // Offer Type Configuration - Only 3 types supported
    offerType: {
      type: String,
      enum: [
        "flat_discount",        // Flat amount off
        "percentage_discount",  // Percentage off
        "bogo",                // Buy One Get One (adds free quantity)
      ],
      required: true,
    },
    
    // Discount Configuration (for flat/percentage)
    discountValue: {
      type: Number,
      min: 0,
      required: function() {
        return this.offerType === "flat_discount" || this.offerType === "percentage_discount";
      },
    },
    maxDiscountAmount: {
      type: Number,
      min: 0,
      // Only applicable for percentage_discount
    },
    
    // BOGO Configuration - simplified for specific products
    bogoConfig: {
      buyQuantity: {
        type: Number,
        min: 1,
        default: 1,
      },
      getQuantity: {
        type: Number,
        min: 1,
        default: 1,
      },
    },
    
    // Applicability - Only cart or specific_products
    applicableOn: {
      type: String,
      enum: ["cart", "specific_products"],
      required: true,
    },
    specificProducts: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "products",
    }],
    
    // Conditions
    minCartValue: {
      type: Number,
      min: 0,
      default: 0,
    },
    
    // Date Range
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
    },
    
    // Behavior
    priority: {
      type: Number,
      default: 1,
      min: 1, // Priority starts from 1, not 0
    },
    autoApply: {
      type: Boolean,
      default: true,
      description: "Automatically apply if conditions met",
    },
    
    // Status
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
offerSchema.index({ isActive: 1, startDate: 1, endDate: 1 });
offerSchema.index({ priority: -1 });

// Validation
offerSchema.pre("validate", function (next) {
  // Validate percentage discount
  if (this.offerType === "percentage_discount" && this.discountValue > 100) {
    this.invalidate("discountValue", "Percentage discount cannot exceed 100");
  }
  
  // Validate date range
  if (this.endDate && this.startDate && this.endDate < this.startDate) {
    this.invalidate("endDate", "End date must be after start date");
  }
  
  // Validate specific products when applicable
  if (this.applicableOn === "specific_products" && (!this.specificProducts || this.specificProducts.length === 0)) {
    this.invalidate("specificProducts", "At least one product must be specified when applicableOn is specific_products");
  }
  
  // BOGO requires specific products
  if (this.offerType === "bogo" && this.applicableOn !== "specific_products") {
    this.invalidate("applicableOn", "BOGO offers must be applied to specific products");
  }
  
  // BOGO requires bogoConfig
  if (this.offerType === "bogo") {
    if (!this.bogoConfig) {
      this.bogoConfig = { buyQuantity: 1, getQuantity: 1 };
    }
    if (!this.bogoConfig.buyQuantity || this.bogoConfig.buyQuantity < 1) {
      this.bogoConfig.buyQuantity = 1;
    }
    if (!this.bogoConfig.getQuantity || this.bogoConfig.getQuantity < 1) {
      this.bogoConfig.getQuantity = 1;
    }
  }
  
  // Ensure priority is at least 1 (0 is not allowed)
  if (this.priority < 1) {
    this.priority = 1;
  }
});

// Method to check if offer is currently valid
offerSchema.methods.isValid = function () {
  if (!this.isActive) return false;
  
  const now = new Date();
  if (this.startDate > now) return false;
  if (this.endDate && this.endDate < now) return false;
  
  return true;
};

module.exports = mongoose.model("offers", offerSchema);
