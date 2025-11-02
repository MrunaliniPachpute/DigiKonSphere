const { response } = require("express");
const flash = require("connect-flash");
const crypto = require("crypto");
const Razorpay = require("razorpay");
const passport = require("../config/passport");
const User = require("../models/User");
const Product = require("../models/Product");
const Cart = require("../models/Cart");
const Order = require("../models/Order");

const razorpay = new Razorpay({
  key_id: process.env.PAYMENT_TEST_KEY,
  key_secret: process.env.PAYMENT_TEST_SECRET,
});

module.exports.getSignupUser = (req, res) => {
  return res.render("userSignUp");
};

module.exports.postSignUpUser = async (req, res) => {
  const { username, email, password, confirmPassword } = req.body;
  try {
    if (confirmPassword !== password) {
      req.flash("error", "Password confirmation do not match");
      return res.redirect("/user/signUp");
    }
    const user = new User({ username, email });
    await User.register(user, password);

    req.login(user, (err) => {
      if (err) {
        req.flash("error", err.message);
        return res.redirect("/user/signUp");
      }
      req.flash("success", "Welcome to DigikonSphere!");
      res.redirect("/home");
    });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/user/signUp");
  }
};

module.exports.getUserLoginForm = (req, res) => {
  return res.render("userLogin");
};

module.exports.postUserLogin = (req, res, next) => {
  passport.authenticate("user-local", (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      req.flash("error", "Incorrect username or password. Try again");
      return res.redirect("/user/login");
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

//Razopay verify
module.exports.userPaymentVerification = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      productId,
      quantity,
      totalAmount,
    } = req.body;

    const hmac = crypto.createHmac("sha256", process.env.PAYMENT_TEST_SECRET);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generatedSignature = hmac.digest("hex");

    const product = await Product.findById(productId);

    // If signature invalid — record as failed payment
    if (generatedSignature !== razorpay_signature) {
      await new Order({
        user: req.user._id,
        items: [
          {
            product: product._id,
            quantity,
            priceAtPurchase: product.price,
          },
        ],
        totalAmount,
        razorpayOrderId: razorpay_order_id,
        paymentStatus: "Failed",
        status: "Cancelled",
      }).save();

      return res
        .status(400)
        .json({ success: false, message: "Invalid signature" });
    }

    //Verified payment → store as Paid
    const order = new Order({
      user: req.user._id,
      items: [
        {
          product: product._id,
          quantity,
          priceAtPurchase: product.price,
        },
      ],
      totalAmount,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      paymentStatus: "Paid",
      status: "Pending",
    });
    await order.save();

    // Remove from cart
    await Cart.findOneAndUpdate(
      { user: req.user._id },
      { $pull: { items: { product: product._id } } }
    );

    req.flash(
      "success",
      `Payment successful! Order placed. Tracking ID: ${order.trackingId}`
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};

//COD Order route

module.exports.COD_Order = async (req, res) => {
  try {
    const { productId, quantity, totalAmount } = req.body;

    const product = await Product.findById(productId);
    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });

    // Create a new order entry with COD
    const order = new Order({
      user: req.user._id,
      items: [
        {
          product: product._id,
          quantity,
          priceAtPurchase: product.price,
        },
      ],
      totalAmount,
      paymentStatus: "Pending", // COD not yet paid
      status: "Pending",
    });
    await order.save();

    // Remove the item from cart (optional)
    await Cart.findOneAndUpdate(
      { user: req.user._id },
      { $pull: { items: { product: product._id } } }
    );

    req.flash("success", "Order placed successfully with Cash on Delivery!");
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

//Remove items from cart

module.exports.removeFromCart = async (req, res) => {
  try {
    const productId = req.params.id;
    await Cart.findOneAndUpdate(
      { user: req.user._id },
      { $pull: { items: { product: productId } } }
    );
    res.redirect("/user/dashboard");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};

//Cancel Order

module.exports.cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.id;

    const order = await Order.findOne({
      _id: orderId,
      user: req.user._id,
      status: { $ne: "Cancelled" },
    });

    if (!order) {
      return res.status(404).send("Order not found or already cancelled");
    }

    order.status = "Cancelled";
    await order.save();
    req.flash("success", "Order cancelled successfully");
    res.redirect("/user/dashboard");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};

//TRACK ORDER

module.exports.trackingUserOrder = async (req, res) => {
  try {
    const order = await Order.findOne({
      trackingId: req.params.id,
      user: req.user._id,
    }).populate("items.product", "name image price");

    if (!order) {
      req.flash("error", "Tracking ID not found");
      return res.redirect("/user/dashboard");
    }

    res.render("trackOrder", { order });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};

//DEL ACC
module.exports.deleteUserAccount = async (req, res) => {
  try {
    const userId = req.user._id;

    // Delete all orders
    await Order.deleteMany({ user: userId });

    // Delete user’s
    await Cart.deleteOne({ user: userId });

    // Finally delete user
    await User.findByIdAndDelete(userId);

    // Logout after deletion
    req.logout((err) => {
      if (err) console.error(err);
      req.flash(
        "success",
        "Your account and all related data have been deleted."
      );
      res.redirect("/home");
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Error deleting account. Try again!");
    res.redirect("/user/dashboard");
  }
};

//User dashboard
module.exports.getUserDashboard = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id }).populate(
      "items.product"
    );
    const orders = await Order.find({ user: req.user._id }).populate(
      "items.product"
    );

    res.render("userDashboard", {
      currentUser: req.user,
      cart: cart ? cart.items : [],
      orders: orders || [],
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Error loading dashboard");
    res.redirect("/home");
  }
};

module.exports.orderProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);
    if (!product) return res.status(404).send("Product not found");

    const cart = await Cart.findOne({ user: req.user._id });
    const cartItem = cart?.items.find(
      (item) => item.product.toString() === productId
    );
    const quantity = cartItem ? cartItem.quantity : 1;
    const totalAmount = product.price * quantity;

    const options = {
      amount: totalAmount * 100, // Convert rupees to paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    

    res.render("paymentPage", {
      product,
      quantity,
      totalAmount,
      key: process.env.PAYMENT_TEST_KEY,
      orderId: order.id,
      user: req.user,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};
