const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
{
    roleId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"roles",
        required:true
    },

    name:{
        type:String,
        required:true
    },

    mobile:{
        type:String,
        required:true,
        unique:true
    },

    email:{
        type:String,
        default:null
    },

    password:{
        type:String,
        required:true
    },

    profileImage:{
        type:String,
        default:""
    },

    cityId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"cities"
    },

    zoneIds:[
        {
            type:mongoose.Schema.Types.ObjectId,
            ref:"zones"
        }
    ],

    allowedCategories:[
        {
            type:mongoose.Schema.Types.ObjectId,
            ref:"categories"
        }
    ],

    customPricingEnabled:{
        type:Boolean,
        default:false
    },

    status:{
        type:String,
        enum:["active","inactive"],
        default:"active"
    },

    isBlocked:{
        type:Boolean,
        default:false
    }
},
{
    timestamps:true
});

module.exports = mongoose.model("users", userSchema);