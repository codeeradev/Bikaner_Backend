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
    
    // Offer Type Configuration
    offerType: {
      type: String,
      enum: [
        "flat_discount",        // Flat amount off
        "percentage_discount",  // Percentage off
        "bogo",                // Buy One Get One
      ],
      required: true,
    },
    
    // Coupon Configuration
    requiresCoupon: {
      type: Boolean,
      default: false,
    },
    couponCode: {
      type: String,
      trim: true,
      uppercase: true,
      sparse: true, // Allows null but enforces uniqueness when set
    },
    
    // Discount Configuration (for flat/percentage)
    discountValue: {
      type: Number,
      min: 0,
    },
    maxDiscountAmount: {
      type: Number,
      min: 0,
    },
    
    // BOGO Configuration
    bogoConfig: {
      buyQuantity: {
        type: Number,
        min: 1,
      },
      getQuantity: {
        type: Number,
        min: 1,
      },
      applyOn: {
        type: String,
        enum: ["same_product", "cheapest", "free_product"],
      },
      freeProductId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "products",
      },
    },
    
    // Buy X Get Y Configuration
    buyXGetYConfig: {
      buyProducts: [{
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "products",
        },
        quantity: {
          type: Number,
          min: 1,
        },
      }],
      getProducts: [{
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "products",
        },
        quantity: {
          type: Number,
          min: 1,
        },
        discountPercentage: {
          type: Number,
          min: 0,
          max: 100,
          default: 100, // 100% = free
        },
      }],
    },
    
    // Combo Configuration
    comboConfig: {
      products: [{
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "products",
        },
        quantity: {
          type: Number,
          min: 1,
        },
      }],
      comboPrice: {
        type: Number,
        min: 0,
      },
    },
    
    // Free Product Configuration
    freeProductConfig: {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "products",
      },
      quantity: {
        type: Number,
        min: 1,
        default: 1,
      },
    },
    
    // Applicability
    applicableOn: {
      type: String,
      enum: ["cart", "specific_products", "category"],
      required: true,
    },
    specificProducts: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "products",
    }],
    specificCategories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "categories",
    }],
    
    // Conditions
    minCartValue: {
      type: Number,
      min: 0,
      default: 0,
    },
    maxUsagePerUser: {
      type: Number,
      min: 0,
    },
    totalUsageLimit: {
      type: Number,
      min: 0,
    },
    currentUsageCount: {
      type: Number,
      default: 0,
      min: 0,
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
      default: 0,
      description: "Higher priority offers are evaluated first",
    },
    isStackable: {
      type: Boolean,
      default: false,
      description: "Can this offer be combined with other stackable offers",
    },
    autoApply: {
      type: Boolean,
      default: false,
      description: "Automatically apply if conditions met (for non-coupon offers)",
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
offerSchema.index({ couponCode: 1 }, { sparse: true, unique: true });
offerSchema.index({ isActive: 1, startDate: 1, endDate: 1 });
offerSchema.index({ priority: -1 });

// Validation
offerSchema.pre("validate", function (next) {
  // Normalize coupon code
  if (this.couponCode) {
    this.couponCode = this.couponCode.trim().toUpperCase();
  }
  
  // If requires coupon, coupon code is mandatory
  if (this.requiresCoupon && !this.couponCode) {
    this.invalidate("couponCode", "Coupon code is required when requiresCoupon is true");
  }
  
  // If doesn't require coupon, autoApply should be possible
  if (!this.requiresCoupon && !this.autoApply) {
    this.autoApply = true; // Default to auto-apply for non-coupon offers
  }
  
  // Validate percentage discount
  if (this.offerType === "percentage_discount" && this.discountValue > 100) {
    this.invalidate("discountValue", "Percentage discount cannot exceed 100");
  }
  
  // Validate date range
  if (this.endDate && this.startDate && this.endDate < this.startDate) {
    this.invalidate("endDate", "End date must be after start date");
  }
});

// Method to check if offer is currently valid
offerSchema.methods.isValid = function () {
  if (!this.isActive) return false;
  
  const now = new Date();
  if (this.startDate > now) return false;
  if (this.endDate && this.endDate < now) return false;
  
  if (this.totalUsageLimit && this.currentUsageCount >= this.totalUsageLimit) {
    return false;
  }
  
  return true;
};

module.exports = mongoose.model("offers", offerSchema);
