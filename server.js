require("dotenv").config();
const express = require("express");
const path = require("path");
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "public")));

// Import routes
const fbpixelRoutes = require("./routes/fbpixel");
const googleRoutes = require("./routes/google");
const testRoutes = require("./routes/test");
const webhookRoutes = require("./routes/webhook");
const oauthRoutes = require("./routes/oauth");

// Register routes
app.use("/fbpixel", fbpixelRoutes.router);
app.use("/google", googleRoutes);
app.use("/test", testRoutes);
app.use("/webhook", webhookRoutes);
app.use("/oauth", oauthRoutes);

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Zoho Webhook Meta CAPI Server" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Facebook Pixel endpoint: http://localhost:${PORT}/fbpixel`);
  console.log(`Google Conversion endpoint: http://localhost:${PORT}/google`);
  console.log(`Test Pixel endpoint: http://localhost:${PORT}/test/pixel`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/webhook/zoho-lead`);
  console.log(`OAuth Test Page: http://localhost:${PORT}/oauth.html`);
  console.log(`Google Conversion Test Page: http://localhost:${PORT}/test-google.html`);
});

