const mongoose = require("mongoose");
const { Schema } = mongoose;

const AurusEmail = new Schema({
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
    whenEntered: {
        type: Date
    }
});

module.exports = mongoose.model("AurusEmail", AurusEmail, "AurusEmail");

