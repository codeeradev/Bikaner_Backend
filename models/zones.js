const mongoose = require("mongoose");

const zoneSchema = new mongoose.Schema(
{
    name:{
        type:String,
        required:true
    },

    description:String,

    deliveryCharge:{
        type:Number,
        default:0
    },

    minimumOrderAmount:{
        type:Number,
        default:0
    },

    estimatedDeliveryTime:{
        type:Number,
        default:60
    },

    isActive:{
        type:Boolean,
        default:true
    }
},
{
    timestamps:true
});

module.exports = mongoose.model("zones", zoneSchema);