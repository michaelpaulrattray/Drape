import "dotenv/config";
import { openDatabase } from "./lib/dbConnection.mts";
const url = process.env.MYSQL_PUBLIC_URL || process.env.DATABASE_URL!;
const c = await openDatabase(url);
const [r] = await c.query<any[]>("SELECT publicId FROM casting_rolls WHERE publicId=?", ["49608d3e-f318-4071-82ab-cbc6be7605f1"]);
console.log("roll rows here:", r.length, "| url host:", new URL(url.replace('mysql://','http://')).host);
await c.end();

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
