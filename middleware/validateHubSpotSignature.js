// middleware/validateHubSpotSignature.js
const crypto = require("crypto");

const validateHubSpotSignature = (clientSecret) => (req, res, next) => {
    console.log("THE CLI SEC", clientSecret);
    const { url, method, body, headers, hostname } = req;

    const signatureHeader = headers["x-hubspot-signature-v3"];
    const timestampHeader = headers["x-hubspot-request-timestamp"];

    // Check if headers exist
    if (!signatureHeader || !timestampHeader) {
        console.log("❌ Missing signature or timestamp headers");
        return response.status(401).json({ error: "Missing required HubSpot headers" });
    }

    // Validate timestamp
    const MAX_ALLOWED_TIMESTAMP = 300000; // 5 minutes in milliseconds
    const currentTime = Date.now();
    if (currentTime - timestampHeader > MAX_ALLOWED_TIMESTAMP) {
        console.log("❌ Timestamp is invalid, reject request");
        return res.status(401).json({ error: "Request timestamp too old" });
    }

    // Construct the signature
    const uri = `https://${hostname}${url}`;
    // This ensures consistent signature validation regardless of whether a body is present.
    // const rawString = `${method}${uri}${JSON.stringify(body)}${timestampHeader}`;
    const bodyString = Object.keys(body).length === 0 ? "" : JSON.stringify(body);
    const rawString = `${method}${uri}${bodyString}${timestampHeader}`;
    // console.log("RAWSTRING", rawString);
    const hashedString = crypto.createHmac("sha256", clientSecret).update(rawString).digest("base64");

    // Validate signature
    try {
        if (crypto.timingSafeEqual(Buffer.from(hashedString), Buffer.from(signatureHeader))) {
            console.log("✓ Signature valid for:", url);
            next(); // Signature is valid, proceed to route handler
        } else {
            console.log("❌ Signature mismatch for:", url);
            return res.status(401).json({ error: "Invalid signature" });
        }
    } catch (error) {
        console.error("❌ Signature validation error:", error.message);
        return res.status(401).json({ error: "Signature validation failed" });
    }
};

module.exports = validateHubSpotSignature;
