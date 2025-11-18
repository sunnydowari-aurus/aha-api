const mongoose = require("mongoose");
const { Schema } = mongoose;

const AhaLogMaster = new Schema({
 from:{
    type:String
 },
 request:{
    type:Object
 },
 response:{
    type:Object
 },
 whenEntered: {
    type: Date,
    default: new Date(new Date().toISOString()),
 },
   
})

module.exports = mongoose.model("AhaLogMaster", AhaLogMaster,"AhaLogMaster");