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

// AHA Leads Facebook Pixel endpoint - Sends data to Facebook Pixel CAPI
router.post("/ahaleads/fb-pixel", async (req, res) => {
  try {
    // Validate environment variables
    if (!process.env.PIXEL_ID) {
      return res.status(400).json({ 
        error: "Missing PIXEL_ID environment variable",
        message: "Please set PIXEL_ID in your .env file"
      });
    }
    
    if (!process.env.ACCESS_TOKEN) {
      return res.status(400).json({ 
        error: "Missing ACCESS_TOKEN environment variable",
        message: "Please set ACCESS_TOKEN in your .env file"
      });
    }

    const data = req.body;

    // Handle array format or single object format
    const events = Array.isArray(data) ? data : [data];

    console.log("=".repeat(80));
    console.log("RECEIVED DATA:");
    console.log("=".repeat(80));
    console.log(JSON.stringify(events, null, 2));
    console.log("=".repeat(80));

    // Process each event in the array
    const processedEvents = events.map((event, index) => {
      // Debug: Log raw event data for troubleshooting
      console.log(`\nProcessing Event ${index + 1}:`);
      console.log(`  Raw event keys:`, Object.keys(event));
      console.log(`  Raw event values:`, {
        ph: event.ph,
        phone: event.phone,
        full_name: event.full_name,
        ct: event.ct,
        city: event.city,
        st: event.st,
        state: event.state,
        zp: event.zp,
        pincode: event.pincode,
        lead_id: event.lead_id,
        country: event.country
      });

      // Handle Zoho CRM field names: ph, zp, ct, st
      // Map CRM fields to standard format
      const rawPhone = event.ph;
      const rawFullName = event.full_name;
      const rawCity = event.ct;
      const rawState = event.st;
      const rawPincode = event.zp;
      // Handle lead ID - check multiple possible field names
      const rawLeadId = event.lead_id;
      // Extract event_id from CRM (separate from lead_id)
      const rawEventId = event.event_id || null;
      
      // Debug: Log lead ID extraction
      if (!rawLeadId) {
        console.log(`  → Lead ID not found. Checked fields: lead_id=${event.lead_id}, id=${event.id}, Lead_ID=${event.Lead_ID}, record_id=${event.record_id}, zoho_lead_id=${event.zoho_lead_id}`);
      } else {
        console.log(`  → Lead ID found: "${rawLeadId}"`);
      }
      
      // Debug: Log event ID extraction
      if (!rawEventId) {
        console.log(`  → Event ID not found. event_id=${event.event_id}`);
      } else {
        console.log(`  → Event ID found: "${rawEventId}"`);
      }

      // Clean phone number
      const cleanedPhone = cleanPhoneNumber(rawPhone);
      
      // Split full name into first and last name
      const { fn, ln } = splitFullName(rawFullName);

      // Convert event_time to number if it's a string
      let eventTime = event.event_time;
      if (eventTime) {
        if (typeof eventTime === 'string') {
          eventTime = parseInt(eventTime, 10);
          if (isNaN(eventTime)) {
            eventTime = Math.floor(Date.now() / 1000);
          }
        }
      } else {
        eventTime = Math.floor(Date.now() / 1000);
      }

      // Build processed event with both original and processed fields
      const processedEvent = {
        // Event metadata
        event_name: event.event_name,
        event_time: eventTime,
        action_source: event.action_source,
        event_id: rawEventId,
        lead_id: rawLeadId,
        
        // Original fields (for reference)
        full_name: rawFullName,
        phone_raw: rawPhone,
        city_raw: rawCity,
        state_raw: rawState,
        pincode_raw: rawPincode,
        country: event.country,
        
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

      return processedEvent;
    });

    // Build Facebook Pixel CAPI format with hashed data
    const pixelData = processedEvents.map((event) => {
      // Calculate hashed values for Facebook Pixel CAPI
      const hashedFn = event.fn ? sha256(event.fn) : null;
      const hashedLn = event.ln ? sha256(event.ln) : null;
      const hashedPh = event.phone ? sha256(event.phone) : null;
      const hashedCt = event.city ? sha256(event.city.toLowerCase()) : null;
      const hashedSt = event.state ? sha256(event.state.toLowerCase()) : null;
      const hashedZp = event.pincode ? sha256(event.pincode) : null;
      const hashedCountry = event.country ? sha256(event.country.toLowerCase()) : null;
      
      // Build user_data object with hashed values (Facebook Pixel CAPI format)
      const user_data = {};
      if (hashedFn) user_data.fn = [hashedFn];
      if (hashedLn) user_data.ln = [hashedLn];
      if (hashedPh) user_data.ph = [hashedPh];
      if (hashedCt) user_data.ct = [hashedCt];
      if (hashedSt) user_data.st = [hashedSt];
      if (hashedZp) user_data.zp = [hashedZp];
      if (hashedCountry) user_data.country = [hashedCountry];
      if (event.event_id) user_data.lead_id = [event.event_id];

      // Validate that user_data has at least one customer information parameter
      // Facebook requires at least one of: fn, ln, ph, ct, st, zp, country, or lead_id
      const hasCustomerInfo = user_data.fn || user_data.ln || user_data.ph || 
                               user_data.ct || user_data.st || user_data.zp || user_data.country || user_data.lead_id;
      
      if (!hasCustomerInfo) {
        console.warn(`⚠️  Warning: Event ${event.index} has no customer information parameters. Facebook will reject this event.`);
        console.warn(`   Available fields:`, {
          fn: event.fn,
          ln: event.ln,
          phone: event.phone,
          city: event.city,
          state: event.state,
          pincode: event.pincode,
          country: event.country,
          event_id: event.event_id
        });
      }

      // Build custom_data object
      const custom_data = {};
      if (event.event_id) custom_data.lead_id = event.event_id;

      return {
        event_name: event.event_name,
        event_time: event.event_time,
        action_source: event.action_source,
        event_id: event.event_id ? `crm_lead_${event.event_id}` : `lead_${Date.now()}_${event.index}`,
        user_data: user_data,
        custom_data: custom_data
      };
    });

    // Filter out events with no customer information before sending
    const validPixelData = pixelData.filter((event, index) => {
      const hasCustomerInfo = event.user_data && (
        event.user_data.fn || event.user_data.ln || event.user_data.ph || 
        event.user_data.ct || event.user_data.st || 
        event.user_data.zp || event.user_data.country || event.user_data.lead_id
      );
      
      if (!hasCustomerInfo) {
        console.error(`❌ Skipping event ${index}: No customer information parameters`);
        return false;
      }
      return true;
    });

    if (validPixelData.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "No valid events to send",
        message: "All events are missing customer information parameters. Facebook requires at least one of: fn, ln, ph, ct, st, zp, country, or lead_id",
        events_received: events.length,
        events: processedEvents
      });
    }

    // Send to Facebook Pixel CAPI
    const requestBody = {
      data: validPixelData,
      test_event_code: "TEST15990"
    };
    
    console.log("\nSending to Facebook Pixel CAPI:");
    console.log("PIXEL_ID:", process.env.PIXEL_ID);
    console.log(`Valid events: ${validPixelData.length} out of ${pixelData.length}`);
    console.log("Data being sent:", JSON.stringify(requestBody, null, 2));

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${process.env.PIXEL_ID}/events?access_token=${process.env.ACCESS_TOKEN}`,
      {
        method: "POST",
        body: JSON.stringify(requestBody),
        headers: { "Content-Type": "application/json" },
      }
    );

    const pixelResponse = await response.json();
    console.log("\nFacebook Pixel CAPI Response:", JSON.stringify(pixelResponse, null, 2));

    // Check if there were any errors
    if (pixelResponse.error) {
      console.error("Facebook Pixel Error:", pixelResponse.error);
      return res.status(response.status || 500).json({ 
        ok: false,
        error: "Facebook Pixel API error",
        pixel_error: pixelResponse.error,
        events_received: events.length,
        events: processedEvents,
        pixel_data: {
          description: "Data formatted for Facebook Pixel CAPI (with SHA256 hashed user data)",
          data: pixelData
        }
      });
    }

    return res.json({ 
      ok: true, 
      message: "Data received and sent to Facebook Pixel successfully",
      events_received: events.length,
      events: processedEvents,
      pixel_data: {
        description: "Data formatted for Facebook Pixel CAPI (with SHA256 hashed user data)",
        data: pixelData
      },
      pixel_response: pixelResponse
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
      // Handle lead ID - check multiple possible field names
      const rawLeadId = event.lead_id;
      
      const processedEvent = {
        event_name: event.event_name || "Zoho_FB_Lead_New",
        event_time: event.event_time || Math.floor(Date.now() / 1000),
        action_source: event.action_source || "website",
        lead_id: rawLeadId,
        full_name: event.full_name || `${event.first_name || ""} ${event.last_name || ""}`.trim() || null,
        phone: event.phone,
        city: event.city ,
        state: event.state ,
        pincode: event.pincode ,
        country: event.country ,
        received_at: new Date().toISOString(),
        index: index
      };

      console.log(`\nEvent ${index + 1}:`, JSON.stringify(processedEvent, null, 2));
      return processedEvent;
    });


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

