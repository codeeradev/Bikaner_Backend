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

    cityId:{ type:mongoose.Schema.Types.ObjectId, ref:"cities", required:true },

    lat:{ type:Number, required:true },
    
    lng:{ type:Number, required:true },
    isActive:{
        type:Boolean,
        default:true
    }
},
{
    timestamps:true
});

module.exports = mongoose.model("zones", zoneSchema);