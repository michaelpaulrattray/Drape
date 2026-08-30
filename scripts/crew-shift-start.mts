/**
 * OPEN THE LIVE SHIFT ROW — step 2 of a shift, run immediately after the brief
 * is chosen and BEFORE a line of code is written (issue #272).
 *
 * Founder, 2026-08-30, verbatim: *"if my shifts are running and i have no idea
 * what they are working on or doing thats dangerous"*.
 *
 * # THE START WRITE IS THE LOAD-BEARING HALF, AND #272 SAYS SO
 *
 * *"A shift that reports only at the end is a shift whose mistakes are
 * discoverable only after they are made. The whole value is the row appearing
 * BEFORE the work, so that a wrong brief — a retired plan, a card he has
 * already ruled obsolete, a section he did not authorise — is visible while it
 * is still cheap."*
 *
 * So this runs EARLY. A shift that builds first and opens its row afterwards
 * has kept the letter and thrown away the reason.
 *
 * # ⚠ THIS IS A WRITER, AND IT IS THE ONLY TABLE IT MAY NAME
 *
 * `scripts/crew-read-replies.mts` states that a shift's road to the founder's
 * half is read-only by construction. That property is UNCHANGED and this script
 * must never erode it: it names `crew_shift_runs` and nothing else, issues no
 * DDL, and never DELETEs. `server/crewShiftWriterBoundary.test.ts` reads this
 * file's source and reddens if that stops being true — with a positive control,
 * because a boundary test that cannot fail is the thing it is guarding against.
 *
 * Migration `0055`'s header carries the full argument for why a shift writes
 * production rows here at all, including the sentence in `0054` it overrides.
 *
 * # WHICH WORLD
 *
 * Production is the one that matters — that is the page he opens:
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/crew-shift-start.mts \
 *     --shift foreman-118 --seat foreman --kind focus \
 *     --card '#272' --title 'He cannot see what a shift is doing while it runs' \
 *     --intent 'A live shift row read from the database, so his page names what is running.'
 *
 * A plain local run has no `MYSQL_PUBLIC_URL` and falls back to `.env`'s
 * `DATABASE_URL`, which is dev. `openDatabase` prints the host and PORT — the
 * two worlds share a hostname and differ only by port.
 *
 * Later in the shift, to prove it is still alive and to record the branch:
 *
 *   … scripts/crew-shift-start.mts --note 'branch cut, building the reader' --branch feat/272-live-shift-row
 *
 * `--note` UPDATES the newest open run rather than opening a second one. That
 * is the heartbeat, and it is deliberately manual: a heartbeat process would be
 * a new persistent process, which `PROGRAM.md` makes a founder-announced act.
 */
import {
  CREW_SHIFT_SEATS,
  CREW_SHIFT_WORK_KINDS,
  type CrewShiftSeat,
  type CrewShiftWorkKind,
} from "../shared/crewShiftState.js";
import {
  CREW_WORK_CATEGORIES,
  CREW_WORK_MASTER_KEY,
  backgroundWorkAllowed,
} from "../shared/crewWorkSwitches.js";
import { openDatabase, resolveDatabaseUrl, worldOf } from "./lib/dbConnection.mts";

const TABLE = "crew_shift_runs";

/** `--flag value`, absent ⇒ null. No shorthand and no clustering: one shape. */
function arg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  /* A flag whose value is the next flag is a typo, never an empty string. */
  if (value === undefined || value.startsWith("--")) return null;
  return value;
}

/**
 * A timestamp as UTC ISO, never a locale string.
 *
 * mysql2 hands back a `Date`, and printing it raw renders it in the MACHINE's
 * zone while this repository's every stored timestamp is UTC — so a shift on a
 * UTC+10 laptop reads a row ten hours out and the string still ends in the
 * letters "UTC" (`scripts/lib/dbConnection.mts` carries the full incident).
 */
function iso(value: unknown): string {
  return value instanceof Date ? `${value.toISOString().replace("T", " ").slice(0, 19)} UTC` : String(value);
}

/**
 * WHICH WORLD THIS ROW LANDS IN, NAMED PLAINLY.
 *
 * ⚠ This is the failure mode that matters most on this road, and it is silent.
 * The page #272 exists for is PRODUCTION; a shift that opens its row against
 * dev has done everything right, seen a success message, and left his page
 * saying "Nothing running" for the whole shift. Nothing anywhere would say so.
 *
 * The two worlds are the same hostname and the same database NAME and differ
 * only by PORT (`scripts/lib/dbConnection.mts`), so the port is not something
 * to make an operator read — the VARIABLE that answered is. `MYSQL_PUBLIC_URL`
 * is only present under `railway.cmd run --service MySQL`.
 */
function whichWorld(): "PRODUCTION" | "DEV" {
  return process.env.MYSQL_PUBLIC_URL ? "PRODUCTION" : "DEV";
}

function refuse(message: string): never {
  console.error(`REFUSING: ${message}`);
  process.exit(1);
}

await import("dotenv/config");
const url = resolveDatabaseUrl();
if (!url) {
  refuse("no database URL. Set DATABASE_URL in .env, or wrap in `railway.cmd run --service MySQL`.");
}

const noteMode = arg("note");
const conn = await openDatabase(url!);
console.log(`world: ${whichWorld()} · ${worldOf(url)}`);

try {
  /*
    THE READER IS PROVEN BEFORE ITS ANSWER IS BELIEVED (working law 2).

    Everything below turns on whether this table exists, and "it does not" is
    also exactly what a wrong database looks like. The control is a table that
    certainly exists in both worlds.
  */
  const [control] = await conn.query<any[]>("SHOW TABLES LIKE 'users'");
  if (control.length !== 1) {
    refuse("the existence reader cannot see `users` — wrong database, or a reader that cannot say yes.");
  }
  const [present] = await conn.query<any[]>(`SHOW TABLES LIKE '${TABLE}'`);
  if (present.length !== 1) {
    refuse(
      `\`${TABLE}\` does not exist in this world. It is migration 0055 and production takes it by `
      + "`scripts/ceremony-crew-shift-runs.mts`, which is a FOUNDER act. The shift row cannot be opened "
      + "until that has run — say so in the shift report rather than proceeding silently.",
    );
  }

  if (noteMode !== null) {
    /*
      THE HEARTBEAT. Updates the newest OPEN run — `endedAt IS NULL` — and
      touches nothing else. Scoped by a subquery on the same table rather than
      by an id the caller passes, because a shift that has to remember its own
      row id will eventually stamp somebody else's (invariant 1's shape: put
      the scope in the statement that writes).
    */
    const branch = arg("branch");
    const [result] = await conn.query<any>(
      `UPDATE \`${TABLE}\`
          SET heartbeatAt = UTC_TIMESTAMP(),
              intent = ?,
              branch = COALESCE(?, branch)
        WHERE endedAt IS NULL
        ORDER BY id DESC
        LIMIT 1`,
      [noteMode.slice(0, 500), branch],
    );
    if (result.affectedRows !== 1) {
      refuse("there is no open run to note against. Open one first (without --note).");
    }
    console.log(`NOTED — the open run now reads: ${noteMode}`);
    if (branch) console.log(`branch: ${branch}`);
  } else {
    const shift = arg("shift");
    const seat = arg("seat");
    const kind = arg("kind");
    const intent = arg("intent");

    if (!shift) refuse("--shift is required (the shift's own name, e.g. foreman-118).");
    if (!seat) refuse(`--seat is required, one of: ${CREW_SHIFT_SEATS.join(", ")}`);
    if (!intent) refuse("--intent is required — one sentence on what this shift intends to change.");
    if (!kind) refuse(`--kind is required, one of: ${CREW_SHIFT_WORK_KINDS.join(", ")}`);

    /* Closed vocabularies, checked here rather than in the column. A typo'd
       seat would draw a blank strip on his page and read as a bug in the page. */
    if (!CREW_SHIFT_SEATS.includes(seat as CrewShiftSeat)) {
      refuse(`--seat "${seat}" is not one of: ${CREW_SHIFT_SEATS.join(", ")}`);
    }
    if (!CREW_SHIFT_WORK_KINDS.includes(kind as CrewShiftWorkKind)) {
      refuse(`--kind "${kind}" is not one of: ${CREW_SHIFT_WORK_KINDS.join(", ")}`);
    }

    /*
      ⚠ THE BACKGROUND-WORK GATE (#277) — the arm that makes his switch a
      CONTROL rather than a documented rule.

      His order inverts today's default: background work is OPT-IN and the
      switch is his. A rule that lives only in `PROGRAM.md` is precisely the
      "written, documented, never invoked" class `CLAUDE.md` catalogues at
      length — so opening a `background` run is REFUSED here unless he has
      turned the master and at least one category on.

      Read at the same database this row is about to be written to, so a shift
      cannot be gated by one world's switches while filing into another.

      ⚠ **AN ABSENT SWITCH TABLE REFUSES**, which is the opposite of the
      READER's behaviour and deliberately so: the reader reports a state and
      "off" is the honest one, while this decides whether to SPEND A NIGHT. His
      bar is that an unreadable value reads OFF, and off means this refuses.
    */
    if (kind === "background") {
      const [switchTable] = await conn.query<any[]>("SHOW TABLES LIKE 'crew_work_switches'");
      const switches: Record<string, boolean> = {};
      if (switchTable.length === 1) {
        const [rows] = await conn.query<any[]>("SELECT switchKey, enabled FROM `crew_work_switches`");
        for (const row of rows) switches[String(row.switchKey)] = Boolean(row.enabled);
      }
      const open = CREW_WORK_CATEGORIES.filter((category) => backgroundWorkAllowed(switches, category.key));
      if (open.length === 0) {
        /*
          ⚠ THE REFUSAL NAMES ITS OWN REASON, and the three cases are genuinely
          different. The first version of this message always said "no category
          is on" — which was FALSE whenever the master was off and a category
          was on, and that is the commonest way he will leave it (one tap on the
          master stops everything without clearing five switches). A refusal
          that misstates why it refused sends the next shift to the wrong
          switch. Caught by driving it, not by reading it.
        */
        const masterOn = switches[CREW_WORK_MASTER_KEY] ?? false;
        const categoriesOn = CREW_WORK_CATEGORIES.filter((c) => switches[c.key] ?? false);
        const because = switchTable.length !== 1
          ? "the switch table does not exist in this world yet, which reads OFF (his bar)."
          : !masterOn && categoriesOn.length > 0
            ? `the master is off — ${categoriesOn.map((c) => c.label).join(", ")} `
              + `${categoriesOn.length === 1 ? "is" : "are"} switched on, but the master gates everything.`
            : !masterOn
              ? "the master is off and no category is on."
              : "the master is on but no category is.";
        refuse(
          `background work is OFF: ${because}`
          + " With no confirmed focus and no named side lane, WRITE WHY YOU ARE IDLE AND EXIT — "
          + "an idle night is a correct night, and inventing work is the one unforgivable brief. "
          + "He turns this on from /admin/crew.",
        );
      }
      console.log(`background work is ON for: ${open.map((c) => c.label).join(", ")}`);
    }

    /*
      ⚠ AN OPEN RUN ALREADY EXISTS — and this is a WARNING rather than a
      refusal, deliberately. Two shifts genuinely share this tree (memory: *two
      seats, one tree*), and a relay seat opening a row while a Foreman shift
      runs is legitimate. What is NOT legitimate is doing it without noticing,
      so the previous run is printed and the operator is told what to do about
      it. Refusing here would mean a crashed shift's stale row locks out every
      later one, which is the failure that matters more.
    */
    const [open] = await conn.query<any[]>(
      `SELECT id, shift, seat, intent, startedAt FROM \`${TABLE}\` WHERE endedAt IS NULL ORDER BY id DESC`,
    );
    if (open.length > 0) {
      console.log(`\n⚠ ${open.length} run(s) still open — another seat, or a shift that died without closing:`);
      for (const row of open) {
        console.log(`   #${row.id} ${row.shift} (${row.seat}) started ${iso(row.startedAt)} — ${row.intent}`);
      }
      console.log("   If one of these is a dead shift, close it: scripts/crew-shift-close.mts --id <n> --outcome failed\n");
    }

    const [result] = await conn.query<any>(
      `INSERT INTO \`${TABLE}\` (shift, seat, workKind, cardRef, cardTitle, intent, branch, startedAt, heartbeatAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
      [
        shift.slice(0, 64),
        seat,
        kind,
        arg("card")?.slice(0, 64) ?? null,
        arg("title")?.slice(0, 255) ?? null,
        intent.slice(0, 500),
        arg("branch")?.slice(0, 255) ?? null,
      ],
    );

    /* Read back rather than trusted: an INSERT that reported success says the
       statement parsed (working law 1 — the changed row is the fact). */
    const [rows] = await conn.query<any[]>(
      `SELECT id, shift, seat, workKind, cardRef, intent, startedAt FROM \`${TABLE}\` WHERE id = ?`,
      [result.insertId],
    );
    if (rows.length !== 1) throw new Error("the insert reported success and the row is not there — stop and investigate");
    const row = rows[0];
    console.log(
      `\nOPENED — run #${row.id}: ${row.shift} (${row.seat}, ${row.workKind})`
      + `${row.cardRef ? ` on ${row.cardRef}` : ""}\n  ${row.intent}\n  started ${iso(row.startedAt)}`,
    );
    console.log("\nHis page names this within a minute. Close it at shift end:");
    console.log(`  scripts/crew-shift-close.mts --id ${row.id} --outcome shipped --note '…' --pr <n>`);
  }
} catch (cause) {
  console.error(`FAILED: ${(cause as Error).message}`);
  await conn.end();
  process.exit(1);
}

await conn.end();
process.exit(0);
