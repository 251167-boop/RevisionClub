import mysql from "mysql2/promise";

export const mysqlConfigured = Boolean(
  process.env.MYSQL_HOST &&
    process.env.MYSQL_DATABASE &&
    process.env.MYSQL_USER &&
    process.env.MYSQL_PASSWORD,
);

export const mysqlPool = mysqlConfigured
  ? globalThis.__revisionMysqlPool ||
    mysql.createPool({
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
      connectionLimit: 4,
      enableKeepAlive: true,
      waitForConnections: true,
      queueLimit: 20,
    })
  : null;

if (mysqlPool) globalThis.__revisionMysqlPool = mysqlPool;
