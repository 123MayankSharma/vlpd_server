const mongoose = require("mongoose");

const OwnerSchema = new mongoose.Schema({
  name: {
    type: String,
    require: true,
  },
  email: {
    type: String,
    require: true,
  },
  vehicle_number_plate: {
    type: String,
    require: true,
  },
  phone: {
    type: String,
    require: true,
  },
  address: {
    type: String,
    require: true,
  },
  Date: {
    type: String,
    require: true,
  },
});

module.exports = mongoose.model("owner", OwnerSchema);
