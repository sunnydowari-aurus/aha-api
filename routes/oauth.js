const express = require("express");
const router = express.Router();
const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { storeTokens } = require("../utils/tokenManager");

// Google OAuth 2.0 Configuration
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || "http://localhost:3000/oauth/callback";
const SCOPES = "https://www.googleapis.com/auth/adwords";

// State storage file (persists across server restarts)
const STATE_FILE = path.join(__dirname, "../.oauth_states.json");
const STATE_TIMEOUT = parseInt(process.env.OAUTH_STATE_TIMEOUT || "600000", 10); // Default 10 minutes

// Generate state parameter for CSRF protection
const generateState = () => {
    return crypto.randomBytes(32).toString('hex');
};

// Load states from file
function loadStatesFromFile() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const data = fs.readFileSync(STATE_FILE, "utf8");
            const states = JSON.parse(data);
            // Filter out expired states
            const now = Date.now();
            const validStates = {};
            for (const [state, timestamp] of Object.entries(states)) {
                if (now - timestamp < STATE_TIMEOUT) {
                    validStates[state] = timestamp;
                }
            }
            // Save cleaned states back
            if (Object.keys(validStates).length !== Object.keys(states).length) {
                fs.writeFileSync(STATE_FILE, JSON.stringify(validStates, null, 2));
            }
            return validStates;
        }
    } catch (err) {
        console.warn("⚠️  Could not load states from file:", err.message);
    }
    return {};
}

// Save states to file
function saveStatesToFile(states) {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(states, null, 2));
    } catch (err) {
        console.warn("⚠️  Could not save states to file:", err.message);
    }
}

// State store (in-memory + file persistence)
let stateStore = new Map(Object.entries(loadStatesFromFile()));

// Clean up expired states
function cleanupExpiredStates() {
    const now = Date.now();
    const states = {};
    let cleaned = false;
    
    for (const [state, timestamp] of stateStore.entries()) {
        if (now - timestamp < STATE_TIMEOUT) {
            states[state] = timestamp;
        } else {
            cleaned = true;
        }
    }
    
    stateStore = new Map(Object.entries(states));
    
    if (cleaned || Object.keys(states).length > 0) {
        saveStatesToFile(states);
    }
}

// Clean up states every 5 minutes
setInterval(cleanupExpiredStates, 5 * 60 * 1000);

// Route to initiate OAuth flow
router.get("/authorize", (req, res) => {
    try {
        // Validate required environment variables
        if (!process.env.GOOGLE_CLIENT_ID) {
            return res.status(400).json({
                ok: false,
                error: "Missing GOOGLE_CLIENT_ID environment variable",
                message: "Please set GOOGLE_CLIENT_ID in your .env file"
            });
        }

        // Clean up expired states first
        cleanupExpiredStates();
        
        // Generate state for CSRF protection
        const state = generateState();
        const timestamp = Date.now();
        stateStore.set(state, timestamp);
        
        // Save to file for persistence
        const states = Object.fromEntries(stateStore);
        saveStatesToFile(states);
        
        console.log("🔐 Generated OAuth state:", state.substring(0, 16) + "...");
        console.log("⏰ State expires in:", Math.floor(STATE_TIMEOUT / 1000 / 60), "minutes");

        // Clean client ID (must match what's used in callback)
        const clientId = process.env.GOOGLE_CLIENT_ID.toString().trim().replace(/^["']|["']$/g, '');
        
        // Build authorization URL
        const authUrl = new URL(GOOGLE_AUTH_URL);
        authUrl.searchParams.set("client_id", clientId);
        authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("scope", SCOPES);
        authUrl.searchParams.set("access_type", "offline"); // Request refresh token
        authUrl.searchParams.set("prompt", "consent"); // Force consent screen to get refresh token
        authUrl.searchParams.set("state", state);

        console.log("\n" + "=".repeat(80));
        console.log("🚀 OAUTH FLOW INITIATED");
        console.log("=".repeat(80));
        console.log("Client ID:", clientId.substring(0, 20) + "..." + clientId.substring(clientId.length - 10));
        console.log("Redirect URI:", REDIRECT_URI);
        console.log("Scopes:", SCOPES);
        console.log("State:", state);
        console.log("Authorization URL generated");
        console.log("=".repeat(80) + "\n");

        return res.json({
            ok: true,
            authUrl: authUrl.toString(),
            state: state
        });
    } catch (err) {
        console.error("OAuth Authorization Error:", err);
        return res.status(500).json({
            ok: false,
            error: "Failed to generate authorization URL",
            details: err.message
        });
    }
});

// OAuth callback route - receives authorization code
router.get("/callback", async (req, res) => {
    try {
        const { code, state, error } = req.query;

        console.log("\n" + "=".repeat(80));
        console.log("📥 OAUTH CALLBACK RECEIVED");
        console.log("=".repeat(80));
        console.log("Code received:", code ? "Yes" : "No");
        console.log("State received:", state ? state.substring(0, 16) + "..." : "None");
        console.log("Stored states count:", stateStore.size);
        console.log("Error:", error || "None");
        console.log("=".repeat(80) + "\n");

        // Handle OAuth errors
        if (error) {
            console.error("❌ OAuth Error:", error);
            return res.status(400).json({
                ok: false,
                error: "OAuth authorization failed",
                details: error
            });
        }

        // Clean up expired states first
        cleanupExpiredStates();
        
        // Validate state parameter
        if (!state) {
            console.error("❌ No state parameter received");
            return res.status(400).json({
                ok: false,
                error: "Missing state parameter",
                message: "State parameter is required for security"
            });
        }
        
        if (!stateStore.has(state)) {
            console.error("❌ State mismatch!");
            console.error("Received state:", state);
            console.error("Stored states:", Array.from(stateStore.keys()).map(s => s.substring(0, 16) + "..."));
            console.error("State store size:", stateStore.size);
            
            // Try to load from file in case of server restart
            const fileStates = loadStatesFromFile();
            if (fileStates[state]) {
                console.log("✅ Found state in file, restoring...");
                stateStore.set(state, fileStates[state]);
            } else {
                return res.status(400).json({
                    ok: false,
                    error: "Invalid state parameter",
                    message: "State mismatch - possible CSRF attack or server restart",
                    troubleshooting: {
                        possible_causes: [
                            "Server was restarted between authorization and callback",
                            "State expired (default timeout: 10 minutes)",
                            "Multiple server instances running",
                            "Browser cache or redirect issue"
                        ],
                        solutions: [
                            "Complete OAuth flow immediately after clicking authorize",
                            "Don't restart server during OAuth flow",
                            "Check that only one server instance is running",
                            "Try clearing browser cache and retry"
                        ]
                    }
                });
            }
        }

        // Remove used state (security: one-time use)
        stateStore.delete(state);
        const states = Object.fromEntries(stateStore);
        saveStatesToFile(states);
        console.log("✅ State validated and removed");

        // Validate authorization code
        if (!code) {
            return res.status(400).json({
                ok: false,
                error: "Missing authorization code",
                message: "No authorization code received from Google"
            });
        }

        // Validate required environment variables
        if (!process.env.GOOGLE_CLIENT_ID) {
            return res.status(400).json({
                ok: false,
                error: "Missing GOOGLE_CLIENT_ID environment variable",
                message: "Please set GOOGLE_CLIENT_ID in your .env file"
            });
        }

        if (!process.env.GOOGLE_CLIENT_SECRET) {
            return res.status(400).json({
                ok: false,
                error: "Missing GOOGLE_CLIENT_SECRET environment variable",
                message: "Please set GOOGLE_CLIENT_SECRET in your .env file"
            });
        }

        // Clean and validate client credentials
        const clientId = process.env.GOOGLE_CLIENT_ID.toString().trim().replace(/^["']|["']$/g, '');
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET.toString().trim().replace(/^["']|["']$/g, '');
        
        // Validate format
        if (!clientId || clientId.length < 10) {
            return res.status(400).json({
                ok: false,
                error: "Invalid GOOGLE_CLIENT_ID format",
                message: "Client ID appears to be empty or invalid"
            });
        }
        
        if (!clientSecret || clientSecret.length < 10) {
            return res.status(400).json({
                ok: false,
                error: "Invalid GOOGLE_CLIENT_SECRET format",
                message: "Client secret appears to be empty or invalid"
            });
        }
        
        // Log client ID (first/last few chars for debugging, not full secret)
        console.log("🔑 Client ID:", clientId.substring(0, 20) + "..." + clientId.substring(clientId.length - 10));
        console.log("🔑 Client Secret:", clientSecret.substring(0, 5) + "..." + clientSecret.substring(clientSecret.length - 5));
        console.log("🔗 Redirect URI:", REDIRECT_URI);
        console.log("📝 Authorization Code:", code.substring(0, 20) + "...");

        // Exchange authorization code for access token
        console.log("🔄 Exchanging authorization code for access token...");
        
        const tokenRequestData = {
            code: code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: REDIRECT_URI,
            grant_type: "authorization_code"
        };
        
        console.log("📤 Token request data:", {
            code: code.substring(0, 20) + "...",
            client_id: clientId.substring(0, 20) + "...",
            client_secret: "***hidden***",
            redirect_uri: REDIRECT_URI,
            grant_type: "authorization_code"
        });
        
        const tokenResponse = await axios.post(
            GOOGLE_TOKEN_URL,
            tokenRequestData,
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }
        );

        const { access_token, refresh_token, expires_in, token_type } = tokenResponse.data;

        // Store tokens in token manager (for automatic refresh)
        storeTokens(access_token, refresh_token, expires_in, token_type);

        // Print token information to console
        console.log("\n" + "=".repeat(80));
        console.log("✅ GOOGLE ADS OAUTH SUCCESS - Access Token Received");
        console.log("=".repeat(80));
        console.log("Access Token:", access_token);
        console.log("Token Type:", token_type);
        console.log("Expires In:", expires_in, "seconds");
        if (refresh_token) {
            console.log("Refresh Token:", refresh_token);
        } else {
            console.log("⚠️  Refresh Token: Not received (you may need to revoke access and re-authenticate)");
        }
        console.log("\n💡 Tokens have been stored automatically. No need to add to .env file!");
        console.log("📝 Optional: Add to .env file for persistence across server restarts:");
        console.log(`GOOGLE_ADS_ACCESS_TOKEN=${access_token}`);
        if (refresh_token) {
            console.log(`GOOGLE_ADS_REFRESH_TOKEN=${refresh_token}`);
        }
        console.log("=".repeat(80) + "\n");

        // Return token information
        return res.json({
            ok: true,
            message: "Successfully authenticated with Google Ads API. Tokens stored automatically.",
            access_token: access_token,
            refresh_token: refresh_token,
            expires_in: expires_in,
            token_type: token_type,
            note: "Tokens are automatically managed. They will be refreshed when needed."
        });
    } catch (err) {
        console.error("\n" + "=".repeat(80));
        console.error("❌ OAUTH CALLBACK ERROR");
        console.error("=".repeat(80));
        console.error("Error:", err.response?.data || err.message);
        console.error("Status:", err.response?.status);
        console.error("=".repeat(80) + "\n");
        
        // Provide specific guidance for invalid_client error
        if (err.response?.data?.error === 'invalid_client') {
            return res.status(401).json({
                ok: false,
                error: "Invalid client credentials",
                details: err.response.data,
                troubleshooting: {
                    possible_causes: [
                        "GOOGLE_CLIENT_ID doesn't match the one used in authorization URL",
                        "GOOGLE_CLIENT_SECRET is incorrect",
                        "Client credentials have extra quotes or spaces in .env file",
                        "Client ID/Secret were regenerated in Google Cloud Console",
                        "Redirect URI doesn't match exactly what's configured in Google Cloud Console"
                    ],
                    solutions: [
                        "Verify GOOGLE_CLIENT_ID matches exactly (no quotes, no spaces)",
                        "Verify GOOGLE_CLIENT_SECRET matches exactly (no quotes, no spaces)",
                        "Check .env file format: GOOGLE_CLIENT_ID=your_id_here (no quotes)",
                        "Regenerate client secret in Google Cloud Console if needed",
                        "Ensure redirect URI matches exactly: http://localhost:3000/oauth/callback"
                    ],
                    check_redirect_uri: {
                        expected: REDIRECT_URI,
                        note: "Must match exactly in Google Cloud Console (including http vs https, localhost vs 127.0.0.1)"
                    }
                }
            });
        }
        
        return res.status(err.response?.status || 500).json({
            ok: false,
            error: "Failed to exchange authorization code for token",
            details: err.response?.data || err.message
        });
    }
});

// Route to refresh access token using refresh token
router.post("/refresh", async (req, res) => {
    try {
        if (!process.env.GOOGLE_CLIENT_ID) {
            return res.status(400).json({
                ok: false,
                error: "Missing GOOGLE_CLIENT_ID environment variable"
            });
        }

        if (!process.env.GOOGLE_CLIENT_SECRET) {
            return res.status(400).json({
                ok: false,
                error: "Missing GOOGLE_CLIENT_SECRET environment variable"
            });
        }

        const refreshToken = req.body.refresh_token || process.env.GOOGLE_ADS_REFRESH_TOKEN;

        if (!refreshToken) {
            return res.status(400).json({
                ok: false,
                error: "Missing refresh token",
                message: "Provide refresh_token in request body or set GOOGLE_ADS_REFRESH_TOKEN in .env"
            });
        }

        // Exchange refresh token for new access token
        const tokenResponse = await axios.post(
            GOOGLE_TOKEN_URL,
            {
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                refresh_token: refreshToken,
                grant_type: "refresh_token"
            },
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }
        );

        const { access_token, expires_in, token_type } = tokenResponse.data;

        // Store refreshed token in token manager
        storeTokens(access_token, null, expires_in, token_type);

        // Print refreshed token to console
        console.log("\n" + "=".repeat(80));
        console.log("🔄 GOOGLE ADS TOKEN REFRESHED");
        console.log("=".repeat(80));
        console.log("New Access Token:", access_token);
        console.log("Token Type:", token_type);
        console.log("Expires In:", expires_in, "seconds");
        console.log("💡 Token stored automatically. No need to update .env file!");
        console.log("=".repeat(80) + "\n");

        return res.json({
            ok: true,
            message: "Access token refreshed successfully and stored automatically",
            access_token: access_token,
            expires_in: expires_in,
            token_type: token_type
        });
    } catch (err) {
        console.error("Token Refresh Error:", err.response?.data || err.message);
        
        return res.status(500).json({
            ok: false,
            error: "Failed to refresh access token",
            details: err.response?.data || err.message
        });
    }
});

// Route to validate access token
router.get("/validate", async (req, res) => {
    try {
        const { getTokenInfo, getValidAccessToken } = require("../utils/tokenManager");
        
        // Get token info
        const tokenInfo = getTokenInfo();
        
        if (!tokenInfo.has_access_token) {
            return res.status(400).json({
                ok: false,
                error: "No access token found",
                message: "Please authenticate using /oauth.html to get an access token"
            });
        }

        // Get valid access token (will refresh if needed)
        let accessToken;
        try {
            accessToken = await getValidAccessToken();
        } catch (tokenError) {
            return res.status(401).json({
                ok: false,
                error: "Token validation failed",
                message: tokenError.message,
                token_info: tokenInfo
            });
        }

        // Validate token by calling Google's tokeninfo endpoint
        try {
            const tokenInfoResponse = await axios.get(
                `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`
            );

            const tokenInfo = tokenInfoResponse.data;

            console.log("\n" + "=".repeat(80));
            console.log("✅ TOKEN VALIDATION SUCCESS");
            console.log("=".repeat(80));
            console.log("Token is valid!");
            console.log("Issued to:", tokenInfo.issued_to || "N/A");
            console.log("Audience:", tokenInfo.audience || "N/A");
            console.log("User ID:", tokenInfo.user_id || "N/A");
            console.log("Scope:", tokenInfo.scope || "N/A");
            console.log("Expires in:", tokenInfo.expires_in, "seconds");
            console.log("=".repeat(80) + "\n");

            return res.json({
                ok: true,
                message: "Access token is valid",
                token_info: {
                    issued_to: tokenInfo.issued_to,
                    audience: tokenInfo.audience,
                    user_id: tokenInfo.user_id,
                    scope: tokenInfo.scope,
                    expires_in: tokenInfo.expires_in,
                    is_valid: true,
                    cached_info: getTokenInfo()
                }
            });
        } catch (tokenError) {
            console.error("\n" + "=".repeat(80));
            console.error("❌ TOKEN VALIDATION FAILED");
            console.error("=".repeat(80));
            console.error("Error:", tokenError.response?.data || tokenError.message);
            console.error("=".repeat(80) + "\n");

            return res.status(401).json({
                ok: false,
                error: "Access token is invalid or expired",
                details: tokenError.response?.data || tokenError.message,
                solution: "Re-authenticate using /oauth.html to get a new access token"
            });
        }
    } catch (err) {
        console.error("Token Validation Error:", err);
        return res.status(500).json({
            ok: false,
            error: "Failed to validate token",
            details: err.message
        });
    }
});

// Route to clear all states (for testing/debugging)
router.post("/clear-states", (req, res) => {
    try {
        stateStore.clear();
        if (fs.existsSync(STATE_FILE)) {
            fs.unlinkSync(STATE_FILE);
        }
        console.log("🗑️  All OAuth states cleared");
        return res.json({
            ok: true,
            message: "All OAuth states cleared successfully"
        });
    } catch (err) {
        console.error("Error clearing states:", err);
        return res.status(500).json({
            ok: false,
            error: "Failed to clear states",
            details: err.message
        });
    }
});

// Route to get state info (for debugging)
router.get("/state-info", (req, res) => {
    try {
        const states = Array.from(stateStore.entries()).map(([state, timestamp]) => ({
            state: state.substring(0, 16) + "...",
            created_at: new Date(timestamp).toISOString(),
            expires_in_seconds: Math.max(0, Math.floor((STATE_TIMEOUT - (Date.now() - timestamp)) / 1000))
        }));
        
        return res.json({
            ok: true,
            state_count: stateStore.size,
            state_timeout_seconds: Math.floor(STATE_TIMEOUT / 1000),
            states: states
        });
    } catch (err) {
        return res.status(500).json({
            ok: false,
            error: "Failed to get state info",
            details: err.message
        });
    }
});

module.exports = router;

