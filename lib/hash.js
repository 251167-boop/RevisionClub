import crypto from "node:crypto";

export function hashUserPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");

  const hashedPassword = crypto.scryptSync(password, salt, 64);
  return hashedPassword.toString("hex") + ":" + salt;
}

export function verifyPassword(storedPassword, suppliedPassword) {
  if (
    typeof storedPassword !== "string" ||
    typeof suppliedPassword !== "string" ||
    suppliedPassword.length > 256 ||
    !/^[a-f0-9]{128}:[a-f0-9]{32}$/.test(storedPassword)
  )
    return false;
  const [hashedPassword, salt] = storedPassword.split(":");
  const hashedPasswordBuf = Buffer.from(hashedPassword, "hex");
  const suppliedPasswordBuf = crypto.scryptSync(suppliedPassword, salt, 64);
  return crypto.timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
}
