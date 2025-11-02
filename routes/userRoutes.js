const express = require("express");
const router = express.Router();
const { isRoleUser} = require("../middlewares/auth");
const userController  = require("../controllers/userController");
require("dotenv").config();
const Razorpay = require("razorpay");

const razorpay = new Razorpay({
  key_id: process.env.PAYMENT_TEST_KEY,
  key_secret: process.env.PAYMENT_TEST_SECRET,
});

//signup user routes
router
  .route("/signup")
  .get(userController.getSignupUser )
  .post(userController.postSignUpUser);

//login user routes
router
  .route("/login")
  .get(userController.getUserLoginForm)
  .post(userController.postUserLogin)


//Dashboard
router.get("/dashboard", isRoleUser, userController.getUserDashboard)

//payment routes

router.post("/verifyPayment",isRoleUser, userController.userPaymentVerification);

router.post("/codOrder" , isRoleUser, userController.COD_Order )

//cart route
router.post("/cart/remove/:id", isRoleUser,userController.removeFromCart)

//order route
router.get("/product/:id/addOrder", isRoleUser, userController.orderProduct);

router.get("/order/cancelOrder/:id", isRoleUser, userController.cancelOrder);

router.get("/order/track/:id", isRoleUser, userController.trackingUserOrder )

//del acc route
router.post("/deleteAccount", isRoleUser, userController.deleteUserAccount)

module.exports = router;
