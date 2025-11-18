const express = require("express");
const router = express.Router();
const crypto = require("crypto");

// Helper function to hash data for Meta CAPI
const sha256 = (v) => {
  if (!v) return null;
  return crypto
    .createHash("sha256")
    .update(v.toLowerCase().trim())
    .digest("hex");
};

// Test endpoint - Currently just logs data, Facebook Pixel integration disabled
router.post("/test/pixel", async (req, res) => {
  try {
    const data = req.body;

    // Handle array format or single object format
    const events = Array.isArray(data) ? data : [data];

    console.log("=".repeat(80));
    console.log("RECEIVED DATA (Facebook Pixel call disabled - logging only):");
    console.log("=".repeat(80));
    console.log(JSON.stringify(events, null, 2));
    console.log("=".repeat(80));

    // Process each event in the array
    const processedEvents = events.map((event, index) => {
      const processedEvent = {
        event_name: event.event_name || "Lead",
        event_time: event.event_time || Math.floor(Date.now() / 1000),
        action_source: event.action_source || "website",
        meta_lead_id: event.meta_lead_id || null,
        full_name: event.full_name || null,
        phone: event.phone || null,
        email: event.email || null,
        city: event.city || null,
        state: event.state || null,
        pincode: event.pincode || null,
        country: event.country || null,
        received_at: new Date().toISOString(),
        index: index
      };

      console.log(`\nEvent ${index + 1}:`, JSON.stringify(processedEvent, null, 2));
      return processedEvent;
    });

    // TODO: Facebook Pixel integration will be added here later
    // const response = await fetch(
    //   `https://graph.facebook.com/v18.0/${process.env.PIXEL_ID}/events?access_token=${process.env.ACCESS_TOKEN}`,
    //   {
    //     method: "POST",
    //     body: JSON.stringify({ data: processedEvents }),
    //     headers: { "Content-Type": "application/json" },
    //   }
    // );

    return res.json({ 
      ok: true, 
      message: "Data received and logged successfully (Facebook Pixel integration disabled)",
      events_received: events.length,
      events: processedEvents,
      note: "Facebook Pixel API call is currently disabled. Data is only being logged."
    });
  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ error: "internal error", message: err.message });
  }
});

// Zoho webhook endpoint - Currently just logs data, Facebook Pixel integration disabled
router.post("/webhook/zoho-lead", async (req, res) => {
  try {
    // Validate secret (optional - can be disabled for testing)
    if (process.env.ZOHO_SHARED_SECRET && req.headers["x-zoho-secret"] !== process.env.ZOHO_SHARED_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const data = req.body;

    // Handle array format or single object format
    const events = Array.isArray(data) ? data : [data];

    console.log("=".repeat(80));
    console.log("ZOHO WEBHOOK DATA (Facebook Pixel call disabled - logging only):");
    console.log("=".repeat(80));
    console.log(JSON.stringify(events, null, 2));
    console.log("=".repeat(80));

    // Process each event in the array
    const processedEvents = events.map((event, index) => {
      const processedEvent = {
        event_name: event.event_name || "Zoho_FB_Lead_New",
        event_time: event.event_time || Math.floor(Date.now() / 1000),
        action_source: event.action_source || "website",
        meta_lead_id: event.meta_lead_id || event.lead_id || null,
        full_name: event.full_name || `${event.first_name || ""} ${event.last_name || ""}`.trim() || null,
        phone: event.phone || null,
        email: event.email || null,
        city: event.city || null,
        state: event.state || null,
        pincode: event.pincode || null,
        country: event.country || null,
        received_at: new Date().toISOString(),
        index: index
      };

      console.log(`\nEvent ${index + 1}:`, JSON.stringify(processedEvent, null, 2));
      return processedEvent;
    });

    // TODO: Facebook Pixel integration will be added here later
    // const response = await fetch(
    //   `https://graph.facebook.com/v18.0/${process.env.PIXEL_ID}/events?access_token=${process.env.ACCESS_TOKEN}`,
    //   {
    //     method: "POST",
    //     body: JSON.stringify({ data: processedEvents }),
    //     headers: { "Content-Type": "application/json" },
    //   }
    // );

    return res.json({ 
      ok: true, 
      message: "Webhook data received and logged successfully (Facebook Pixel integration disabled)",
      events_received: events.length,
      events: processedEvents,
      note: "Facebook Pixel API call is currently disabled. Data is only being logged."
    });
  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ error: "internal error", message: err.message });
  }
});

module.exports = router;

