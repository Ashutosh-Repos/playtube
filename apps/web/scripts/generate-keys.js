const crypto = require('crypto');

function generateKeys() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  console.log("============================================================");
  console.log("🔑  RSA KEYS GENERATED (Copy to .env)");
  console.log("============================================================");
  console.log("");
  
  // Convert to Base64 (Preferred for single-line .env)
  const privateBase64 = Buffer.from(privateKey).toString('base64');
  const publicBase64 = Buffer.from(publicKey).toString('base64');

  console.log("AUTH_PRIVATE_KEY=\"" + privateBase64 + "\"");
  console.log("");
  console.log("AUTH_PUBLIC_KEY=\"" + publicBase64 + "\"");
  console.log("");
  console.log("============================================================");
}

generateKeys();
