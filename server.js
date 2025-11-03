const express = require("express");
const app = express();

require("dotenv").config();
const Razorpay = require("razorpay");
const bodyParser = require("body-parser");
const connectDB = require("./config/db");
connectDB();
const setupMiddleware = require("./middlewares/middleware");
setupMiddleware(app);
app.use((req, res, next) => {
  res.locals.googleMapsApiKey = process.env.GOOGLE_MAPS_API; 
  next();
});
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
    console.warn("SerialPort error:", err.message);
  });

  port.on("open", () => console.log("Serial connection open on COM4"));

  parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));
  console.log("SerialPort initialized successfully");
} catch (err) {
  console.warn( "SerialPort initialization failed:", err.message);
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
app.get("/", (req, res) => res.send(`Server working well..Click here to view homepage : https://digikonsphere.onrender.com/home`));

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

app.use("/user/", userRoutes);
app.use("/artisian/", artisianRoutes);
app.use("/product/", productRoutes);



const PORT = process.env.PORT || 3000;

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
  console.log("Gyroscope parser not initialized (non-IOT mode)");
}

server.listen(PORT, () => {
  console.log(`Server+Gyro running at http://localhost:${PORT}/home`);
});
