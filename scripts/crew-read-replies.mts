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
 * # IT NEVER WRITES TO HIS TABLE. ONE SELECT AND NOTHING ELSE.
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
 * # ⚠ `--write` TOUCHES ONE TRACKED FILE, AND NEVER THE DATABASE (#749)
 *
 * The posture above is about HIS half of the store and it is unchanged: no
 * INSERT, no UPDATE, no DELETE, no DDL, on any road through this file. What
 * `--write` does is set `state: "answered"` on the briefing items he has
 * ALREADY replied to and this repository has ALREADY acknowledged — the same
 * tracked JSON a shift edits by hand and the desk sweep edits by rule, in the
 * working tree, committed and reviewed like any other change.
 *
 * It exists because the reading below had no writer. He found that himself:
 * *"for some reason the fangs desk card wont dissapear even though i replied
 * seen ages ago"* — 29 hours and four shifts after his reply, every one of
 * which was TOLD by this script and left it for the next one.
 * `shared/crewReplyAcknowledgement.ts` holds the rule, and why a card can be
 * held where a set of frames never is.
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
 * ⚠ **AND "A DEPLOYED EDITION" IS NOT WHAT THE CODE READ UNTIL 2026-08-29 — it
 * read the WORKING TREE, which is a superset and hides in exactly the
 * direction the waterline did** (#221 §4). An edition committed but never
 * deployed acknowledges replies his page still shows as unread. See
 * `lib/liveBriefing.mts`: the list now comes from the briefing AT THE NEWEST
 * SUCCESS DEPLOYMENT'S COMMIT, and every road that cannot get there falls back
 * to the tree ON THE SCREEN rather than substituting it in silence.
 *
 *   --all     print the whole thread, acknowledged or not
 *   --write   apply `answered` to the items he has replied to (#749)
 */
import { execFileSync, execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

import { openDatabase, resolveDatabaseUrl, utc } from "./lib/dbConnection.mts";
import { listedRows } from "./lib/deployWatch.mts";
import { chooseBriefing, describeSource, parseBriefingFacts } from "./lib/liveBriefing.mts";
import type { ResolvableBriefing } from "../shared/crewCardResolution.js";
import {
  acknowledgementLine,
  planReplyAcknowledgements,
} from "../shared/crewReplyAcknowledgement.js";
import { hostIndex, staleOpenHosts, type ReplyRow } from "./lib/replyHosts.mts";
import { parseStrictArgsOrRefuse } from "./lib/strictArgs.mts";

const args = parseStrictArgsOrRefuse(process.argv.slice(2), { value: [], boolean: ["all", "write"] });
const showAll = args.flag("all");
const WRITE = args.flag("write");

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
 * THE DEPLOYED BRIEFING — read at the live commit, NOT from the working tree.
 *
 * Two things come out of it and neither is essential: the acknowledgement
 * waterline, and the card titles. If it cannot be read the script still prints
 * every reply — it says so and shows the whole thread, which is the failure
 * direction that loses nothing.
 *
 * ⚠ **AND IT WAS READ FROM THE TREE UNTIL 2026-08-29, WHICH IS A DIFFERENT
 * WORLD** (#221 §4). The night deployment `465bb66c` built an image and never
 * started a container, this line printed `edition 93` at a production serving
 * 92 — and the acknowledgement set, whose whole contract is *a reply is seen
 * when the team's own next deploy proves it was read*, was taken from an
 * edition no deploy had proven. `lib/liveBriefing.mts` holds the decision and
 * the reasoning; every fallback road it can take says so on the screen.
 */
const treeJson = (() => {
  try {
    return readFileSync("server/crew/crew-briefing.json", "utf8");
  } catch (cause) {
    console.error(`[warn] could not read server/crew/crew-briefing.json (${(cause as Error).message}).`);
    return null;
  }
})();

/* Railway's own listing, scoped by `--service` explicitly — this script runs
   UNDER `railway run --service MySQL`, which injects a service context that an
   unscoped listing honours (#148, the rite's ten-minute silence). Never fatal:
   a CLI that is slow, absent or unauthenticated drops to the tree with a line
   saying so, because a shift-start reader that dies costs more than the defect
   it repairs. */
const deploymentRows = (() => {
  try {
    /* A SHELL is not a style choice on Windows — `railway.cmd` is a batch file
       and `execFileSync` without one cannot resolve it from PATH (the rite's
       own `run` carries the same note). Driven both ways: without it this read
       fell to the tree every night, honestly and uselessly. One string rather
       than an args array because node's DEP0190 warns on the pair, and a
       shift-start tool should print its answer and no noise. */
    const service = process.env.RAILWAY_SERVICE ?? "Drape";
    /* Nothing but a plain service name ever reaches the shell string. The
       value is an operator's own environment rather than a request, so this is
       belt and braces — but a name that is not a name is a typo or a hostile
       env, and both are better answered by falling back to the tree with a
       line on the screen than by running whatever it says. */
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(service)) return [];
    return listedRows(execSync(
      `railway.cmd deployment list --service ${service} --json --limit 5`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 60_000 },
    ));
  } catch {
    return [];
  }
})();

const choice = chooseBriefing(deploymentRows, treeJson, (sha) => {
  try {
    return execFileSync("git", ["show", `${sha}:server/crew/crew-briefing.json`], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 30_000,
    });
  } catch {
    return null;
  }
});

const briefing = choice.facts;
if (!briefing) console.error("[warn] no briefing could be parsed on any road — showing the WHOLE thread and no card titles.");

const acknowledged = briefing?.acknowledgedReplyIds ?? [];
/* BOTH halves of the reply namespace, and the state each item is drawn in.
   `needsYou` alone printed "(not in the current briefing)" over 17 ids that
   were all present — see `lib/replyHosts.mts` for the reading. */
const hosts = hostIndex(briefing);

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

  /* THE SWEEP'S OWN READING — the default read prints only UNacknowledged
     replies, and the thing that went wrong is on the other side of that line
     (an acknowledged reply whose card was never moved off `open`). So it gets
     its own narrow statement rather than riding the display query, which
     answers a different question in two of its three modes. */
  const [addressed] = await conn.query<any[]>(
    "SELECT id, cardId FROM crew_replies WHERE cardId IS NOT NULL ORDER BY id ASC",
  );
  const stale = staleOpenHosts(briefing, addressed as ReplyRow[]);

  /* PROVENANCE FIRST, then the counts. The edition number on its own was read
     as a fact about production for two shifts running (#221 §4); it now
     arrives with the world it was read from attached to it. */
  console.log(describeSource(choice));
  console.log(
    `briefing edition ${briefing?.edition ?? "?"} · ${acknowledged.length} acknowledged · `
    + `${total[0].n} replies in total`,
  );

  /*
    HIS OWN STANDING ORDER, ASKED AS A READING (relay 2026-08-29 16:20):
    *"Mark every answered item's state in the SAME edition that acknowledges
    its reply — an item whose reply is acknowledged but whose state stays open
    is the schema arm's own class."* It prints ABOVE the replies because it is
    work this shift owes, not context; and it prints its CLEAN answer too, so
    silence here is a reading rather than an absent check.
  */
  if (stale.length > 0) {
    console.log(
      `\n⚠ THE DESK STILL SHOWS ${stale.length} ANSWERED ITEM${stale.length === 1 ? "" : "S"} AS OPEN `
      + "— set the state in THIS shift's edition (his order, 2026-08-29):",
    );
    for (const { host, replyIds } of stale) {
      console.log(`    ${host.kind} ${host.id} — answered by ${replyIds.map((id) => `#${id}`).join(", ")}`);
      console.log(`      "${host.title}"`);
    }
  } else {
    console.log("state sweep: no acknowledged reply points at an item still `open`.");
  }

  /*
    THE WRITER THE READING NEVER HAD (#749).

    ⚠ IT IS PLANNED AGAINST THE TREE, NOT AGAINST THE READING ABOVE. That
    reading is taken at the DEPLOYED briefing on purpose — it answers *what does
    his page say right now* — and the file being written is the one on disk,
    which may already be an edition ahead. So the plan re-reads the tree's own
    acknowledgement set and the tree's own states, and an item the deployed
    briefing calls open that the tree has already settled is correctly a no-op.
  */
  const treeFacts = treeJson === null ? null : parseBriefingFacts(treeJson);
  const treeStale = staleOpenHosts(treeFacts, addressed as ReplyRow[]);

  if (WRITE) {
    if (treeJson === null || treeFacts === null) {
      console.error(
        "\nREFUSING to write: server/crew/crew-briefing.json could not be read or does not parse. "
        + "A failed read is never a verdict, and this one would write a file.",
      );
      await conn.end();
      process.exit(1);
    }
    const tree = JSON.parse(treeJson) as ResolvableBriefing & Record<string, unknown>;
    const plan = planReplyAcknowledgements(tree, treeStale.map(({ host }) => host.id));

    console.log(`\nWRITE — applying \`answered\` in the tree's edition ${treeFacts.edition}:`);
    if (plan.apply.length === 0) console.log("  nothing to apply.");
    for (const item of plan.apply) {
      const rows = (item.list === "eyeItems" ? tree.eyeItems : tree.needsYou) ?? [];
      const row = rows.find((candidate) => candidate.id === item.id);
      /* Belt and braces: the planner read these rows out of this same object a
         line ago, so a miss here is impossible rather than unlikely — and an
         impossible thing that writes a file says so rather than skipping. */
      if (!row) throw new Error(`planned ${item.list} '${item.id}' is not in the briefing it was planned from`);
      row.state = "answered";
      console.log(`  · ${acknowledgementLine(item)}`);
    }
    if (plan.held.length > 0) {
      console.log("");
      console.log(`⚠ ${plan.held.length} card(s) he replied to CANNOT be marked answered yet.`);
      console.log("  Marking them would orphan something the briefing schema then refuses at the");
      console.log("  parse, so each is left alone and named instead:");
      for (const hold of plan.held) console.log(`  ! ${hold.list} ${hold.id} — ${hold.reason}`);
    }
    if (plan.apply.length > 0) {
      writeFileSync("server/crew/crew-briefing.json", `${JSON.stringify(tree, null, 2)}\n`, "utf8");
      console.log("");
      console.log("  server/crew/crew-briefing.json written. It ships with the next edition.");
    }
  } else if (treeStale.length > 0) {
    /*
      ⚠ THE ACTION, NOT A REQUEST FOR JUDGEMENT. The sentence above has printed
      on every run since 2026-08-29 and asked a shift to type a state by hand;
      four consecutive shifts read it and none of them did. It names the command
      now, and the command carries the rule.
    */
    console.log("");
    console.log("  Apply it — his reply IS the act (#749), and no shift has to judge whether he meant it:");
    console.log("    railway.cmd run --service MySQL -- npx tsx scripts/crew-read-replies.mts --write");
  }

  if (rows.length === 0) {
    console.log(showAll ? "\nThe thread is empty." : "\nNo new replies.");
  } else {
    console.log(`\n${rows.length} ${showAll ? "" : "NEW "}${rows.length === 1 ? "reply" : "replies"}:\n`);
    for (const row of rows) {
      const host = row.cardId === null ? undefined : hosts.get(row.cardId);
      const card = row.cardId === null
        ? "general note"
        : host
          ? `${host.kind} ${row.cardId} [${host.state ?? "no state"}] — "${host.title}"`
          : `card ${row.cardId} (not in the current briefing)`;
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
      "And the General box is still his control panel: a cardless \"pause the nights\" / "
      + "\"stop\" means create .agents/STOP, say so in your mailbox entry, and exit.",
    );
  }
} catch (cause) {
  console.error(`FAILED: ${(cause as Error).message}`);
  await conn.end();
  process.exit(1);
}

await conn.end();
process.exit(0);
