const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");
const path = require("path");

const { uploadToGCS } = require("../utils/gcsUploader");

const Product = require("../models/Product");
const Cart = require("../models/Cart");
const User = require("../models/User");

module.exports.getProdById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id).populate("owner");
    if (!product) {
      req.flash("error", "Product not found!");
      return res.redirect("/home");
    }
    res.render("productPage", { product, googleMapsApiKey: process.env.GOOGLE_MAPS_API });
  } catch (err) {
    console.log(err);
    req.flash("error", "Error loading product details!");
    res.redirect("/home");
  }
};

module.exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      req.flash("error", "Product not found!");
      return res.redirect("/home");
    }

    if (product.owner.toString() !== req.user._id.toString()) {
      req.flash("error", "You are not authorized to delete this product.");
      return res.redirect("/home");
    }

    await Product.findByIdAndDelete(id);

    req.flash("success", "Product deleted successfully!");
    res.redirect("/home");
  } catch (err) {
    console.error("Error deleting product:", err);
    req.flash("error", "Something went wrong while deleting the product.");
    res.redirect("/home");
  }
};

module.exports.geteditProductForm = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      req.flash("error", "Product not found!");
      return res.redirect("/home");
    }

    if (product.owner.toString() !== req.user._id.toString()) {
      req.flash("error", "You are not authorized to edit this product.");
      return res.redirect("/home");
    }

    res.render("editProduct", { product, currentUser: req.user });

  } catch (err) {
    console.error("Error loading edit form:", err);
    req.flash("error", "Something went wrong.");
    res.redirect("/home");
  }
};

module.exports.putEditedProduct =async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      req.flash("error", "Product not found.");
      return res.redirect("/home");
    }

    if (product.owner.toString() !== req.user._id.toString()) {
      req.flash("error", "Not authorized to edit this product.");
      return res.redirect("/home");
    }

    const {
      "prod-name": name,
      "prod-details": details,
      price,
      stock: quantity,
    } = req.body;

    // Update core fields
    product.name = name;
    product.details = details;
    product.price = price;
    product.quantity = quantity;

    // If new file uploaded
    if (req.file) {
      const gcsPath = `products/${req.user._id}/${Date.now()}_${req.file.originalname}`;
      const newImageUrl = await uploadToGCS(req.file.path, gcsPath);
      product.image = newImageUrl;
    }

    await product.save();
    req.flash("success", "Product updated successfully!");
    res.redirect(`/product/${id}`);
  } catch (err) {
    console.error("Error updating product:", err);
    req.flash("error", "Something went wrong while updating the product.");
    res.redirect("/home");
  }
};

module.exports.addToCart =  async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      req.flash("error", "Product not found!");
      return res.redirect("/home");
    };

    let cart = await Cart.findOne({
      user: req.user._id
    });

    if (!cart) {
      cart = new Cart({
        user: req.user._id,
        items: [{ product: product._id, quantity: 1 }]
      });
    } else {
      const cartItem = cart.items.find(
        (item) => item.product.toString() === product._id.toString()
      );

      if (cartItem) {
        cartItem.quantity += 1;
      } else {
        cart.items.push({ product: product._id, quantity: 1 });
      }
    }

    cart.updatedAt = Date.now();
    await cart.save();

    req.flash("success", `${product.name} added to cart!`);
    res.redirect("/home");
  } catch (err) {
    console.error("Error adding to cart:", err);
    req.flash("error", "Unable to add to cart. Please try again.");
    res.redirect("/home");
  }
};



//--TRY ON FEATURE 

function findLocalImagePath(imageStr) {
  // Common cases: '/images/necklace.png' or 'public/images/necklace.png' or 'images/necklace.png'
  const candidates = [
    path.join(__dirname, '..', 'public', imageStr.replace(/^\//, '')),
    path.join(__dirname, '..', imageStr.replace(/^\//, '')),
    path.join(process.cwd(), imageStr.replace(/^\//, '')),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}


async function removeBgForImage(imageUrlOrPath) {
  const apiKey = process.env.BG_REMOVER;
  if (!apiKey) throw new Error('BG_REMOVER API key not configured');

  const localPath = findLocalImagePath(imageUrlOrPath);
  try {
    if (localPath) {
      const form = new FormData();
      form.append('image_file', fs.createReadStream(localPath));
      form.append('size', 'auto');
      const resp = await axios.post('https://api.remove.bg/v1.0/removebg', form, {
        responseType: 'arraybuffer',
        headers: {
          ...form.getHeaders(),
          'X-Api-Key': apiKey,
        },
        timeout: 60_000,
      });
      return Buffer.from(resp.data, 'binary').toString('base64');
    } else {
      // treat as URL
      const resp = await axios.post(
        'https://api.remove.bg/v1.0/removebg',
        { image_url: imageUrlOrPath, size: 'auto' },
        {
          responseType: 'arraybuffer',
          headers: { 'X-Api-Key': apiKey },
          timeout: 60_000,
        }
      );
      return Buffer.from(resp.data, 'binary').toString('base64');
    }
  } catch (err) {
    // bubble up a descriptive error
    const msg = err.response && err.response.data
      ? err.response.data.toString()
      : err.message;
    throw new Error(`BG remover failed: ${msg}`);
  }
}
module.exports.tryOnProduct = async (req, res) => {
  try {
    console.log("CLICKED BG REMOVER");

    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) return res.status(404).send("Product not found");

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    let imageSrc = product.image;

    // ✅ Pick correct image source (local or remote)
    if (!imageSrc) {
      imageSrc = "/images/necklace.png";
    }

    // Check if it's a cloud URL (publicly reachable)
    const isPublic =
      typeof imageSrc === "string" &&
      (imageSrc.startsWith("http://") || imageSrc.startsWith("https://"));

    // ✅ Try to find local path if not a URL
    const localPath = !isPublic ? findLocalImagePath(imageSrc) : null;
    if (!isPublic && !localPath) {
      throw new Error("Local image not found: " + imageSrc);
    }

    console.log("👉  imageSrc actually sent:", imageSrc);
const safeUrl = encodeURI(imageSrc);
    const base64Image = await removeBgForImage(safeUrl);
    // Prepare data URL
    const resultImageDataUrl = `data:image/png;base64,${base64Image}`;

    // For preview on frontend
    const originalImageForClient = isPublic ? imageSrc : baseUrl + imageSrc;

    // ✅ Render view with product_type
    res.render("tryOn", {
      productId: id,
      productType: product.product_type || "other",
      originalImage: originalImageForClient,
      resultImage: resultImageDataUrl,
    });
  } catch (err) {
    console.error("❌ Error in /product/tryOn/:id ->", err.message || err);
    res
      .status(500)
      .send("Error processing image: " + (err.message || "unknown"));
  }
};
