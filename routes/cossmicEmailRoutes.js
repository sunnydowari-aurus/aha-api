const express = require("express");
const router = express.Router();
const cossmicRouter = require("../reference/cossmic/routes/CossmicMasterRoute");

// Mount Cossmic Email routes
router.use("/", cossmicRouter);

module.exports = router;


