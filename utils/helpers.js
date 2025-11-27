const crypto = require("crypto");

// Helper function to hash data (used by both Meta and Google)
const sha256 = (v) => {
  if (!v) return null;
  return crypto
    .createHash("sha256")
    .update(v.toLowerCase().trim())
    .digest("hex");
};

// Helper function to clean phone number
const cleanPhoneNumber = (phone) => {
  if (!phone) return null;
  return phone.replace(/\D/g, "");
};

// Helper function to split full name
const splitFullName = (fullName) => {
  if (!fullName) return { fn: null, ln: null };
  const parts = fullName.trim().split(/\s+/);
  const fn = parts[0] || null;
  const ln = parts.slice(1).join(" ") || null;
  return { fn, ln };
};

module.exports = {
  sha256,
  cleanPhoneNumber,
  splitFullName,
};

