const crypto = require("node:crypto");

function key() {
  const value = process.env.FRANCHISE_CREDENTIAL_KEY;
  if (!value || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error("FRANCHISE_CREDENTIAL_KEY must be a 32-byte hex key");
  }
  return Buffer.from(value, "hex");
}

exports.encryptPassword = (password) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  return ["v1", iv.toString("hex"), cipher.getAuthTag().toString("hex"), ciphertext.toString("hex")].join(":");
};

exports.decryptPassword = (value) => {
  const [version, iv, tag, ciphertext] = value.split(":");
  if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("Invalid credential envelope");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "hex")), decipher.final()]).toString("utf8");
};
