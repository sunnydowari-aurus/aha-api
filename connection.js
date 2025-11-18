const mongoose = require("mongoose");

mongoose
  // .connect("mongodb://localhost:27017/epixWebsite", {
  //   useNewUrlParser: true,
  // })
  .connect('mongodb+srv://dbAhaPM:ECBk1ix8syXwuklk@aha-cluster.cbwdhaw.mongodb.net/Aha_Sass_CMS')
  .then(() => {
    console.log("DB Connection Successfull !");
  })
  .catch((error) => {
    console.log("DB Connection Failed!", error);
  });
