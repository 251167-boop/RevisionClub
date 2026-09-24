import crypto from "node:crypto";
import { mysqlPool } from "@/lib/mysql";
import { hashUserPassword } from "@/lib/hash";

export function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createPasswordReset(email) {
  if (!mysqlPool) throw new Error("Password reset requires MySQL.");
  const [users] = await mysqlPool.execute(
    "SELECT id, email, username FROM users WHERE lower(email)=lower(?) LIMIT 1",
    [email],
  );
  if (!users[0]) return null;

  const [recent] = await mysqlPool.execute(
    `SELECT 1 FROM password_reset_tokens
     WHERE user_id=? AND created_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 60 SECOND)
     LIMIT 1`,
    [users[0].id],
  );
  if (recent.length) return { throttled: true };

  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashResetToken(token);
  await mysqlPool.execute(
    "DELETE FROM password_reset_tokens WHERE user_id=? OR expires_at < UTC_TIMESTAMP() OR used_at IS NOT NULL",
    [users[0].id],
  );
  await mysqlPool.execute(
    "INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 MINUTE))",
    [tokenHash, users[0].id],
  );
  return { token, user: users[0] };
}

export async function discardPasswordReset(token) {
  if (!mysqlPool || !token) return;
  await mysqlPool.execute(
    "DELETE FROM password_reset_tokens WHERE token_hash=? AND used_at IS NULL",
    [hashResetToken(token)],
  );
}

export async function resetPassword(token, password) {
  if (!mysqlPool) throw new Error("Password reset requires MySQL.");
  const tokenHash = hashResetToken(token);
  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT user_id FROM password_reset_tokens
       WHERE token_hash=? AND used_at IS NULL AND expires_at>UTC_TIMESTAMP()
       FOR UPDATE`,
      [tokenHash],
    );
    if (!rows[0]) {
      await connection.rollback();
      return false;
    }
    const passwordHash = hashUserPassword(password);
    await connection.execute("UPDATE users SET password=? WHERE id=?", [
      passwordHash,
      rows[0].user_id,
    ]);
    await connection.execute(
      "UPDATE password_reset_tokens SET used_at=UTC_TIMESTAMP() WHERE token_hash=?",
      [tokenHash],
    );
    await connection.execute("DELETE FROM sessions WHERE user_id=?", [
      rows[0].user_id,
    ]);
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
