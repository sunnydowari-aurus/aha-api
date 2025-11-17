const mongoose = require("mongoose");
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("DB Connection Successful!");
  } catch (error) {
    console.log("DB Connection Failed!", error);
    process.exit(1);
  }
};

module.exports = connectDB;


