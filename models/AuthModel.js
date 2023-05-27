const mongoose = require("mongoose");

const ownerInfoDoc = new mongoose.Schema({
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "owner",
  },
  last_accessed: {
    type: Date,
    default: Date.now,
  },
});
const AuthModel = new mongoose.Schema({
  username: {
    type: String,
    min: 3,
    max: 40,
  },
  email: {
    type: String,
    min: 6,
  },
  password: {
    type: String,
    min: 6,
    max: 40,
  },
  userType: {
    type: String,
  },
  clicked_document: {
    type: [ownerInfoDoc],
    index: true,
  },
});

module.exports = mongoose.model("AuthInfo", AuthModel);
