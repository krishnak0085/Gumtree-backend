import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    category: {
      type: String,
      required: true
    },

    description: String,

    thicknesses: [String],

    imageUrl: String
  },
  { timestamps: true }
);

export default mongoose.model("Product", productSchema);