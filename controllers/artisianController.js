const { response } = require("express");
const Artisian = require("../models/Artisian");
const Product = require("../models/Product");
const Order = require("../models/Order");
const flash = require("connect-flash");
const passport = require("../config/passport");
const fetchPixabayImages = require("../utils/fetchPixabayImages");
const { createVideoFromImages } = require("../utils/createVideoFromImages");
const ArtisianStory = require("../models/ArtisianStory");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");
const { VertexAI } = require("@google-cloud/vertexai");
const textToSpeech = require("@google-cloud/text-to-speech");
const ffmpeg = require("fluent-ffmpeg");
const axios = require("axios");

const { uploadToGCS } = require("../utils/gcsUploader");

const vertex = new VertexAI({
  project: process.env.PROJECT_ID,
  location: "us-central1",
});
const ttsClient = new textToSpeech.TextToSpeechClient();

module.exports.getSignupArtist = (req, res) => {
  return res.render("artisianSignUp");
};

module.exports.postSignupArtist = async (req, res) => {
  const {
    username,
    email,
    password,
    confirmPassword,
    contact,
    street,
    city,
    state,
    country,
    craftType,
    pincode,
  } = req.body;

  try {
    if (confirmPassword !== password) {
      req.flash("error", "Password confirmation do not match");
      return res.redirect("/artisian/signUp");
    }
    if (!username || !email || !password || !street || !contact) {
      req.flash("error", "Please fill all required fields!");
      return res.redirect("/artisian/signUp");
    }

    const existingUser = await Artisian.findOne({ email });
    if (existingUser) {
      req.flash("error", "Email already registered!");
      return res.redirect("/artisian/signUp");
    }

    const artisian = new Artisian({
      username,
      email,
      contact,
      street,
      city,
      state,
      craftType,
      country,
      pincode,
    });
    await Artisian.register(artisian, password);

    req.login(artisian, (err) => {
      if (err) {
        req.flash("error", err.message);
        return res.redirect("/artisian/signUp");
      }
      req.flash("success", "Welcome to DigikonSphere!");
      res.redirect("/home");
    });
  } catch (err) {
    console.error("Signup Error:", err);
    req.flash("error", err.message);
    res.redirect("/artisian/signUp");
  }
};

module.exports.getLoginArtistForm = (req, res) => res.render("artisianLogin");

module.exports.postLoginArtist = (req, res, next) => {
  passport.authenticate("artisian-local", (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      req.flash("error", "Incorrect username or password. Try again");
      return res.redirect("/artisian/login");
    }
    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }
      req.flash("success", "Welcome to DigikonSphere!");
      return res.redirect("/home");
    });
  })(req, res, next);
};

module.exports.getArtistDashboard = async (req, res) => {
  try {
    const products = await Product.find({
      owner: req.user._id,
    });
    res.render("artisianDashboard", { products });
  } catch (err) {
    console.log(err);
    res.send("Error loading dashboard");
  }
};

module.exports.getAddProdForm = (req, res) => {
  res.render("addProduct");
};

module.exports.postAddProd = async (req, res) => {
  try {
    const {
      "prod-name": name,
      price,
      stock: quantity,
      "prod-details": details,
      product_type,
    } = req.body;

    let imageUrl = null;

    // If user uploaded a file
    if (req.file) {
      const gcsPath = `products/${req.user._id}/${Date.now()}_${req.file.originalname}`;
      imageUrl = await uploadToGCS(req.file.path, gcsPath);
    }

    const newProd = new Product({
      name,
      price,
      quantity,
      details,
      product_type,
      owner: req.user._id,
      ...(imageUrl && { image: imageUrl }),
    });

    await newProd.save();
    req.flash("success", "Product added successfully!");
    res.redirect("/artisian/dashboard");
  } catch (err) {
    console.error("Error adding product:", err);
    req.flash("error", "Failed to add product. Try again.");
    res.redirect("/artisian/addProd");
  }
};

module.exports.getArtisianOrders = async (req, res) => {
  try {
    // Find all orders where any product belongs to this artisian
    const orders = await Order.find({ "items.product": { $exists: true } })
      .populate("user", "username email")
      .populate("items.product", "name image owner");

    // Filter orders where product.owner matches artisian’s ID
    const myOrders = orders.filter((order) =>
      order.items.some(
        (item) => item.product?.owner?.toString() === req.user._id.toString()
      )
    );

    res.render("artisianOrders", { orders: myOrders });
  } catch (err) {
    console.error("Error fetching artisian orders:", err);
    req.flash("error", "Unable to load orders");
    res.redirect("/artisian/dashboard");
  }
};

module.exports.shipOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate("items.product");

    if (!order) return res.status(404).send("Order not found");

    // Loop through order items and reduce quantity
    for (let item of order.items) {
      const product = item.product;
      if (product.owner.toString() === req.user._id.toString()) {
        product.quantity -= item.quantity;
        if (product.quantity < 0) product.quantity = 0;
        await product.save();
      }
    }

    order.status = "Shipped";
    await order.save();

    req.flash("success", "Order marked as shipped!");
    res.redirect("/artisian/orders");
  } catch (err) {
    console.error("Error updating order:", err);
    res.status(500).send("Server error");
  }
};

module.exports.delArtistAccount = async (req, res) => {
  try {
    const artisianId = req.user._id;
    await Product.deleteMany({ owner: artisianId });
    await Artisian.findByIdAndDelete(artisianId);

    req.logout((err) => {
      if (err) console.error(err);
      req.flash(
        "success",
        "Your artisian account and all products have been deleted."
      );
      res.redirect("/home");
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Error deleting artisian account. Try again!");
    res.redirect("/artisian/dashboard");
  }
};

//STORY GEN

module.exports.generateStory = async (req, res) => {
  if (req.inProgress) return res.status(429).send("Already generating...");
  req.inProgress = true;

  try {
    const { id } = req.params;
    const artisan = await Artisian.findById(id);
    if (!artisan) return res.status(404).send("Artisan not found");

    const existing = await ArtisianStory.findOne({ artisian: id });
    if (existing) return res.redirect(`/artisian/${id}/story`);

    // gen story
    const model = vertex.getGenerativeModel({ model: "gemini-2.5-flash" });
    const artistLocation = `${artisan.street}, ${artisan.city}, ${artisan.state}, ${artisan.country} - ${artisan.pincode}`;

    const prompt = `
      Write an inspiring and emotional 3-paragraph story about ${artisan.username}, 
      a ${artisan.craftType} from ${artistLocation}.
      Focus on their passion, creative journey, and cultural roots. 
      Keep it under 300 words, engaging and cinematic.
    `;

    const storyResp = await model.generateContent(prompt);
    const storyText = storyResp.response.candidates[0].content.parts[0].text;
    console.log("✅ Story generated");

    // 5 imgs->pixbay
    const query = `${artisan.craftType} ${artisan.city}`;
    const images = await fetchPixabayImages(query, 5);
    if (!images.length) throw new Error("No images found for artisan type");

    //tts
    const [ttsResp] = await ttsClient.synthesizeSpeech({
      input: { text: storyText },
      voice: { languageCode: "en-US", ssmlGender: "FEMALE" },
      audioConfig: { audioEncoding: "MP3" },
    });

    const audioDir = path.join(process.cwd(), "public", "videos");

    if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });

    //save narration file
    const narrationFile = path.join(audioDir, `${uuidv4()}_narration.mp3`);
    fs.writeFileSync(narrationFile, ttsResp.audioContent);
    console.log("Narration generated");

    // Random bg choosing
    // 🎵 Random background music (from root /public/bg_music)
    const randomNum = Math.floor(Math.random() * 5) + 1;
    const bgMusicFile = path.join(
      process.cwd(),
      "public",
      "bg_music",
      `${randomNum}.mp3`
    );

    if (!fs.existsSync(bgMusicFile)) {
      console.warn(`⚠️ Background track not found: ${bgMusicFile}`);
    } else {
      console.log(`🎶 Using background track: ${randomNum}.mp3`);
    }

    //  Create video
    const outputVideo = path.join(audioDir, `${uuidv4()}_story.mp4`);

    await createVideoFromImages(
      images,
      storyText,
      narrationFile,
      bgMusicFile,
      outputVideo
    );

    // Save to DB
    const story = new ArtisianStory({
      artisian: id,
      storyText,
      images,
      generatedVideoUrl: `/videos/${path.basename(outputVideo)}`,
      status: "Generated",
      createdAt: new Date(),
    });

    await story.save();

    console.log("Artisan story + video generated successfully!");
    res.redirect(`/artisian/${id}/story`);
  } catch (err) {
    console.error("Error generating artisan story:", err);
    res.status(500).send("Failed to generate story");
  } finally {
    req.inProgress = false; // release lock
  }
};

module.exports.getArtisianStory = async (req, res) => {
  try {
    const { id } = req.params;
    const artisian = await Artisian.findById(id);

    if (!artisian) {
      return res.status(404).send("Artisan not found");
    }

    const story = await ArtisianStory.findOne({ artisian: id });

    if (!story) {
      req.flash("error", "No story exists for this artisan!");
      return res.redirect("/home");
    }

    res.render("artisianStory", {
      artisan: artisian, // Keep variable name consistent for EJS
      story,
    });
  } catch (err) {
    console.error("Error loading artisan story:", err);
    res.status(500).send("Server error while loading story");
  }
};
