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

// Test endpoint to verify Facebook Pixel is working
router.post("/test/pixel", async (req, res) => {
  try {
    const data = req.body;

    // Extract lead fields (with defaults for testing)
    const leadId = data.lead_id || `test_${Date.now()}`;
    const email = data.email;
    const phone = data.phone;
    const firstName = data.first_name;
    const lastName = data.last_name;
    const createdTime = data.created_time 
      ? Math.floor(new Date(data.created_time).getTime() / 1000)
      : Math.floor(Date.now() / 1000);

    // Hash user data for Meta CAPI
    const user_data = {};
    if (email) user_data.em = [sha256(email)];
    if (phone) user_data.ph = [sha256(phone.replace(/\D/g, ""))];
    if (firstName) user_data.fn = [sha256(firstName)];
    if (lastName) user_data.ln = [sha256(lastName)];

    // Create event object for Meta
    const eventObj = {
      event_name: "Lead",
      event_time: createdTime,
      action_source: "other",
      event_id: `lead_${leadId}`,
      user_data,
      custom_data: {
        lead_id: leadId,
        lead_source: data.lead_source || "Test",
        city: data.city || "",
      },
    };

    console.log("Sending to Meta CAPI:", JSON.stringify(eventObj, null, 2));

    // Send to Meta CAPI
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${process.env.PIXEL_ID}/events?access_token=${process.env.ACCESS_TOKEN}`,
      {
        method: "POST",
        body: JSON.stringify({ data: [eventObj] }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const json = await response.json();
    console.log("Meta CAPI Response:", json);

    return res.json({ 
      ok: true, 
      meta: json,
      sent_data: eventObj
    });
  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ error: "internal error", message: err.message });
  }
});

// Zoho webhook endpoint
router.post("/webhook/zoho-lead", async (req, res) => {
  try {
    // Validate secret
    if (req.headers["x-zoho-secret"] !== process.env.ZOHO_SHARED_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const data = req.body;

    // Extract lead fields
    const leadId = data.lead_id;
    const email = data.email;
    const phone = data.phone;
    const firstName = data.first_name;
    const lastName = data.last_name;
    const createdTime = Math.floor(new Date(data.created_time).getTime() / 1000);

    // Hash user data for Meta CAPI
    const user_data = {};
    if (email) user_data.em = [sha256(email)];
    if (phone) user_data.ph = [sha256(phone.replace(/\D/g, ""))];
    if (firstName) user_data.fn = [sha256(firstName)];
    if (lastName) user_data.ln = [sha256(lastName)];

    // Create event object for Meta
    const eventObj = {
      event_name: "Lead",
      event_time: createdTime,
      action_source: "other",
      event_id: `lead_${leadId}`,
      user_data,
      custom_data: {
        lead_id: leadId,
        lead_source: data.lead_source || "",
        city: data.city || "",
      },
    };

    // Send to Meta CAPI
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${process.env.PIXEL_ID}/events?access_token=${process.env.ACCESS_TOKEN}`,
      {
        method: "POST",
        body: JSON.stringify({ data: [eventObj] }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const json = await response.json();
    console.log("Meta CAPI Response:", json);

    return res.json({ ok: true, meta: json });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal error" });
  }
});

module.exports = router;

