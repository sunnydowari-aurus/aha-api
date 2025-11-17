const express = require("express");
const router = express.Router();
const ahaEmailRouter = require("../reference/aha/routes/AhaEmailRoute");

// Mount AHA Email routes
router.use("/", ahaEmailRouter);

module.exports = router;


