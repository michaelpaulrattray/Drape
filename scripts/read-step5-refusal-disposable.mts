/**
 * DID THE REFUSED RENDER LEAVE A FRAME ANYWHERE? — shift 62's step 5.
 *
 * The reader said "the glasses are still in the picture" and the render was
 * refused and refunded. That sentence is a claim; the picture is the fact, and
 * before building anything on the claim it is worth asking whether the bytes
 * survived somewhere this account can reach. Read-only.
 */
import "dotenv/config";
import { openDatabase, utc } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

const key = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([key]);
const c = await openDatabase(process.env[key]!);
const [rows] = await c.query<any[]>(
  `SELECT id, publicId, status, requestText, imageKey, thumbKey, failureClass, operationId, outcome, createdAt
     FROM casting_candidate_variants
    WHERE candidateId = (SELECT id FROM casting_candidates WHERE publicId = 'cec09129-b263-43ed-ac20-8c7fed24bcdc')
    ORDER BY id`,
);
console.log(`CONTROL  ${rows.length} variant(s) on the walked face, expected 5\n`);
for (const r of rows) {
  console.log(`v#${r.id} ${utc(r.createdAt)} ${String(r.status).padEnd(9)} "${r.requestText}"`);
  console.log(`     imageKey ${r.imageKey ?? "—"} · failureClass ${r.failureClass ?? "—"} · outcome ${r.outcome ?? "—"}`);
}
await c.end();
process.exit(0);
