# AHA Email HA Server

Unified Express server that consolidates all routes from reference files and test-api.

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory. See `ENV_VARIABLES.md` for all required variables.

**Important:** Set the `MONGODB_URI` variable with your MongoDB connection string (replacing the hardcoded value from `reference/connection.js`).

### 3. Start the Server

**Development mode (with nodemon):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on the port specified in your `.env` file (default: 3000).

## API Routes

### AHA Email Routes
- Base path: `/AhaEmail/*`
- Routes: sendEmail, sendNewAHAEmail, sendEmailZohoAHA, sendWhatsappData, sendEmailFranchise, sendAurusEmail, getEmail, getAHALog, getAurusEmail, updateEmail, updateAurusEmail, sendCurtainsEmail, careerAurusEmail, sendMumbaiLandingEmail, WebHook

### Cossmic Email Routes
- Base path: `/CossmicEmail/*`
- Routes: createEmail

### Order Routes
- Base path: `/Order/*`
- Routes: getResourceId, PushOrderDataRista

### Test API Routes (Zoho Webhook & Meta CAPI)
- `POST /ahaleads/fb-pixel` - AHA Leads Facebook Pixel endpoint (sends data to Facebook Pixel CAPI)
- `POST /webhook/zoho-lead` - Zoho CRM webhook endpoint

### Health Check
- `GET /` - Server health check

## Project Structure

```
.
├── server.js                 # Main Express server file
├── config/
│   └── db.js                # MongoDB connection configuration
├── routes/                   # All route files
│   ├── index.js             # Route aggregator
│   ├── healthRoutes.js      # Health check routes
│   ├── fbpixelRoute.js      # Facebook Pixel CAPI routes (Zoho webhook & Meta CAPI)
│   ├── ahaEmailRoutes.js    # AHA Email routes
│   ├── cossmicEmailRoutes.js # Cossmic Email routes
│   └── orderRoutes.js       # Order/Rista routes
├── modules/                  # Business logic modules
│   ├── AHAEmailModule.js    # AHA Email module functions
│   ├── CossmicEmailModule.js # Cossmic Email module functions
│   └── StaticModule.js      # Static utility functions
├── schemas/                  # MongoDB schemas
│   ├── AhaEmailMaster.js
│   ├── AhaLogMaster.js
│   ├── AurusEmailMaster.js
│   └── CossmicEmailMaster.js
├── package.json             # Dependencies and scripts
└── ENV_VARIABLES.md         # Environment variables documentation
```

## Features

- ✅ Unified Express server with all routes
- ✅ MongoDB connection via environment variables
- ✅ Nodemon support for development
- ✅ CORS configuration
- ✅ Error handling middleware
- ✅ Integration of test-api routes (Zoho webhook & Meta CAPI)


