const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");

const userSchema = new mongoose.Schema({
  email : {
    type : String,
    required : true
  },
  username : {
    type : String,
    required : true
  }
});

userSchema.plugin(passportLocalMongoose, { usernameField: 'email' });

const User = mongoose.model("User", userSchema);
module.exports = User;
