/**
 * WHERE IS RUN-15's MASTER? — the frame every density reading is measured against.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/read-run15-master-disposable.mts
 */
import "dotenv/config";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

assertOneWorld(["MYSQL_PUBLIC_URL"]);
const url = process.env.MYSQL_PUBLIC_URL;
if (!url) throw new Error("run under `railway run --service MySQL`");

const connection = await openDatabase(url);
const [rows] = await connection.query<any[]>(
  `SELECT publicId, imageKey, thumbKey, position, rollId
     FROM casting_candidates
    WHERE publicId = '154fb36b-334e-4cb1-92aa-9a2c567f6d26'`,
);
await connection.end();
for (const row of rows) console.log(JSON.stringify(row, null, 2));

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
