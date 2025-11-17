const express = require("express");
const router = express.Router();
const orderRouter = require("../reference/src/routes/Order");

// Mount Order routes
router.use("/", orderRouter);

module.exports = router;


