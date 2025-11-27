const express = require("express");
const router = express.Router();
const axios = require("axios");

// NOTE: Ensure your utility functions are available in this path.
const { sha256, cleanPhoneNumber, splitFullName } = require("../utils/helpers");
const { getValidAccessToken, getTokenInfo } = require("../utils/tokenManager");

// The Google Ads API requires conversionDateTime in format: "YYYY-MM-DD HH:MM:SS+TZ:TZ"
// This utility function converts the Unix timestamp (event_time) to the required format.
const formatTimestamp = (timestamp) => {
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
        
        if (!process.env.GOOGLE_CONVERSION_ACTION_RESOURCE_NAME) {
            return res.status(400).json({
                ok: false,
                error: "Missing GOOGLE_CONVERSION_ACTION_RESOURCE_NAME environment variable",
                message: "Please set GOOGLE_CONVERSION_ACTION_RESOURCE_NAME in your .env file"
            });
        }
        
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
        
        // Validate required request body fields
        if (!data.event_time) {
            return res.status(400).json({
                ok: false,
                error: "Missing required field: event_time",
                message: "event_time is required for Google Ads API"
            });
        }
        
        // The Google Ads API expects a single conversion object per request (or an array of them).
        // We will map the incoming lead data to the ClickConversion structure.

        // 1. DATA CLEANING AND HASHING (Final Correct Structure for V22)
        const cleanedPhone = cleanPhoneNumber(data.ph);
        const { fn, ln } = data.full_name
            ? splitFullName(data.full_name)
            : { fn: null, ln: null }; // Fallback if full_name is missing

        // V22 requires an array of single-key objects (oneof rule)
        const userIdentifiers = [];

        // A. Email identifier (Standalone object)
        if (data.email) {
            userIdentifiers.push({ hashedEmail: sha256(data.email) });
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
        if (data.zp) {
            addressInfo.postalCode = data.zp.toString();
        }
        if (data.country) {
            // Country code should be ISO 3166-1 alpha-2 format (e.g., "IN", "US")
            addressInfo.countryCode = data.country.length === 2 
                ? data.country.toUpperCase() 
                : data.country.substring(0, 2).toUpperCase();
        }

        // Only add the address block if it contains data
        if (Object.keys(addressInfo).length > 0) {
            // The key is 'addressInfo' and its value is the object containing all name/geo data
            userIdentifiers.push({ addressInfo: addressInfo });
        }

        // Validate that we have at least one user identifier
        if (userIdentifiers.length === 0) {
            return res.status(400).json({
                ok: false,
                error: "Missing user identifiers",
                message: "At least one user identifier is required (email, phone, or name/address data). Your request is missing all of these fields.",
                received_data: {
                    has_email: !!data.email,
                    has_phone: !!data.ph,
                    has_full_name: !!data.full_name
                }
            });
        }

        // 2. CONSTRUCT MINIMAL GOOGLE ADS API PAYLOAD
        const conversionObject = {
            // Minimal required fields:
            conversionAction: process.env.GOOGLE_CONVERSION_ACTION_RESOURCE_NAME,
            conversionDateTime: formatTimestamp(data.event_time),
            userIdentifiers: userIdentifiers, // Required for Enhanced Conversions
            
            // Minimal optional fields based on your use case:
            conversionValue: data.deal_value || 0.0,
            currencyCode: data.currency_code || "USD", 
        };

        // Only include gclid if it exists in the request body
        if (data.gclid) {
            conversionObject.gclid = data.gclid;
        } else {
            // If no gclid, log a warning
            console.warn("⚠️ Warning: No gclid provided in request body. Conversion may not be attributed to a click.");
        }
        
        // Ensure conversionValue is included even if 0, as it's a number field
        if (typeof conversionObject.conversionValue !== 'number') {
             conversionObject.conversionValue = 0.0;
        }

        const clickConversionPayload = {
            conversions: [conversionObject],
            // Removed validate_only: true to enable actual conversion upload
            partialFailure: true, 
        };

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

        return res.json({
            ok: true,
            message: "Enhanced Conversion sent to Google Ads successfully",
            google_ads_request_payload: clickConversionPayload,
            google_ads_response: response.data,
            // Check response.data.partialFailureError for any errors
        });
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