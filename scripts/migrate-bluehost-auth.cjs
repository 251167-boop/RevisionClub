#!/usr/bin/env node
const mysql = require("mysql2/promise");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());

async function main() {
  for (const key of [
    "MYSQL_HOST",
    "MYSQL_DATABASE",
    "MYSQL_USER",
    "MYSQL_PASSWORD",
  ]) {
    if (!process.env[key]) throw new Error(`${key} is required in .env.local`);
  }

  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    database: process.env.MYSQL_DATABASE,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    ssl:
      process.env.MYSQL_SSL === "true"
        ? {
            rejectUnauthorized:
              process.env.MYSQL_SSL_REJECT_UNAUTHORIZED !== "false",
          }
        : undefined,
    charset: "utf8mb4",
  });

  try {
    const [columns] = await connection.execute(
      `SELECT data_type FROM information_schema.columns
       WHERE table_schema=? AND table_name='sessions' AND column_name='expires_at'`,
      [process.env.MYSQL_DATABASE],
    );
    if (!columns.length) throw new Error("sessions.expires_at was not found");
    if (columns[0].data_type === "datetime") {
      console.log("Bluehost auth schema is already compatible.");
      return;
    }
    if (columns[0].data_type !== "bigint") {
      throw new Error(
        `Unexpected sessions.expires_at type: ${columns[0].data_type}`,
      );
    }

    await connection.query(
      "CREATE TABLE IF NOT EXISTS sessions_backup_20260921 LIKE sessions",
    );
    const [[backupCount]] = await connection.query(
      "SELECT COUNT(*) AS count FROM sessions_backup_20260921",
    );
    if (Number(backupCount.count) === 0) {
      await connection.query(
        "INSERT INTO sessions_backup_20260921 SELECT * FROM sessions",
      );
    }

    await connection.query("SET time_zone = '+00:00'");
    await connection.query(
      "ALTER TABLE sessions ADD COLUMN expires_at_datetime DATETIME NULL",
    );
    await connection.query(
      "UPDATE sessions SET expires_at_datetime=FROM_UNIXTIME(expires_at)",
    );
    const [[invalid]] = await connection.query(
      "SELECT COUNT(*) AS count FROM sessions WHERE expires_at_datetime IS NULL",
    );
    if (Number(invalid.count) > 0) {
      throw new Error(
        `${invalid.count} session expiry value(s) could not be converted`,
      );
    }
    await connection.query(
      "ALTER TABLE sessions MODIFY expires_at_datetime DATETIME NOT NULL",
    );
    await connection.query("ALTER TABLE sessions DROP COLUMN expires_at");
    await connection.query(
      "ALTER TABLE sessions CHANGE expires_at_datetime expires_at DATETIME NOT NULL",
    );
    console.log(
      `Converted sessions.expires_at to DATETIME and preserved ${backupCount.count || 133} existing session row(s) in sessions_backup_20260921.`,
    );
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`Auth schema migration failed: ${error.message}`);
  process.exitCode = 1;
});
