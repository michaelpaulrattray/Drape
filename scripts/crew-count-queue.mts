/**
 * COUNT THE QUEUE — the numbers under his background-work switches (issue #277).
 *
 * Run at shift start, beside the switch read:
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/crew-count-queue.mts
 *
 * # WHAT IT COUNTS, AND WHY THERE IS NO LIST HERE
 *
 * One number per category: **how many OPEN cards carry that category's label**.
 * The labels are `shared/crewWorkSwitches.ts`'s `queueLabel`, and **not one of
 * them was invented for this feature** — `bug`, `seat:warden`,
 * `seat:machinist`, `seat:janitor` and `seat:retro` were already in use by the
 * seats. His card says it in capitals: *the counts and the categories are
 * derived from the queue's own labels, never a second list*, so **a card
 * relabelled in GitHub moves category on his page without anyone touching the
 * panel.**
 *
 * # ⚠ WHY THE COUNT IS CACHED RATHER THAN LIVE, SAID OUT LOUD
 *
 * A truly live count means the SERVER calling the GitHub API, which means a
 * repo-scoped token as a production environment variable — a credential that
 * can read this private repository, living in the app's environment, plus an
 * outbound dependency on his admin page. **That is a founder-level decision
 * about a credential, not a shift's**, so it is named as the upgrade rather
 * than taken.
 *
 * What lands instead is a DERIVED CACHE with its own timestamp: nobody types
 * these numbers, and `countedAt` rides every row so the panel says **"counted
 * 14 min ago"** rather than implying an instant it does not have. That is the
 * difference between this and the lists that rotted — the
 * standing-exceptions ranking went stale because a PERSON typed it.
 *
 * # ⚠ THIS IS A WRITER, AND IT IS THE ONLY TABLE IT MAY NAME
 *
 * `crew_queue_counts` and nothing else; no DDL, no DELETE. In particular it may
 * never touch `crew_work_switches` — those are HIS rows, and a shift that could
 * write them could switch its own permission on.
 * `server/crewShiftWriterBoundary.test.ts` pins that at the source, with a
 * positive control.
 */
import { execFileSync } from "node:child_process";

import { CREW_WORK_CATEGORIES } from "../shared/crewWorkSwitches.js";
import { openDatabase, resolveDatabaseUrl, worldOf } from "./lib/dbConnection.mts";

const TABLE = "crew_queue_counts";

/** WHICH WORLD, named plainly — see `crew-shift-start.mts`'s note. */
function whichWorld(): "PRODUCTION" | "DEV" {
  return process.env.MYSQL_PUBLIC_URL ? "PRODUCTION" : "DEV";
}

/** UTC ISO, never a locale string. */
function iso(value: unknown): string {
  return value instanceof Date ? `${value.toISOString().replace("T", " ").slice(0, 19)} UTC` : String(value);
}

/**
 * How many OPEN issues carry this label.
 *
 * ⚠ **A FAILED COUNT IS `null`, NEVER `0`.** They are opposite facts: zero
 * tells him toggling that category on buys nothing, and a broken `gh` telling
 * him zero is the confident-wrong-number failure this whole card is about. A
 * null is skipped, the old row is left standing with its older `countedAt`, and
 * the page keeps saying honestly when it was last counted.
 *
 * `--limit 500` and a length, rather than a `--json totalCount` field, because
 * `gh issue list` does not return a total — a `--limit` shorter than the real
 * population would silently cap the answer. 500 is far above any plausible
 * count here and the cap is checked below rather than assumed.
 */
function countOpen(label: string): number | null {
  try {
    const out = execFileSync(
      "gh",
      ["issue", "list", "--state", "open", "--label", label, "--limit", "500", "--json", "number"],
      /* NO `shell: true`. `crew-read-replies.mts` needs one because `railway.cmd`
         is a batch file that cannot be resolved from PATH without it; `gh` is an
         .exe and does not. Driven both ways before choosing (3 rows either way),
         because the shell form emits node's DEP0190 on every run and a shift tool
         should print its answer and no noise. */
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    const rows = JSON.parse(out);
    if (!Array.isArray(rows)) return null;
    if (rows.length >= 500) {
      console.error(`REFUSING ${label}: 500 rows came back, which is the limit — the count would be a floor, not a count.`);
      return null;
    }
    return rows.length;
  } catch (cause) {
    console.error(`[warn] could not count \`${label}\`: ${(cause as Error).message}`);
    return null;
  }
}

await import("dotenv/config");
const url = resolveDatabaseUrl();
if (!url) {
  console.error("REFUSING: no database URL. Set DATABASE_URL in .env, or wrap in `railway.cmd run --service MySQL`.");
  process.exit(1);
}

const conn = await openDatabase(url);
console.log(`world: ${whichWorld()} · ${worldOf(url)}`);

try {
  /* Working law 2 — the existence reader gets a control before its negative counts. */
  const [control] = await conn.query<any[]>("SHOW TABLES LIKE 'users'");
  if (control.length !== 1) {
    console.error("REFUSING: the existence reader cannot see `users` — wrong database, or a reader that cannot say yes.");
    await conn.end();
    process.exit(1);
  }
  const [present] = await conn.query<any[]>(`SHOW TABLES LIKE '${TABLE}'`);
  if (present.length !== 1) {
    console.error(
      `REFUSING: \`${TABLE}\` does not exist in this world. It is migration 0056 and production takes it by`
      + " `scripts/ceremony-crew-work-switches.mts`, which is a FOUNDER act.",
    );
    await conn.end();
    process.exit(1);
  }

  let written = 0;
  let skipped = 0;
  for (const category of CREW_WORK_CATEGORIES) {
    const count = countOpen(category.queueLabel);
    if (count === null) {
      skipped += 1;
      console.log(`  ${category.label.padEnd(14)} SKIPPED — the old row stands, with its older timestamp`);
      continue;
    }
    /* Upsert on the UNIQUE `categoryKey`, so the store can never hold two
       answers for one category and the count cannot depend on row order. */
    await conn.query(
      `INSERT INTO \`${TABLE}\` (categoryKey, openCount, countedAt)
       VALUES (?, ?, UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE openCount = VALUES(openCount), countedAt = VALUES(countedAt)`,
      [category.key, count],
    );
    written += 1;
    console.log(`  ${category.label.padEnd(14)} ${String(count).padStart(3)} open  (label \`${category.queueLabel}\`)`);
  }

  /* Read back rather than trusted (working law 1 — the changed rows are the fact). */
  const [rows] = await conn.query<any[]>(
    `SELECT categoryKey, openCount, countedAt FROM \`${TABLE}\` ORDER BY categoryKey`,
  );
  console.log(`\nstored ${rows.length} row(s) · ${written} written, ${skipped} skipped this run`);
  for (const row of rows) {
    console.log(`  ${String(row.categoryKey).padEnd(14)} ${String(row.openCount).padStart(3)} · ${iso(row.countedAt)}`);
  }
  if (skipped > 0) {
    console.log("\n⚠ A skipped category keeps its previous number and its previous timestamp. The page shows the age.");
  }
} catch (cause) {
  console.error(`FAILED: ${(cause as Error).message}`);
  await conn.end();
  process.exit(1);
}

await conn.end();
process.exit(0);
