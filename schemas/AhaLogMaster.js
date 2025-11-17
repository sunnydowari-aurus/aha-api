const mongoose = require("mongoose");
const { Schema } = mongoose;

const AhaLogMaster = new Schema({
    // Add your log schema fields here based on your requirements
    logData: {
        type: Schema.Types.Mixed
    },
    whenEntered: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("AhaLogMaster", AhaLogMaster, "AhaLogMaster");

