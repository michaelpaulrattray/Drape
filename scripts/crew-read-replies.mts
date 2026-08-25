/**
 * READ THE FOUNDER'S REPLIES — step 1 of a shift, and step 1 of shift close
 * (issue #41, design `docs/specs/CREW_TAB_DESIGN.md` §3).
 *
 * Prints every reply the crew has not yet acknowledged: id, when, which card
 * (with the card's title when the current briefing still holds it), and **the
 * body verbatim**. A shift runs it at shift start, and again at shift close
 * before writing the briefing — the same merge-never-overwrite law the Desk
 * artifact had.
 *
 * # IT NEVER WRITES. ONE SELECT AND NOTHING ELSE.
 *
 * That is the whole security posture of this file and it is worth stating
 * rather than implying: the reply table is the founder's half of the store, and
 * a shift's road to it is read-only by construction. Nothing here issues an
 * INSERT, an UPDATE, a DELETE or a DDL statement. Acknowledgement is not a
 * write either — it happens by a shift adding ids to `acknowledgedReplyIds` in
 * `server/crew/crew-briefing.json` and PUSHING, which is what makes "seen by
 * the crew" honest: a reply is seen when the team's own next deploy proves it
 * was read.
 *
 * # WHICH WORLD
 *
 * Production is the one that matters — that is where he types — and it is
 * reached the established way, wrapped in the Railway MySQL service:
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/crew-read-replies.mts
 *
 * A plain local run has no `MYSQL_PUBLIC_URL` and falls back to `.env`'s
 * `DATABASE_URL`, which is dev. `resolveDatabaseUrl()` decides that, and
 * `openDatabase` prints the host and PORT it opened on stderr — the two worlds
 * share a hostname and a database name and differ only by port, which has
 * produced a wrong reading here before.
 *
 * # SET DIFFERENCE, NOT A WATERLINE
 *
 * The default read prints every reply whose id is NOT in the acknowledged
 * list — never "newer than the newest acknowledged id". The first version
 * used that waterline, and its docblock claimed it degraded safely; the claim
 * was BACKWARDS (caught by the PR #72 re-review): acknowledgement is a HAND
 * EDIT of a JSON list, so a shift that adds #10 and misses #9 would sink #9
 * below the waterline and hide it from every future default read forever,
 * while his page said "Not read yet" — the design's forbidden vanishing,
 * transplanted into the one tool a shift reads him with. The set difference
 * cannot hide a reply: an unacknowledged id prints on every run until a
 * deployed edition names it, however the list was edited.
 *
 *   --all   print the whole thread, acknowledged or not
 */
import { readFileSync } from "node:fs";

import { openDatabase, resolveDatabaseUrl, utc } from "./lib/dbConnection.mts";

const showAll = process.argv.includes("--all");

/* `.env` for the dev fallback. It is loaded BEFORE the URL is resolved, and
   `resolveDatabaseUrl` prefers MYSQL_PUBLIC_URL, so a wrapped production run is
   never quietly redirected to dev by this line. */
await import("dotenv/config");
const url = resolveDatabaseUrl();
if (!url) {
  console.error("REFUSING: no database URL. Set DATABASE_URL in .env, or wrap in `railway.cmd run --service MySQL`.");
  process.exit(1);
}

/**
 * The deployed briefing, read from the working tree.
 *
 * Two things come out of it and neither is essential: the acknowledgement
 * waterline, and the card titles. If it cannot be read the script still prints
 * every reply — it says so and shows the whole thread, which is the failure
 * direction that loses nothing.
 */
type Briefing = {
  edition: number;
  acknowledgedReplyIds: number[];
  needsYou: Array<{ id: string; title: string }>;
};

let briefing: Briefing | null = null;
try {
  briefing = JSON.parse(readFileSync("server/crew/crew-briefing.json", "utf8")) as Briefing;
} catch (cause) {
  console.error(`[warn] could not read server/crew/crew-briefing.json (${(cause as Error).message}).`);
  console.error("[warn] showing the WHOLE thread and no card titles — nothing is hidden by this.");
}

const acknowledged = briefing?.acknowledgedReplyIds ?? [];
const titles = new Map((briefing?.needsYou ?? []).map((card) => [card.id, card.title]));

const conn = await openDatabase(url);
try {
  /*
    THE READER IS PROVEN BEFORE ITS ANSWER IS BELIEVED (working law 2).

    "No new replies" is the answer this script gives most nights, and it is
    indistinguishable from a missing table, an empty database or a wrong world.
    So the table's existence is established first, and a missing one SAYS SO
    rather than printing the same reassuring silence.
  */
  const [exists] = await conn.query<any[]>("SHOW TABLES LIKE 'crew_replies'");
  if (exists.length !== 1) {
    console.log("`crew_replies` does not exist in this world — the ceremony has not been run here.");
    console.log("That is not the same as \"no replies\". Run scripts/ceremony-crew-replies.mts.");
    await conn.end();
    process.exit(0);
  }

  const [total] = await conn.query<any[]>("SELECT COUNT(*) AS n FROM crew_replies");
  /* Set difference at the statement. The empty list needs its own arm because
     `NOT IN ()` is not SQL; with nothing acknowledged, everything is new. */
  const [rows] = await conn.query<any[]>(
    showAll || acknowledged.length === 0
      ? "SELECT id, cardId, body, createdAt FROM crew_replies ORDER BY id ASC"
      : "SELECT id, cardId, body, createdAt FROM crew_replies WHERE id NOT IN (?) ORDER BY id ASC",
    showAll || acknowledged.length === 0 ? [] : [acknowledged],
  );

  console.log(
    `briefing edition ${briefing?.edition ?? "?"} · ${acknowledged.length} acknowledged · `
    + `${total[0].n} replies in total`,
  );

  if (rows.length === 0) {
    console.log(showAll ? "\nThe thread is empty." : "\nNo new replies.");
  } else {
    console.log(`\n${rows.length} ${showAll ? "" : "NEW "}${rows.length === 1 ? "reply" : "replies"}:\n`);
    for (const row of rows) {
      const card = row.cardId === null
        ? "journal note"
        : `card ${row.cardId}${titles.has(row.cardId) ? ` — "${titles.get(row.cardId)}"` : " (not in the current briefing)"}`;
      console.log(`  #${row.id}  ${utc(row.createdAt)}  ${card}`);
      /* Verbatim, every line of it, indented but never reflowed or truncated —
         his words are the steering wheel and this is the only place a shift
         reads them. */
      for (const line of String(row.body).split("\n")) console.log(`    ${line}`);
      console.log("");
    }
    console.log(
      "Acknowledge by adding these ids to `acknowledgedReplyIds` in "
      + "server/crew/crew-briefing.json and pushing — that is the ONLY thing that marks "
      + "them seen on his page.",
    );
    console.log(
      "And the journal is still his control panel: a cardless \"pause the nights\" / "
      + "\"stop\" means create .agents/STOP, say so in your journal entry, and exit.",
    );
  }
} catch (cause) {
  console.error(`FAILED: ${(cause as Error).message}`);
  await conn.end();
  process.exit(1);
}

await conn.end();
process.exit(0);
