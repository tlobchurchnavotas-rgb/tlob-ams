/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const pngToIco = require("png-to-ico");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readLogoB64FromConstants(constantsPath) {
  const txt = fs.readFileSync(constantsPath, "utf8");
  const m = txt.match(/const\s+CHURCH_LOGO_B64\s*=\s*"([^"]+)";/);
  if (!m) throw new Error(`Could not find CHURCH_LOGO_B64 in ${constantsPath}`);
  return m[1];
}

async function main() {
  const root = path.resolve(__dirname, "..");
  const constantsPath = path.join(root, "src", "constants.js");

  const publicDir = path.join(root, "public");
  const buildResourcesDir = path.join(root, "build-resources");

  ensureDir(publicDir);
  ensureDir(buildResourcesDir);

  const b64 = readLogoB64FromConstants(constantsPath);
  const pngBuf = Buffer.from(b64, "base64");

  const publicLogoPath = path.join(publicDir, "logo.png");
  const iconPngPath = path.join(buildResourcesDir, "icon.png");
  const iconIcoPath = path.join(buildResourcesDir, "icon.ico");

  // Always (re)write to keep icons in sync with CHURCH_LOGO_B64.
  fs.writeFileSync(publicLogoPath, pngBuf);
  fs.writeFileSync(iconPngPath, pngBuf);

  const icoBuf = await pngToIco(pngBuf);
  fs.writeFileSync(iconIcoPath, icoBuf);

  console.log("Generated:");
  console.log("-", path.relative(root, publicLogoPath));
  console.log("-", path.relative(root, iconPngPath));
  console.log("-", path.relative(root, iconIcoPath));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

