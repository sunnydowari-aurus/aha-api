const mongoose = require("mongoose");
const { Schema } = mongoose;

const AhaEmail = new Schema({
    Name: {
        type: String
    },
    LName: {
        type: String
    },
    Email: {
        type: String
    },
    Mobile: {
        type: String
    },
    Comment: {
        type: String
    },
    utm_source: {
        type: String
    },
    utm_medium: {
        type: String
    },
    utm_campaign: {
        type: String
    },
    utm_content: {
        type: String
    },
    utm_term: {
        type: String
    },
    from: {
        type: String
    },
    preferredTime: {
        type: String
    },
    apiName: {
        type: String
    },
    objPageName: {
        type: String
    },
    whenEntered: {
        type: Date
    }
});

module.exports = mongoose.model("AhaEmail", AhaEmail, "AhaEmail");

