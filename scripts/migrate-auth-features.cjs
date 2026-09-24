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
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema=? AND table_name='users'`,
      [process.env.MYSQL_DATABASE],
    );
    const names = new Set(columns.map((column) => column.column_name));

    await connection.query(
      "ALTER TABLE users MODIFY password VARCHAR(255) NULL",
    );
    if (!names.has("google_sub")) {
      await connection.query(
        "ALTER TABLE users ADD COLUMN google_sub VARCHAR(255) NULL",
      );
      await connection.query(
        "CREATE UNIQUE INDEX users_google_sub_unique ON users (google_sub)",
      );
    }

    await connection.query(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token_hash CHAR(64) PRIMARY KEY,
      user_id INT NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX password_reset_user (user_id),
      INDEX password_reset_expiry (expires_at),
      CONSTRAINT password_reset_user_fk FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    console.log("Google sign-in and password-reset schema is ready.");
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`Auth feature migration failed: ${error.message}`);
  process.exitCode = 1;
});
