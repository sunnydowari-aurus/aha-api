require("dotenv").config();
const express = require("express");
const cors = require("cors");
const createError = require("http-errors");
const path = require("path");
const connectDB = require(path.join(__dirname, "./config/db"));

// Import all routes
const routes = require(path.join(__dirname, "./routes"));

const app = express();

// Connect to MongoDB
connectDB();

// CORS configuration
const corsOptions = {
  origin: [
    "http://localhost:5012",
    "https://pmt.ahasmarthomes.com",
    "http://192.168.2.235:5011",
    "https://ha.ahasmarthomes.com",
    "http://13.127.48.223:5012",
    "https://www.ahasmarthomes.com",
    "https://www.aurusit.com"
  ],
  credentials: true,
  preflightContinue: false,
  exposedHeaders: ['SET-COOKIE'],
  methods: ['GET', 'POST', 'DELETE', 'UPDATE', 'PUT', 'PATCH']
};

app.use(cors(corsOptions));

// Middleware
app.use(express.static(__dirname + '/'));
app.use(express.json());

// URL normalization middleware - remove double slashes
app.use((req, res, next) => {
  // Normalize the URL by removing double slashes (except after protocol)
  req.url = req.url.replace(/([^:]\/)\/+/g, '$1');
  req.originalUrl = req.originalUrl.replace(/([^:]\/)\/+/g, '$1');
  next();
});

// CORS headers middleware
const whitelist = [
  "https://pmt.ahasmarthomes.com",
  "https://ha.ahasmarthomes.com",
  "http://192.168.2.235:5011",
  "https://www.ahasmarthomes.com"
];

app.all("*", async (req, res, next) => {
  const origin = req.headers.origin;
  if (whitelist.indexOf(origin) != -1) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Access-Control-Allow-Headers", ["Content-Type", "X-Requested-With", "X-HTTP-Method-Override", "Accept", "userToken"]);
  res.header("Access-Control-Expose-Headers", ["userToken"]);
  res.header("Access-Control-Allow-Credentials", true);
  res.header("Access-Control-Allow-Methods", "GET,POST,PATCH");
  res.header("Cache-Control", "no-store,no-cache,must-revalidate");
  res.header("Vary", "Origin");
  if (req.method === "OPTIONS") {
    res.status(200).send("");
    return;
  }
  next();
});

// Mount all routes
app.use(routes);

// 404 handler
app.use(function (req, res, next) {
  const error = createError(404, `Route not found: ${req.method} ${req.originalUrl}`);
  next(error);
});

// Error handler
app.use(function (err, req, res, next) {
  const status = err.status || 500;
  const isDevelopment = req.app.get("env") === "development";
  
  // Log error details
  console.error(`Error ${status}:`, {
    message: err.message,
    method: req.method,
    url: req.originalUrl,
    stack: isDevelopment ? err.stack : undefined
  });

  // Don't send error details in production for security
  const errorResponse = {
    error: {
      message: status === 404 
        ? `Route not found: ${req.method} ${req.originalUrl}`
        : status === 500 
          ? "Internal server error" 
          : err.message,
      status: status
    },
    result: false
  };

  // Include stack trace in development
  if (isDevelopment) {
    errorResponse.error.stack = err.stack;
  }

  res.status(status).json(errorResponse);
});

// Uncaught exception handler
process.on("uncaughtException", function(e) {
  console.log("Exception raised on Production Server:" + e);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/`);
  // console.log(`AHA Email routes: http://localhost:${PORT}/AhaEmail/*`); // Commented out - not in use
  console.log(`Cossmic Email routes: http://localhost:${PORT}/CossmicEmail/*`);
  console.log(`Order routes: http://localhost:${PORT}/Order/*`);
  console.log(`Test Pixel endpoint: http://localhost:${PORT}/test/pixel`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/webhook/zoho-lead`);
});

