const express = require("express");
const app = express();
require("dotenv").config();
const Razorpay = require("razorpay");
const bodyParser = require("body-parser");
const connectDB = require("./config/db");
connectDB();
const setupMiddleware = require("./middlewares/middleware");
setupMiddleware(app);

const { SerialPort, ReadlineParser } = require("serialport");
const { Server } = require("socket.io");
const http = require("http");

const server = http.createServer(app);
const io = new Server(server);

let port;
let parser;

try {
  port = new SerialPort({ path: "COM4", baudRate: 9600 });

  // catch async errors (like “COM4 not found”)
  port.on("error", (err) => {
    console.warn("⚠️ SerialPort error:", err.message);
  });

  port.on("open", () => console.log("✅ Serial connection open on COM4"));

  parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));
  console.log("🔌 SerialPort initialized successfully");
} catch (err) {
  console.warn("⚠️ SerialPort initialization failed:", err.message);
}

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const razorpay = new Razorpay({
  key_id: process.env.PAYMENT_TEST_KEY,
  key_secret: process.env.PAYMENT_TEST_SECRET,
});

const Product = require("./models/Product");

const userRoutes = require("./routes/userRoutes");
const artisianRoutes = require("./routes/artisianRoutes");
const productRoutes = require("./routes/productRoutes");

app.use(bodyParser.json());

app.use("/models", express.static(path.join(__dirname, "TripoSR/outputs")));

// basic routes
app.get("/", (req, res) => res.send("Server working well"));

app.get("/home", async (req, res) => {
  try {
    const products = await Product.find({}).populate("owner", "username");
    res.render("homePage", { products });
  } catch (err) {
    console.log(err);
    req.flash("error", "Unable to load products.");
    res.render("homePage", { products: [] });
  }
});

app.post("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      req.flash("error", "Error logging out. Try again!");
      return res.redirect("/home");
    }
    req.flash("success", "Logged out successfully!");
    res.redirect("/home");
  });
});

app.get("/product/3dPreview/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) return res.status(404).send("Product not found!");
    console.log("Product found:", product.name);

    const tripoDir = path.join(__dirname, "TripoSR");
    const inputsDir = path.join(tripoDir, "inputs");
    const outputsDir = path.join(tripoDir, "outputs", id);

    if (!fs.existsSync(inputsDir)) fs.mkdirSync(inputsDir, { recursive: true });
    if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir, { recursive: true });
    console.log("📁 Directories initialized.");

    const modelPath = path.join(outputsDir, "0", "mesh.obj");
    if (fs.existsSync(modelPath)) {
      console.log("✅ Using cached model:", modelPath);
      return res.render("Preview3d", {
        prod: product,
        modelPath: `/models/${id}/0/mesh.obj`,
        layout: false,
      });
    }

    console.log("Model not found... generating from scratch!");

    const fileName = `${id}.jpg`;
    const inputPath = path.join(inputsDir, fileName);
    const response = await axios({
      url: product.image,
      method: "GET",
      responseType: "arraybuffer",
    });
    fs.writeFileSync(inputPath, Buffer.from(response.data));
    console.log("Image downloaded to:", inputPath);

    const command = `cd "${tripoDir}" && set CUDA_VISIBLE_DEVICES= && "${path.join(
      tripoDir,
      "venv",
      "Scripts",
      "python.exe"
    )}" run.py "./inputs/${fileName}" --pretrained-model-name-or-path "./models" --output-dir "./outputs/${id}" --model-save-format obj`;

    console.log("Running TripoSR command:", command);

    exec(command, async (error, stdout, stderr) => {
      if (error) {
        console.error("TripoSR error:", stderr || error.message);
        return res.status(500).send("Error running TripoSR");
      }

      console.log(stdout);

      const generatedModelPath = `TripoSR/outputs/${id}/0/mesh.obj`;
      product.model3dPath = generatedModelPath;
      await product.save();

      console.log("Model generated at:", generatedModelPath);

      res.render("Preview3d", {
        prod: product,
        modelPath: `/models/${id}/0/mesh.obj`,
      });
    });
  } catch (err) {
    console.error("Route error:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.use("/user/", userRoutes);
app.use("/artisian/", artisianRoutes);
app.use("/product/", productRoutes);

const PORT = process.env.PORT || 3000;

// ✅ Safe parser usage
if (parser) {
  parser.on("data", (data) => {
    try {
      const str = data.toString().trim();
      console.log("RAW Serial data:", str);

      const parts = str.split(",").map(Number);
      if (parts.length >= 2 && !parts.some(isNaN)) {
        const gx = parts[0];
        const gy = parts[1];
        io.emit("gyroData", { gx, gy });
      }
    } catch (err) {
      console.error("Gyro parse error:", err);
    }
  });
} else {
  console.log("⚠️ Gyroscope parser not initialized (non-IOT mode)");
}

server.listen(PORT, () => {
  console.log(`Server+Gyro running at http://localhost:${PORT}/home`);
});
