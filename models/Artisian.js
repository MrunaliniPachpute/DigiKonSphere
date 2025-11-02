const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");

const artisianSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  street: { type: String },
  city: { type: String },
  state: { type: String },
  country: { type: String },
  pincode: { type: String },
  contact : {type : Number},
  craftType: { type: String, required: true },
});

artisianSchema.plugin(passportLocalMongoose, { usernameField: "email" });

module.exports = mongoose.model("Artisian", artisianSchema);
