const axios = require("axios");
const fs = require("fs");
const path = require("path");

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const TOKEN_FILE = path.join(__dirname, "../.tokens.json");

// In-memory token storage
let tokenCache = {
    access_token: null,
    refresh_token: null,
    expires_at: null,
    token_type: null
};

// Load tokens from file if exists (for persistence across restarts)
function loadTokensFromFile() {
    try {
        if (fs.existsSync(TOKEN_FILE)) {
            const data = fs.readFileSync(TOKEN_FILE, "utf8");
            const tokens = JSON.parse(data);
            tokenCache = { ...tokenCache, ...tokens };
            console.log("✅ Loaded tokens from file");
            return true;
        }
    } catch (err) {
        console.warn("⚠️  Could not load tokens from file:", err.message);
    }
    return false;
}

// Save tokens to file for persistence
function saveTokensToFile() {
    try {
        fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokenCache, null, 2));
        console.log("💾 Tokens saved to file");
    } catch (err) {
        console.warn("⚠️  Could not save tokens to file:", err.message);
    }
}

// Initialize tokens from environment variables or file
function initializeTokens() {
    // First, try to load from file
    if (loadTokensFromFile()) {
        return;
    }

    // If not in file, try environment variables
    if (process.env.GOOGLE_ADS_ACCESS_TOKEN) {
        tokenCache.access_token = process.env.GOOGLE_ADS_ACCESS_TOKEN.toString().trim().replace(/^["']|["']$/g, '');
    }

    if (process.env.GOOGLE_ADS_REFRESH_TOKEN) {
        tokenCache.refresh_token = process.env.GOOGLE_ADS_REFRESH_TOKEN.toString().trim().replace(/^["']|["']$/g, '');
    }

    // Calculate expiry if we have a token (assume it expires in 1 hour if not set)
    if (tokenCache.access_token && !tokenCache.expires_at) {
        tokenCache.expires_at = Date.now() + (3600 * 1000); // 1 hour from now
    }
}

// Check if token is expired or about to expire (within 5 minutes)
function isTokenExpired() {
    if (!tokenCache.access_token) {
        return true;
    }

    if (!tokenCache.expires_at) {
        // If we don't know expiry, assume it might be expired
        return true;
    }

    // Consider token expired if it expires within 5 minutes
    const bufferTime = 5 * 60 * 1000; // 5 minutes
    return Date.now() >= (tokenCache.expires_at - bufferTime);
}

// Refresh access token using refresh token
async function refreshAccessToken() {
    try {
        if (!process.env.GOOGLE_CLIENT_ID) {
            throw new Error("Missing GOOGLE_CLIENT_ID environment variable");
        }

        if (!process.env.GOOGLE_CLIENT_SECRET) {
            throw new Error("Missing GOOGLE_CLIENT_SECRET environment variable");
        }

        const refreshToken = tokenCache.refresh_token || process.env.GOOGLE_ADS_REFRESH_TOKEN;

        if (!refreshToken) {
            throw new Error("No refresh token available. Please re-authenticate using /oauth.html");
        }

        console.log("\n" + "=".repeat(80));
        console.log("🔄 REFRESHING ACCESS TOKEN");
        console.log("=".repeat(80));

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

        // Update token cache
        tokenCache.access_token = access_token;
        tokenCache.token_type = token_type || "Bearer";
        tokenCache.expires_at = Date.now() + (expires_in * 1000);

        // Save to file for persistence
        saveTokensToFile();

        console.log("✅ Access token refreshed successfully");
        console.log("Expires in:", expires_in, "seconds");
        console.log("New expiry time:", new Date(tokenCache.expires_at).toISOString());
        console.log("=".repeat(80) + "\n");

        return access_token;
    } catch (err) {
        console.error("\n" + "=".repeat(80));
        console.error("❌ TOKEN REFRESH FAILED");
        console.error("=".repeat(80));
        console.error("Error:", err.response?.data || err.message);
        console.error("=".repeat(80) + "\n");

        // Clear invalid tokens
        tokenCache.access_token = null;
        tokenCache.refresh_token = null;
        tokenCache.expires_at = null;

        throw new Error(`Token refresh failed: ${err.response?.data?.error || err.message}`);
    }
}

// Get valid access token (refresh if needed)
async function getValidAccessToken() {
    // Check if token is expired or about to expire
    if (isTokenExpired()) {
        console.log("⏰ Access token expired or expiring soon, refreshing...");
        await refreshAccessToken();
    }

    if (!tokenCache.access_token) {
        throw new Error("No access token available. Please authenticate using /oauth.html");
    }

    return tokenCache.access_token;
}

// Store tokens (called from OAuth callback)
function storeTokens(accessToken, refreshToken, expiresIn, tokenType) {
    tokenCache.access_token = accessToken;
    tokenCache.token_type = tokenType || "Bearer";
    tokenCache.expires_at = Date.now() + (expiresIn * 1000);

    if (refreshToken) {
        tokenCache.refresh_token = refreshToken;
    }

    // Save to file for persistence
    saveTokensToFile();

    console.log("💾 Tokens stored in memory and file");
}

// Get token info for debugging
function getTokenInfo() {
    return {
        has_access_token: !!tokenCache.access_token,
        has_refresh_token: !!tokenCache.refresh_token,
        expires_at: tokenCache.expires_at ? new Date(tokenCache.expires_at).toISOString() : null,
        is_expired: isTokenExpired(),
        expires_in_seconds: tokenCache.expires_at ? Math.max(0, Math.floor((tokenCache.expires_at - Date.now()) / 1000)) : null
    };
}

// Initialize on module load
initializeTokens();

module.exports = {
    getValidAccessToken,
    refreshAccessToken,
    storeTokens,
    getTokenInfo,
    isTokenExpired
};









