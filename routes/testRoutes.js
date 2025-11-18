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

// Helper function to split full_name into first name (fn) and last name (ln)
const splitFullName = (fullName) => {
  if (!fullName || typeof fullName !== 'string') {
    return { fn: null, ln: null };
  }
  
  const trimmedName = fullName.trim();
  if (!trimmedName) {
    return { fn: null, ln: null };
  }
  
  const nameParts = trimmedName.split(/\s+/);
  
  if (nameParts.length === 1) {
    // Only one name part - treat as last name
    return { fn: null, ln: nameParts[0] };
  } else {
    // First part is first name, rest is last name
    const fn = nameParts[0];
    const ln = nameParts.slice(1).join(' ');
    return { fn, ln };
  }
};

// Helper function to clean phone number per Facebook requirements
// Remove symbols (including +), letters, leading zeros. Must include country code as numeric prefix.
const cleanPhoneNumber = (phone) => {
  if (!phone || typeof phone !== 'string') {
    return null;
  }
  
  // Remove all non-numeric characters (including +, letters, symbols)
  let cleaned = phone.replace(/[^\d]/g, '');
  
  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, '');
  
  // If number doesn't have country code, add default (assuming India 91)
  // You can modify this logic based on your needs
  if (cleaned.length > 0) {
    // Check if it looks like an Indian number (starts with 91 or 10 digits)
    if (cleaned.startsWith('91') && cleaned.length >= 12) {
      // Already has country code 91
      // Do nothing
    } else if (cleaned.length === 10) {
      // Assume Indian number (10 digits), add country code 91
      cleaned = '91' + cleaned;
    } else if (cleaned.length < 8) {
      // Too short, invalid
      return null;
    }
    // If it's 11+ digits and doesn't start with 91, assume it already has a country code
  } else {
    return null; // Empty after cleaning
  }
  
  // Final validation - must have reasonable length (at least 8 digits including country code)
  if (cleaned.length < 8) {
    return null; // Invalid phone number
  }
  
  return cleaned; // Return numeric string without + symbol
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
      // Handle Zoho CRM field names: ph, zp, ct, st
      // Map CRM fields to standard format
      const rawPhone = event.ph || event.phone || null;
      const rawFullName = event.full_name || null;
      const rawCity = event.ct || event.city || null;
      const rawState = event.st || event.state || null;
      const rawPincode = event.zp || event.pincode || null;

      // Clean phone number
      const cleanedPhone = cleanPhoneNumber(rawPhone);
      
      // Split full name into first and last name
      const { fn, ln } = splitFullName(rawFullName);

      // Build processed event with both original and processed fields
      const processedEvent = {
        // Event metadata
        event_name: event.event_name || "Lead",
        event_time: event.event_time || Math.floor(Date.now() / 1000),
        action_source: event.action_source || "website",
        meta_lead_id: event.meta_lead_id || null,
        
        // Original fields (for reference)
        full_name: rawFullName,
        phone_raw: rawPhone,
        city_raw: rawCity,
        state_raw: rawState,
        pincode_raw: rawPincode,
        country: event.country || null,
        email: event.email || null,
        
        // Processed fields (ready for Facebook Pixel)
        fn: fn, // First name
        ln: ln, // Last name
        phone: cleanedPhone, // Cleaned phone with country code
        city: rawCity,
        state: rawState,
        pincode: rawPincode,
        
        // Metadata
        received_at: new Date().toISOString(),
        index: index
      };

      console.log(`\nEvent ${index + 1}:`, JSON.stringify(processedEvent, null, 2));
      console.log(`  → Name split: "${rawFullName}" → fn: "${fn}", ln: "${ln}"`);
      console.log(`  → Phone cleaned: "${rawPhone}" → "${cleanedPhone}"`);
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
      processed_fields: {
        fn: "First name (split from full_name)",
        ln: "Last name (split from full_name)",
        phone: "Cleaned phone number with country code",
        city: "City (from ct field)",
        state: "State (from st field)",
        pincode: "Pincode/Zipcode (from zp field)"
      },
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

