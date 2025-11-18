const mongoose = require("mongoose");
const { Schema } = mongoose;

const AhaEmail = new Schema({

    Name :{
        type:String
    },
    LName :{
        type:String
    },
    apiName :{
        type:String
    },
    Email : {
        type:String
    },
    Mobile : {
        type:String
    },
    Comment:{
        type:String
    },
    Address:{
        type:String
    },
    Pincode:{
        type:String
    },
    City:{
        type:String
    },
    State:{
        type:String
    },
    InitialInv:{
        type:String
    },
    utm_source:{
        type:String
    },
    utm_medium:{
        type:String
    },
    utm_campaign:{
        type:String
    },
    utm_content:{
        type:String
    },
    utm_term:{
        type:String
    },
    from:{
        type:String
    },
    preferredTime:{
        type:String
    },
    StageOfConstruction:{
        type:String
    },
    PropertisType:{
        type:String
    },
    PropertyStage:{
        type:String
    },
    PropertyTimeline:{
        type:String
    },
    IntrestedServices:{
        type:Array
    },
    eventType:{
        type:String
    },
    id:{
        type:String
    },
    created:{
        type:String
    },
    waId:{
        type:String
    },
    senderName:{
        type:String
    },
    sourceId:{
        type:String
    },
    sourceUrl:{
        type:String
    },
    sourceType:{
        type:String
    },
    isActive:{
        type:Boolean,
        default:true
    },
    whenEntered: {
        type: Date,
        default: new Date(new Date().toISOString()),
    },
   
})

module.exports = mongoose.model("AhaEmail", AhaEmail,"AhaEmail");