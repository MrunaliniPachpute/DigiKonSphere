const flash = require("connect-flash");
const User = require("../models/User");
const Artisian = require("../models/Artisian");

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) return next();
  req.flash("error", "Login to view this page.");
  res.redirect("/user/login");
}

function isRoleUser(req, res, next) {
  if (req.isAuthenticated() && (req.user instanceof User)) return next();
  req.flash("error", "Login your User account to view this page.");
  res.redirect("/user/login");
}
function isRoleArtisian(req, res, next) {
  if (req.isAuthenticated() && (req.user instanceof Artisian)) return next();
  req.flash("error", "Please log in with your Artisan account to view this page.");
  res.redirect("/artisian/login");
}

module.exports = { isRoleArtisian, isLoggedIn, isRoleUser };