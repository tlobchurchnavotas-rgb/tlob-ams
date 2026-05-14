const fs = require("fs");
const path = require("path");
const os = require("os");

function getLanIPv4Addresses() {
  const nets = os.networkInterfaces();
  const out = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (!net) continue;
      const fam = net.family;
      const v4 = fam === "IPv4" || fam === 4;
      if (v4 && !net.internal) out.push(net.address);
    }
  }
  return [...new Set(out)].filter(Boolean);
}

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
    try {
      const cert = fs.readFileSync(certPath, "utf8");
      const key = fs.readFileSync(keyPath, "utf8");
      
      if (cert && key && cert.includes("BEGIN CERTIFICATE") && key.includes("BEGIN PRIVATE KEY")) {
        console.log("✓ Using existing valid SSL certificates from:", certDir);
        return { cert, key };
      } else {
        console.log("⚠️  Existing certificates invalid, regenerating...");
        fs.unlinkSync(certPath);
        fs.unlinkSync(keyPath);
      }
    } catch (err) {
      console.log("⚠️  Error reading existing certificates:", err.message);
    }
  }

  // Create cert directory if it doesn't exist
  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
    console.log("📁 Created certificate directory:", certDir);
  }

  console.log("🔐 Generating new self-signed certificate...");

  try {
    // Use selfsigned package for reliable cert generation
    let selfsigned;
    try {
      selfsigned = require("selfsigned");
    } catch (e) {
      throw new Error("selfsigned package not found. Please run: npm install selfsigned");
    }
    
    const attrs = [
      { name: "commonName", value: "localhost" },
      { name: "organizationName", value: "TLOB AMS" },
      { name: "countryName", value: "US" },
    ];

    const altNames = [
      { type: 2, value: "localhost" },
      { type: 7, ip: "127.0.0.1" },
      ...getLanIPv4Addresses().map((ip) => ({ type: 7, ip })),
    ];

    const extensions = [
      { name: "basicConstraints", cA: false },
      { name: "keyUsage", digitalSignature: true, keyEncipherment: true },
      { name: "subjectAltName", altNames },
    ];

    console.log("  Generating RSA key pair (2048-bit)...");
    const pems = selfsigned.generate(attrs, {
      days: 365,
      keySize: 2048,
      algorithm: "sha256",
      extensions,
    });

    // Validate generated certificates
    if (!pems.cert || !pems.private) {
      throw new Error("Certificate generation produced invalid output");
    }

    console.log("  Writing certificates to disk...");
    
    // Write certificate
    fs.writeFileSync(certPath, pems.cert, "utf8");
    console.log("  ✓ Certificate written:", certPath);
    
    // Write key
    fs.writeFileSync(keyPath, pems.private, "utf8");
    console.log("  ✓ Key written:", keyPath);

    // Verify files were written
    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      throw new Error("Failed to write certificate files to disk");
    }

    console.log("✓✓ Self-signed certificate generated successfully!");
    console.log("   Valid for 365 days");

    return {
      cert: pems.cert,
      key: pems.private,
    };
  } catch (error) {
    console.error("❌ CRITICAL: Certificate generation failed");
    console.error("   Error:", error.message);
    throw new Error(
      `Failed to generate HTTPS certificate: ${error.message}`
    );
  }
}

module.exports = {
  ensureCertificates,
  getLanIPv4Addresses,
};
