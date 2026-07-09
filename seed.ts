// Dev helper: marks every user approved + emailVerified + admin.
// Guarded so it can never be pointed at production by accident.
import 'dotenv/config';
import mysql from 'mysql2/promise';

if (process.env.NODE_ENV === 'production') {
  console.error('seed.ts refuses to run with NODE_ENV=production');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const host = new URL(databaseUrl).host;
console.log(`About to grant approved/verified/admin to ALL users on: ${host}`);
console.log('Press Ctrl+C within 3 seconds to abort...');
await new Promise((resolve) => setTimeout(resolve, 3000));

const c = await mysql.createConnection(databaseUrl);
await c.query("UPDATE users SET approved = 1, emailVerified = 1, role = 'admin'");
console.log('all users approved, verified, and admin');
await c.end();
