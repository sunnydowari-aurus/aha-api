const express = require("express");
const router = express.Router();
const axios = require("axios");

// NOTE: Ensure your utility functions are available in this path.
const { sha256, cleanPhoneNumber, splitFullName } = require("../utils/helpers");
const { getValidAccessToken, getTokenInfo } = require("../utils/tokenManager");

// The Google Ads API requires conversionDateTime in format: "YYYY-MM-DD HH:MM:SS+TZ:TZ"
// This utility function converts the Unix timestamp (event_time) to the required format.
const formatTimestamp = (timestamp) => {
    // If timestamp is already a formatted string, return it as-is
    if (typeof timestamp === 'string' && timestamp.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[\+\-]\d{2}:\d{2}$/)) {
        return timestamp;
    }
    
    // Timestamps from Zoho/Facebook are often in seconds. Convert to milliseconds.
    const date = new Date(timestamp * 1000);
    
    // Get timezone offset (in minutes, negative means ahead of UTC)
    // Example: IST (UTC+5:30) returns -330, EST (UTC-5) returns +300
    const offsetMinutes = date.getTimezoneOffset();
    
    // Flip the sign because getTimezoneOffset() returns opposite of ISO format
    // ISO format: +05:30 means 5h30m ahead of UTC
    // getTimezoneOffset(): -330 means 330 minutes ahead of UTC
    const sign = offsetMinutes <= 0 ? '+' : '-';
    const absOffset = Math.abs(offsetMinutes);
    const offsetHours = String(Math.floor(absOffset / 60)).padStart(2, '0');
    const offsetMins = String(absOffset % 60).padStart(2, '0');
    const timezone = `${sign}${offsetHours}:${offsetMins}`;
    
    // Format: YYYY-MM-DD HH:MM:SS+TZ:TZ (e.g., "2025-11-22 15:00:00+05:30")
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}${timezone}`;
};

// Normalize Zoho CRM field names to standard format
// Handles both Zoho CRM format (fn, ln, em, postalCode, countryCode, conversionValue, conversionDateTime)
// and standard format (full_name, email, zp, country, deal_value, event_time)
const normalizeZohoFields = (event) => {
    // Handle names: fn/ln OR full_name (split if needed)
    let fn = event.fn || null;
    let ln = event.ln || null;
    
    if (!fn || !ln) {
        if (event.full_name) {
            const nameParts = splitFullName(event.full_name);
            fn = fn || nameParts.fn;
            ln = ln || nameParts.ln;
        }
    }
    
    // Handle email: em OR email
    const email = event.em || event.email || null;
    
    // Handle phone: ph OR phone
    const ph = event.ph || event.phone || null;
    
    // Handle postal code: postalCode OR zp
    const zp = event.postalCode || event.zp || null;
    
    // Handle country: countryCode OR country
    const country = event.countryCode || event.country || null;
    
    // Handle conversion value: conversionValue OR deal_value
    const deal_value = event.conversionValue !== undefined ? event.conversionValue : (event.deal_value || 0.0);
    
    // Handle timestamp: conversionDateTime (may be pre-formatted) OR event_time (Unix timestamp)
    let event_time = null;
    if (event.conversionDateTime) {
        // Check if it's already formatted (YYYY-MM-DD HH:MM:SS+TZ:TZ)
        if (typeof event.conversionDateTime === 'string' && event.conversionDateTime.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[\+\-]\d{2}:\d{2}$/)) {
            // Already formatted, use as-is but we'll need to convert to Unix timestamp for validation
            // For now, we'll pass it through and handle in formatTimestamp
            event_time = event.conversionDateTime;
        } else {
            // Try to parse as Unix timestamp (seconds or milliseconds)
            const parsed = typeof event.conversionDateTime === 'string' 
                ? parseFloat(event.conversionDateTime) 
                : event.conversionDateTime;
            event_time = parsed < 10000000000 ? parsed : Math.floor(parsed / 1000); // Convert ms to seconds if needed
        }
    } else if (event.event_time) {
        event_time = typeof event.event_time === 'string' ? parseFloat(event.event_time) : event.event_time;
        // Convert milliseconds to seconds if needed
        if (event_time > 10000000000) {
            event_time = Math.floor(event_time / 1000);
        }
    }
    
    // Handle currency: currencyCode OR currency_code
    const currency_code = event.currencyCode || event.currency_code || "USD";
    
    // Attribution IDs
    const gclid = event.gclid || null;
    const gbraid = event.gbraid || null;
    const wbraid = event.wbraid || null;
    
    // Capture conversionAction from payload (required, no fallback)
    const conversionAction = event.conversionAction || null;
    
    // Debug: Log conversionAction capture
    if (conversionAction) {
        console.log(`  🔍 Captured conversionAction from payload: ${conversionAction}`);
    } else {
        console.log(`  ⚠️ WARNING: conversionAction not found in payload`);
    }
    
    return {
        fn,
        ln,
        email,
        ph,
        zp,
        country,
        deal_value,
        event_time,
        currency_code,
        gclid,
        gbraid,
        wbraid,
        conversionAction, // Add conversionAction to normalized fields
        // Keep original fields for logging
        _original: {
            ct: event.ct || event.city || null,
            st: event.st || event.state || null
        }
    };
};

// --- Google Ads Enhanced Click Conversion Route ---
router.post("/", async (req, res) => {
    try {
        // Validate required environment variables
        if (!process.env.GOOGLE_CUSTOMER_ID) {
            return res.status(400).json({
                ok: false,
                error: "Missing GOOGLE_CUSTOMER_ID environment variable",
                message: "Please set GOOGLE_CUSTOMER_ID in your .env file"
            });
        }
        
        // REMOVED: GOOGLE_CONVERSION_ACTION_RESOURCE_NAME validation
        // conversionAction must come from payload
        
        if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
            return res.status(400).json({
                ok: false,
                error: "Missing GOOGLE_ADS_DEVELOPER_TOKEN environment variable",
                message: "Please set GOOGLE_ADS_DEVELOPER_TOKEN in your .env file"
            });
        }
        
        // Get valid access token (will auto-refresh if expired)
        let accessToken;
        try {
            accessToken = await getValidAccessToken();
        } catch (tokenError) {
            return res.status(401).json({
                ok: false,
                error: "Authentication failed",
                message: tokenError.message,
                solution: "Please authenticate using /oauth.html to get a new access token"
            });
        }

        const data = req.body;
        
        // Handle array format or single object format (like fbpixel.js)
        const events = Array.isArray(data) ? data : [data];
        
        // Log received data
        console.log("=".repeat(80));
        console.log("RECEIVED DATA:");
        console.log("=".repeat(80));
        console.log(JSON.stringify(events, null, 2));
        console.log("=".repeat(80));
        
        // CRITICAL: Log conversionAction from received payload
        events.forEach((event, idx) => {
            console.log(`\n🔍 Event ${idx + 1} - conversionAction from raw payload:`, event.conversionAction);
            if (!event.conversionAction) {
                console.error(`  ❌ ERROR: Event ${idx + 1} has NO conversionAction in payload!`);
            }
        });
        
        // Process each event in the array
        const processedEvents = [];
        const eventErrors = [];
        
        events.forEach((event, index) => {
            try {
                // Normalize field names (handles both Zoho CRM and standard formats)
                const normalized = normalizeZohoFields(event);
                
                // Debug: Log raw event data and normalized fields
                console.log(`\nProcessing Event ${index + 1}:`);
                console.log(`  Raw event keys:`, Object.keys(event));
                console.log(`  Raw event values:`, {
                    fn: event.fn,
                    ln: event.ln,
                    em: event.em,
                    email: event.email,
                    ph: event.ph,
                    phone: event.phone,
                    postalCode: event.postalCode,
                    zp: event.zp,
                    countryCode: event.countryCode,
                    country: event.country,
                    conversionValue: event.conversionValue,
                    deal_value: event.deal_value,
                    conversionDateTime: event.conversionDateTime,
                    event_time: event.event_time,
                    conversionAction: event.conversionAction,
                    gclid: event.gclid,
                    gbraid: event.gbraid,
                    wbraid: event.wbraid
                });
                console.log(`  Normalized fields:`, normalized);
                
                // Validate required fields
                if (!normalized.event_time) {
                    const errorMsg = `Event ${index + 1}: Missing required field. Must provide either 'event_time' (Unix timestamp) or 'conversionDateTime' (formatted or Unix timestamp)`;
                    console.error(`  ❌ ${errorMsg}`);
                    eventErrors.push({ event_index: index + 1, error: errorMsg });
                    return; // Skip this event
                }
                
                // Validate conversionAction is present in payload
                if (!normalized.conversionAction) {
                    const errorMsg = `Event ${index + 1}: Missing required field 'conversionAction'. Must provide 'conversionAction' in the payload (e.g., 'customers/6861463039/conversionActions/7396897617')`;
                    console.error(`  ❌ ${errorMsg}`);
                    eventErrors.push({ event_index: index + 1, error: errorMsg });
                    return; // Skip this event
                }
                
                // Validate conversionAction format
                if (!normalized.conversionAction.match(/^customers\/\d+\/conversionActions\/\d+$/)) {
                    const errorMsg = `Event ${index + 1}: Invalid 'conversionAction' format. Expected format: 'customers/{customer_id}/conversionActions/{conversion_action_id}' (received: '${normalized.conversionAction}')`;
                    console.error(`  ❌ ${errorMsg}`);
                    eventErrors.push({ event_index: index + 1, error: errorMsg });
                    return; // Skip this event
                }
                
                processedEvents.push(normalized);
            } catch (error) {
                const errorMsg = `Event ${index + 1}: ${error.message}`;
                console.error(`  ❌ ${errorMsg}`);
                eventErrors.push({ event_index: index + 1, error: errorMsg });
            }
        });
        
        // Validate that we have at least one valid event
        if (processedEvents.length === 0) {
            return res.status(400).json({
                ok: false,
                error: "No valid events to process",
                message: "All events failed validation or are missing required fields",
                events_received: events.length,
                errors: eventErrors
            });
        }
        
        // Log summary of processing
        if (eventErrors.length > 0) {
            console.warn(`\n⚠️ Warning: ${eventErrors.length} event(s) failed validation and were skipped:`);
            eventErrors.forEach(err => console.warn(`  - ${err.error}`));
        }
        
        // Process each normalized event and build conversion objects
        const conversionObjects = processedEvents.map((normalized, index) => {
            // 1. DATA CLEANING AND HASHING (Final Correct Structure for V22)
            const cleanedPhone = cleanPhoneNumber(normalized.ph);
            const { fn, ln } = normalized;

            // V22 requires an array of single-key objects (oneof rule)
            const userIdentifiers = [];

            // A. Email identifier (Standalone object)
            if (normalized.email) {
                userIdentifiers.push({ hashedEmail: sha256(normalized.email) });
            }

            // B. Phone identifier (Standalone object)
            if (cleanedPhone) {
                userIdentifiers.push({ hashedPhoneNumber: sha256(cleanedPhone) });
            }

            // C. Address Info Block (All names and geo data combined into one object,
            // which becomes one item in the userIdentifiers array)
            const addressInfo = {};

            // Names MUST be included in addressInfo for v22 to avoid the 'Unknown name' error
            if (fn) {
                addressInfo.hashedFirstName = sha256(fn);
            }
            if (ln) {
                addressInfo.hashedLastName = sha256(ln);
            }

            // Geographical data (NOT hashed)
            if (normalized.zp) {
                addressInfo.postalCode = normalized.zp.toString();
            }
            if (normalized.country) {
                // Country code should be ISO 3166-1 alpha-2 format (e.g., "IN", "US")
                addressInfo.countryCode = normalized.country.length === 2 
                    ? normalized.country.toUpperCase() 
                    : normalized.country.substring(0, 2).toUpperCase();
            }

            // Only add the address block if it contains data
            if (Object.keys(addressInfo).length > 0) {
                // The key is 'addressInfo' and its value is the object containing all name/geo data
                userIdentifiers.push({ addressInfo: addressInfo });
            }

            // Validate that we have at least one user identifier for this event
            if (userIdentifiers.length === 0) {
                console.warn(`⚠️ Warning: Event ${index + 1} has no user identifiers. Skipping this event.`);
                return null; // Will be filtered out
            }

            // 2. CONSTRUCT MINIMAL GOOGLE ADS API PAYLOAD
            // CRITICAL: Use conversionAction from payload ONLY (no env var fallback)
            const conversionActionToUse = normalized.conversionAction;
            
            // Explicit validation and logging
            if (!conversionActionToUse) {
                console.error(`  ❌ ERROR: conversionAction is null/undefined in normalized object`);
                console.error(`  Normalized object keys:`, Object.keys(normalized));
                return null;
            }
            
            console.log(`  🔍 DEBUG: About to create conversion object`);
            console.log(`  🔍 DEBUG: normalized.conversionAction = ${normalized.conversionAction}`);
            console.log(`  🔍 DEBUG: conversionActionToUse = ${conversionActionToUse}`);
            
            const conversionObject = {
                // Use conversionAction from payload (required, no env var fallback)
                conversionAction: conversionActionToUse,
                conversionDateTime: formatTimestamp(normalized.event_time),
                userIdentifiers: userIdentifiers, // Required for Enhanced Conversions
                
                // Minimal optional fields based on your use case:
                conversionValue: normalized.deal_value || 0.0,
                currencyCode: normalized.currency_code || "USD", 
            };
            
            // Verify the conversion object has the correct conversionAction
            console.log(`  🔍 DEBUG: conversionObject.conversionAction = ${conversionObject.conversionAction}`);
            if (conversionObject.conversionAction !== conversionActionToUse) {
                console.error(`  ❌ CRITICAL ERROR: conversionAction mismatch! Expected: ${conversionActionToUse}, Got: ${conversionObject.conversionAction}`);
            }

            // Handle attribution IDs (priority: gclid > gbraid > wbraid)
            if (normalized.gclid) {
                conversionObject.gclid = normalized.gclid;
            } else if (normalized.gbraid) {
                conversionObject.gbraid = normalized.gbraid;
            } else if (normalized.wbraid) {
                conversionObject.wbraid = normalized.wbraid;
            } else {
                // If no attribution ID, log a warning
                console.warn(`⚠️ Warning: Event ${index + 1} has no attribution ID (gclid, gbraid, or wbraid). Conversion may not be attributed to a click.`);
            }
            
            // Ensure conversionValue is included even if 0, as it's a number field
            if (typeof conversionObject.conversionValue !== 'number') {
                 conversionObject.conversionValue = 0.0;
            }
            
            console.log(`  ✅ Event ${index + 1} processed successfully`);
            console.log(`  📍 Conversion Action from payload: ${normalized.conversionAction}`);
            console.log(`  📍 Conversion Action in conversion object: ${conversionObject.conversionAction}`);
            console.log(`  Conversion object:`, JSON.stringify(conversionObject, null, 2));
            
            return conversionObject;
        }).filter(obj => obj !== null); // Remove any null entries (events with no user identifiers)

        // Validate that we have at least one valid conversion object
        if (conversionObjects.length === 0) {
            return res.status(400).json({
                ok: false,
                error: "No valid conversions to send",
                message: "All events are missing required user identifiers (email, phone, or name/address data).",
                events_received: events.length,
                events_processed: processedEvents.length
            });
        }

        const clickConversionPayload = {
            conversions: conversionObjects,
            // Removed validate_only: true to enable actual conversion upload
            partialFailure: true, 
        };
        
        console.log(`\n📊 Summary: ${conversionObjects.length} out of ${events.length} events processed successfully`);

        // 3. API CALL SETUP
        // Validate and clean customer ID format (remove dashes, ensure numeric)
        const customerId = process.env.GOOGLE_CUSTOMER_ID.toString().replace(/-/g, '');
        if (!/^\d+$/.test(customerId)) {
            return res.status(400).json({
                ok: false,
                error: "Invalid GOOGLE_CUSTOMER_ID format",
                message: "GOOGLE_CUSTOMER_ID must be a numeric value (e.g., 1234567890)"
            });
        }
        
        // Google Ads API v22 endpoint (correct format without /ads/ prefix)
        const url = `https://googleads.googleapis.com/v22/customers/${customerId}:uploadClickConversions`;

        // Validate and clean developer token
        const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN.toString().trim().replace(/^["']|["']$/g, '');
        
        if (!developerToken || developerToken.length < 5) {
            return res.status(400).json({
                ok: false,
                error: "Invalid GOOGLE_ADS_DEVELOPER_TOKEN",
                message: "Developer token appears to be empty or invalid"
            });
        }
        
        // Get token info for logging
        const tokenInfo = getTokenInfo();

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'developer-token': developerToken,
        };
        
        // Only add login-customer-id if it's set (optional for MCC accounts)
        if (process.env.GOOGLE_LOGIN_CUSTOMER_ID) {
            headers['login-customer-id'] = process.env.GOOGLE_LOGIN_CUSTOMER_ID.toString().replace(/-/g, '');
        }
        
        // Debug logging
        console.log("\n" + "=".repeat(80));
        console.log("📤 GOOGLE ADS API REQUEST");
        console.log("=".repeat(80));
        console.log("URL:", url);
        console.log("Customer ID:", customerId);
        console.log("Access Token (first 20 chars):", accessToken.substring(0, 20) + "...");
        console.log("Token Status:", {
            expires_at: tokenInfo.expires_at,
            expires_in_seconds: tokenInfo.expires_in_seconds,
            is_expired: tokenInfo.is_expired
        });
        console.log("Developer Token:", developerToken.substring(0, 5) + "..." + developerToken.substring(developerToken.length - 5));
        console.log("Headers:", {
            'Content-Type': headers['Content-Type'],
            'Authorization': `Bearer ${accessToken.substring(0, 20)}...`,
            'developer-token': developerToken.substring(0, 5) + "..." + developerToken.substring(developerToken.length - 5),
            'login-customer-id': headers['login-customer-id'] || 'Not set'
        });
        console.log("Request Payload:", JSON.stringify(clickConversionPayload, null, 2));
        console.log("=".repeat(80) + "\n");

        // 4. EXECUTE API CALL (with automatic retry on 401)
        let response;
        try {
            response = await axios.post(
                url,
                clickConversionPayload,
                { headers: headers }
            );
        } catch (apiError) {
            // If we get a 401, try refreshing the token and retry once
            if (apiError.response?.status === 401) {
                console.log("🔄 Received 401 error, refreshing token and retrying...");
                try {
                    // Refresh token
                    accessToken = await getValidAccessToken();
                    
                    // Update headers with new token
                    headers['Authorization'] = `Bearer ${accessToken}`;
                    
                    // Retry the request
                    response = await axios.post(
                        url,
                        clickConversionPayload,
                        { headers: headers }
                    );
                    console.log("✅ Retry successful after token refresh");
                } catch (retryError) {
                    // If retry also fails, throw the original error
                    throw apiError;
                }
            } else {
                // For non-401 errors, throw immediately
                throw apiError;
            }
        }

        const responseData = {
            ok: true,
            message: `Enhanced Conversion sent to Google Ads successfully (${conversionObjects.length} conversion${conversionObjects.length > 1 ? 's' : ''})`,
            events_received: events.length,
            events_processed: conversionObjects.length,
            google_ads_request_payload: clickConversionPayload,
            google_ads_response: response.data,
        };
        
        // Include error information if any events were skipped
        if (eventErrors.length > 0) {
            responseData.events_skipped = eventErrors.length;
            responseData.skipped_events = eventErrors;
        }
        
        return res.json(responseData);
    } catch (err) {
        console.error("\n" + "=".repeat(80));
        console.error("❌ GOOGLE ADS API ERROR");
        console.error("=".repeat(80));
        console.error("Error Status:", err.response?.status);
        console.error("Error Status Text:", err.response?.statusText);
        console.error("Error Response:", JSON.stringify(err.response?.data, null, 2));
        console.error("Error Message:", err.message);
        console.error("=".repeat(80) + "\n");
        
        // Return more detailed error information
        const errorResponse = {
            ok: false,
            error: "Failed to send conversion to Google Ads.",
        };
        
        if (err.response) {
            errorResponse.status = err.response.status;
            errorResponse.statusText = err.response.statusText;
            errorResponse.details = err.response.data || err.message;
            
            // Provide specific guidance for 401 errors
            if (err.response.status === 401) {
                const errorData = err.response.data?.error;
                const googleAdsError = errorData?.details?.[0]?.errors?.[0];
                
                // Check for specific "NOT_ADS_USER" error
                if (googleAdsError?.errorCode?.authenticationError === "NOT_ADS_USER") {
                    errorResponse.troubleshooting = {
                        issue: "Google account not associated with Google Ads",
                        error_message: googleAdsError.message,
                        possible_causes: [
                            "The Google account used for OAuth doesn't have access to any Google Ads accounts",
                            "The Google account hasn't been added to the Google Ads account",
                            "You're using a personal Gmail account that doesn't have Google Ads access"
                        ],
                        solutions: [
                            "1. Use a Google account that has access to Google Ads",
                            "2. Sign in to Google Ads (https://ads.google.com/) with the account you want to use",
                            "3. Ensure the account has access to customer ID: " + (process.env.GOOGLE_CUSTOMER_ID || "your customer ID"),
                            "4. If needed, add the account to Google Ads: Tools & Settings → Access and Security → Users",
                            "5. Re-authenticate using /oauth.html with the correct Google account",
                            "6. Make sure you're signing in with the same account that has Google Ads access"
                        ],
                        note: "The access token is being sent correctly. The issue is that the Google account itself doesn't have Google Ads permissions."
                    };
                } else {
                    // Generic 401 error
                    errorResponse.troubleshooting = {
                        possible_causes: [
                            "Access token has expired (tokens expire after 1 hour)",
                            "Developer token is missing or invalid",
                            "Access token doesn't have required scopes",
                            "Customer ID doesn't match the account the token was generated for",
                            "Token format issue (extra quotes or spaces in .env file)"
                        ],
                        solutions: [
                            "Refresh your access token using the refresh token endpoint: POST /oauth/refresh",
                            "Re-authenticate using /oauth.html to get a new access token",
                            "Verify GOOGLE_ADS_DEVELOPER_TOKEN is correct in Google Ads API Center",
                            "Check that GOOGLE_CUSTOMER_ID matches the account you authenticated for",
                            "Ensure access token in .env has no quotes: GOOGLE_ADS_ACCESS_TOKEN=ya29.abc... (not GOOGLE_ADS_ACCESS_TOKEN=\"ya29.abc...\")"
                        ]
                    };
                }
            }
            
            // Provide specific guidance for 403 errors (API not enabled)
            if (err.response.status === 403) {
                const errorData = err.response.data?.error;
                if (errorData?.code === 403 && errorData?.message?.includes("has not been used") || errorData?.message?.includes("disabled")) {
                    errorResponse.troubleshooting = {
                        issue: "Google Ads API is not enabled in your Google Cloud project",
                        solution: [
                            "1. Go to Google Cloud Console: https://console.cloud.google.com/",
                            "2. Select your project",
                            "3. Navigate to: APIs & Services → Library",
                            "4. Search for 'Google Ads API'",
                            "5. Click 'Enable'",
                            "6. Wait 2-5 minutes for the API to propagate",
                            "7. Retry your request"
                        ],
                        direct_link: errorData?.details?.[0]?.metadata?.activationUrl || 
                                   `https://console.developers.google.com/apis/api/googleads.googleapis.com/overview?project=${process.env.GOOGLE_CLIENT_ID?.split('.')[0] || 'YOUR_PROJECT_ID'}`
                    };
                }
            }
            
            // If it's a 404, provide helpful message
            if (err.response.status === 404) {
                errorResponse.message = "404 Not Found - Check that GOOGLE_CUSTOMER_ID is correct and the endpoint URL is valid";
            }
        } else if (err.request) {
            errorResponse.details = "No response received from Google Ads API";
            errorResponse.message = err.message;
        } else {
            errorResponse.details = err.message;
        }
        
        return res.status(err.response?.status || 500).json(errorResponse);
    }
});

module.exports = router;