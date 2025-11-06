// const crypto = require("crypto");
// const axios = require("axios");
// const dotenv = require("dotenv");
// const path = require("path");
// const env = process.env.NODE_ENV || "development";
// dotenv.config({
//     path: path.resolve(__dirname, `config/${env}.env`),
// });
// const CLIENT_SECRET = process.env.CLIENT_SECRET;
// console.log("CLIENT_SECRET", CLIENT_SECRET);

// const testWebhook = async () => {
//     const method = "POST";
//     const hostname = "localhost:3000";
//     const url = "/webhook-test";
//     const uri = `http://${hostname}${url}`;
//     const body = { test: "data", eventId: 123 };
//     const timestamp = Date.now();

//     // Generate signature
//     const rawString = `${method}${uri}${JSON.stringify(body)}${timestamp}`;
//     const signature = crypto.createHmac("sha256", process.env.CLIENT_SECRET).update(rawString).digest("base64");

//     console.log("Sending request with:");
//     console.log("Timestamp:", timestamp);
//     console.log("Signature:", signature);

//     try {
//         const response = await axios.post(`http://localhost:3000/webhook-test`, body, {
//             headers: {
//                 "Content-Type": "application/json",
//                 "x-hubspot-signature-v3": signature,
//                 "x-hubspot-request-timestamp": timestamp.toString(),
//             },
//         });
//         console.log("Response:", response.data);
//     } catch (error) {
//         console.error("Error:", error.message);
//     }
// };

// testWebhook();

// test-webhook.js
const crypto = require("crypto");
const axios = require("axios");
const dotenv = require("dotenv");
const path = require("path");

const env = process.env.NODE_ENV || "development";
dotenv.config({
    path: path.resolve(__dirname, `config/${env}.env`),
});

const CLIENT_SECRET = process.env.CLIENT_SECRET;

if (!CLIENT_SECRET) {
    console.error("ERROR: CLIENT_SECRET is not defined");
    process.exit(1);
}

const testWebhook = async () => {
    const method = "POST";
    const url = "/webhook-test";
    const body = { test: "data", eventId: 123 };
    const timestamp = Date.now();

    // IMPORTANT: URI must match exactly what the server constructs
    // The server uses: https://${hostname}${url}
    // When making request to localhost, hostname will be 'localhost:4000'
    // const uri = `https://localhost:4000${url}`;
    const uri = `https://localhost${url}`; // Remove :4000

    // Generate signature - must match server's rawString construction
    const rawString = `${method}${uri}${JSON.stringify(body)}${timestamp}`;

    console.log("Raw string:", rawString);

    const signature = crypto.createHmac("sha256", CLIENT_SECRET).update(rawString).digest("base64");

    console.log("Timestamp:", timestamp);
    console.log("Signature:", signature);

    try {
        const response = await axios.post(`http://localhost:3000${url}`, body, {
            headers: {
                "Content-Type": "application/json",
                "x-hubspot-signature-v3": signature,
                "x-hubspot-request-timestamp": timestamp.toString(),
                Host: "localhost:3000", // Ensure hostname matches
            },
        });
        console.log("✓ Success! Response:", response.data);
    } catch (error) {
        console.error("✗ Error:", error.message);
        if (error.response) {
            console.error("Response data:", error.response.data);
        }
    }
};

testWebhook();
