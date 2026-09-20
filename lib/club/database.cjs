const Database = require("better-sqlite3");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
function openDatabase(
  filename = process.env.DATABASE_PATH ||
    path.join(
      process.env.VERCEL ? os.tmpdir() : path.join(process.cwd(), ".data"),
      "revision-club.db",
    ),
) {
  if (filename !== ":memory:") {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    if (
      !fs.existsSync(filename) &&
      !process.env.DATABASE_PATH &&
      fs.existsSync(path.join(process.cwd(), "posts.db"))
    ) {
      const source = new Database(path.join(process.cwd(), "posts.db"), {
        readonly: true,
      });
      source.exec(`VACUUM INTO '${filename.replaceAll("'", "''")}'`);
      source.close();
    }
  }
  const db = new Database(filename);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.exec(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,email TEXT UNIQUE,password TEXT,username TEXT,points INTEGER DEFAULT 0,avatar_url TEXT);
  CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,expires_at INTEGER NOT NULL,user_id TEXT NOT NULL REFERENCES users(id));
  CREATE TABLE IF NOT EXISTS rc_migrations(name TEXT PRIMARY KEY,applied_at TEXT NOT NULL);`);
  if (
    !db
      .prepare("PRAGMA table_info(users)")
      .all()
      .some((c) => c.name === "avatar_url")
  )
    db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT");
  for (const name of fs
    .readdirSync(path.join(process.cwd(), "migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    db.transaction(() => {
      if (db.prepare("SELECT 1 FROM rc_migrations WHERE name=?").get(name))
        return;
      db.exec(
        fs.readFileSync(path.join(process.cwd(), "migrations", name), "utf8"),
      );
      db.prepare("INSERT INTO rc_migrations VALUES(?,?)").run(
        name,
        new Date().toISOString(),
      );
    }).immediate();
  }
  return db;
}
module.exports = { openDatabase };
