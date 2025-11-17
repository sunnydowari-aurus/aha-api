const express = require("express");
const router = express.Router();
const emailModule = require("../modules/CossmicEmailModule");

router.post("/createEmail", emailModule.createEmail);

module.exports = router;
