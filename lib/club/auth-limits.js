import { createHash } from "node:crypto";
import { mysqlPool } from "@/lib/mysql";

export async function checkAuthRate(email) {
  const key = createHash("sha256")
    .update(String(email).trim().toLowerCase())
    .digest("hex");
  const time = Date.now();

  if (!mysqlPool)
    throw new Error("MySQL is required. SQLite fallback has been removed.");
  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      "SELECT attempts, window_start FROM rc_auth_limits WHERE `key`=? FOR UPDATE",
      [key],
    );
    const entry = rows[0];
    const blocked =
      entry &&
      time - Number(entry.window_start) < 15 * 60000 &&
      Number(entry.attempts) >= 12;

    if (!blocked) {
      if (!entry) {
        await connection.execute(
          "INSERT INTO rc_auth_limits (`key`, attempts, window_start) VALUES (?, 1, ?)",
          [key, time],
        );
      } else if (time - Number(entry.window_start) >= 15 * 60000) {
        await connection.execute(
          "UPDATE rc_auth_limits SET attempts=1, window_start=? WHERE `key`=?",
          [time, key],
        );
      } else {
        await connection.execute(
          "UPDATE rc_auth_limits SET attempts=attempts+1 WHERE `key`=?",
          [key],
        );
      }
    }
    await connection.commit();
    return !blocked;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
