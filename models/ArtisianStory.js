const mongoose = require("mongoose");

const artisianStorySchema = new mongoose.Schema({
  artisian: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Artisian",
    required: true,
    unique: true,
  },
  storyText: { type: String, required: true },
  images: [String], 
  generatedVideoUrl: String, 
  status: {
    type: String,
    enum: ["Pending", "Approved", "Generated"],
    default: "Pending"
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("ArtisianStory", artisianStorySchema);
