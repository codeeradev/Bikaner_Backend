const mongoose = require("mongoose");

const roleSchema = new mongoose.Schema(
{
    name:{
        type:String,
        required:true,
        unique:true
    },

    permissions:[String],

    isActive:{
        type:Boolean,
        default:true
    }
},
{
    timestamps:true
}
);

module.exports = mongoose.model("roles", roleSchema);