/**
 * READ HIS BACKGROUND-WORK SWITCHES — step 1b of a shift, beside the replies
 * (issue #277).
 *
 * Founder-ordered 2026-08-30: with no confirmed focus and no named side lane, a
 * shift **stops** unless he has turned this on. It inverts today's default and
 * it guards a failure he named himself — *"we need to ensure if they are
 * waiting a long time for me they dont completly over engineer security or
 * anything because they are bored."*
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/crew-work-switches.mts
 *
 * # IT NEVER WRITES. ONE SELECT PER TABLE AND NOTHING ELSE.
 *
 * The switches are the FOUNDER's half of the store, exactly as `crew_replies`
 * is, and a shift's road to them is read-only by construction — the same
 * property `scripts/crew-read-replies.mts` states about his replies, pinned by
 * `server/crewShiftWriterBoundary.test.ts` at the source with a positive
 * control. **A switch a shift could write is not his switch.**
 *
 * # WHAT IT PRINTS IS A VERDICT, NOT A TABLE
 *
 * A shift reading a grid of six booleans and deciding for itself is how a rule
 * gets misapplied at 4am. So this prints the ANSWER — what may be worked, in
 * his order — and the raw state underneath it for the record.
 *
 * # ⚠ THE HONEST LIMIT, STATED RATHER THAN DRESSED UP
 *
 * This is one of the two arms that make the switch a real control (the other is
 * `crew-shift-start.mts` REFUSING to open a `background` run while it is off,
 * and the row recording `workKind` so a bypass is visible on his page).
 * Beyond that, enforcement is the shift running its own tools — the same class
 * of control as `.agents/STOP`. It is strong because the team is built to use
 * it, not because it is unbypassable, and claiming more would be a promise
 * wearing a guard's name (invariant 7's own warning, pointed at this feature).
 */
import {
  CREW_WORK_CATEGORIES,
  CREW_WORK_MASTER_KEY,
  anyBackgroundWorkAllowed,
  backgroundWorkAllowed,
  type CrewWorkSwitchState,
} from "../shared/crewWorkSwitches.js";
import { openDatabase, resolveDatabaseUrl, worldOf } from "./lib/dbConnection.mts";

const SWITCH_TABLE = "crew_work_switches";
const COUNT_TABLE = "crew_queue_counts";

/**
 * WHICH WORLD, named plainly — the same reason #272's writers name theirs.
 *
 * A shift that reads DEV's switches has read the wrong answer with no error and
 * no clue, and would then work (or refuse) a night on a state he never set.
 */
function whichWorld(): "PRODUCTION" | "DEV" {
  return process.env.MYSQL_PUBLIC_URL ? "PRODUCTION" : "DEV";
}

/** UTC ISO, never a locale string — see `scripts/lib/dbConnection.mts`. */
function iso(value: unknown): string {
  return value instanceof Date ? `${value.toISOString().replace("T", " ").slice(0, 19)} UTC` : String(value);
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
  /*
    THE READER IS PROVEN BEFORE ITS ANSWER IS BELIEVED (working law 2). An empty
    result is the whole basis for "nothing is switched on", and it is also
    exactly what a wrong database looks like.
  */
  const [control] = await conn.query<any[]>("SHOW TABLES LIKE 'users'");
  if (control.length !== 1) {
    console.error("REFUSING: the existence reader cannot see `users` — wrong database, or a reader that cannot say yes.");
    await conn.end();
    process.exit(1);
  }

  const [present] = await conn.query<any[]>(`SHOW TABLES LIKE '${SWITCH_TABLE}'`);
  if (present.length !== 1) {
    /*
      ⚠ AN ABSENT TABLE IS "OFF", AND IT SAYS SO RATHER THAN FAILING.

      His bar: *"a fresh install, a lost row, an unreadable value: OFF."* Before
      the ceremony runs this is exactly that case, and the safe direction is the
      one where nothing runs. A refusal here would be indistinguishable, to a
      shift, from a broken tool — and a broken tool invites working around it.
    */
    console.log(
      `\n${SWITCH_TABLE} does not exist in this world yet (migration 0056 — production takes it by`
      + " `scripts/ceremony-crew-work-switches.mts`, a FOUNDER act).",
    );
    console.log("VERDICT: background work is OFF. An absent store reads off, which is his bar.");
    await conn.end();
    process.exit(0);
  }

  const [switchRows] = await conn.query<any[]>(
    `SELECT switchKey, enabled, changedAt FROM \`${SWITCH_TABLE}\``,
  );
  const switches: Record<string, boolean> = {};
  let changedAt: Date | null = null;
  for (const row of switchRows) {
    switches[String(row.switchKey)] = Boolean(row.enabled);
    if (changedAt === null || row.changedAt > changedAt) changedAt = row.changedAt;
  }
  const state: CrewWorkSwitchState = switches;

  /* The counts table may lag the switch table by a ceremony; a missing one is
     not an error, it just means nobody has counted yet. */
  const [countPresent] = await conn.query<any[]>(`SHOW TABLES LIKE '${COUNT_TABLE}'`);
  const counts = new Map<string, { openCount: number; countedAt: Date }>();
  if (countPresent.length === 1) {
    const [countRows] = await conn.query<any[]>(
      `SELECT categoryKey, openCount, countedAt FROM \`${COUNT_TABLE}\``,
    );
    for (const row of countRows) {
      counts.set(String(row.categoryKey), { openCount: Number(row.openCount), countedAt: row.countedAt });
    }
  }

  const master = switches[CREW_WORK_MASTER_KEY] ?? false;
  console.log(`\nMASTER: ${master ? "ON" : "OFF"}${changedAt ? ` · last changed ${iso(changedAt)}` : ""}`);

  for (const category of CREW_WORK_CATEGORIES) {
    const allowed = backgroundWorkAllowed(state, category.key);
    const own = switches[category.key] ?? false;
    const count = counts.get(category.key);
    const countText = count
      ? `${count.openCount} open · counted ${iso(count.countedAt)}`
      : "not counted yet";
    console.log(
      `  ${allowed ? "✓" : "·"} ${category.label.padEnd(14)} ${(own ? "on" : "off").padEnd(4)} ${countText}`,
    );
  }

  console.log("");
  if (anyBackgroundWorkAllowed(state)) {
    const open = CREW_WORK_CATEGORIES.filter((category) => backgroundWorkAllowed(state, category.key));
    console.log(`VERDICT: background work is ON for — ${open.map((c) => c.label).join(", ")}.`);
    console.log("It is admissible ONLY with no confirmed focus and no named side lane, and only from");
    console.log("a card that already exists. A defect you find yourself is CARDED before it is built.");
  } else {
    console.log(
      master
        ? "VERDICT: the master is on and no category is. Nothing is admissible."
        : "VERDICT: background work is OFF. With no focus and no named side lane, write why you are idle and exit.",
    );
  }
  console.log("\nThis reader NEVER writes. He sets these from /admin/crew.");
} catch (cause) {
  console.error(`FAILED: ${(cause as Error).message}`);
  await conn.end();
  process.exit(1);
}

await conn.end();
process.exit(0);
