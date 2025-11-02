const express = require("express");
const router = express.Router();
const { isRoleArtisian} = require("../middlewares/auth");
const artisianController  = require("../controllers/artisianController.js");
const upload = require("../config/multer");

router
  .route("/signUp")
  .get(artisianController.getSignupArtist)
  .post(artisianController.postSignupArtist);

router
  .route("/login")
  .get(artisianController.getLoginArtistForm)
  .post(artisianController.postLoginArtist);

router.get("/dashboard", isRoleArtisian, artisianController.getArtistDashboard );

router
  .route("/addProd")
  .all(isRoleArtisian)
  .get(artisianController.getAddProdForm)
  .post(upload.single("prod-img"), artisianController.postAddProd);


//ORDERS
router.get("/orders", isRoleArtisian, artisianController.getArtisianOrders)

router.post("/order/ship/:id" , isRoleArtisian, artisianController.shipOrder)

//Del Account
router.post("/deleteAccount", isRoleArtisian, artisianController.delArtistAccount)

//Generate story
router.post("/:id/generateStory", isRoleArtisian, artisianController.generateStory);

router.get("/:id/story", artisianController.getArtisianStory);

module.exports = router;

