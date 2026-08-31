/**
 * WHAT HE HAS MARKED NOT RELEVANT — and the shift's answer (issue #325).
 *
 *   # what is waiting — read only, no arguments
 *   railway.cmd run --service MySQL -- npx tsx scripts/crew-card-intents.mts
 *
 *   # the shift's answer, one card at a time
 *   railway.cmd run --service MySQL -- npx tsx scripts/crew-card-intents.mts \
 *     --resolve 312 --outcome closed --note 'built and deployed on 2026-08-29'
 *   railway.cmd run --service MySQL -- npx tsx scripts/crew-card-intents.mts \
 *     --resolve 312 --outcome declined --note 'still open — #340 depends on it'
 *
 * # ⚠ THIS IS THE OTHER HALF OF A FEATURE THAT IS INERT WITHOUT IT
 *
 * His tap records an intent and closes nothing. **A shift closing the card is
 * the whole rest of the road**, and a road whose second half nobody walks is
 * invariant 7 — *a control that is not invoked does not exist* — which is
 * exactly what happened to the live shift row's four commands (#286). So this
 * is named in the standing orders' close block beside the desk sweep, and the
 * `--resolve` call is what writes his answer back onto the panel he tapped
 * from.
 *
 * # ⚠ IT DOES NOT TOUCH GITHUB, AND THAT IS DELIBERATE
 *
 * Closing the issue is `gh issue close`, run by the shift with its own
 * credential — the same road every card close already takes. Nothing here holds
 * a token, and nothing in production does either, which is the credential
 * decision his card declined to take as a side effect of a button.
 *
 * So the order of operations matters and is stated: **close the card in GitHub
 * FIRST, then record `--outcome closed` here.** A row that says closed over a
 * card still open is a report contradicting its artifact (working law 1); the
 * other order is at worst a row this tool lists again next shift.
 *
 * # ⚠ THE WRITE IS ONE TABLE AND THREE COLUMNS WIDE
 *
 * `crew_card_intents` has two writers split by column (migration 0059). This
 * one may write `resolution`, `resolutionNote` and `resolvedAt` and NOTHING
 * ELSE — his `intent`, `markedByUserId`, `markedAt` and `withdrawnAt` are the
 * page's, and a shift tool that could rewrite what he asked for could rewrite
 * the record of him asking. `server/crewShiftWriterBoundary.test.ts` reads
 * these bytes and reddens on a second table, on DDL, on a DELETE, and on this
 * file naming one of his columns in a SET.
 *
 * # ⚠ AND IT REFUSES A WITHDRAWN ROW RATHER THAN RESOLVING IT
 *
 * He can take a tap back between the shift reading the list and acting on it.
 * The pending condition is re-asked INSIDE the UPDATE — `withdrawnAt IS NULL
 * AND resolution IS NULL` — so a card he decided to keep cannot be closed by a
 * shift working from a list that was true a minute ago. Zero rows changed is
 * reported as a refusal with its reason, never as success.
 */
import { openDatabase, resolveDatabaseUrl, worldOf } from "./lib/dbConnection.mts";
import { parseStrictArgsOrRefuse } from "./lib/strictArgs.mts";
import {
  CREW_INTENT_NOTE_MAX,
  CREW_INTENT_RESOLUTIONS,
  intentIsPending,
} from "../shared/crewCardIntents.js";

const TABLE = "crew_card_intents";

const ARGS = parseStrictArgsOrRefuse(process.argv.slice(2), {
  value: ["resolve", "outcome", "note"],
  boolean: ["dry-run"],
});

const resolveArg = ARGS.value("resolve");
const outcomeArg = ARGS.value("outcome");
const noteArg = ARGS.value("note");
const dryRun = ARGS.flag("dry-run");

/** UTC ISO, never a locale string — every crew tool prints one clock. */
function iso(value: unknown): string {
  return value instanceof Date ? `${value.toISOString().replace("T", " ").slice(0, 19)} UTC` : String(value);
}

if (resolveArg !== null && !/^\d+$/.test(resolveArg)) {
  console.error("REFUSING: --resolve takes a card NUMBER, e.g. --resolve 312.");
  process.exit(1);
}
if (resolveArg === null && (outcomeArg !== null || noteArg !== null || dryRun)) {
  console.error("REFUSING: --outcome, --note and --dry-run only mean something with --resolve.");
  process.exit(1);
}
if (resolveArg !== null) {
  if (outcomeArg === null) {
    console.error(`REFUSING: --resolve needs --outcome (${CREW_INTENT_RESOLUTIONS.join(" | ")}).`);
    process.exit(1);
  }
  if (!(CREW_INTENT_RESOLUTIONS as readonly string[]).includes(outcomeArg)) {
    console.error(`REFUSING: --outcome must be one of: ${CREW_INTENT_RESOLUTIONS.join(", ")}.`);
    process.exit(1);
  }
  /*
    ⚠ A DECLINE WITHOUT A REASON IS REFUSED, and that is his card's bar rather
    than tidiness: *"the next shift acts on the intents, closes what it
    confirms, and REPORTS anything it declined to close and why."* The note is
    the report, and it lands on the panel he tapped from. A `closed` row may go
    without one — the card being closed is its own evidence.
  */
  if (outcomeArg === "declined" && (noteArg === null || noteArg.trim().length === 0)) {
    console.error("REFUSING: --outcome declined needs --note saying why. He asked for the reason, not the verdict.");
    process.exit(1);
  }
  if (noteArg !== null && noteArg.length > CREW_INTENT_NOTE_MAX) {
    console.error(`REFUSING: --note is ${noteArg.length} characters; the column holds ${CREW_INTENT_NOTE_MAX}.`);
    process.exit(1);
  }
}

/** Which world answered — the same plain naming every crew tool prints. */
function whichWorld(): "PRODUCTION" | "DEV" {
  return process.env.MYSQL_PUBLIC_URL ? "PRODUCTION" : "DEV";
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
  /* Working law 2 — the existence reader gets a control before its negative
     counts for anything. An empty answer and a wrong database look identical. */
  const [control] = await conn.query<any[]>("SHOW TABLES LIKE 'users'");
  if (control.length !== 1) {
    throw new Error("the existence reader cannot see `users` — wrong database, or a reader that cannot say yes.");
  }
  const [present] = await conn.query<any[]>(`SHOW TABLES LIKE '${TABLE}'`);
  if (present.length !== 1) {
    console.log(`\n\`${TABLE}\` does not exist in this world yet (migration 0059).`);
    console.log("His taps are not live until the ceremony runs:");
    console.log("  railway.cmd run --service MySQL -- npx tsx scripts/ceremony-crew-card-intents.mts --production");
    process.exit(0);
  }

  if (resolveArg !== null) {
    const card = Number(resolveArg);
    const [before] = await conn.query<any[]>(
      `SELECT issueNumber, intent, markedAt, withdrawnAt, resolution, resolutionNote, resolvedAt
         FROM \`${TABLE}\` WHERE issueNumber = ?`,
      [card],
    );
    if (before.length !== 1) {
      console.error(`\nREFUSING: he has not marked #${card}. Nothing to answer.`);
      process.exit(1);
    }
    const row = before[0];
    if (!intentIsPending({
      issueNumber: row.issueNumber,
      intent: row.intent,
      markedAt: row.markedAt,
      withdrawnAt: row.withdrawnAt ?? null,
      resolution: row.resolution ?? null,
      resolutionNote: row.resolutionNote ?? null,
      resolvedAt: row.resolvedAt ?? null,
    })) {
      console.error(
        `\nREFUSING: #${card} is not waiting — `
        + (row.withdrawnAt ? `he took the mark back ${iso(row.withdrawnAt)}.` : `already ${row.resolution} ${iso(row.resolvedAt)}.`),
      );
      process.exit(1);
    }

    if (dryRun) {
      console.log(`\nDRY RUN — would record #${card} as ${outcomeArg}${noteArg ? `: ${noteArg}` : ""}. Nothing written.`);
      process.exit(0);
    }

    /*
      ⚠ THE PENDING CONDITION IS RE-ASKED IN THE `WHERE`, not trusted from the
      SELECT above. He can withdraw between the two, and enforcement invariant 1
      is exactly this shape: a check followed by a write keyed on id alone is a
      check-then-write race. Here the race would close a card he decided to
      keep.
    */
    const [result] = await conn.query<any>(
      `UPDATE \`${TABLE}\`
          SET resolution = ?, resolutionNote = ?, resolvedAt = NOW()
        WHERE issueNumber = ? AND withdrawnAt IS NULL AND resolution IS NULL`,
      [outcomeArg, noteArg, card],
    );
    if (Number(result?.affectedRows ?? 0) !== 1) {
      console.error(
        `\nREFUSING: #${card} changed underneath this command — nothing was written. Read it again.`,
      );
      process.exit(1);
    }
    console.log(`\nRECORDED — #${card} is ${outcomeArg}${noteArg ? `: ${noteArg}` : ""}.`);
    console.log("His page shows it under the card the moment it re-reads.");
    process.exit(0);
  }

  const [rows] = await conn.query<any[]>(
    `SELECT issueNumber, intent, markedAt, withdrawnAt, resolution, resolutionNote, resolvedAt
       FROM \`${TABLE}\` ORDER BY markedAt DESC`,
  );

  const pending = rows.filter((row) => row.withdrawnAt === null && row.resolution === null);

  console.log("");
  if (pending.length === 0) {
    console.log("WAITING ON A SHIFT: nothing. He has marked no card that has not been answered.");
  } else {
    console.log(`WAITING ON A SHIFT: ${pending.length} card(s) he marked not relevant`);
    for (const row of pending) {
      console.log(`  #${row.issueNumber} — marked ${iso(row.markedAt)}`);
    }
    console.log("");
    console.log("For each: read the card against the CODE, close it in GitHub if it is genuinely stale,");
    console.log("then record the answer here. A decline needs its reason — he sees the note, not the verdict.");
    console.log("  gh issue close <n> --comment '<why>'");
    console.log(`  npx tsx scripts/${"crew-card-intents.mts"} --resolve <n> --outcome closed --note '<what you checked>'`);
  }

  const answered = rows.filter((row) => row.resolution !== null);
  const withdrawn = rows.filter((row) => row.withdrawnAt !== null && row.resolution === null);
  console.log("");
  console.log(`ALREADY ANSWERED: ${answered.length} · TAKEN BACK BY HIM: ${withdrawn.length}`);
  for (const row of answered.slice(0, 5)) {
    console.log(
      `  #${row.issueNumber} — ${row.resolution} ${iso(row.resolvedAt)}${row.resolutionNote ? `: ${row.resolutionNote}` : ""}`,
    );
  }
} finally {
  await conn.end();
}

process.exit(0);
