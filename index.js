const express = require("express");
const app = express();
const mongoose = require("mongoose");
const FormData = require("form-data");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs");
const dotenv = require("dotenv");
const OwnerInfo = require("./models/OwnerInfo");
const Auth = require("./models/AuthModel");
const cors = require("cors");
const morgan = require("morgan");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

dotenv.config();
app.use(cors());
app.use(morgan("combined"));
app.use(express.json());

//basic variables
const port = 8000;
const mongoUrl = process.env.MONGO_URL;

//variable to store path of image which will be temporarily stored
let vehicle_number_plate_image = "";

//specifying paramters to be used while storing image
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads/");
  },
  filename: (req, file, cb) => {
    //filetype of image of license plate
    const extension = file.mimetype.split("/")[1];
    vehicle_number_plate_image = `${file.fieldname}-${Date.now()}.${extension}`;
    //filename
    cb(null, vehicle_number_plate_image);
  },
});

// Multer Filter which will filter anything that does not fit in the filter criteria
const multerFilter = (req, file, cb) => {
  const allowed_ft = ["jpg", "png", "jpeg"];
  if (allowed_ft.includes(file.mimetype.split("/")[1])) {
    cb(null, true);
  } else {
    cb(new Error("Not an Image File!!"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: multerFilter,
  limits: { fileSize: 1024 * 1024 * 16 },
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
/*
 * @method: Deletes Image
 */
const deleteImg = (imagePath) => {
  //deleting the file after it has been processed
  fs.unlink(imagePath, (err) => {
    if (err) throw err; //handle your error the way you want to;
    console.log(`${imagePath} was deleted`); //or else the file will be deleted
  });
};
/*
 * endpoint to handle registering a new user
 */
app.post("/register", async (req, res) => {
  try {
    if (!req.body.password || !req.body.username || !req.body.email) {
      return res.status(400).send("one of the input fields is missing...");
    } else {
      //generate hashed password

      const email = await Auth.findOne({ email: req.body.email });
      console.log(email);
      if (email) {
        return res
          .status(400)
          .json({ Message: "User with this Email Already Exists!" });
      }

      const userName = await Auth.findOne({ username: req.body.username });

      if (userName) {
        return res
          .status(400)
          .json({ Message: "User with this Username Already Exists!" });
      }

      const saltRounds = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);

      const newUser =
        req.body.role == "Admin"
          ? new Auth({
              username: req.body.username,
              email: req.body.email,
              password: hashedPassword,
              userType: "Admin",
            })
          : new Auth({
              username: req.body.username,
              email: req.body.email,
              password: hashedPassword,
              userType: "User",
            });
      const user = await newUser.save();
      if (user) {
        jwt.sign(
          {
            name: user.username /*this object contains payload*/,
          },
          process.env.SECRET_KEY,
          { expiresIn: "3000s" },
          (err, token) => {
            if (err) {
              console.log(err);
              return res.status(500).json({ error: "backend error..." });
            }
            return res
              .status(200)
              .json({ token: token, name: user.username, role: user.userType });
          }
        );
      } else {
        return res.status(500).json({
          Message: "Could Not register you. Please Try again Later..",
        });
      }
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      Message: "Could Not register you. Please Try again Later..",
    });
  }
});
/*
 * endpoint to handle login
 */
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await Auth.findOne({ username: username });

    //if user is not found
    if (!user)
      return res
        .status(400)
        .json({ Message: "Entered email or Password is Incorrect!" });

    //then, validate the password
    const validatePassword = await bcrypt.compare(password, user.password);

    //if password of user stored in db does not match password entered by client return client error

    if (validatePassword) {
      jwt.sign(
        {
          name: user.username /*this object contains payload*/,
        },
        process.env.SECRET_KEY,
        { expiresIn: "5000s" },
        (err, token) => {
          if (err) {
            return res.status(500).json({ Message: "backend error..." });
          }
          return res
            .status(200)
            .json({ token: token, name: username, role: user.userType });
        }
      );
    } else {
      return res
        .status(400)
        .json({ Message: "Entered email or Password is Incorrect!" });
    }
  } catch (err) {
    return res
      .status(500)
      .json({ Message: "Username or Password is Incorrect" });
  }
});

app.post("/owner_info", upload.single("image"), async (req, res) => {
  const { token, role } = req.body;
  console.log(token);
  console.log(role);
  jwt.verify(token, process.env.SECRET_KEY, async (err, authData) => {
    if (err) {
      console.log(err);
      return res.status(400).json({
        errorText: "Verification Error",
        errorMessage: "Please Log In to Perform This Operation...",
      });
    } else {
      try {
        //assigning location of image to variable
        vehicle_number_plate_image = `./uploads/${vehicle_number_plate_image}`;
        let formdata = new FormData();
        //reading license plate image from it's location using fs
        formdata.append(
          "image",
          fs.createReadStream(vehicle_number_plate_image)
        );
        //making  async post request to backend api because the ml model takes some
        //time for processing
        await axios
          .post(process.env.MODEL_API, formdata, {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          })
          .then(function (response) {
            vehicle = response.data;
          })
          .catch(function (error) {
            return res.status(400).json({
              errorTitle: "Image Error:",
              errorMessage: "Please try Again!",
            });
          });

        console.log("Number Plate" + vehicle);

        //delete image it has been processed
        deleteImg(vehicle_number_plate_image);
        //finding if info of a person with the given number plate exists or not

        //sanitizing input for spaces

        let vehicleStr = "";

        for (let i = 0; i < vehicle.length; i++) {
          if (vehicle[i] != " ") {
            vehicleStr += vehicle[i];
          }
        }

        await OwnerInfo.findOne({ vehicle_number_plate: vehicleStr })
          .then((data) => {
            if (!data) {
              if (role == "Admin") {
                return res.status(200).json({
                  name: vehicleStr,
                  email: "NA",
                  vehicle_number_plate: vehicleStr,
                  phone: "NA",
                  address: "NA",
                  Date: "NA",
                });
              } else {
                return res.status(200).json({
                  name: vehicleStr,
                  email: "NA",
                  vehicle_number_plate: vehicleStr,
                });
              }
            } else {
              (async function () {
                const isUpdated = await Auth.updateOne(
                  {
                    username: authData.name,
                    "clicked_document.post": data._id,
                  },
                  {
                    $set: {
                      "clicked_document.$.last_accessed": Date.now(),
                    },
                  }
                );
                if (isUpdated.modifiedCount == 0)
                  await Auth.updateOne(
                    {
                      username: authData.name,
                      "clicked_document.post": { $ne: data._id },
                    },
                    {
                      $addToSet: {
                        clicked_document: {
                          post: data._id,
                          last_accessed: Date.now(),
                        },
                      },
                    },
                    {
                      upsert: true,
                      new: true,
                    }
                  );
              })();
              if (role == "Admin") return res.status(200).json(data);
              else
                return res.status(200).json({
                  name: data.name,
                  email: data.email,
                  vehicle_number_plate: vehicleStr,
                });
            }
          })
          .catch((err) => {
            console.error(err);
            return res.status(500).json({
              errorText: "DB Error",
              errorMessage: "Could Not Access Backend!",
            });
          });
      } catch (err) {
        console.log(err);
        return res
          .status(500)
          .json({ errorText: "Error", errorMessage: "Backend Error..." });
      }
    }
  });
});

app.post("/history", async (req, res) => {
  try {
    //return all the documents from history collection whose user id is same as the user
    jwt.verify(
      req.body.token,
      process.env.SECRET_KEY,
      async (err, authData) => {
        if (err) {
          return res.status(400).json({
            errorText: "Verification Error",
            errorMessage: "Please Log In to Perform This Operation...",
          });
        } else {
          try {
            //fetching history array and populating with references
            const history = await Auth.find({ username: authData.name })
              .select("clicked_document")
              .populate("clicked_document.post");
            //converting array of object to string
            posts = JSON.stringify(history[0].clicked_document);
            //again converting back to array
            posts = JSON.parse(posts);
            //sorting in decreasing order
            posts.sort(
              (a, b) => new Date(b.last_accessed) - new Date(a.last_accessed)
            );
            return res.status(200).json({ history: posts });
          } catch (err) {
            console.error(err);
            return res.status(500).json({
              errorText: "DB Error",
              errorMessage: "Please Try again...",
            });
          }
        }
      }
    );
  } catch (err) {
    return res.status(500).json({
      errorText: "Backend Error",
      errorMessage: "Could Not Fetch History! Please Try Again...",
    });
  }
});

app.post("/HistoryInfo", async (req, res) => {
  const infoId = req.body._id;
  try {
    jwt.verify(
      req.body.token,
      process.env.SECRET_KEY,
      async (err, authData) => {
        if (err) {
          return res.status(400).json({
            errorText: "Verification Error",
            errorMessage: "Please Log In to Perform This Operation...",
          });
        } else {
          await Auth.updateOne(
            {
              username: authData.name,
              "clicked_document.post": infoId,
            },
            {
              $set: {
                "clicked_document.$.last_accessed": Date.now(),
              },
            }
          );
          return res.status(200).json({ Message: "Success!" });
        }
      }
    );
  } catch (err) {
    return res.status(500).json({
      errorText: "Update Error",
      errorMessage: "Could Not Update History",
    });
  }
});

app.post("/insertInfo", async (req, res) => {
  try {
    jwt.verify(
      req.body.token,
      process.env.SECRET_KEY,
      async (err, authData) => {
        if (err || req.body.role !== "Admin") {
          return res.status(400).json({
            errorText: "Verification Error",
            errorMessage: "Please Log In to Perform This Operation...",
          });
        } else {
          try {
            const { vehicle_number_plate, name, email, phone, address, Date } =
              req.body;

            const newInfo = new OwnerInfo({
              name,
              email,
              vehicle_number_plate,
              phone,
              address,
              Date,
            });
            await newInfo.save();
            (async function () {
              await Auth.updateOne(
                {
                  username: authData.name,
                  "clicked_document.post": { $ne: newInfo._id },
                },
                {
                  $addToSet: {
                    clicked_document: {
                      post: newInfo._id,
                      last_accessed: Date.now(),
                    },
                  },
                },
                {
                  upsert: true,
                  new: true,
                }
              );
            })();
            return res.status(200).json({
              Message: `${req.body.vehicle_number_plate} Info Inserted`,
            });
          } catch (err) {
            return res.status(500).json({
              errorText: "Insert Error",
              errorMessage: "Could Not Insert Record",
            });
          }
        }
      }
    );
  } catch (err) {
    return res.status(500).json({
      errorText: "Insert Error",
      errorMessage: "Could Not Insert Record",
    });
  }
});

app.post("/UpdateInfo", async (req, res) => {
  try {
    jwt.verify(
      req.body.token,
      process.env.SECRET_KEY,
      async (err, authData) => {
        if (err || req.body.role != "Admin") {
          return res.status(400).json({
            errorText: "Verification Error",
            errorMessage: "Please Log In to Perform This Operation...",
          });
        } else {
          try {
            const {
              vehicle_number_plate,
              name,
              email,
              phone,
              address,
              Date,
              _id,
            } = req.body;
            await OwnerInfo.updateOne(
              { _id: req.body._id },
              {
                vehicle_number_plate,
                name,
                email,
                phone,
                address,
                Date,
                _id,
              }
            );
            res.status(200).json({
              Message: `${req.body.vehicle_number_plate} Info Updated`,
            });
          } catch (err) {
            return res.status(500).json({
              errorText: "Update Error",
              errorMessage: `Error While Updating`,
            });
          }
        }
      }
    );
  } catch (err) {
    return res.status(500).json({
      errorText: "Update Error",
      errorMessage: `Error While Updating`,
    });
  }
});

app.listen(port, () => {
  console.log(`server running at port ${port}`);
});
