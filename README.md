# Zoho Webhook Integration with Meta CAPI

This Node.js Express server receives webhook events from Zoho CRM and forwards lead data to Meta Conversions API (Facebook Pixel).

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory with the following content:

```env
# Meta Facebook Pixel Configuration
PIXEL_ID=1234567890
ACCESS_TOKEN=YOUR_META_CAPI_ACCESS_TOKEN

# Zoho Webhook Security
ZOHO_SHARED_SECRET=YOUR_SHARED_SECRET

# Server Configuration (optional)
PORT=3000
```

Update the following variables:

- `PIXEL_ID`: Your Facebook Pixel ID
- `ACCESS_TOKEN`: Your Meta Conversions API access token
- `ZOHO_SHARED_SECRET`: A shared secret for validating Zoho webhook requests
- `PORT`: Server port (optional, defaults to 3000)

### 3. Start the Server

```bash
npm start
```

The server will start on `http://localhost:3000` (or your configured PORT).

## API Endpoints

### POST `/webhook/zoho-lead`

Receives Zoho CRM lead webhook and forwards to Meta CAPI.

**Headers:**
- `x-zoho-secret`: Must match `ZOHO_SHARED_SECRET` from `.env`
- `Content-Type`: `application/json`

**Request Body:**
```json
{
  "lead_id": "1234567890",
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@example.com",
  "phone": "+1234567890",
  "lead_source": "Website",
  "city": "New York",
  "created_time": "2024-01-15T10:30:00Z"
}
```

**Response:**
```json
{
  "ok": true,
  "meta": {
    "events_received": 1,
    "messages": [],
    "fbtrace_id": "..."
  }
}
```

## Testing with Postman

### Postman Request Configuration

1. **Method**: `POST`
2. **URL**: `http://localhost:3000/webhook/zoho-lead`

3. **Headers**:
   - `x-zoho-secret`: `YOUR_SHARED_SECRET` (must match your `.env` value)
   - `Content-Type`: `application/json`

4. **Body** (raw JSON):
```json
{
  "lead_id": "1234567890",
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@example.com",
  "phone": "+1-234-567-8900",
  "lead_source": "Website",
  "city": "New York",
  "created_time": "2024-01-15T10:30:00Z"
}
```

### Expected Response

**Success (200 OK):**
```json
{
  "ok": true,
  "meta": {
    "events_received": 1,
    "messages": [],
    "fbtrace_id": "ABC123..."
  }
}
```

**Unauthorized (401):**
```json
{
  "error": "Unauthorized"
}
```

**Error (500):**
```json
{
  "error": "internal error"
}
```

## Zoho CRM Configuration

### Setting up the Webhook in Zoho

1. Go to **Setup → Automation → Workflow Rules**
2. Create a new rule:
   - **Module**: Leads
   - **When**: On Create
   - **Condition**: All Leads (or filter if needed)
3. Add a **Webhook** action:
   - **Method**: POST
   - **URL**: `https://<your-domain-or-ip>/webhook/zoho-lead`
   - **Headers**:
     - `x-zoho-secret`: `YOUR_SHARED_SECRET`
     - `Content-Type`: `application/json`
4. **Webhook Body** (use this JSON template in Zoho):
```json
{
  "lead_id": "${Leads.Lead Id}",
  "first_name": "${Leads.First Name}",
  "last_name": "${Leads.Last Name}",
  "email": "${Leads.Email}",
  "phone": "${Leads.Phone}",
  "lead_source": "${Leads.Lead Source}",
  "city": "${Leads.City}",
  "created_time": "${Leads.Created Time}"
}
```

## How It Works

1. Zoho CRM sends a webhook POST request when a new lead is created
2. The server validates the `x-zoho-secret` header
3. Lead data is extracted and user data (email, phone, names) is hashed using SHA256
4. A Meta CAPI event object is created with:
   - Event name: "Lead"
   - Hashed user data for privacy
   - Custom data (lead_id, lead_source, city)
5. The event is sent to Meta Graph API
6. Response is returned to Zoho

## Verification

After sending a test webhook:

1. **Check server logs** for Meta CAPI response
2. **Check Meta Events Manager**:
   - Go to Events Manager → Test Events
   - You should see "Lead" events with Source: "Server"

## Troubleshooting

- **401 Unauthorized**: Check that `x-zoho-secret` header matches your `.env` value
- **500 Internal Error**: Check server logs for details. Verify `PIXEL_ID` and `ACCESS_TOKEN` are correct
- **No events in Meta**: Verify your access token has the correct permissions for Conversions API

