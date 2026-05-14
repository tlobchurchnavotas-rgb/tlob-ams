const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

/**
 * Ensure certificates exist, generate if needed using OpenSSL
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
    // Try to use openssl command (works on Windows if OpenSSL is installed via WSL, Git Bash, or native OpenSSL)
    // For Windows, also check if we can use Powershell or WSL
    const osIsWindows = process.platform === "win32";
    
    if (osIsWindows) {
      // Try multiple approaches for Windows
      let success = false;
      
      // Approach 1: Try native openssl (if installed)
      try {
        execSync(
          `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/CN=localhost/O=TLOB AMS/C=US"`,
          { stdio: "pipe" }
        );
        success = true;
        console.log("✓ Generated certificate with OpenSSL");
      } catch (e1) {
        // Approach 2: Try PowerShell (Windows-native)
        try {
          const psScript = `
$cert = New-SelfSignedCertificate -DnsName localhost -CertStoreLocation cert:\\CurrentUser\\My -Subject "CN=localhost,O=TLOB AMS,C=US" -Type SSLAuthenticationCertificate -NotAfter (Get-Date).AddYears(1);
$certPath = "${certPath}".Replace("\\", "\\\\");
$keyPath = "${keyPath}".Replace("\\", "\\\\");
Export-Certificate -Cert $cert -FilePath $certPath -Force | Out-Null;
$key = $cert.PrivateKey;
$keyBytes = $key.ExportPkcs8PrivateKey();
[System.IO.File]::WriteAllBytes($keyPath, $keyBytes);
Write-Host "Certificate generated successfully"
          `.trim();
          
          execSync(`powershell -NoProfile -Command "${psScript}"`, {
            stdio: "pipe",
          });
          success = true;
          console.log("✓ Generated certificate with PowerShell");
        } catch (e2) {
          throw new Error(
            "Could not generate certificate. Please ensure OpenSSL is installed or run PowerShell as Administrator."
          );
        }
      }
      
      if (!success) {
        throw new Error("Failed to generate certificate on Windows");
      }
    } else {
      // macOS/Linux: Use openssl
      execSync(
        `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/CN=localhost/O=TLOB AMS/C=US"`,
        { stdio: "pipe" }
      );
      console.log("✓ Generated certificate with OpenSSL");
    }
  } catch (error) {
    console.error("❌ Certificate generation failed:", error.message);
    throw new Error(
      `Failed to generate HTTPS certificate: ${error.message}\n` +
      "Please install OpenSSL or ensure PowerShell can create self-signed certificates."
    );
  }

  // Read and return the generated certificates
  return {
    cert: fs.readFileSync(certPath, "utf8"),
    key: fs.readFileSync(keyPath, "utf8"),
  };
}

module.exports = {
  ensureCertificates,
};
