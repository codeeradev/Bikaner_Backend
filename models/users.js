const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
{
    roleId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"roles",
    },

    name:{
        type:String,
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

    lat:Number,
    lng:Number,

    status:{
        type:String,
        enum:["active","inactive"],
        default:"active"
    },

    isBlocked:{
        type:Boolean,
        default:false
    },
    constRoleId:Number, // This field is used to store the constant role ID for reference
},
{
    timestamps:true
});

module.exports = mongoose.model("users", userSchema);