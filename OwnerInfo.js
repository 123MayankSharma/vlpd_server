const mongoose = require("mongoose")

const OwnerSchema = new mongoose.Schema({
  name:String,
  email:String,
  vehicle_number_plate:String,
  phone:String,
  address:String,
  Date:String
})


mongoose.model("owner",OwnerSchema)




