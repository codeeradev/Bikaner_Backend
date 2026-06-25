const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
{
    name:String,

    image:String,

    description:String,

    sortOrder:{
        type:Number,
        default:0
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

module.exports = mongoose.model("categories", categorySchema);