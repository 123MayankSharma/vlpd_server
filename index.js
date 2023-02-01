const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const FormData = require("form-data")
const multer = require("multer")
const axios = require("axios")
const fs = require('fs')
const dotenv=require('dotenv')

dotenv.config()
require("./OwnerInfo");
//using body Parser
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

//basic variables
const port = 8000;
const OwnerInfo = mongoose.model("owner");
const mongoUrl =process.env.MONGO_URL;

//variable to store path of image which will be temporarily stored
let vehicle_number_plate_image = ""

//specifying paramters to be used while storing image
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads/");
  },
  filename: (req, file, cb) => {
    //filetype of image of license plate
    const extension = file.mimetype.split("/")[1];
    vehicle_number_plate_image = `${file.fieldname}-${Date.now()}.${extension}`
    //filename
    cb(null, vehicle_number_plate_image);
  },
});

// Multer Filter which will filter anything that does not fit in the filter criteria
const multerFilter = (req, file, cb) => {
  const allowed_ft = ["jpg", "png", "jpeg"]
  if (allowed_ft.includes(file.mimetype.split("/")[1])) {
    cb(null, true);
  } else {
    cb(new Error("Not an Image File!!"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: multerFilter,
  limits: { fileSize: 1024 * 1024 * 16 }
});

//variable to store vehicle_number_plate that wil
//be returned as response from ml flask api
let vehicle = "";

mongoose.connect(mongoUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

mongoose.connection.on("connected", () => {
  console.log("connected to mongoDB");
});

mongoose.connection.on("error", (err) => {
  throw err;
});

const deleteImg = (imagePath) => {
  //deleting the file after it has been processed
  fs.unlink(imagePath, (err) => {
    if (err) throw err //handle your error the way you want to;
    console.log(`${imagePath} was deleted`);//or else the file will be deleted
  });

}

app.post("/owner_info", upload.single("image"), async (req, res) => {

  //assigning location of image to variable
  vehicle_number_plate_image = `./uploads/${vehicle_number_plate_image}`
  let formdata = new FormData()
  //reading license plate image from it's location using fs
  formdata.append("image", fs.createReadStream(vehicle_number_plate_image));
  //making  async post request to backend api because the ml model takes some 
  //time for processing
  await axios.post(process.env.MODEL_API, formdata, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  })
    .then(function(response) {
      vehicle = response.data
    })
    .catch(function(error) {
      res.status(400).json({errorTitle:"Image Error:",errorMessage:"Please try Again!"})
    });
 
    console.log(vehicle)
    
  //delete image it has been processed
  deleteImg(vehicle_number_plate_image)
  //finding if info of a person with the given number plate exists or not
  
  //sanitizing input for spaces
  
  let vehicleStr=""

  for(let i=0;i<vehicle.length;i++){
      if(vehicle[i]!=" "){
        vehicleStr+=vehicle[i]
    }
  }

 console.log(vehicleStr) 

  OwnerInfo.findOne({vehicle_number_plate:vehicleStr})
    .then((data) => {
      
      if (!data) {
        res.status(200).json({
        name: vehicleStr,
        email: 'NA',
        vehicle_number_plate:vehicleStr,
        phone: 'NA',
        address: 'NA',
        Date: 'NA'
    }
  )
      } else {
        res.status(200).send(data) 
      }
    })
    .catch((err) => {
      console.log(err);
    });

})

app.listen(port, () => {
  console.log(`server running at port ${port}`);
});
