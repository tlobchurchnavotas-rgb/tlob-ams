const fs = require("fs");
const path = require("path");

/**
 * Ensure certificates exist, generate if needed using selfsigned
 * @param {string} certDir - Directory to store certificates
 * @returns {{cert: string, key: string}} - Certificate and key content as strings
 */
function ensureCertificates(certDir) {
  const certPath = path.join(certDir, "localhost.crt");
  const keyPath = path.join(certDir, "localhost.key");

  // Check if certificates already exist
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    console.log("✓ Using existing SSL certificates");
    return {
      cert: fs.readFileSync(certPath, "utf8"),
      key: fs.readFileSync(keyPath, "utf8"),
    };
  }

  // Create cert directory if it doesn't exist
  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
  }

  console.log("🔐 Generating self-signed certificate for HTTPS...");

  try {
    // Use selfsigned package for reliable cert generation
    const selfsigned = require("selfsigned");
    
    const attrs = [
      { name: "commonName", value: "localhost" },
      { name: "organizationName", value: "TLOB AMS" },
      { name: "countryName", value: "US" },
    ];

    const pems = selfsigned.generate(attrs, {
      days: 365,
      keySize: 2048,
      algorithm: "sha256",
    });

    // Write certificate and key to files
    fs.writeFileSync(certPath, pems.cert, "utf8");
    fs.writeFileSync(keyPath, pems.private, "utf8");

    console.log("✓ Generated self-signed certificate successfully");

    return {
      cert: pems.cert,
      key: pems.private,
    };
  } catch (error) {
    console.error("❌ Certificate generation failed:", error.message);
    throw new Error(
      `Failed to generate HTTPS certificate: ${error.message}`
    );
  }
}

module.exports = {
  ensureCertificates,
};
