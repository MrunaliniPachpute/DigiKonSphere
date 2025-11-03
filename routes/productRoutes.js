const express = require("express");
const router = express.Router();
const productController  = require("../controllers/productController.js");
require("dotenv").config();
const { isRoleUser, isRoleArtisian, isLoggedIn } = require("../middlewares/auth");

const upload = require("../config/multer");

router.get("/:id", productController.getProdById)

router.get("/deleteProd/:id", isRoleArtisian, productController.deleteProduct)

router
  .route("/editProd/:id")
  .all(isLoggedIn, isRoleArtisian)
  .get(productController.geteditProductForm)
  .put( upload.single("prod-img"), productController.putEditedProduct)

router.get("/:id/addToCart", isRoleUser, productController.addToCart);

router.get("/tryOn/:id", productController.tryOnProduct)
router.get("3dPreview/:id", productController.Preview3d);
module.exports = router;
