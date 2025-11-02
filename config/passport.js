const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const User = require("../models/User");
const Artisian = require("../models/Artisian");

  passport.use(
    "user-local",
    new LocalStrategy({ usernameField: "email" }, User.authenticate())
  );
  passport.use(
    "artisian-local",
    new LocalStrategy({ usernameField: "email" }, Artisian.authenticate())
  );

  passport.serializeUser((user, done) => {
    done(null, { id: user.id, type: user.constructor.modelName });
  });

  passport.deserializeUser(async (obj, done) => {
    try {
      const Model = obj.type === "User" ? User : Artisian;
      const user = await Model.findById(obj.id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
console.log("Passport strategies registered");

module.exports = passport;
