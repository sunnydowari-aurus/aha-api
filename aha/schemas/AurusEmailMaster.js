const mongoose = require("mongoose");
const { Schema } = mongoose;

const AurusEmail = new Schema({

    name :{
        type:String
    },
    email :{
        type:String
    },
    countrycode :{
        type:String
    },
    contact :{
        type:String
    },
    message : {
        type:String
    },
    from : {
        type:String
    },
    vacancies:{
        type:String
    },
    file:{
        type:String
    },
    // type:{
    //     type:String
    // },
    isActive:{
        type:Boolean,
        default:true
    },
    whenEntered: {
        type: Date,
        default: new Date(new Date().toISOString()),
    },
   
})

module.exports = mongoose.model("AurusEmail", AurusEmail,"AurusEmail");