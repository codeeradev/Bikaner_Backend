const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
{
    categoryId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"categories"
    },

    name:String,

    slug:String,

    description:String,

    sku:String,

    image:String,

    unitValue:Number,

    unit:String,

    mrp:Number,

    sellingPrice:Number,

    bulkPrice:Number,

    city:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"cities"
    },

    zone:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"zones"
    },

    stock:{
        type:Number,
        default:0
    },

    minBulkQty:{
        type:Number,
        default:0
    },

    isFeatured:{
        type:Boolean,
        default:false
    },

    isActive:{
        type:Boolean,
        default:true
    },

    nutritionValues:{
        type:Map,
        of:new mongoose.Schema({
            value:{
                type:Number,
                required:true
            },
            unit:{
                type:String,
                required:true
            }
        }, { _id:false }),
        default:undefined
    },

    ingredients:{
        type:[String],
        default:undefined
    }
},
{
    timestamps:true
}
);

module.exports = mongoose.model("products", productSchema);