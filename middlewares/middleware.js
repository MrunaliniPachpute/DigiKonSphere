module.exports = function setupMiddleware(app) {
  const express = require("express");
  const expressLayouts = require("express-ejs-layouts");
  const bodyParser = require("body-parser");
  const methodOverride = require("method-override");
  const session = require("express-session");
  const flash = require("connect-flash");
  const passport = require("../config/passport");

  app.use(express.urlencoded({ extended: true }));
  app.use(express.static("public"));
  app.use(expressLayouts);
  app.set("view engine", "ejs");
  app.set("layout", "layout");
  app.use(bodyParser.json());
  app.use(methodOverride("_method"));
  app.use(
    session({
      secret: process.env.MYSECRET,
      resave: false,
      saveUninitialized: true,
      cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: false,
      },
    })
  );
  app.use(flash());
  app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    next();
  });

  app.use(passport.initialize());
  app.use(passport.session());


  app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    next();
  });

}