const express = require("express");
const router = express.Router();
const { sendToMetaCAPI } = require("./fbpixel");

// Zoho webhook endpoint (uses /fbpixel route)
router.post("/zoho-lead", async (req, res) => {
  try {
    // Validate secret
    if (req.headers["x-zoho-secret"] !== process.env.ZOHO_SHARED_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const data = req.body;
    const events = Array.isArray(data) ? data : [data];
    const { json } = await sendToMetaCAPI(events);

    return res.json({ ok: true, meta: json });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal error" });
  }
});

module.exports = router;

