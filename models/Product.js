const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  details: {
    type: String,
  },
  image: {
    type: String,
    default:
      "https://images.unsplash.com/photo-1576495169018-bd2414046c6b?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=804",
  },
  price: {
    type: Number,
    min: 1,
  },
  quantity: {
    type: Number,
    min: 0,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Artisian",
    required: true,
  },
  product_type: {
    type: String,
    required: true,
    enum: ["jewellery", "pottery", "wall_decor", "other"],
    default: "other",
  },
  model3d: {
    type: String, 
    default: null,
  },
});

const Product = mongoose.model("Product", productSchema);
module.exports = Product;
