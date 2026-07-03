const mongoose = require("mongoose");
const { generateSlug } = require("../utils/slugify");

const categorySchema = new mongoose.Schema(
{
    name:String,

    slug:String,
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
categorySchema.pre("save", function () {
  if (this.isModified("name")) {
    this.slug = generateSlug(this.name);
  }
});

module.exports = mongoose.model("categories", categorySchema);