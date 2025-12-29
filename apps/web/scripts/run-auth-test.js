const { generateKeyPairSync } = require("crypto");
const { spawn } = require("child_process");
const path = require("path");

console.log("Generating temporary keys for testing...");

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048, // Standard RSA
  publicKeyEncoding: {
    type: "spki",
    format: "pem",
  },
  privateKeyEncoding: {
    type: "pkcs8",
    format: "pem",
  },
});

const env = {
  ...process.env,
  AUTH_PRIVATE_KEY: Buffer.from(privateKey).toString("base64"),
  AUTH_PUBLIC_KEY: Buffer.from(publicKey).toString("base64"),
};

console.log("Keys generated. Running test-auth.ts...");

const testScript = path.join(__dirname, "test-auth.ts");
const cmd = "npx";
const args = ["tsx", testScript];

const child = spawn(cmd, args, { env, stdio: "inherit" });

child.on("close", (code) => {
  if (code === 0) {
    console.log("\n✅ Auth Verification Passed!");
  } else {
    console.error("\n❌ Auth Verification Failed.");
    process.exit(1);
  }
});
