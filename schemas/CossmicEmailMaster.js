const mongoose = require("mongoose");
const { Schema } = mongoose;

const CossmicEmail = new Schema({
    Name: {
        type: String
    },
    EmailID: {
        type: String
    },
    MobileNo: {
        type: String
    },
    Message: {
        type: String
    },
    Url: {
        type: String
    },
    whenEntered: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("CossmicEmail", CossmicEmail, "CossmicEmail");

