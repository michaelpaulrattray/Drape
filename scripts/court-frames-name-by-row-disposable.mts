/**
 * A FRAME IS NAMED BY THE VARIANT IT IS — the name-by-row law, standing from
 * fable-1212 §2 (found opus-905 §3).
 *
 *   npx tsx scripts/court-frames-name-by-row-disposable.mts
 *
 * # The defect it repairs, proved by digest rather than by eye
 *
 * A court driver that waits on the surface's outcome BANNER does not merely
 * misreport when the banner never appears — it saves whatever is on screen
 * under the name of the step it meant to run. Two proven instances in one
 * directory:
 *
 * ```
 *   before/2-after-unrelated-edit.png  ea234bb9…  ┐ same bytes, two names
 *   after/0-before-anything.png        ea234bb9…  ┘ — and a "before anything"
 *                                                   file holding a SILVER-HAIR
 *                                                   carry frame is not a master
 *   after/1-tattoo-on-neck.png         af3aa19f…  ┐ same bytes, one arm, and
 *   after/2-after-unrelated-edit.png   af3aa19f…  ┘ the log says why: step two
 *                                                   "did not settle" and the
 *                                                   step-one frame was saved
 * ```
 *
 * # What this does
 *
 * Fetches every variant of the courts' candidate BY `imageKey` FROM ITS OWN
 * ROW, indexes the bytes by sha256, and matches every frame already on disk
 * against that index. What comes out is a `by-row/` tree whose filenames are
 * variant ids and the request each variant was made by — plus a manifest naming
 * every file that matched nothing, because a frame with no row behind it is the
 * thing this law exists to surface.
 *
 * **The originals are left where they are.** Renaming in place would destroy the
 * evidence that the misfiling happened, which is the one thing the next reader
 * needs in order to believe the law.
 *
 * Free: R2 GETs and sha256. No renders, no credits, no engine, no writes to any
 * database.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import "dotenv/config";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

const REPO = resolve(import.meta.dirname, "..");
const TREE = resolve(REPO, "output/court-realism");
const OUT = resolve(TREE, "by-row");
/** The dev Cast every ink court on this arc has run against. */
const CANDIDATE = 232;

assertOneWorld(["DATABASE_URL"]);
const url = process.env.DATABASE_URL;
const base = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");
if (!url || !base) {
  console.error("REFUSING: DATABASE_URL and R2_PUBLIC_URL are both needed — one names the rows, the other holds the bytes");
  process.exit(1);
}

const connection = await openDatabase(url);
const [rows] = await connection.query<any[]>(
  `SELECT id, imageKey, requestText FROM casting_candidate_variants
     WHERE candidateId = ? AND imageKey IS NOT NULL ORDER BY id`,
  [CANDIDATE],
);
await connection.end();

const slug = (text: string): string =>
  (text || "no-request").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

const byDigest = new Map<string, { id: number; requestText: string }>();
for (const row of rows) {
  const response = await fetch(`${base}/${row.imageKey}`);
  if (!response.ok) {
    console.log(`v#${row.id}  ${row.imageKey}  GONE (${response.status}) — a row whose object has been swept`);
    continue;
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  byDigest.set(createHash("sha256").update(bytes).digest("hex"), { id: row.id, requestText: row.requestText ?? "" });
  await mkdir(OUT, { recursive: true });
  await writeFile(resolve(OUT, `v${row.id}-${slug(row.requestText ?? "")}.png`), bytes);
}
console.log(`indexed ${byDigest.size} variant frames of candidate ${CANDIDATE}`);

const manifest: string[] = [
  "# court-realism, named by row",
  "",
  "Every frame below was fetched BY `imageKey` FROM ITS OWN ROW. The files in the",
  "arm directories were named by what their driver INTENDED to run, and at least",
  "two of them are not what they say (opus-905 §3, ruled fable-1212 §2).",
  "",
  "| file on disk | sha256 (12) | the variant it actually IS |",
  "|---|---|---|",
];

for (const arm of await readdir(TREE, { withFileTypes: true })) {
  if (!arm.isDirectory() || arm.name === "by-row") continue;
  for (const name of await readdir(resolve(TREE, arm.name))) {
    if (!name.endsWith(".png")) continue;
    const bytes = await readFile(resolve(TREE, arm.name, name));
    const digest = createHash("sha256").update(bytes).digest("hex");
    const row = byDigest.get(digest);
    const verdict = row === undefined
      ? "**NO ROW MATCHES THESE BYTES** — the object may have been swept, or this frame never had a row"
      : `v#${row.id} — "${row.requestText}"`;
    manifest.push(`| \`${arm.name}/${name}\` | \`${digest.slice(0, 12)}\` | ${verdict} |`);
    console.log(`${arm.name}/${name}  ${digest.slice(0, 12)}  ${verdict}`);
  }
}

await writeFile(resolve(OUT, "NAMED-BY-ROW.md"), `${manifest.join("\n")}\n`, "utf8");
console.log(`\nmanifest: ${resolve(OUT, "NAMED-BY-ROW.md")}`);
process.exit(0);
