import { createHash } from "node:crypto";
import { db } from "@/lib/db";
export function checkAuthRate(email) {
  const key = createHash("sha256")
    .update(String(email).trim().toLowerCase())
    .digest("hex");
  return db
    .transaction(() => {
      const time = Date.now(),
        entry = db.prepare("SELECT * FROM rc_auth_limits WHERE key=?").get(key);
      if (
        entry &&
        time - entry.window_start < 15 * 60000 &&
        entry.attempts >= 12
      )
        return false;
      db.prepare(
        "INSERT INTO rc_auth_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN excluded.window_start-window_start>=900000 THEN 1 ELSE attempts+1 END,window_start=CASE WHEN excluded.window_start-window_start>=900000 THEN excluded.window_start ELSE window_start END",
      ).run(key, time);
      return true;
    })
    .immediate();
}
