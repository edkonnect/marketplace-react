import "dotenv/config";
import mysql from "mysql2/promise";

const url = new URL(process.env.DATABASE_URL!);
const host = url.hostname;
const dbName = url.pathname.slice(1);
console.log(`Connecting to host=${host} db=${dbName}`);

// Safety: refuse to run against a non-local database unless --live is passed.
const isLocal = host === "localhost" || host === "127.0.0.1";
if (!isLocal && !process.argv.includes("--live")) {
  console.error(
    "This is NOT a local database. Nothing was changed.\n" +
      "If you really want to create the table here (after a backup), run again with --live"
  );
  process.exit(1);
}

const conn = await mysql.createConnection(process.env.DATABASE_URL!);
await conn.query(`
  CREATE TABLE IF NOT EXISTS parent_chat_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversationId VARCHAR(64) NOT NULL,
    userId INT NOT NULL,
    viaTempLogin BOOLEAN NOT NULL DEFAULT FALSE,
    userMessage TEXT NOT NULL,
    botReply MEDIUMTEXT,
    toolsUsed VARCHAR(500),
    hadError BOOLEAN NOT NULL DEFAULT FALSE,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX parent_chat_user_idx (userId),
    INDEX parent_chat_conversation_idx (conversationId),
    INDEX parent_chat_created_idx (createdAt)
  ) DEFAULT CHARSET=utf8mb4
`);
console.log("parent_chat_messages ready");
await conn.end();