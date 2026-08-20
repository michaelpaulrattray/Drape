/**
 * THE BOT'S LEFTOVER PICTURES, CLEARED — dev only, one Cast, one account.
 *
 * The attach door caps a Cast at eight held pictures (designs + attachments)
 * and there is no detach door yet, so a driver that re-attaches the same
 * specimen on every run walls itself: *"This Cast is holding 8 pictures already
 * — remove one to add another."* That is the door working; this is the cleanup
 * the driver's own repeats owe.
 *
 * SCOPED TO ONE CANDIDATE AND ONE ACCOUNT, both named in the statement rather
 * than checked before it. It deletes the OBJECT first and the ROW second: a row
 * with no object is a broken reference the code will refuse loudly, and an
 * object with no row is litter nothing can ever purge — of the two orders, only
 * one leaves a photograph of a person at a permanent URL.
 *
 *   npx tsx scripts/clear-bot-attachments-disposable.mts
 */
import "dotenv/config";

import { openDatabase, resolveDatabaseUrl, worldOf } from "./lib/dbConnection.mts";

const CANDIDATE = Number(process.env.CLEAR_CANDIDATE ?? "232");
const USER = Number(process.env.CLEAR_USER ?? "823");

const url = resolveDatabaseUrl();
if (!url) throw new Error("no database url");
const world = worldOf(url);
console.log(`world: ${world}`);
if (!world.includes(":52008")) {
  console.log("REFUSING: this is not the dev database. Nothing was touched.");
  process.exit(1);
}

const conn = await openDatabase(url);
const [rows] = await conn.execute(
  "SELECT id, publicId, storageKey FROM casting_reference_attachments WHERE candidateId = ? AND userId = ?",
  [CANDIDATE, USER],
);
const held = rows as Array<{ id: number; publicId: string; storageKey: string }>;
console.log(`held: ${held.length} attachments on candidate ${CANDIDATE} for user ${USER}`);

const { storageDelete } = await import("../server/storage");
for (const row of held) {
  try {
    await storageDelete(row.storageKey);
    console.log(`  object gone: ${row.storageKey}`);
  } catch (error) {
    console.log(`  object FAILED: ${row.storageKey} — ${String(error)}`);
    continue;
  }
  await conn.execute(
    "DELETE FROM casting_reference_attachments WHERE id = ? AND candidateId = ? AND userId = ?",
    [row.id, CANDIDATE, USER],
  );
  console.log(`  row gone: ${row.publicId}`);
}

const [after] = await conn.execute(
  "SELECT COUNT(*) AS n FROM casting_reference_attachments WHERE candidateId = ? AND userId = ?",
  [CANDIDATE, USER],
);
console.log(`remaining: ${JSON.stringify(after)}`);
await conn.end();
process.exit(0);
