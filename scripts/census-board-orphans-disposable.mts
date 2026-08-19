/**
 * DO THE BOARD DELETION PATHS ACTUALLY LEAVE ORPHANS BEHIND, AND HOW MANY?
 *
 * CLEANUP_MILESTONE_TRIAGE §13c filed `removeEdgesForItems` as "the deletion
 * path's other half, and nothing calls it", and stated the cost as *"the likely
 * real cost is unbounded row growth on a table nobody prunes"* — with the word
 * LIKELY, because nobody had counted. This counts.
 *
 * Read-only: four SELECT families against `boards`, `board_items`,
 * `board_edges`, `board_item_versions`. No writes, no credits, no vision, no R2.
 *
 * # The class is wider than §13c named, which is why this reads four tables
 *
 * §13c named ONE path (`deleteBoardItems`) and ONE child table (`board_edges`).
 * Read at the code, there are THREE live hard-delete paths and TWO child tables
 * with no foreign key between any of them:
 *
 *   routes/boards.ts:176  delete       → db/boards.ts:84   deleteBoard
 *   routes/boards.ts:324  deleteItem   → db/boards.ts:600  deleteBoardItem
 *   routes/boards.ts:339  deleteItems  → db/boards.ts:610  deleteBoardItems
 *
 * and the child rows are `board_edges` (keyed by boardId AND by both endpoint
 * item ids) and `board_item_versions` (keyed by itemId, and each row carries an
 * `imageUrl`). `finalCastDeletion.ts:417-422` is the same product's PROVEN
 * sibling — it deletes both child tables for the items it removes — which is
 * what makes this a class rather than an oversight.
 *
 * # The four populations, kept apart because they mean different things
 *
 *   EDGE / board gone      boardId names no `boards` row. Only `deleteBoard`
 *                          can produce this one.
 *   EDGE / endpoint gone   an endpoint item id names no `board_items` row.
 *                          The item was HARD-deleted out from under it.
 *   EDGE / endpoint soft   the endpoint row EXISTS with `deletedAt` set. NOT a
 *                          leak — foundations Decision 7 makes delete undoable
 *                          and the edge must survive for the restore. Counted
 *                          separately so it is never folded into the leak, and
 *                          because `getBoardEdges` returns it to the client
 *                          either way.
 *   VERSION / item gone    `board_item_versions.itemId` names no `board_items`
 *                          row. These carry image URLs, so the row is the last
 *                          pointer to an object nothing will ever collect.
 *
 * # Controls (working law 2), because a broken join and a clean product both
 * # print zero
 *
 *   POSITIVE  visibility — every table's unfiltered COUNT(*). A reader that
 *             cannot see a table reports zero orphans in it too.
 *   POSITIVE  the DETECTOR — the identical orphan query run against an empty
 *             parent set (`WHERE 1=0`), which must return the FULL child count.
 *             This is the arm that matters: it proves the NOT EXISTS shape can
 *             return a non-zero number in this world, so a zero verdict below
 *             is a fact about the data and not about the query.
 *   ARITHMETIC closure — orphans + parented must equal the table total, per
 *             child table. A predicate that silently matches nothing fails this
 *             even when both halves look plausible on their own.
 *
 * Any control failing REFUSES the verdict rather than annotating it.
 *
 *   npx tsx scripts/census-board-orphans-disposable.mts
 *   railway.cmd run --service MySQL -- npx tsx scripts/census-board-orphans-disposable.mts
 */

import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";

import { openDatabase, worldOf } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

const KEY = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([KEY]);

const OUT = "output/board-orphan-census";
mkdirSync(OUT, { recursive: true });

const lines: string[] = [];
const say = (line = "") => { console.log(line); lines.push(line); };

const url = process.env[KEY]!;
const connection = await openDatabase(url);

const count = async (sql: string): Promise<number> => {
  const [rows] = await connection.query<Array<{ n: number }>>(sql);
  return Number(rows[0]?.n ?? -1);
};

say("=".repeat(84));
say(`BOARD ORPHAN CENSUS — ${worldOf(url)}  (via ${KEY})`);
say("=".repeat(84));

/* ---- control 1: visibility ---------------------------------------------- */

const totals = {
  boards: await count("SELECT COUNT(*) AS n FROM boards"),
  items: await count("SELECT COUNT(*) AS n FROM board_items"),
  edges: await count("SELECT COUNT(*) AS n FROM board_edges"),
  versions: await count("SELECT COUNT(*) AS n FROM board_item_versions"),
};

say("");
say("CONTROL 1 — visibility. Every row, unfiltered. A blind reader prints zero");
say("here too, which is why this comes before any verdict.");
say(`  boards               ${totals.boards}`);
say(`  board_items          ${totals.items}`);
say(`  board_edges          ${totals.edges}`);
say(`  board_item_versions  ${totals.versions}`);

/* ---- control 2: the detector, against an empty parent set --------------- */

const detectorEdges = await count(
  "SELECT COUNT(*) AS n FROM board_edges e"
  + " WHERE NOT EXISTS (SELECT 1 FROM board_items i WHERE i.id = e.sourceItemId AND 1=0)",
);
const detectorVersions = await count(
  "SELECT COUNT(*) AS n FROM board_item_versions v"
  + " WHERE NOT EXISTS (SELECT 1 FROM board_items i WHERE i.id = v.itemId AND 1=0)",
);

const detectorEdgesOk = detectorEdges === totals.edges;
const detectorVersionsOk = detectorVersions === totals.versions;

say("");
say("CONTROL 2 — the DETECTOR. The same NOT EXISTS shape with the parent set");
say("emptied (1=0): every child row must come back an orphan. This is the arm");
say("that makes a zero below mean something.");
say(`  board_edges          ${detectorEdges} of ${totals.edges}   ${detectorEdgesOk ? "pass" : "FAIL"}`);
say(`  board_item_versions  ${detectorVersions} of ${totals.versions}   ${detectorVersionsOk ? "pass" : "FAIL"}`);

/* ---- the four populations ----------------------------------------------- */

const edgeBoardGone = await count(
  "SELECT COUNT(*) AS n FROM board_edges e"
  + " WHERE NOT EXISTS (SELECT 1 FROM boards b WHERE b.id = e.boardId)",
);
const edgeEndpointGone = await count(
  "SELECT COUNT(*) AS n FROM board_edges e"
  + " WHERE NOT EXISTS (SELECT 1 FROM board_items i WHERE i.id = e.sourceItemId)"
  + "    OR NOT EXISTS (SELECT 1 FROM board_items i WHERE i.id = e.targetItemId)",
);
const edgeEndpointSoft = await count(
  "SELECT COUNT(*) AS n FROM board_edges e"
  + " WHERE EXISTS (SELECT 1 FROM board_items i WHERE i.id = e.sourceItemId AND i.deletedAt IS NOT NULL)"
  + "    OR EXISTS (SELECT 1 FROM board_items i WHERE i.id = e.targetItemId AND i.deletedAt IS NOT NULL)",
);
const versionItemGone = await count(
  "SELECT COUNT(*) AS n FROM board_item_versions v"
  + " WHERE NOT EXISTS (SELECT 1 FROM board_items i WHERE i.id = v.itemId)",
);

/* ---- control 3: arithmetic closure --------------------------------------- */

const edgeBothEndpointsAlive = await count(
  "SELECT COUNT(*) AS n FROM board_edges e"
  + " WHERE EXISTS (SELECT 1 FROM board_items i WHERE i.id = e.sourceItemId)"
  + "   AND EXISTS (SELECT 1 FROM board_items i WHERE i.id = e.targetItemId)",
);
const versionItemAlive = await count(
  "SELECT COUNT(*) AS n FROM board_item_versions v"
  + " WHERE EXISTS (SELECT 1 FROM board_items i WHERE i.id = v.itemId)",
);

const edgeClosureOk = edgeEndpointGone + edgeBothEndpointsAlive === totals.edges;
const versionClosureOk = versionItemGone + versionItemAlive === totals.versions;

say("");
say("CONTROL 3 — arithmetic closure. Orphaned + parented must equal the total,");
say("or the predicate is matching something other than what it says.");
say(`  board_edges          ${edgeEndpointGone} + ${edgeBothEndpointsAlive} = ${edgeEndpointGone + edgeBothEndpointsAlive} vs ${totals.edges}   ${edgeClosureOk ? "pass" : "FAIL"}`);
say(`  board_item_versions  ${versionItemGone} + ${versionItemAlive} = ${versionItemGone + versionItemAlive} vs ${totals.versions}   ${versionClosureOk ? "pass" : "FAIL"}`);

const controlsPass = detectorEdgesOk && detectorVersionsOk && edgeClosureOk && versionClosureOk
  && totals.boards >= 0 && totals.items >= 0;

say("");
say("=".repeat(84));
if (!controlsPass) {
  say("CONTROLS FAILED — no verdict is printed. A census whose instrument cannot");
  say("be shown to work is not a reading, and an annotated bad number is worse");
  say("than no number.");
  say("=".repeat(84));
  const stampFail = worldOf(url).replace(/[^a-z0-9]+/gi, "-");
  writeFileSync(`${OUT}/census-${stampFail}.txt`, lines.join("\n") + "\n");
  process.exit(1);
}

say("THE READING");
say("=".repeat(84));
say("");
say(`  EDGE / board gone      ${edgeBoardGone}`);
say("      boardId names no boards row — only deleteBoard can leave these.");
say(`  EDGE / endpoint gone   ${edgeEndpointGone}`);
say("      an endpoint item was HARD-deleted; deleteBoardItem(s) leave these.");
say(`  EDGE / endpoint soft   ${edgeEndpointSoft}`);
say("      NOT a leak — Decision 7 keeps delete undoable and the edge must");
say("      survive the restore. Counted apart so it is never folded in.");
say(`  VERSION / item gone    ${versionItemGone}`);
say("      each row carries an imageUrl, so it is the last pointer to an");
say("      object nothing will collect.");
say("");
say(`  leaked rows, both tables: ${edgeBoardGone + edgeEndpointGone + versionItemGone}`);
say("      (edge classes overlap by construction — an edge on a deleted board");
say("       usually has deleted endpoints too — so this is an upper bound on");
say("       distinct edges, not a sum of disjoint sets.)");
say("");
say("=".repeat(84));
say("WHAT THIS DOES NOT ASK. Whether the R2 objects behind an orphaned");
say("version's imageUrl still exist — that is a HEAD per row against a bucket.");
say("The row is the pointer; the census counts pointers.");
say("=".repeat(84));

const stamp = worldOf(url).replace(/[^a-z0-9]+/gi, "-");
writeFileSync(`${OUT}/census-${stamp}.txt`, lines.join("\n") + "\n");
say(`written: ${OUT}/census-${stamp}.txt`);

process.exit(0);
