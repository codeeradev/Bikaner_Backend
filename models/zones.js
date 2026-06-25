const mongoose = require("mongoose");

const zoneSchema = new mongoose.Schema(
{
    cityId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"cities",
        required:true
    },

    name:{
        type:String,
        required:true
    },

    code:String,

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