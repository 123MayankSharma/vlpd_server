const mongoose = require("mongoose");

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
});

module.exports = mongoose.model("AuthInfo", AuthModel);
