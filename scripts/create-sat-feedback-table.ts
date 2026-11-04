import "dotenv/config";
import mysql from "mysql2/promise";

const url = new URL(process.env.DATABASE_URL!);
console.log(`Connecting to host=${url.hostname} db=${url.pathname.slice(1)}`);

const conn = await mysql.createConnection(process.env.DATABASE_URL!);
await conn.query(`
  CREATE TABLE IF NOT EXISTS sat_feedback_responses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contact VARCHAR(320) NOT NULL,
    prepFeeling VARCHAR(50),
    moreInFuture TEXT,
    topicsHelp TEXT,
    targetScore VARCHAR(20),
    biggestChallenge VARCHAR(50),
    referrals TEXT,
    paidInterest VARCHAR(30) NOT NULL,
    testDate VARCHAR(100),
    paidWants TEXT,
    contactMethod VARCHAR(20),
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX sat_feedback_created_idx (createdAt)
  )
`);
console.log("sat_feedback_responses ready");
await conn.end();