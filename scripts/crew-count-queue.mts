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
 * # THE TITLES BESIDE THE NUMBER (#285)
 *
 * Founder, at the live panel: *"am i suppose to see a list under these
 * categories?"* Up to five card titles ride each row, most recent first, and
 * **they cost nothing extra to produce** — this script already has the cards in
 * hand when it counts them, so the titles come out of the SAME `gh` response
 * and land in the SAME statement. That is what makes his card's bar — *the
 * count and the titles share one `countedAt`* — hold by construction rather
 * than by two writes agreeing.
 *
 * ⚠ **AND IT STILL WRITES THE COUNT WHERE THE COLUMN DOES NOT EXIST.** The
 * column is migration 0057 and production takes it by ceremony, which is a
 * founder act; between the deploy and that command this script runs at every
 * shift start against a table without it. So it asks `SHOW COLUMNS` first and
 * falls back to the count-only INSERT — a shift must never leave his panel
 * uncounted because a feature it cannot see is not installed yet.
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

import {
  QUEUE_TITLES_PER_CATEGORY,
  parseQueueTitles,
  serializeQueueTitles,
  type CrewQueueTitle,
} from "../shared/crewQueueTitles.js";
import { CREW_WORK_CATEGORIES } from "../shared/crewWorkSwitches.js";
import { openDatabase, resolveDatabaseUrl, worldOf } from "./lib/dbConnection.mts";

const TABLE = "crew_queue_counts";
const TITLES_COLUMN = "titles";

/** WHICH WORLD, named plainly — see `crew-shift-start.mts`'s note. */
function whichWorld(): "PRODUCTION" | "DEV" {
  return process.env.MYSQL_PUBLIC_URL ? "PRODUCTION" : "DEV";
}

/** UTC ISO, never a locale string. */
function iso(value: unknown): string {
  return value instanceof Date ? `${value.toISOString().replace("T", " ").slice(0, 19)} UTC` : String(value);
}

/** One category's whole reading: the population, and the five it names. */
type CategoryReading = {
  readonly count: number;
  readonly titles: readonly CrewQueueTitle[];
};

/**
 * How many OPEN issues carry this label, and the five most recent of them.
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
function countOpen(label: string): CategoryReading | null {
  try {
    const out = execFileSync(
      "gh",
      ["issue", "list", "--state", "open", "--label", label, "--limit", "500", "--json", "number,title,createdAt"],
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
    /*
      MOST RECENT FIRST, SORTED HERE RATHER THAN TRUSTED (#285's own words).
      `gh issue list` has a default order and this does not depend on it: an
      order that changed under us would silently reorder his panel, and the one
      thing five of ten rows must be is the five he has not seen.

      A row with no readable `createdAt` sorts LAST rather than being dropped —
      it is still a real open card, and the count above already includes it.
    */
    const stamped = rows.map((row: { number?: unknown; title?: unknown; createdAt?: unknown }) => ({
      number: typeof row.number === "number" ? row.number : 0,
      title: typeof row.title === "string" ? row.title : "",
      at: typeof row.createdAt === "string" ? Date.parse(row.createdAt) : Number.NaN,
    }));
    stamped.sort((left, right) => {
      const l = Number.isFinite(left.at) ? left.at : -Infinity;
      const r = Number.isFinite(right.at) ? right.at : -Infinity;
      return r - l;
    });
    const titles: CrewQueueTitle[] = stamped
      .slice(0, QUEUE_TITLES_PER_CATEGORY)
      .map((row) => ({ number: row.number, title: row.title }));
    return { count: rows.length, titles };
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

  /*
    ⚠ IS THE TITLES COLUMN HERE? Migration 0057, and production takes it by
    `scripts/ceremony-crew-queue-count-titles.mts`, which is a FOUNDER act — so
    this script runs at every shift start in the window before that command. A
    write naming a column the table does not have fails the whole INSERT, which
    would leave his panel UNCOUNTED because a feature it cannot see is not
    installed. Asked rather than caught: a writer should know which statement it
    is about to run, not discover it from an error.
  */
  const [titleColumn] = await conn.query<any[]>(`SHOW COLUMNS FROM \`${TABLE}\` LIKE '${TITLES_COLUMN}'`);
  const keepsTitles = titleColumn.length === 1;
  if (!keepsTitles) {
    console.log(
      `  (no \`${TITLES_COLUMN}\` column here — counting only. It is migration 0057 and production takes it by`
      + " `scripts/ceremony-crew-queue-count-titles.mts`, a FOUNDER act.)",
    );
  }

  let written = 0;
  let skipped = 0;
  for (const category of CREW_WORK_CATEGORIES) {
    const reading = countOpen(category.queueLabel);
    if (reading === null) {
      skipped += 1;
      console.log(`  ${category.label.padEnd(14)} SKIPPED — the old row stands, with its older timestamp`);
      continue;
    }
    /* Upsert on the UNIQUE `categoryKey`, so the store can never hold two
       answers for one category and the count cannot depend on row order.

       ⚠ The titles ride the SAME statement as the count, which is what makes
       "they share one `countedAt`" a property of the schema rather than of two
       writes both happening to succeed. */
    if (keepsTitles) {
      await conn.query(
        `INSERT INTO \`${TABLE}\` (categoryKey, openCount, ${TITLES_COLUMN}, countedAt)
         VALUES (?, ?, ?, UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE openCount = VALUES(openCount), ${TITLES_COLUMN} = VALUES(${TITLES_COLUMN}), countedAt = VALUES(countedAt)`,
        [category.key, reading.count, serializeQueueTitles(reading.titles)],
      );
    } else {
      await conn.query(
        `INSERT INTO \`${TABLE}\` (categoryKey, openCount, countedAt)
         VALUES (?, ?, UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE openCount = VALUES(openCount), countedAt = VALUES(countedAt)`,
        [category.key, reading.count],
      );
    }
    written += 1;
    console.log(`  ${category.label.padEnd(14)} ${String(reading.count).padStart(3)} open  (label \`${category.queueLabel}\`)`);
    for (const card of reading.titles) console.log(`      #${card.number} ${card.title}`);
  }

  /* Read back rather than trusted (working law 1 — the changed rows are the fact). */
  const [rows] = await conn.query<any[]>(
    `SELECT categoryKey, openCount, ${keepsTitles ? `${TITLES_COLUMN}, ` : ""}countedAt FROM \`${TABLE}\` ORDER BY categoryKey`,
  );
  console.log(`\nstored ${rows.length} row(s) · ${written} written, ${skipped} skipped this run`);
  for (const row of rows) {
    /* Read back through the PARSER his page uses, never through this script's
       own idea of the shape — a value that writes and reads fine here and
       yields nothing on the panel is exactly the failure being avoided. */
    const named = keepsTitles ? parseQueueTitles(row[TITLES_COLUMN]).length : 0;
    console.log(
      `  ${String(row.categoryKey).padEnd(14)} ${String(row.openCount).padStart(3)}`
      + `${keepsTitles ? ` · ${named} named` : ""} · ${iso(row.countedAt)}`,
    );
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
