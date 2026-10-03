/**
 * MIRROR HIS DESK REPLIES ONTO THEIR GITHUB CARDS — one pass (#1539).
 *
 * His order, 2026-09-30 (terminal). Asked *"it seems my grokbot team cannot
 * see my replies to cards instantly whys this?"*, told the chain, offered
 * (1) mirror each reply the moment it is sent or (2) leave the delay. His word,
 * verbatim: **"go with 1"**. The Desk stays the one place he types; this is
 * what carries what he typed to the readers who only have GitHub.
 *
 * # RUN IT
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/crew-mirror-replies.mts
 *
 *   --seed       install the waterline at the newest reply and post NOTHING.
 *                The first run ever, and the only road onto a fresh machine.
 *   --dry-run    resolve and compose, print what WOULD be posted, post nothing.
 *   --quiet      print only when something happened (the scheduled task's road).
 *   --state P    the state file (default `.agents/crew-reply-mirror.json`).
 *   --max-attempts N  how many passes a failing reply gets before it is
 *                abandoned rather than allowed to wedge the queue (default 30).
 *
 * # ⚠ IT REFUSES TO POST FROM THE DEV WORLD
 *
 * He types on production. `resolveDatabaseUrl()` falls back to `.env`'s
 * `DATABASE_URL` when nothing wraps the command, and that is DEV — the two
 * differ only by port and have produced a wrong reading here before. A dev row
 * mirrored to a real card would put words he never wrote on his own queue, so
 * a WRITE run requires `MYSQL_PUBLIC_URL`/`PUBLIC_DATABASE_URL`, which only the
 * Railway wrapper supplies. `--dry-run` is allowed anywhere, because it posts
 * nothing.
 *
 * # THE SCHEDULE — a machine-local task, announced rather than silent
 *
 * `PROGRAM.md`: *"creating any NEW persistent process or scheduled task is done
 * only inside that seat's own queue card, and its activation is announced on
 * the Desk the shift it happens."* #1539 is that card. Registered on this
 * machine as **"Drape Crew Reply Mirror"**, every minute, and what follows is
 * the recipe that puts it back after a rebuild — it lives here because the
 * runner's own directory is gitignored and a recipe nobody can read is a
 * recipe that is lost.
 *
 * ⚠ **IT RUNS THROUGH A HIDDEN LAUNCHER, AND THAT IS HIS WORD RATHER THAN A
 * PREFERENCE** (2026-09-30, terminal, verbatim: *"please make the mirror run
 * silently its really annoying having a cmd terminal popup on my screen every
 * minute"*). A task whose action is `cmd.exe` opens a console window on his
 * screen once a minute, because the principal is Interactive — `-WindowStyle`
 * is not a scheduled-task setting and `Hidden` does not suppress a child
 * console. So the action is `wscript.exe //B`, which has no console of its own,
 * and the launcher it runs asks for window style 0.
 *
 * ⚠ **THE LAUNCHER IS UNDER `.agents/`, WHICH IS GITIGNORED (`.gitignore:161`),
 * SO ITS BODY IS CARRIED HERE OR IT IS LOST.** This block read `-Execute
 * 'cmd.exe'` from the day it shipped until 2026-09-30: the live task had been
 * moved to the launcher by hand the same night and the written recipe was not,
 * so the one road that survives a rebuild re-created the popup he had just
 * asked to be rid of. Write `.agents/crew-reply-mirror-hidden.vbs` as:
 *
 *   ' Launches the crew reply mirror with NO console window (#1539).
 *   ' Window style 0 = hidden; True = wait, so the task's IgnoreNew and time
 *   ' limit still cover the whole run; the exit code passes through so a 2 (an
 *   ' abandoned reply) still reaches the task's last-result column.
 *   Set sh = CreateObject("WScript.Shell")
 *   sh.CurrentDirectory = "C:\Users\Admin\Drape"
 *   rc = sh.Run("cmd.exe /c cd /d C:\Users\Admin\Drape && railway.cmd run --service MySQL -- npx tsx scripts/crew-mirror-replies.mts --quiet", 0, True)
 *   WScript.Quit rc
 *
 * then register the task against it:
 *
 *   $a = New-ScheduledTaskAction -Execute 'wscript.exe' `
 *     -Argument '//B //Nologo "C:\Users\Admin\Drape\.agents\crew-reply-mirror-hidden.vbs"'
 *   $t = New-ScheduledTaskTrigger -Once -At (Get-Date) `
 *     -RepetitionInterval (New-TimeSpan -Minutes 1)
 *   Register-ScheduledTask -TaskName 'Drape Crew Reply Mirror' -Action $a -Trigger $t `
 *     -Settings (New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 10))
 *
 * `//B` is load-bearing beside the window style: it suppresses WScript's own
 * dialogs, so a scripting error becomes an exit code in the task's last-result
 * column rather than a modal box waiting on his screen for a click.
 *
 * `IgnoreNew` is the load-bearing setting: a slow pass must never have a second
 * pass start beside it and post the same reply twice off the same waterline.
 *
 * **Read it back at the task, never at this block** — that is the mistake above:
 *
 *   (Get-ScheduledTask -TaskName 'Drape Crew Reply Mirror').Actions | Format-List Execute,Arguments
 *
 * # WHY A POLLER AND NOT A HOOK IN THE SERVER
 *
 * The in-server shape needs a GitHub WRITE credential on the customer-facing
 * Railway service. That decision is on the record twice and both times as HIS
 * — #285 (*"do not add a server call, a token or an outbound dependency …
 * it is his to make, not a shift's"*) and `server/routes/crew.ts`'s card-intent
 * mutation, which declines to close a card for exactly this reason. The full
 * reading is in `shared/crewReplyMirror.ts`'s header. This costs a minute
 * instead of a second and no new credential anywhere.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { briefingAtCommit } from "./lib/briefingAtCommit.mts";
import { openDatabase, resolveDatabaseUrl, utc } from "./lib/dbConnection.mts";
import { listedRows } from "./lib/deployWatch.mts";
import { chooseBriefing, describeSource } from "./lib/liveBriefing.mts";
import { hostIndex } from "./lib/replyHosts.mts";
import {
  emptyMirrorState,
  sweepReplyMirror,
  type MirrorState,
  type SweepReply,
} from "./lib/replyMirrorSweep.mts";
import { parseStrictArgsOrRefuse } from "./lib/strictArgs.mts";
import { crewReplyAuthorLabel } from "../shared/crewReplyMirror.js";

const args = parseStrictArgsOrRefuse(process.argv.slice(2), {
  value: ["state", "max-attempts"],
  boolean: ["seed", "dry-run", "quiet"],
});
const SEED = args.flag("seed");
const DRY_RUN = args.flag("dry-run");
const QUIET = args.flag("quiet");
const STATE_PATH = args.value("state") ?? ".agents/crew-reply-mirror.json";
const MAX_ATTEMPTS = args.number("max-attempts", 30);

/** Printed unless `--quiet`; a run that acted says so either way. */
const chat = (line: string) => { if (!QUIET) console.log(line); };
const loud = (line: string) => console.log(line);

if (SEED && DRY_RUN) {
  console.error("REFUSING: --seed and --dry-run ask for two different things. Seeding writes the waterline and posts nothing; a dry run writes nothing at all.");
  process.exit(1);
}

await import("dotenv/config");
const url = resolveDatabaseUrl();
if (!url) {
  console.error("REFUSING: no database URL. Wrap in `railway.cmd run --service MySQL`.");
  process.exit(1);
}

/*
  ⚠ THE WORLD GATE, AND IT IS A CONTROL RATHER THAN A CONVENIENCE. Only the
  Railway wrapper sets these; the bare `.env` fallback is the DEV database,
  whose `crew_replies` rows are fixtures. Posting one to a real card would put
  words he never wrote onto his own queue, publicly, in his name. A dry run is
  exempt because it cannot post.
*/
const onProduction = Boolean(process.env.MYSQL_PUBLIC_URL ?? process.env.PUBLIC_DATABASE_URL);
if (!onProduction && !DRY_RUN && !SEED) {
  console.error(
    "REFUSING to post from the dev world: neither MYSQL_PUBLIC_URL nor PUBLIC_DATABASE_URL is set, so this is `.env`'s "
    + "DATABASE_URL — the dev database. He types on production. Wrap the command in `railway.cmd run --service MySQL`, "
    + "or pass --dry-run to compose without posting.",
  );
  process.exit(1);
}

/** The machine's memory, or an empty one. A file that will not parse is fatal. */
function readState(): MirrorState | null {
  let raw: string;
  try {
    raw = readFileSync(STATE_PATH, "utf8");
  } catch {
    return null;
  }
  /* ⚠ A STATE FILE THAT WILL NOT PARSE IS NOT AN EMPTY ONE. Treating it as
     empty would restart the waterline at 0 and re-post the whole thread onto
     his cards. It refuses and says which file. */
  const parsed = JSON.parse(raw) as Partial<MirrorState>;
  if (typeof parsed.lastMirroredId !== "number" || !Number.isSafeInteger(parsed.lastMirroredId)) {
    throw new Error(`${STATE_PATH} carries no usable lastMirroredId`);
  }
  return {
    lastMirroredId: parsed.lastMirroredId,
    attempts: parsed.attempts && typeof parsed.attempts === "object" ? parsed.attempts : {},
    abandoned: Array.isArray(parsed.abandoned) ? parsed.abandoned : [],
    seededAt: typeof parsed.seededAt === "string" ? parsed.seededAt : null,
  };
}

function writeState(state: MirrorState): void {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

const GH = process.platform === "win32" ? "gh.exe" : "gh";

const conn = await openDatabase(url);

const existing = readState();
if (!existing && !SEED) {
  await conn.end();
  console.error(
    `REFUSING: no state at ${STATE_PATH}, and without it this run cannot tell a new reply from one the crew quoted by `
    + "hand months ago. The card's scope is explicit — no mirroring of OLD replies. Install the waterline first:\n"
    + "    railway.cmd run --service MySQL -- npx tsx scripts/crew-mirror-replies.mts --seed",
  );
  process.exit(1);
}

const [newest] = await conn.query<any[]>("SELECT MAX(id) AS n FROM crew_replies");
const newestId = Number(newest[0]?.n ?? 0);

if (SEED) {
  /* ⚠ SEEDING IS NOT A PASS AND MUST NEVER POST. His whole 240-reply history
     would land on forty cards at once, every one of them already quoted by
     hand. The waterline starts at the newest row and the day is recorded, so a
     later reader sees where the feature began rather than inferring it. */
  const seeded: MirrorState = {
    ...(existing ?? emptyMirrorState()),
    lastMirroredId: newestId,
    seededAt: new Date().toISOString(),
  };
  writeState(seeded);
  await conn.end();
  loud(`SEEDED ${STATE_PATH} at reply #${newestId}. Nothing was posted; replies from #${newestId + 1} on are mirrored.`);
  process.exit(0);
}

const state = existing!;

if (newestId <= state.lastMirroredId && state.abandoned.length === 0) {
  /* The steady state, and it is the whole reason for the waterline: one
     indexed read a minute, no briefing, no GitHub, no output. */
  await conn.end();
  chat(`nothing new — the newest reply is #${newestId} and the mirror is level with it.`);
  process.exit(0);
}

const [rows] = await conn.query<any[]>(
  "SELECT r.id AS id, r.cardId AS cardId, r.body AS body, r.createdAt AS createdAt, "
  + "u.displayName AS displayName, u.name AS name "
  + "FROM crew_replies r LEFT JOIN users u ON u.id = r.authorUserId "
  + "WHERE r.id > ? ORDER BY r.id ASC",
  [state.lastMirroredId],
);
await conn.end();

const replies: SweepReply[] = rows.map((row) => ({
  id: Number(row.id),
  cardId: row.cardId === null || row.cardId === undefined ? null : String(row.cardId),
  body: String(row.body),
  sentAtUtc: utc(row.createdAt),
  author: crewReplyAuthorLabel({ displayName: row.displayName, name: row.name }),
}));

/*
  THE BRIEFING IS READ LAZILY AND ONLY FOR THE SLUGS. A bare `card-<N>` row
  resolves from its own id — and that is the shape his answers actually arrive
  on now (the specimen on #1539: four for four). So a pass with nothing but
  bare rows never pays for a `railway deployment list` or a `git show`, which
  at one run a minute is the difference between a cheap clock and a busy one.
*/
const needsBriefing = replies.some((reply) => reply.cardId !== null && !/^card-\d+$/.test(reply.cardId));
const issueNumberByCardId: ReadonlyMap<string, number | null> = needsBriefing
  ? readDeployedHosts()
  : new Map<string, number | null>();

function readDeployedHosts(): Map<string, number | null> {
  const treeJson = (() => {
    try {
      return readFileSync("server/crew/crew-briefing.json", "utf8");
    } catch {
      return null;
    }
  })();
  const deploymentRows = (() => {
    try {
      const service = process.env.RAILWAY_SERVICE ?? "Drape";
      if (!/^[A-Za-z0-9._-]{1,64}$/.test(service)) return [];
      /* `railway.cmd` is a batch file: a shell is required on Windows, and one
         string rather than an args array because node's DEP0190 warns on the
         pair. Same note as `crew-read-replies.mts`. */
      return listedRows(execFileSync(
        process.env.COMSPEC ?? "cmd.exe",
        ["/c", `railway.cmd deployment list --service ${service} --json --limit 5`],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 60_000 },
      ));
    } catch {
      return [];
    }
  })();
  /* ONE READER, SHARED WITH `crew-read-replies.mts` (#1867). Both tools used
     to carry a copy of this with no `maxBuffer`; the card's own prescription
     said the mirror already had the fix, and line 301's 32 MiB belongs to the
     `gh issue view` call below, not to this read. */
  const choice = chooseBriefing(deploymentRows, treeJson, briefingAtCommit);
  chat(describeSource(choice));
  /* DERIVED from the one index both halves of the reply namespace already come
     out of (`hostIndex`), never a second walk of `needsYou` and `eyeItems` —
     that second walk is the drift `replyHosts.mts`'s own header is about. */
  return new Map([...hostIndex(choice.facts)].map(([id, host]) => [id, host.issueNumber]));
}

const result = await sweepReplyMirror(replies, issueNumberByCardId, state, {
  readComments: async (issueNumber) => {
    const json = execFileSync(GH, ["issue", "view", String(issueNumber), "--json", "comments"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60_000, maxBuffer: 32 * 1024 * 1024,
    });
    const parsed = JSON.parse(json) as { comments?: { body?: string }[] };
    return (parsed.comments ?? []).map((comment) => String(comment.body ?? ""));
  },
  postComment: async (issueNumber, body) => {
    if (DRY_RUN) return;
    /* `--body-file -` rather than `--body`: his words can be four thousand
       characters of markdown with any quoting in them, and a command line is
       neither long enough nor neutral enough to carry that safely. */
    execFileSync(GH, ["issue", "comment", String(issueNumber), "--body-file", "-"], {
      encoding: "utf8", input: body, stdio: ["pipe", "pipe", "pipe"], timeout: 60_000,
    });
  },
  now: () => new Date().toISOString(),
}, MAX_ATTEMPTS);

if (!DRY_RUN) writeState(result.state);

let posted = 0;
for (const outcome of result.outcomes) {
  switch (outcome.kind) {
    case "posted":
      posted += 1;
      loud(`${DRY_RUN ? "WOULD POST" : "POSTED"} reply #${outcome.replyId} → #${outcome.issueNumber}`);
      if (DRY_RUN) loud(outcome.body.split("\n").map((line) => `    ${line}`).join("\n"));
      break;
    case "already":
      chat(`reply #${outcome.replyId} was already on #${outcome.issueNumber} — the marker said so; waterline advanced.`);
      break;
    case "skipped":
      chat(`reply #${outcome.replyId} not mirrored — ${outcome.reason}. It stays on the Desk and in \`crew-read-replies\`.`);
      break;
    case "retry":
      loud(`reply #${outcome.replyId} → #${outcome.issueNumber} FAILED (attempt ${outcome.attempt}/${MAX_ATTEMPTS}): ${outcome.reason}`);
      loud("  the pass stops here and retries this same reply next run, so his replies stay in order.");
      break;
    case "abandoned":
      loud(`⚠ ABANDONED reply #${outcome.replyId} → #${outcome.issueNumber} after ${MAX_ATTEMPTS} attempts: ${outcome.reason}`);
      break;
  }
}

if (result.outcomes.length === 0) chat("nothing to do.");
else if (!QUIET || posted > 0) chat(`waterline now #${result.state.lastMirroredId}.`);

if (result.state.abandoned.length > 0) {
  /* ⚠ EXIT 2 IS THE FINDING, NOT A FAILURE — the house code. The run was
     correct; what it is reporting is that one of his replies never reached its
     card and never will without a hand. It prints on EVERY run while the list
     is non-empty, so a scheduled task's last-result code carries it too. */
  loud("");
  loud(`⚠ ${result.state.abandoned.length} of his replies never reached a card. Read them, put them on by hand, then clear the list in ${STATE_PATH}:`);
  for (const gone of result.state.abandoned) {
    loud(`    reply #${gone.replyId} → #${gone.issueNumber} (${gone.attempts} attempts, ${gone.at}): ${gone.reason}`);
  }
  process.exit(2);
}

process.exit(0);
