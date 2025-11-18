const express = require("express");
const router = express.Router();
const path = require("path");
const emailModule = require(path.join(__dirname, "../modules/CossmicEmailModule"));

router.post("/createEmail", emailModule.createEmail);

module.exports = router;
