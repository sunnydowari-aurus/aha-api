const express = require("express");
const router = express.Router();

// Import all route modules
const healthRoutes = require("./healthRoutes");
const testRoutes = require("./testRoutes");
const ahaEmailRoutes = require("./ahaEmailRoutes");
const cossmicEmailRoutes = require("./cossmicEmailRoutes");
const orderRoutes = require("./orderRoutes");

// Mount all routes
router.use("/", healthRoutes);
router.use("/", testRoutes);
router.use("/AhaEmail", ahaEmailRoutes);
router.use("/CossmicEmail", cossmicEmailRoutes);
router.use("/Order", orderRoutes);

module.exports = router;


