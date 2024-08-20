const crypto = require("crypto");
require("dotenv").config();

const encrypt = function (text) {
  const algorithm = "aes-256-cbc";
  const cipher = crypto.createCipheriv(
    algorithm,
    Buffer.from(process.env.ENCRYPTION_KEY, "hex"),
    Buffer.from(process.env.ENCRYPTION_IV, "hex")
  );

  let encrypted = cipher.update(text, "utf-8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
};

const decrypt = function (text) {
  const algorithm = "aes-256-cbc";
  const decipher = crypto.createDecipheriv(
    algorithm,
    Buffer.from(process.env.ENCRYPTION_KEY, "hex"),
    Buffer.from(process.env.ENCRYPTION_IV, "hex")
  );
  let decrypted = decipher.update(text, "hex", "utf-8");
  decrypted += decipher.final("utf-8");
  return decrypted;
};

module.exports = { decrypt, encrypt };
