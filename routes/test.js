const express = require("express");
const router = express.Router();
const { sendToMetaCAPI } = require("./fbpixel");

// Test endpoint to verify Facebook Pixel is working (uses /fbpixel route)
router.post("/pixel", async (req, res) => {
  try {
    // Prepare data with defaults for testing
    const testData = {
      ...req.body,
      lead_id: req.body.lead_id || `test_${Date.now()}`,
      lead_source: req.body.lead_source || "Test",
    };

    const events = Array.isArray(testData) ? testData : [testData];
    const { json, processedEvents } = await sendToMetaCAPI(events);

    console.log("Sending to Meta CAPI:", JSON.stringify(processedEvents[0], null, 2));

    return res.json({ 
      ok: true, 
      meta: json,
      sent_data: processedEvents[0]
    });
  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ error: "internal error", message: err.message });
  }
});

module.exports = router;

