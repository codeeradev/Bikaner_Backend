const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },

    name: { type: String },

    mobile: { type: String },

    alternateNumber: { type: String, default: "" },
    address: { type: String, required: true},

    house_No: { type: String},
    floor:Number,
    landmark: { type: String, default: "" },

    city: { type: String },

    lat: { type: Number, required: true },

    lng: { type: Number, required: true },

    addressType: {
      type: String,
      enum: ["home", "work", "other"],
      default: "home",
    },

    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("addresses", addressSchema);
