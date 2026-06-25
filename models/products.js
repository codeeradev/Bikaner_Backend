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

    gallery:[String],

    weight:Number,

    unit:String,

    mrp:Number,

    sellingPrice:Number,

    bulkPrice:Number,

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
    }
},
{
    timestamps:true
}
);

module.exports = mongoose.model("products", productSchema);