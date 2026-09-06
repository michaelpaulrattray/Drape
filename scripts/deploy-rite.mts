/**
 * THE DEPLOY CEREMONY, PERFORMED RATHER THAN REMEMBERED (fable-485 §a,
 * founder-approved 2026-08-14).
 *
 * Eleven steps, run several times a night, and the record holds three real
 * incidents from doing them by hand:
 *
 *  - **the watched claim** — a deploy reported SUCCESS from a `deployment list`
 *    read that had matched a line for a DIFFERENT sha, because the watch loop's
 *    grep spanned lines;
 *  - **two flags-from-memory** — a park block quoted scope flags as they were
 *    believed to be rather than as the service holds them;
 *  - **health read once** and reported as three.
 *
 * So this script does the ceremony and prints the receipt. What it prints is
 * what it SAW: every line is a reading taken in this process, and any step that
 * cannot be read fails the run rather than being omitted from the block.
 *
 * # THERE IS NO SUCH THING AS A DEPLOY TOO SMALL FOR THE CEREMONY
 *
 * Ordered into this header by fable-852 §4, banked to opus-630 §1 and opus-633
 * §6, because the temptation lives here rather than in a mailbox. A shift
 * hand-pushed a DOCS-ONLY commit — reasoning, correctly, that no code moved —
 * and killed a paid render the founder was watching. The freeze below would
 * have said GO, so nothing was broken that the design had not already accepted:
 * the failure was the DISCIPLINE, not the outcome. The whole point of the rite
 * is that *"was he working?"* gets asked by a script rather than by a judgement
 * about what counts as a risky commit — and the judgement is exactly the part
 * that is wrong when it is wrong. Running it costs ninety seconds.
 *
 * # What it will not do
 *
 * It pushes `main` and `main:local-migration` and it reads. It never sets a
 * variable, never touches a database, never force-pushes, and never rewrites
 * history — the four things the overnight grant excludes. `--dry` performs
 * every reading and no push.
 *
 * # NEVER PIPE THE RITE — and the receipt no longer depends on you remembering
 *
 * A shift ran this as `… | grep -v … | tail -18` for a tidier mailbox. The pipe
 * ate the receipt, and — the dangerous half — a pipeline returns its LAST
 * command's exit status, so "exit code 0" was reported while the deployment was
 * FAILED. The one tool built to stop a green claim with no fact under it
 * produced one.
 *
 * Every run writes its full transcript and its exit status to
 * `output/deploy-receipts/`, unconditionally and on every path, so a piped or
 * truncated invocation still leaves the durable record. Custody blocks quote
 * that file.
 *
 * ⚠ **AND ITS OWN VERDICT IS THE LAST LINE IT PRINTS** (2026-08-22). The rule
 * above was broken twice in one shift by the seat that had just written about
 * it, so it stopped being a rule. An `isTTY` refusal was ordered, built and
 * BACKED OUT — no headless harness has a TTY, so it refused every operator this
 * project actually has. What stands instead fails closed: a truncated run
 * either carries `RITE EXIT STATUS: …` or visibly carries no verdict at all,
 * and a custody block with nothing to quote is a missing reading rather than a
 * green one. The tidy read is `output/deploy-receipts/index.log`.
 *
 *   npx tsx scripts/deploy-rite.mts [--dry]
 *
 * PLAIN — NEVER under `railway run --service MySQL -- …`. That wrapper injects
 * `RAILWAY_SERVICE_ID`/`RAILWAY_SERVICE_NAME` for MySQL, and an unscoped
 * `railway deployment list` honours them over the linked service, so the watch
 * read MySQL's one-row listing for ten minutes while Drape's deployment sat
 * SUCCESS (#148, 2026-08-26 — foreman-25's rite, exit 143, no receipt). The
 * rite needs no wrapper: it reads the production URL by name itself. It now
 * refuses to start inside a foreign service context, scopes the listing with
 * `--service`, and matches the deployment on the pushed COMMIT HASH.
 */
/*
  THE RITE READS `.env` FOR ONE THING: the OpenRouter key, so the balance line
  is a reading rather than an UNREAD. It was added when the line's first live
  run printed `UNREAD — OPENROUTER_API_KEY not set in this process`, which was
  the honest failure mode doing its job and not the intent.

  Safe here, and checked rather than assumed: this script never reads
  `DATABASE_URL`. Both of its database reads take the production URL explicitly
  from `railway variables --service MySQL` and pass it to `openDatabase(url)`,
  so nothing it does can fall back to the dev database that `.env` names.
*/
import "dotenv/config";
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { openDatabase } from "./lib/dbConnection.mts";
import { decideWatch, foreignServiceContext, listedRows } from "./lib/deployWatch.mts";
import { comparePositions, parseVariableLines } from "./lib/productionFlagPositions.mts";
import {
  DECLARED_BUT_UNMIGRATED,
  DECLARED_COLUMNS_BUT_UNMIGRATED,
} from "./lib/schemaConformance.mts";
import {
  type MissingObjects,
  autoApplyMigrations,
  migrationFilesFrom,
  readSchemaGap,
} from "./lib/ceremonyAutoApply.mts";
import { assetReferencesIn, assetVerdict } from "./lib/staticAssetReferences.mts";
import { uptimeAnchor } from "./lib/uptimeAnchor.mts";
import {
  balanceLine,
  booksLine,
  readOpenRouterActivity,
  readOpenRouterBalance,
  readOpenRouterUsage,
} from "./lib/openrouterBalance.mts";
import {
  falLine,
  priceFalCalls,
  readFalBalance,
  readFalPrices,
  readFalTraffic,
} from "./lib/falSpend.mts";
import {
  deployRefOrderProblem,
  divergedRefMessage,
  pushFailureMessage,
  pushInSequence,
  type PushOutcome,
} from "./lib/ritePushSequence.mts";
import { runScriptGuardsOnCommit } from "./lib/scriptGuards.mts";
import { runTypecheckOnCommit } from "./lib/typecheckOnCommit.mts";
import { BRIEFING_PATH, generatedFilesFrom, judgeQuietEdition, QUIET_REFUSAL, type QuietVerdict } from "./lib/quietEdition.mts";
import { judgeBriefingConformance } from "./lib/briefingConformance.mts";
import { eyeFrameKeysOf, judgeEyeFramePresence } from "./lib/eyeFramePresence.mts";

const DRY = process.argv.includes("--dry");
/*
  ⚠ THE isTTY REFUSAL ORDERED AT fable-1332 §5 WAS BUILT, DRIVEN, AND BACKED
  OUT — because its population is EVERYONE (found opus-978).

  The order was right about the class: twice in one shift is not a memory
  problem. But `process.stdout.isTTY` is undefined in every headless harness,
  including the one every overnight shift runs in — so the guard refused the
  rite's own operator on the FIRST unpiped invocation, which is a control that
  turns off the product's only push path. Driven both ways before it was backed
  out: piped → REFUSED exit 2; unpiped, from the seat that deploys → REFUSED
  exit 2, identically.

  What replaces it is below and it fails CLOSED rather than open: the rite's own
  verdict is the LAST LINE of stdout, so a report quoting a truncated run either
  carries the verdict or visibly carries no verdict at all. A grep that drops it
  leaves a custody block with nothing to quote, which is a missing reading
  rather than a green one.
*/
const SERVICE = process.env.RAILWAY_SERVICE ?? "Drape";
const BASE = process.env.PROD_BASE_URL ?? "https://drape-production-0232.up.railway.app";
/** The branches every deploy carries. Production builds from the second one. */
const BRANCHES = ["main", "main:local-migration"] as const;

const lines: string[] = [];
const say = (line = "") => { console.log(line); lines.push(line); };

/*
  THE RECEIPT DEFENDS ITSELF — ordered fable-1012 §2, from a real incident.

  A shift ran this script as `npx tsx scripts/deploy-rite.mts | grep -v … |
  tail -18` to keep the mailbox tidy. Two things died in that pipe: the receipt,
  which is the whole point of the rite, and the EXIT CODE — a pipeline returns
  its LAST command's status, so the harness reported "exit code 0" while the
  deployment was FAILED. A green-looking signal with no fact under it, produced
  by the one tool built to stop exactly that.

  **NEVER PIPE THE RITE.** But a rule that has to be remembered is a rule that
  gets forgotten at 2am, so the receipt no longer depends on anyone reading it
  off a terminal: every run writes its full transcript AND its exit status to a
  file, unconditionally, on every path — success, REFUSED, or a throw. A piped,
  grepped or truncated invocation still leaves the durable record, and a custody
  block quotes the FILE.

  Registered on `exit` rather than called at the end, because the paths that
  matter most are the ones that never reach the end. Synchronous writes for the
  same reason: nothing async survives `process.exit`.
*/
/* Named rather than inlined: this file gets edited by scripts more often than
   by hand, and an escaped newline inside a template literal is exactly what
   the last such edit broke. */
const NL = String.fromCharCode(10);
const RECEIPTS = "output/deploy-receipts";
const startedAtIso = new Date().toISOString();
const receiptFile = `${RECEIPTS}/${startedAtIso.replace(/[:.]/g, "-")}-${process.pid}.txt`;
process.on("exit", (code) => {
  try {
    mkdirSync(RECEIPTS, { recursive: true });
    const verdict = code === 0 ? "OK" : `EXIT ${code}`;
    writeFileSync(
      receiptFile,
      [
        `deploy-rite ${startedAtIso}`,
        `argv: ${process.argv.slice(2).join(" ") || "(none)"}`,
        `EXIT STATUS: ${verdict}`,
        "",
        ...lines,
        "",
      ].join(NL),
      "utf8",
    );
    /* One greppable line per run beside the transcripts, so the SEQUENCE of
       deploys is readable without opening every file — which is the question
       actually asked when something went wrong an hour ago. */
    appendFileSync(
      `${RECEIPTS}/index.log`,
      `${startedAtIso}  ${verdict.padEnd(8)}  ${receiptFile}${NL}`,
      "utf8",
    );
    console.log(`receipt: ${receiptFile}`);
  } catch (error) {
    /* A receipt that cannot be written must SAY so rather than vanish — an
       absent record reads as a run that never happened. */
    console.error(`[deploy-rite] could not write the receipt: ${String(error)}`);
  }
  /*
    ⚠ THE VERDICT IS THE LAST THING ON STDOUT, and it is deliberately AFTER the
    receipt line so nothing can print below it (2026-08-22, replacing the
    backed-out `isTTY` refusal — see the block near `DRY`).
    
    It is the rite's OWN status, not a pipeline's. A run read through `tail`
    keeps it; a run read through a `grep` that drops it leaves a custody block
    with no verdict to quote — which is a MISSING reading and refused as such,
    rather than a green one. That is the difference the original incident turned
    on: "exit code 0" was reported for a FAILED deploy because the shell handed
    back the last command's status and nothing on screen contradicted it.
  */
  console.log(`RITE EXIT STATUS: ${code === 0 ? "OK" : `EXIT ${code}`}`);
});
/* Annotated on the VARIABLE, not just the arrow: TypeScript only narrows after
   a never-returning call when the binding itself carries the signature. */
const die: (why: string) => never = (why: string): never => {
  say("");
  say(`REFUSED: ${why}`);
  console.error(why);
  process.exit(1);
};

/* The #148 guard, FIRST: inside `railway run --service MySQL` every unscoped
   railway command is a MySQL command. Refuse before any check is spent on. */
{
  const foreign = foreignServiceContext(process.env, SERVICE);
  if (foreign) die(foreign);
}

/*
  `shell` is not a style choice on Windows: `railway.cmd` is a batch file, and
  `execFileSync` without a shell cannot resolve one from PATH — it returns the
  spawn error as text, which reads exactly like a command that ran and said
  nothing. The first run of this script watched a deploy that had already
  succeeded for thirty minutes because of it.
*/
const run = (command: string, args: string[], shell = false, env?: NodeJS.ProcessEnv): string => {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      shell,
      maxBuffer: 32 * 1024 * 1024,
      ...(env ? { env } : {}),
    });
  } catch (error: any) {
    return `${error?.stdout ?? ""}${error?.stderr ?? ""}` || String(error?.message ?? error);
  }
};
const git = (...args: string[]) => run("git", args).trim();

/*
  THE MARKER THE PRE-PUSH GATE LOOKS FOR (ordered fable-982).

  `.githooks/pre-push` refuses any push to `main` or `local-migration` unless
  this variable is set on the git process. It is set HERE and nowhere else, on
  the push child alone — not exported into the shift's environment, because a
  variable that outlives the push would be a marker any later hand-push
  inherits, which is the gate with its own key taped to it.
*/
/*
  AND IT KEEPS THE EXIT STATUS (#317).

  This used to be `gitPush`, built on `run()` above — which returns stderr as a
  string on failure, so it reported a REJECTED push and a successful one with
  the same type and no status. That is why the push loop below could not stop
  between the two refs, and production was three times handed a tree `main` did
  not carry. Reading the text instead is not an option: a successful push
  writes `To github.com…` to stderr, and an up-to-date one writes nothing at
  all.

  `spawnSync` is used rather than the `try/catch` above precisely so the status
  is a value and not an exception — the shape that swallowed it in the first
  place.
*/
const gitPushStatus = (...args: string[]): PushOutcome => {
  const result = spawnSync("git", ["push", ...args], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, DRAPE_DEPLOY_RITE: "1" },
  });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim()
      || String(result.error?.message ?? ""),
  };
};

/*
  AND THE GATE'S OWN INSTALLATION IS CHECKED BEFORE ANYTHING ELSE.

  `core.hooksPath` is local config, so a fresh clone has the hook file and not
  the gate. A guard that is silently absent is worse than none — invariant 7 —
  so the rite refuses to run rather than performing a ceremony whose backstop
  is not armed.
*/
const hooksPath = git("config", "core.hooksPath");
if (hooksPath !== ".githooks") {
  console.log(
    `REFUSED: core.hooksPath is ${hooksPath || "unset"}, not .githooks — the pre-push gate is not armed.\n`
    + "  git config core.hooksPath .githooks",
  );
  process.exit(1);
}
/*
  The atlas merge driver is the same shape of local config (Retro guard R1,
  #100): `.gitattributes` names the generated files, but the driver that
  resolves them by regenerating on the merged tree is registered per clone.
  Without it a merge leaves conflict markers in a file nobody should edit by
  hand — the stall class this guard retires — so the rite says so here, where
  the hooks path is already checked, rather than at the next stalled PR.
*/
const atlasDriver = git("config", "merge.atlas.driver");
if (!/\.githooks\/merge-atlas %O %A %B %P/.test(atlasDriver)) {
  console.log(
    `REFUSED: merge.atlas.driver is ${atlasDriver || "unset"} — the generated map would be merged by hand.\n`
    + "  git config merge.atlas.driver '.githooks/merge-atlas %O %A %B %P'",
  );
  process.exit(1);
}
/*
  THE CUSTODY CHECKS THAT ARE CHEAP ENOUGH TO RUN EVERY TIME (ruled fable-1320
  §1, from the census landing).

  These are CHECKS, not refusals: the founder-activity freeze below is the only
  thing that says *"not now"*, and this says *"not like this"*. Red here means
  the push does not fire, exactly as a red suite would — the difference being
  that a suite takes a minute and these take seconds, so there is no honest
  reason to leave them to memory.

  **No path filter, deliberately.** *"Only run the capability census when
  server/castingV2 changed"* is a second list of which files matter, and a
  second list drifts from the first the day somebody adds a door somewhere new
  (working law 4). Both are deterministic and both are seconds; running them
  always costs less than deciding when to.

  What is NOT here: `pnpm test` and `pnpm check`, which are minutes and belong
  in the custody block of the report, and `capability:check --drive`, which
  makes text calls and costs money — the census's own rule that a script whose
  default action is to spend is never run casually.
*/
for (const [label, script] of [["atlas", "architecture:check"], ["capability", "capability:check"]]) {
  const result = spawnSync("pnpm", [script!], { encoding: "utf8", shell: true });
  const printed = `${result.stdout ?? ""}${result.stderr ?? ""}`
    .trim().split(/\r?\n/).slice(-3).join(" · ");
  if (result.status !== 0) {
    console.log(`REFUSED: ${label} check is RED — the push does not fire. ${printed}`);
    /* Both refusals on the night of #78/#79/#86 were LOCAL staleness — the
       generated file on disk behind the source — and the repair is one line.
       Printing it beside the refusal is the second half of Retro guard R1. */
    console.log("  repair: pnpm architecture:generate && pnpm capability:generate — then review the diff and commit it");
    process.exit(1);
  }
  console.log(`  ${label}: ok`);
}

/*  THE SECRET SCAN (#469) — his order, Crew reply #110, 2026-09-03, verbatim:
    *"Add the secret scan to the ceremony. That's the one hole where a mistake
    is actually expensive, and it's seconds rather than minutes. File it and
    get on with it — I don't need to see it again."*

    The hole it closes: his own pushes bypass main's required checks (#460 —
    343 of 499 commits went unchecked), and the rite is the ONLY path product
    and record commits take to main outside a PR. So until now a key committed
    by hand reached the public repository with nothing in its way, while the
    identical scanner ran on every PR.

    ONE COPY OF THE SCAN, and this is a caller. `scripts/secret-scan.sh` owns
    the gitleaks pin, the config, the redaction and `--diff-merges=first-parent`;
    the gate calls the same bytes. Re-stating the arguments here would be a
    second definition that drifts (working law 4), which is the same reason the
    pin was pulled out of the two workflows in the first place.

    ⚠ IT REFUSES, IT NEVER WARNS — including when it cannot RUN. A scanner that
    skips itself when its shell or binary is missing is invariant 7's failure
    exactly, and it would skip on precisely the machine this rite runs on.

    WHY IT NEEDS A SHELL RESOLVED BY HAND: measured on his machine the day this
    landed — no `gitleaks` on PATH, no `sh` on the WINDOWS PATH, and no
    `curl.exe`. `bash.exe` in system32 is WSL and sees a different filesystem,
    so it is deliberately not a candidate. Git Bash's own sh has curl, unzip
    and sha256sum, and is what the scan script is written against.

    RANGE: exactly the commits this push would add. If the remote tip cannot be
    read, it scans the FULL HISTORY instead of skipping — 7.0s measured over
    3,205 commits, so failing toward MORE scanning costs nothing worth having.

    NOT ADDED: `pnpm test`. He kept the eight minutes deliberately; this card
    narrows the ceremony/gate gap by exactly the one check he named.
*/
{
  const shCandidates = [
    "C:\\Program Files\\Git\\bin\\sh.exe",
    "C:\\Program Files (x86)\\Git\\bin\\sh.exe",
  ];
  const sh = shCandidates.find((candidate) => existsSync(candidate));
  if (!sh) {
    console.log("REFUSED: the secret scan needs Git Bash's sh and none of its known paths exist — the push does not fire.");
    console.log(`  looked at: ${shCandidates.join(", ")}`);
    console.log("  repair: install Git for Windows, or add this machine's sh.exe to the list in scripts/deploy-rite.mts");
    process.exit(1);
  }

  const fetched = spawnSync(sh, ["scripts/secret-scan.sh", "fetch"], { encoding: "utf8" });
  if (fetched.status !== 0) {
    console.log("REFUSED: the pinned gitleaks binary could not be fetched or failed its sha256 — the push does not fire.");
    console.log(`  ${`${fetched.stdout ?? ""}${fetched.stderr ?? ""}`.trim().split(/\r?\n/).slice(-3).join(" · ")}`);
    console.log("  repair: check the network, then re-run — the binary is cached after one success, so this is a one-time cost");
    process.exit(1);
  }
  const gitleaks = (fetched.stdout ?? "").trim().split(/\r?\n/).pop() ?? "";

  /* `run()` swallows a git error and RETURNS its text, so a failed fetch is
     silent here (review finding on PR #473). The tip is therefore re-proved
     after the fetch rather than assumed: an unresolvable range would make
     gitleaks error, and an errored scan used to be reported as a leak. */
  const remoteTip = git("ls-remote", "origin", "refs/heads/main").split(/\s+/)[0] ?? "";
  let ranged = /^[0-9a-f]{40}$/.test(remoteTip);
  if (ranged && !git("cat-file", "-t", remoteTip).startsWith("commit")) {
    git("fetch", "--quiet", "origin", "main");
    ranged = git("cat-file", "-t", remoteTip).startsWith("commit");
  }
  const args = ranged
    ? ["scripts/secret-scan.sh", remoteTip]
    : ["scripts/secret-scan.sh"];

  const scan = spawnSync(sh, args, { encoding: "utf8", env: { ...process.env, GITLEAKS: gitleaks } });
  const printed = `${scan.stdout ?? ""}${scan.stderr ?? ""}`;
  if (scan.status !== 0) {
    /* ⚠ NON-ZERO IS NOT THE SAME AS "A SECRET IS IN YOUR HISTORY" (review
       finding on PR #473). A scan that could not RUN — a broken binary exiting
       126/127, a range gitleaks cannot resolve — also exits non-zero, and the
       repair below is the most expensive wrong advice this script can give:
       rotate a production credential and rewrite main. Both states refuse, so
       nothing escapes either way; only the sentence changes. gitleaks prints
       `leaks found: N` when and only when it has a verdict. */
    const found = /leaks found:/i.test(printed);
    console.log(found
      ? "REFUSED: the secret scan found something in the commits this push would add — the push does not fire."
      : "REFUSED: the secret scan could not RUN, so nothing about this push has been checked — the push does not fire.");
    /* The finding's VALUE is never printed: --redact=100 hides it inside
       gitleaks, and this prints gitleaks' own lines, which name the rule,
       the file and the commit and nothing else. */
    console.log(`${printed.trim().split(/\r?\n/).map((line) => `  ${line}`).join("\n")}`);
    if (found) {
      console.log("  repair: the secret is IN THE HISTORY, so removing it from the working tree is not enough —");
      console.log("  rotate the credential first, then rewrite or drop the commit that carries it, then re-run");
    } else {
      console.log(`  repair: this is a broken scanner, NOT a leak — do not rotate anything. Delete the cached`);
      /* The glob must sit OUTSIDE the quotes or it never expands, and TMPDIR is
         usually unset under Git Bash - printed advice that silently does nothing
         is the failure the -v change exists to prevent (review, PR #473). */
      console.log('  binary and re-run: rm -rf "${TMPDIR:-/tmp}"/gitleaks-* (it is re-downloaded and re-verified)');
    }
    process.exit(1);
  }
  /* ⚠ A CLEAN VERDICT MUST HAVE READ SOMETHING (found by driving this, not by
     reading it). gitleaks handed a range git cannot resolve does NOT error: it
     prints `0 commits scanned`, `no leaks found`, and exits 0. So the most
     dangerous shape here was never a false alarm — it was a green
     `secret scan: ok` over nothing at all, which is invariant 7 in its
     quietest form. The commits this push adds are counted independently, and a
     scan that read none of them is refused as a broken instrument. */
  const scanned = Number(/(\d+) commits scanned/.exec(printed)?.[1] ?? "-1");
  const toPush = ranged ? Number(git("rev-list", "--count", `${remoteTip}..HEAD`).trim() || "0") : -1;
  /* `<= 0`, not `=== 0`: an unreadable count is -1, and a guard that passes on
     -1 disarms itself the day the pinned binary changes its summary wording.
     At exit 0 gitleaks HAS run, so its summary must be parseable; refusing an
     unreadable count is the same philosophy as refusing an unread range.
     (Second-look review finding on PR #473 - the sibling of the very hole this
     block was added to close. Law 7: the sweep is part of the fix.) */
  if (ranged && toPush > 0 && scanned <= 0) {
    console.log(scanned === 0
      ? "REFUSED: the secret scan reported a clean verdict having read ZERO of the "
        + `${toPush} commit(s) this push adds — the push does not fire.`
      : "REFUSED: the secret scan reported a clean verdict and its own summary could not be read, "
        + `so nothing proves it looked at the ${toPush} commit(s) this push adds — the push does not fire.`);
    console.log("  This is the scanner failing quietly, not the tree being clean. Nothing has been checked.");
    console.log(`  repair: check that ${remoteTip.slice(0, 8)} is a commit this clone actually has, then re-run`);
    process.exit(1);
  }
  console.log(`  secret scan: ok — ${scanned < 0 ? "count unreadable" : `${scanned} commit(s)`} read `
    + `(${ranged ? `${remoteTip.slice(0, 8)}..HEAD` : "full history — remote tip unreadable"})`);
}

const railway = (...args: string[]) => run("railway.cmd", args, true);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Drape's own rows, newest first, with the commit each was built from. */
const listDeployments = () =>
  listedRows(railway("deployment", "list", "--service", SERVICE, "--json", "--limit", "5"));

/** The production database's public URL, read by name and never printed. */
function productionUrl(): string | undefined {
  return railway("variables", "--service", "MySQL", "--kv").split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("MYSQL_PUBLIC_URL="))
    ?.slice("MYSQL_PUBLIC_URL=".length);
}

/* ── 1. what is being deployed ──────────────────────────────────────────── */

const sha = git("rev-parse", "HEAD");
const shortSha = sha.slice(0, 8);
const subject = git("log", "-1", "--format=%s");
const dirty = git("status", "--porcelain").split("\n").filter((line) => line && !line.startsWith("??"));
if (dirty.length > 0) {
  die(`the working tree has ${dirty.length} uncommitted tracked change(s) — a deploy must carry a commit, not a desk:\n${dirty.join("\n")}`);
}

/*
  A QUIET EDITION DOES NOT DEPLOY (#159).

  The standing orders say a quiet shift ships no edition and runs no rite —
  and two quiet shifts deployed anyway on the morning of 2026-08-27, each a
  production deploy for one "nothing needed doing" journal line, on the
  founder's Fable credits. An order the model does not follow needs a
  mechanical guard. This reads the COMMITTED bytes of the push — what changes
  between origin/main and HEAD — and refuses an edition that moves nothing he
  can read. Anything that moves (a card, a step, a chip, an eye item, a
  pipeline row, an acknowledged reply, a file) passes. ⚠ The journal that once
  made this a three-rule judgement is gone (#293); the module's header keeps
  the reasoning.
  `scripts/lib/quietEdition.mts` is the owner and states the verdict exactly;
  `server/quietEdition.test.ts` the arms, including the two real editions.
  Under `--dry` the verdict is reported and the run continues — a dry run
  never pushes anyway. Before the script guards, so a quiet edition costs no
  worktree.
*/
{
  const remoteMain = git("ls-remote", "origin", "refs/heads/main").split(/\s+/)[0] ?? "";
  let verdict: QuietVerdict;
  if (!/^[0-9a-f]{40}$/.test(remoteMain)) {
    verdict = { quiet: false, why: "(unread — origin/main could not be resolved)" };
  } else if (remoteMain === sha) {
    verdict = { quiet: false, why: "nothing to push — origin/main already holds this commit" };
  } else {
    /* The remote tip may not be local yet (his own push, another seat's
       merge); fetch it by name so the diff is against what the push replaces. */
    if (!git("cat-file", "-t", remoteMain).startsWith("commit")) git("fetch", "--quiet", "origin", "main");
    const show = (spec: string): string | null => {
      const result = spawnSync("git", ["show", spec], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
      return result.status === 0 ? result.stdout : null;
    };
    const head = show(`${sha}:${BRIEFING_PATH}`);
    /* A tip the fetch could not bring home is UNREAD, said as such — not "the
       briefing is new on origin/main", which is a reading nobody took
       (review of #160, note 2). */
    verdict = !git("cat-file", "-t", remoteMain).startsWith("commit")
      ? { quiet: false, why: "(unread — origin/main's tip could not be fetched)" }
      : head === null
      ? { quiet: false, why: "the pushed commit carries no briefing" }
      : judgeQuietEdition({
        changedFiles: git("diff", "--name-only", remoteMain, sha).split(/\r?\n/),
        generatedFiles: generatedFilesFrom(readFileSync(path.resolve(import.meta.dirname, "..", ".gitattributes"), "utf8")),
        parentBriefing: show(`${remoteMain}:${BRIEFING_PATH}`),
        headBriefing: head,
      });
  }
  if (verdict.quiet && !DRY) die(`${QUIET_REFUSAL} — ${verdict.why}. Write the mailbox entry and exit; no edition, no rite.`);
  say(`  quiet edition: ${verdict.quiet ? `WOULD REFUSE (dry run) — ${verdict.why}` : `no — ${verdict.why}`}`);
}

/*
  AND THE BRIEFING PARSES, AT THE COMMIT BEING PUSHED (#169).

  Edition 55 shipped `status: "done"` (not in the pipeline enum) and a
  42-entry journal against the 40 cap; every check above was green, the
  deploy was SUCCESS, and the founder's Crew page served its DEGRADED state
  for ~15 minutes until the next edition trimmed it. The parse arm lives in
  `server/crew/crewBriefing.test.ts` and runs on every PR — but an edition
  push never rides a PR, so on this path nothing parsed the briefing at all.
  `scripts/lib/briefingConformance.mts` is the owner (the schema IMPORTED
  from `server/crew/crewBriefing.ts`, never copied); a red parse refuses the
  push whatever else the commit carries, because the deploy serves the whole
  bundle and a red briefing degrades his page no matter which file the push
  was for. Under `--dry` the verdict is reported and the run continues.

  One branch is pre-empted and said so rather than left to be believed
  (review of #170, finding 2): the judge's "not JSON" arm is unreachable in
  THIS process, because importing the schema statically imports
  `crew-briefing.json` itself — a HEAD briefing that is not JSON crashes the
  rite at module load, before the receipt handler registers. Still
  fail-closed (no push fires), but receiptless; the arm stays in the suite
  because the judge is a module and other callers do not share this import.
*/
{
  const shown = spawnSync("git", ["show", `${sha}:${BRIEFING_PATH}`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  const conformance = shown.status !== 0
    ? { ok: false, why: `the pushed commit carries no briefing at ${BRIEFING_PATH}` }
    : judgeBriefingConformance(shown.stdout);
  if (!conformance.ok && !DRY) {
    die(`the briefing does not parse against server/crew/crewBriefing.ts — the push does not fire; his page would fall to the degraded state (#169).\n    ${conformance.why}\n  repair: fix ${BRIEFING_PATH} against the schema, commit, re-run`);
  }
  say(`  briefing parse: ${conformance.ok ? `ok — ${conformance.why}` : `WOULD REFUSE (dry run) — ${conformance.why}`}`);
}

/*
  AND THE EYE FRAMES IT NAMES ARE IN THE BUCKET HIS BROWSER WILL ASK (#320).

  The founder: *"this card on my desk isnt rendering correctly"* — broken-image
  glyphs under the captions. The briefing was right, the allowlist was right,
  the deploy was SUCCESS; the BYTES were in the dev bucket, because
  `crew-upload-eye-frame.mts` reads `.env` and succeeds identically against
  either bucket. Twice repaired by hand, plus a third near-miss on the same
  script (#265) — three incidents, one script, no guard.

  `R2_PUBLIC_URL` is read OFF THE SERVICE by name and never defaulted: the
  ambient `.env` names the dev bucket, so a fallback would check the wrong
  bucket and pass, which is the mistake itself. The key population is read from
  the briefing AT THE COMMIT BEING PUSHED, so the bytes judged and the bytes
  deployed are the same by construction. `crew-eye/` objects sit in the public
  bucket, so this is a credential-free HEAD and the rite never touches an R2
  secret. Under `--dry` the verdict is reported and the run continues.
*/
{
  const shown = spawnSync("git", ["show", `${sha}:${BRIEFING_PATH}`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  const base = shown.status !== 0
    ? undefined
    : parseVariableLines(railway("variables", "--service", SERVICE, "--kv"))
      .find((reading) => reading.name === "R2_PUBLIC_URL")?.value;
  const frames = shown.status !== 0
    ? { ok: false, why: `the pushed commit carries no briefing at ${BRIEFING_PATH}`, checked: 0, missing: [], unread: [] }
    : await judgeEyeFramePresence(
      eyeFrameKeysOf(shown.stdout),
      base,
      async (url) => await fetch(url, { method: "HEAD" }).then((response) => response.status).catch(() => null),
    );
  if (!frames.ok && !DRY) {
    die(`an eye frame this edition names is not in the production bucket — the push does not fire; his card would draw broken images (#320).
    ${frames.why}
  repair: re-upload the frame(s) against the PRODUCTION R2 variables, put the new key(s) in ${BRIEFING_PATH}, commit, re-run`);
  }
  say(`  eye frames: ${frames.ok ? `ok — ${frames.why}` : `WOULD REFUSE (dry run) — ${frames.why}`}`);
}

/*
  AND THE SCRIPT GUARDS, OVER THE TREE BEING PUSHED (#152).

  A shift's edition commit carries its court harnesses under `scripts/`, and
  this rite pushes them without `pnpm test`. Seven suites hold every script to
  a contract (exit, database door, world); none ran on this path, so two
  disposables rode to main red on `scriptExitDiscipline` with e39 and the NEXT
  pull request's gate was blamed for it. They run here now — in a throwaway
  worktree of the commit being pushed, because they read the disk and the
  shared tree carries untracked litter that is not in the push (two breaching
  files the day this landed). The suite list is derived from the suites
  themselves and REFUSES if it loses its origin case; a worktree that cannot be
  made refuses too. It sits AFTER the dirty-tree refusal above so that the
  tree the list is derived from and the tree the suites run in are the same
  commit by construction (review of #157, finding 3).
  `scripts/lib/scriptGuards.mts` is the owner; `server/scriptGuards.test.ts`
  the arms. Seconds, like the atlas and capability checks.
*/
{
  const verdict = runScriptGuardsOnCommit(path.resolve(import.meta.dirname, ".."), sha);
  if (!verdict.ok) {
    die(`the script guards are RED on ${shortSha}, the tree being pushed — the push does not fire.\n`
      + verdict.printed.split("\n").map((line) => `    ${line}`).join("\n")
      + "\n  repair: fix the named script in the commit (the shape is scripts/SKELETON-disposable.mts), commit, re-run");
  }
  say(`  script guards: ok (${verdict.suites.length} suites on ${shortSha})`);
}

/*
  AND `pnpm check`, OVER THE SAME TREE (#263 — the founder's own ruling).

  > "The CI hole is the best find in the card. A gate that only runs on pull
  > requests, plus a path that pushes straight to main, means the gate is
  > optional in practice. Fixing the rite to run the check is right."

  `gate-checks` runs on `pull_request` only. This rite is the other way to
  `main`, and it is the way MOST things arrive: 343 of the 499 commits on main
  since 25 August came without a pull request, and the last three carry zero
  check runs between them. Until this block existed, nothing typechecked any of
  them — which is how `pnpm check` sat RED on `main` for a day (#263's origin).

  The docblock above says `pnpm test` and `pnpm check` are "minutes" and belong
  in the report's custody block. THAT SENTENCE IS NOW HALF TRUE and the half
  that moved is this one: measured on the night it landed, the check is **85
  seconds** on a clean worktree, against a rite that already spends minutes
  watching a deploy. `pnpm test` is still not here.

  It runs on `--dry` too, deliberately: a dry run answers "would this push
  fire", and a dry run that skips the slowest refusal answers a different
  question.
*/
{
  const verdict = runTypecheckOnCommit(path.resolve(import.meta.dirname, ".."), sha);
  if (!verdict.ok) {
    die(`\`pnpm check\` is RED on ${shortSha}, the tree being pushed — the push does not fire.\n`
      + verdict.printed.split("\n").map((line) => `    ${line}`).join("\n")
      + `\n  (${verdict.seconds}s) repair: fix the named file, commit, re-run.`
      + "\n  NOTE: this ran on the COMMIT, not your working directory — untracked"
      + "\n  litter is deliberately invisible to it, so `pnpm check` failing in your"
      + "\n  tree while this passes is correct and expected.");
  }
  say(`  pnpm check: ok on ${shortSha} (${verdict.seconds}s)`);
}

/*
  WHAT IS IN FLIGHT WHEN THIS LANDS — recorded, not prevented.

  A deploy that lands mid-roll kills the process holding its candidates, and
  the founder ruled that this is an accepted collision class: per-slice billing
  plus the recovery sweep IS the answer, and drain infrastructure is explicitly
  not to be built (2026-08-01). So this does not gate, wait or queue. It READS,
  because the collision has been invisible in every receipt so far — tonight's
  own 07:24Z roll was killed by a deploy from this shift and settled correctly
  eight refunds later, and nothing in the record would have said so.

  Read by NAME from the MySQL service; the URL never leaves this block.
*/
/**
 * IS HE IN THE MIDDLE OF SOMETHING (fable-504)?
 *
 * Ten deploys landed in one night while the founder was dogfooding, and one of
 * them killed a roll he was watching. The Aug-1 ruling accepts that collision
 * class and forbids drain infrastructure — it does not forbid manners. So the
 * rite REFUSES while he has casting work from the last ten minutes, and says
 * why. `--anyway` proceeds deliberately, for the case where the push IS the fix
 * he is waiting on.
 *
 * # WHAT THIS CAN AND CANNOT SEE — said in the receipt, not just here
 *
 * It reads ROWS: candidates and variants. Browsing writes neither. On
 * 2026-08-16 this line printed *"his last casting work was 138.5 minutes ago"*
 * while he was opening face panels — twelve production scans between 10:46Z and
 * 10:58Z, reconciled to the cent against fal's own balance — and two deploys
 * landed inside that session, one of them five seconds after a scan of his.
 *
 * The guard is unchanged, deliberately (fable-754 §4): what it protects against
 * is a killed roll, and reading request logs per deploy to catch a browsing
 * session buys a risk the kept-scan table is already retiring. What changes is
 * the SENTENCE — it now says which reading it took, so nobody quotes a
 * quietness this instrument cannot see. An instrument that overstates its own
 * reach is the uptime-anchor family's defect wearing a politeness costume.
 */
const founderIsActive = await (async (): Promise<{ active: boolean; note: string }> => {
  const url = productionUrl();
  if (!url) return { active: false, note: "(unread — MYSQL_PUBLIC_URL not readable)" };
  try {
    const connection = await openDatabase(url);
    const [rows] = await connection.query<any[]>(
      `SELECT MAX(at) AS latest FROM (
         SELECT MAX(createdAt) AS at FROM casting_candidates WHERE userId = 1
         UNION ALL
         SELECT MAX(createdAt) AS at FROM casting_candidate_variants WHERE userId = 1
       ) AS his`,
    );
    await connection.end();
    const latest = rows[0]?.latest ? new Date(rows[0].latest).getTime() : 0;
    const blind = "browsing writes no row and is invisible to this reading";
    if (!latest) return { active: false, note: `no cast or version on record (${blind})` };
    const minutes = (Date.now() - latest) / 60_000;
    return {
      active: minutes <= 10,
      note: `his last CAST OR VERSION was ${minutes.toFixed(1)} minutes ago (${blind})`,
    };
  } catch {
    return { active: false, note: "(unread — the production ledger could not be reached)" };
  }
})();

const inFlight = await (async (): Promise<string> => {
  const url = railway("variables", "--service", "MySQL", "--kv").split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("MYSQL_PUBLIC_URL="))
    ?.slice("MYSQL_PUBLIC_URL=".length);
  if (!url) return "(unread — MYSQL_PUBLIC_URL not readable)";
  try {
    const connection = await openDatabase(url);
    const [rows] = await connection.query<any[]>(
      `SELECT COUNT(*) AS open FROM casting_candidates
        WHERE status NOT IN ('ready', 'failed', 'discarded')
          AND createdAt >= (NOW() - INTERVAL 20 MINUTE)`,
    );
    /*
      THE FREEZE'S THIRD READING (fable-847 §1, granted).

      The line above counts CANDIDATES, which is a roll's unit of work — and a
      REFINE mints no candidate at all. So a founder halfway through a paid
      edit was invisible to this reading, and a deploy that killed it would have
      printed "nothing in flight" on its own receipt. A live operation holds a
      lease it renews every 30 s, so `claimed`/`running` with an unexpired lease
      is exactly the set whose process this push is about to replace.

      SAID OUT LOUD, because a guard credited with a save it could not have made
      is worse than no guard: **this would NOT have saved last night.** His
      render began 51 seconds AFTER the push landed, and no reading taken before
      a push can see work that has not started. That future hole is D-85's
      accepted cost and stays accepted. This closes the other one — the edit
      already under way while the rite says the coast is clear.
    */
    const [operationRows] = await connection.query<any[]>(
      `SELECT COUNT(*) AS live FROM generation_operations
        WHERE status IN ('claimed', 'running')
          AND leaseExpiresAt > NOW()`,
    );
    await connection.end();
    const open = Number(rows[0]?.open ?? 0);
    const live = Number(operationRows[0]?.live ?? 0);
    const parts = [
      ...(open > 0 ? [`${open} candidate(s)`] : []),
      ...(live > 0 ? [`${live} live operation(s) (unexpired lease — a refine is here and nowhere else)`] : []),
    ];
    return parts.length === 0
      ? "nothing in flight — no candidate of the last 20 minutes, no operation on an unexpired lease"
      : `${parts.join(" + ")} IN FLIGHT — this deploy costs their wait (accepted class, D-85)`;
  } catch {
    /* NO ERROR TEXT. A driver's connection error can carry the DSN it was
       handed, and this line goes into a mailbox report — the reading is
       either taken or it is not, and which driver said no does not belong in
       a receipt beside a credential. */
    return "(unread — the production ledger could not be reached)";
  }
})();

say(`DEPLOY RITE — ${shortSha} · ${subject}`);
say(`  service ${SERVICE} · ${BASE}${DRY ? " · DRY RUN (no push)" : ""}`);
say(`  paid work at push: ${inFlight}`);
say(`  the founder: ${founderIsActive.note}`);
if (founderIsActive.active && !process.argv.includes("--anyway")) {
  die(`he is in an active session — ${founderIsActive.note}. Batch this and deploy when he goes `
    + `quiet (fable-504). If this push IS the fix he is waiting on, say so and re-run with --anyway.`);
}
say("");

/* ── 2. push both branches, and PROVE both landed ───────────────────────── */

/*
  WHOSE DEPLOYMENT IS THIS GOING TO BE? Read BEFORE the push, because after it
  there is a window — measured at seven minutes on 2026-08-19 — in which the
  newest row is still the PREVIOUS deploy, already SUCCESS. The watch below
  accepted exactly that and printed `deployment 0ea3207c → SUCCESS after 2s`
  for a commit Railway had not begun building; health, uptime and the flags
  were then read off the OLD process and were all true of it, which is what
  makes this class dangerous — nothing in the receipt looks wrong.
*/
const priorDeployment = DRY ? null : (listDeployments()[0]?.id ?? null);

/*
  THE PUSH STOPS AT THE FIRST FAILURE (#317).

  It did not, for three incidents: a `main` rejected as non-fast-forward was
  printed and the loop went on to push `main:local-migration`, which production
  builds from. The ref that ships was the one that survived the failure.

  The order guard is checked HERE rather than only in the suite because the
  stop only protects production while production's own ref is LAST — reorder
  `BRANCHES` and this block silently stops helping (invariant 7: a control must
  refuse, not assume).
*/
if (!DRY) {
  const orderProblem = deployRefOrderProblem(BRANCHES);
  if (orderProblem) die(orderProblem);

  const sequence = pushInSequence(BRANCHES, (branch) => gitPushStatus("origin", branch));
  for (const attempt of sequence.attempts) {
    say(`  push ${attempt.branch}: ${attempt.ok ? attempt.output || "ok" : "FAILED"}`);
  }
  for (const skipped of sequence.skipped) say(`  push ${skipped}: NOT ATTEMPTED — an earlier ref failed`);
  if (sequence.failed) die(pushFailureMessage(sequence));
}

/*
  THE REMOTE'S OWN ANSWER, not the push command's exit code. `git push` on an
  up-to-date branch says nothing at all, which is indistinguishable from a push
  that did not happen — and production builds from `local-migration`, so a
  branch left behind deploys the previous commit under this one's name.
*/
for (const branch of BRANCHES) {
  const ref = branch.includes(":") ? branch.split(":")[1]! : branch;
  const remote = git("ls-remote", "origin", `refs/heads/${ref}`).split(/\s+/)[0] ?? "";
  if (remote !== sha) die(divergedRefMessage(ref, remote, shortSha));
  say(`  origin/${ref} = ${shortSha}  ✓`);
}
if (DRY) { say(""); say("DRY RUN — stopping before the watch."); process.exit(0); }

/* ── 3. watch to a terminal state ───────────────────────────────────────── */

say("");
const started = Date.now();
let deployment: { id: string; status: string } | null = null;
for (let attempt = 0; attempt < 90; attempt += 1) {
  /*
    ONE LINE, PARSED AS A LINE. The watched-claim incident was a pattern that
    matched a status on one line and a sha on another; the newest deployment is
    the first row of this list and its status is that row's own field.

    AND IT MUST NOT BE THE ONE THAT WAS THERE BEFORE THE PUSH — see
    `lib/deployWatch.mts`, and the receipt it printed for somebody else's
    deployment on 2026-08-19.
  */
  /* EVERY fetched row is searched for the pushed sha — a foreign row created
     after mine sits at index 0 and would otherwise hide a settled own row
     until the timeout (review of #149). */
  const decision = decideWatch(priorDeployment, listDeployments(), sha);
  if (decision.kind === "settled" || decision.kind === "running") {
    deployment = { id: decision.id, status: decision.status };
  }
  if (decision.kind === "settled") break;
  if (attempt % 6 === 5) {
    if (decision.kind === "not-mine") say(`  waiting for Railway to create the deployment (${attempt * 20}s)`);
    /* A NEW row on ANOTHER commit is somebody else's deploy — his own flag-flip
       redeploy from the dashboard, typically. Say so and keep waiting for the
       row built from THIS push rather than adopting his. */
    if (decision.kind === "foreign") {
      say(`  newest deployment ${decision.id.slice(0, 8)} is on ${decision.commitHash.slice(0, 8)}, not ${shortSha} — not mine, waiting (${attempt * 20}s)`);
    }
    if (decision.kind === "unattributed") {
      say(`  newest deployment ${decision.id.slice(0, 8)} carries no commit hash — cannot be attributed to this push, waiting (${attempt * 20}s)`);
    }
  }
  await wait(20_000);
}
if (!deployment) {
  die(priorDeployment
    ? `Railway never created a deployment of ${shortSha} newer than ${priorDeployment.slice(0, 8)}. The push LANDED and no build of it was seen — nothing here may be reported as deployed.`
    : "no deployment row could be read at all");
}
const elapsed = Math.round((Date.now() - started) / 1000);
say(`  deployment ${deployment.id.slice(0, 8)} → ${deployment.status} after ${elapsed}s`);
if (deployment.status !== "SUCCESS") die(`the deploy ended ${deployment.status}`);

/* ── 4. health, THREE TIMES — a deploy reporting SUCCESS is a claim ─────── */

const healths: Array<{ status: string; db: number; uptime: number; timestamp: string }> = [];
for (let read = 0; read < 3; read += 1) {
  const response = await fetch(`${BASE}/api/health`).catch(() => null);
  if (!response || !response.ok) die(`health read ${read + 1} returned ${response?.status ?? "no response"}`);
  const body = await response!.json() as any;
  healths.push({
    status: body.status,
    db: Number(body.checks?.database?.latencyMs ?? NaN),
    uptime: Number(body.uptime ?? NaN),
    timestamp: String(body.timestamp ?? ""),
  });
  if (read < 2) await wait(3_000);
}
if (healths.some((entry) => entry.status !== "healthy")) die(`health said ${healths.map((h) => h.status).join(", ")}`);
const latencies = healths.map((entry) => entry.db);
// Both terms from the same reading — this loop sleeps, and the local clock is
// not a party to the subtraction. See scripts/lib/uptimeAnchor.mts.
const anchor = uptimeAnchor(healths[0]!);

/* ── 5. the flags, OFF THE SERVICE ──────────────────────────────────────── */

/*
  ⚠ THE BLOCK USED TO BE A PREFIX FILTER, AND IT HAD ALREADY DRIFTED.
  `/^(CASTING_|R7_|ENABLE_STORAGE_CLEANUP_WORKER)/` is a rule about what to
  INCLUDE rather than a list of what is safe to SHOW — and a set
  `ENABLE_EVIDENCE_CANDIDATE_WORKER` would not have matched it, so the one flag
  of the eight late-documented ones that is not a scope could have stood on the
  service and never appeared in a receipt. An allowlist of known-harmless names
  is the only safe shape for anything printing a production variable's value
  (`never-filter-a-secret-listing`: a redaction rule fails OPEN).

  AND THE BLOCK NOW CARRIES A VERDICT. Printing what the service holds fixed
  "flags from memory"; it never fixed the other half, which is that nobody
  compares those values to the RECORD. Two `CLAUDE.md` paragraphs had gone stale
  in the direction that reads as a prohibition on something the founder had
  already authorised — see `scripts/lib/productionFlagPositions.mts`.
*/
const readings = parseVariableLines(railway("variables", "--service", SERVICE, "--kv"));
if (readings.length === 0) die("no variables could be read from the service — a park block may not quote flags from memory");
const positions = comparePositions(readings);
if (positions.block.length === 0) die("the flag position table is empty — the receipt would show a clean block over nothing");

/* ── 5a-bis. THE ADDITIVE MIGRATION, APPLIED RATHER THAN ASKED FOR ───────── */

/*
  HE STOPS BEING THE BOTTLENECK (founder order, 2026-08-31, issue #322):

    *"can you change the rules and allow for auto migration and ceremonies so
    it doesnt need to ask me to run commands ever again"*

  Three ceremonies by hand in twenty-four hours, each one holding a finished
  feature still. #285 sat built-and-unmerged for a night waiting on one
  command, and its own card said so. So the rule reserving production-database
  migrations to him is gone, and this is what replaces it.

  IT LIVES HERE AND NOWHERE ELSE, ON PURPOSE. The rite already runs on every
  push, already resolves the world by name rather than by inference, already
  reads `information_schema`, and already writes a durable receipt. A separate
  auto-migration process would be a second thing to remember, a second place to
  get the world wrong, and a second thing that can silently stop running.

  WHAT IT WILL NOT DO, and the asymmetry is the whole design: a statement that
  DROPS, RENAMES, MODIFIES or rewrites rows is REFUSED and NAMED — never
  applied, never silently skipped. An additive migration nobody wanted is a
  dead table; a DROP nobody wanted is data gone from a commercial product's
  production database, and no test restores it. The refusal quotes the
  statement, so running it by hand is one command and never a guess.

  ⚠ `--dry` PLANS AND PRINTS AND WRITES NOTHING, exactly as it does for the
  push. A rehearsal that migrated production would be the worst possible
  reading of the word.
*/
/** One call. Everything it does lives in the lib, where it can be DRIVEN. */
const autoApply = (
  connection: Awaited<ReturnType<typeof openDatabase>>,
  missing: MissingObjects,
  readBack: () => Promise<MissingObjects>,
) => autoApplyMigrations({
  missing,
  readBack,
  execute: async (sql) => { await connection.query(sql); },
  listMigrations: () => migrationFilesFrom(readdirSync, (file) => readFileSync(file, "utf8")),
  dry: DRY,
});

/* ── 5b. the SCHEMA, off the same service ───────────────────────────────── */

/*
  A FLAG POSITION IS HALF A PROMISE; THE OTHER HALF IS THE TABLE UNDER IT.

  Six paragraphs in CLAUDE.md say a table "must exist before this is flipped on
  — production takes it by the ceremony script", and every one of those is a
  promise about a HAND-RUN act that nothing has ever checked. The boot guards
  deliberately do not: the ink-studio paragraph calls its table "a named
  prerequisite of the FLIP rather than a boot guard" and gives the reason — the
  writer catches its own failure, so a missing table costs a TALLY and never a
  customer's answer. Quiet, and only in the record, which is the shape of the
  mistake nobody finds.

  One `information_schema` query, on a connection this script already opens.
*/
const schema = await (async (): Promise<{ line: string; migration: readonly string[]; problems: string[] }> => {
  const url = productionUrl();
  if (!url) return { line: "(unread — MYSQL_PUBLIC_URL not readable)", migration: [], problems: [] };
  try {
    const connection = await openDatabase(url);
    /* Relative, like the receipt path above: the rite runs from the repo root. */
    const schemaSource = readFileSync("drizzle/schema.ts", "utf8");

    /*
      ONE READING OF THE SERVICE, TAKEN TWICE — before the migration and after
      it — so the second is a READ-BACK rather than a repeat of the first
      (working law 1). The reading itself lives in the lib (`readSchemaGap`),
      because the pre-deploy command (#508) plans production writes from the
      same closure and two copies of it drift (review of #584, finding 1).
    */
    const read = () => readSchemaGap(
      schemaSource,
      async (sql) => (await connection.query<any[]>(sql))[0] as any[],
    );

    let { verdict, missing, declaredIndexCount } = await read();
    const migration = await autoApply(connection, missing, async () => (await read()).missing);
    if (migration.applied > 0) verdict = (await read()).verdict;

    await connection.end();
    const enumerated =
      Object.keys(DECLARED_BUT_UNMIGRATED).length
      + Object.keys(DECLARED_COLUMNS_BUT_UNMIGRATED).length;
    return {
      line:
        `${verdict.declaredTables} tables declared · ${verdict.liveTables} on the service · `
        + `${declaredIndexCount} named indexes · ${enumerated} enumerated as unmigrated`,
      migration: migration.lines,
      problems: [...migration.problems, ...verdict.problems],
    };
  } catch (error) {
    /* NO ERROR TEXT — same rule as every other database read here: this line
       goes into a mailbox and a driver's error can carry the DSN it was handed.
       An unread schema is stated as unread, never as conforming. */
    void error;
    return { line: "(unread — the production schema could not be reached)", migration: [], problems: [] };
  }
})();

/* ── 5c. the STATIC ASSETS, off the bucket the service actually names ────── */

/*
  A reference added without the upload is a BROKEN IMAGE — visible to a
  customer, invisible to the type checker, and invisible to the whole suite,
  because the bytes live in a bucket rather than in the repository.

  The BASE is read off the service and never assumed: `shared/const.ts` carries
  a dev-bucket fallback, and a production that failed to set
  `VITE_ASSETS_BASE_URL` would quietly serve a developer's bucket to customers.
  An unreachable bucket is UNREAD and does not cost the run its verdict — same
  rule as the balance lines. A 404 from a bucket that ANSWERED does.
*/
const assets = await (async (): Promise<{ line: string; problems: string[] }> => {
  const base = readings.find((reading) => reading.name === "VITE_ASSETS_BASE_URL")?.value;
  if (!base) {
    return {
      line: "(unread — the service names no VITE_ASSETS_BASE_URL)",
      problems: [
        "VITE_ASSETS_BASE_URL is not set on the service, so the client falls back to the DEV bucket baked into shared/const.ts — customers would be served a developer's assets",
      ],
    };
  }
  const sources = spawnSync("git", ["ls-files", "client/src", "shared", "server"], {
    encoding: "utf8",
    shell: false,
  }).stdout.split(NL).filter((file) => /\.(ts|tsx)$/.test(file) && !/\.test\.tsx?$/.test(file));
  const { references, dynamic } = assetReferencesIn(
    sources.map((file) => ({ path: file, text: readFileSync(file, "utf8") })),
  );
  const statuses = new Map<string, number | null>();
  await Promise.all(
    references.map(async (reference) => {
      try {
        const response = await fetch(`${base}/${reference.path}`, { method: "HEAD" });
        statuses.set(reference.path, response.status);
      } catch {
        statuses.set(reference.path, null);
      }
    }),
  );
  const verdict = assetVerdict(references, dynamic, statuses);
  return { line: `${verdict.line} · ${base}`, problems: verdict.problems };
})();

/* ── 6. the receipt ─────────────────────────────────────────────────────── */

say("");
say("─".repeat(72));
say(`\`${shortSha}\` · main == local-migration · deploy SUCCESS · health ×3 — 200 ·`);
say(`healthy · db ${latencies.map((value) => value.toFixed(2)).join(" / ")} ms ·`);
say(`paid work at push: ${inFlight}`);
say(`**UPTIME ANCHOR ${anchor}** (uptime ${healths[0]!.uptime.toFixed(1)} s)`);
/* OUR OWN MONEY, beside the deploy that will spend it. At zero the
   interpreter fails and every paid roll and refine dies at dispatch, so a
   deploy is exactly the moment to look. Read here, never remembered. */
say(balanceLine(await readOpenRouterBalance()));
/*
  AND THE SPEND BESIDE THE LEVEL (fable-688 §3).

  A remaining balance cannot show a leak: two deploys an hour apart both print
  "$9.68" whether nothing was spent or a cent was. The account keeps its own
  windows, so the receipt carries today's and this week's figure next to the
  remainder, and a drain becomes visible in ONE reading instead of needing two.
  That is exactly the reading that attributed tonight's own 7¢ movement.
*/
const books = await readOpenRouterActivity();
say(await (async () => {
  const usage = await readOpenRouterUsage();
  if (!usage.ok) return `openrouter spend UNREAD — ${usage.why}`;
  /*
    THE "NEEDS A MANAGEMENT KEY" NOTE BELONGS TO THE BOOKS, NOT TO THIS KEY.

    `isManagementKey` is a property of the INFERENCE key and is correctly false
    — but the breakdown now arrives on a different credential, on the next
    line. Printing the note off this flag alone told the reader a capability was
    missing while it sat directly underneath. Same class as the three threshold
    sentences swept earlier tonight: a fact restated somewhere it cannot see
    whether it is still true.
  */
  return `openrouter spend  today $${usage.daily.toFixed(2)} · week $${usage.weekly.toFixed(2)}`
    + ` · month $${usage.monthly.toFixed(2)}`
    + (books.ok ? "" : "  (per-day/model breakdown needs a management key)");
})());
/*
  AND THE BOOKS THEMSELVES (fable-693 §2c).

  Per day and per model, from the provider rather than from us — the reading
  that turned the whole reconciliation the right way round. Account-wide rather
  than per-key, and the line says so where it prints.
*/
say(booksLine(books));
/*
  AND THE OTHER ACCOUNT (fable-684 §1).

  The founder ordered fal the same rigour, and the two are not symmetrical:
  fal's remainder is behind an admin key we do not hold (HTTP 403), while its
  PRICE list answers to our ordinary key. So the reader asks for the balance
  every time — the day he mints an admin key this upgrades itself, with no code
  change and nobody remembering to come back — and derives a floor from our own
  rows meanwhile. Priced with fal's own figures where fal states one in a unit
  that converts, and with our measured $0.099 where its published unit is
  opaque.

  The window is SEVEN DAYS, matching the week the $100 question is about.
*/
say(await (async () => {
  const balance = await readFalBalance();
  if (balance.ok) return falLine(balance);
  const url = productionUrl();
  if (!url) return falLine(balance);
  try {
    const connection = await openDatabase(url);
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const traffic = await readFalTraffic(connection, since);
    await connection.end();
    const prices = await readFalPrices(traffic.models.map((model) => model.model));
    return falLine(balance, { traffic, priced: priceFalCalls(traffic.models, prices) });
  } catch {
    /* NO ERROR TEXT — same rule as the in-flight read above: this line goes
       into a mailbox, and a driver's error can carry the DSN it was handed. */
    return falLine(balance);
  }
})());
say("");
say("FLAGS, read off the service — and compared to the record:");
for (const line of positions.block) say(line);
if (positions.mismatches.length === 0) {
  say(`  ✓ all ${positions.block.length} stand where scripts/lib/productionFlagPositions.mts says they do`);
} else {
  say("");
  say(`  *** FLAG POSITION MISMATCH — ${positions.mismatches.length} ***`);
  for (const mismatch of positions.mismatches) say(`  ! ${mismatch}`);
  say("  Either production moved without the record, or the record went stale.");
  say("  Fix the row in scripts/lib/productionFlagPositions.mts — and ask what");
  say("  CLAUDE.md's paragraph for that flag now says about a decision that moved.");
}
say("");
say(`MIGRATION, applied by this run (#322 — additive only, destructive refused):`);
for (const line of schema.migration) say(`  ${line}`);
if (schema.migration.length === 0) say("  (unread — the service could not be reached, so nothing was planned or applied)");
say("");
say(`SCHEMA, read off the service: ${schema.line}`);
if (schema.problems.length === 0) {
  say("  ✓ every table, column and named index the code declares is there");
} else {
  say(`  *** SCHEMA MISMATCH — ${schema.problems.length} ***`);
  for (const problem of schema.problems) say(`  ! ${problem}`);
  say("  Anything REFUSED above is a destructive statement and is yours to run by hand;");
  say("  anything else here is a ceremony that could not be applied automatically.");
}
say("");
say(`STATIC ASSETS, off the bucket the service names: ${assets.line}`);
if (assets.problems.length === 0) {
  say("  ✓ every asset the client names is in the bucket");
} else {
  say(`  *** STATIC ASSET PROBLEM — ${assets.problems.length} ***`);
  for (const problem of assets.problems) say(`  ! ${problem}`);
}
say("─".repeat(72));
/*
  THE VERDICT RIDES IN THE EXIT STATUS, NOT IN AN EARLY REFUSAL.
  The deploy has already landed by the time a flag can be read, so dying at
  step 5 would destroy the receipt and change nothing about production. What a
  mismatch takes away is the one thing that gets quoted — a custody block's
  `RITE EXIT STATUS: OK`.
*/
process.exit(positions.mismatches.length + schema.problems.length + assets.problems.length === 0 ? 0 : 1);
