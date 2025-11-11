const mongoose = require("mongoose");

mongoose.connect("mongodb://127.0.0.1:27017/socialapp");

const userSchema = mongoose.Schema({
  name: String,
  username: String,
  email: String,
  password: String,
  age: Number,
  profile: { type: String, default: "default.png" },
  posts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
});

module.exports = mongoose.model("User", userSchema);
