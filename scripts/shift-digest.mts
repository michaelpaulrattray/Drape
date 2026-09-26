/**
 * THE SHIFT DIGEST, GENERATED — the CLI half of #510.
 *
 * The reasoning, the two halves and the refusal doctrine live in
 * `scripts/lib/shiftDigest.mts`. This file is IO only: it reads the surfaces,
 * asks `git` and `gh` what changed, embeds `patrol-clocks.mts`'s own output
 * rather than reimplementing it, and prints.
 *
 *     npx tsx scripts/shift-digest.mts
 *     npx tsx scripts/shift-digest.mts --paths server/routes/billing.ts
 *     npx tsx scripts/shift-digest.mts --flags CASTING_V2_SCOPE --out .agents/foreman/DIGEST.md
 *
 * Flags: `--paths` and `--flags` take comma-separated lists; `--out` writes to
 * a file as well as stdout; `--no-network` skips `gh` (the queue and the closed
 * cards then say UNREADABLE rather than empty, which is the point).
 *
 * ⚠ **IT NEVER TOUCHES A DATABASE AND NEVER WRITES ONE.** The switch panel, the
 * queue counts, his replies and the card intents are production rows that the
 * shift-start sequence reads for itself; this reader is free, offline apart
 * from `gh`, and safe to run twice.
 *
 * ⚠ **`.agents/` IS GITIGNORED, so `PROGRAM.md` and `prompt.md` cannot be read
 * by CI.** The library is driven with fixtures instead, and the two arms that
 * matter — the money/auth path, the lobby card — run against the REAL law
 * surfaces, which are tracked. A missing `.agents/` file is a named refusal
 * here rather than a silently thinner digest.
 *
 * Unknown flags are REFUSED rather than ignored (#288).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cardCommentsVerdict, readCardComments } from "./lib/cardBuildState.mts";
import { openPullRequestsVerdict, readOpenPullRequests } from "./lib/cardClaimWarning.mts";
import type { CrewCardCommentFact } from "../shared/crewCardBuildState.js";
import { LAW_SURFACES } from "./lib/lawText.mts";
import { OPEN_QUEUE_LIMIT, bandFromOpenQueue } from "./lib/nextUpItems.mts";
import { mailboxEntries } from "./lib/mailboxEntries.mts";
import {
  buildDigest,
  choosePreviousShift,
  DigestRefusal,
  isUnreadable,
  parseMoneyAuthMap,
  type NextUpRow,
  type OpenPullRequestLike,
  type PreviousShift,
  type Unreadable,
} from "./lib/shiftDigest.mts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROGRAM = ".agents/foreman/PROGRAM.md";
/* The reviewer's charter carries the triage's own money/auth path map. It is
   READ rather than copied: a second list of money surfaces in this file is the
   mirror working law 4 is about, and the one it would drift from is the list
   that decides whether a shift on a session-mint site is handed the
   access-control section. */
const CHARTER = "docs/REVIEWER_CHARTER.md";
const PROMPT = ".agents/foreman/prompt.md";

class Refusal extends Error {}

type Options = {
  paths: string[];
  flags: string[];
  out: string | null;
  network: boolean;
  root: string;
};

function parseArgs(argv: string[]): Options {
  const options: Options = { paths: [], flags: [], out: null, network: true, root: REPO_ROOT };
  const list = (value: string | undefined, flag: string): string[] => {
    if (!value) throw new Refusal(`${flag} needs a comma-separated list`);
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--paths") {
      options.paths.push(...list(argv[index + 1], "--paths"));
      index += 1;
    } else if (flag === "--flags") {
      options.flags.push(...list(argv[index + 1], "--flags"));
      index += 1;
    } else if (flag === "--out") {
      const value = argv[index + 1];
      if (!value) throw new Refusal("--out needs a path");
      options.out = value;
      index += 1;
    } else if (flag === "--root") {
      const value = argv[index + 1];
      if (!value) throw new Refusal("--root needs a path");
      options.root = path.resolve(value);
      index += 1;
    } else if (flag === "--no-network") {
      options.network = false;
    } else {
      throw new Refusal(
        `unknown flag "${flag}" — this reader takes --paths, --flags, --out, --root and --no-network only`,
      );
    }
  }
  return options;
}

function readRequired(root: string, relative: string): string {
  const full = path.join(root, relative);
  if (!existsSync(full)) {
    throw new Refusal(`${relative} is not there — a digest without it would be quietly thinner than the book`);
  }
  return readFileSync(full, "utf8");
}

/** The repository's own top-level directories — derived, never a constant list. */
function topLevelDirectories(root: string): string[] {
  return readdirSync(root).filter((entry) => {
    const stats = statSync(path.join(root, entry), { throwIfNoEntry: false });
    return stats?.isDirectory() ?? false;
  });
}

/**
 * Which entry was the previous shift — the collector in `mailboxEntries.mts`,
 * the decision in `choosePreviousShift`. Neither half lives here, so both can
 * be driven: this file ends in `process.exit`, so nothing may import it (#960).
 */
function previousShift(root: string): PreviousShift | Unreadable {
  const entries = mailboxEntries(root);
  if (isUnreadable(entries)) return entries;
  return choosePreviousShift(entries, Date.now());
}

function run(command: string, args: string[], cwd: string): string {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
  });
}

function commitsSince(root: string, iso: string | null): string[] | Unreadable {
  if (!iso) return { unreadable: "no previous entry to measure from" };
  try {
    const out = run("git", ["log", `--since=${iso}`, "--oneline", "--no-decorate", "main"], root);
    return out.split(/\r?\n/).filter((row) => row.trim().length > 0);
  } catch (error) {
    return { unreadable: `git log failed — ${(error as Error).message.split("\n")[0]}` };
  }
}

function ghJson(root: string, args: string[]): unknown | Unreadable {
  try {
    const out = run("gh", args, root);
    return JSON.parse(out);
  } catch (error) {
    return { unreadable: `gh failed — ${(error as Error).message.split("\n")[0]}` };
  }
}

/**
 * THE OPEN PULL REQUESTS — "is somebody already building this?", asked at the
 * top of the launch rather than only at the declaration (#1094).
 *
 * #1083 put this read into `crew-shift-start.mts`, which fires the moment a
 * shift DECLARES its card. The digest names the same cards ~30 seconds earlier,
 * and that is where the choice is actually made — so this is the same question
 * moved to the place a shift reads first, with the same reader and the same
 * matcher underneath it (`lib/cardClaimWarning.mts`).
 *
 * ⚠ **A FAILED READ IS `Unreadable`, NEVER AN EMPTY LIST.** `readOpenPull-
 * Requests` returns `null` for absent, unauthenticated, offline or slow, and
 * `null` mapped to `[]` would render as a clean board — which is precisely the
 * class this file's `nextUp` docblock exists about. The reason is carried into
 * the digest as a line the shift can act on.
 *
 * `--no-network` is its own reason, for the same rule: a read nobody took is
 * not a read that found nothing.
 *
 * ⚠ **THE JUDGEMENT IS NOT HERE, AND THAT IS DELIBERATE.** Nothing in this
 * script past a `gh` call is reachable from a suite, so the first shape of this
 * collector held the `null` → UNREADABLE mapping inline and a sabotage that
 * collapsed it to `[]` — a failed read rendering as a clean board — broke no
 * arm. `openPullRequestsVerdict` lives beside the reader in
 * `lib/cardClaimWarning.mts` where `server/crewShiftCardClaim.test.ts` drives
 * both directions; what is left here is the call and the root.
 */
function openPullRequests(root: string, network: boolean): OpenPullRequestLike[] | Unreadable {
  /* The ROOT, not the cwd: this script takes `--root`, and a digest that read
     the pull requests of whatever directory it was launched from would name
     another repository's branches beside this one's cards. */
  return openPullRequestsVerdict(network ? readOpenPullRequests(null, root) : null, network);
}

/**
 * THE CLAIMS AND REFUSALS ON THE CARDS (#1094 piece 2) — the half a pull-request
 * read cannot see, and the half that existed at the moment the duplicate this
 * card was filed about actually happened.
 *
 * Same doctrine as the collector above and for the same recorded reason: the
 * `null` → UNREADABLE mapping lives beside the reader in
 * `lib/cardBuildState.mts`, where a suite can drive both directions, because
 * nothing in this script past a `gh` call is reachable from one.
 */
function cardComments(root: string, network: boolean): CrewCardCommentFact[] | Unreadable {
  return cardCommentsVerdict(network ? readCardComments(null, root) : null, network);
}

/* Named, because the truncation marker below compares against it: a read that
   comes back exactly at its limit may have lost rows, and dropping a closed
   card silently is how a "what changed" section stops being one. */
const CLOSED_LIMIT = 40;

/**
 * NEXT UP — READ AS THE WHOLE OPEN QUEUE AND FILTERED, NEVER ASKED NARROWLY
 * (#774, the fourth and last reader of one class).
 *
 * The class: *a successful `gh` read of nothing believed as a fact, on a
 * signal that steers or stops the team.* It was seen on production — the queue
 * counter stored 0 for `process` at 15:00:11 and 8 forty seconds later (#725)
 * — and fixed at the park gate (#730) and the desk sweep (#772). This is the
 * one that mattered most and was left: **the line every shift reads first.**
 *
 * Asking `--label founder-ordered` and getting `[]` is indistinguishable from
 * a blip, and the old road printed **"NEXT UP: EMPTY — no open
 * `founder-ordered` card"** with full confidence. A shift that believes it
 * works a background card instead of the card he ordered, for a whole session.
 *
 * ⚠ **The fix is to WIDEN the question, not to add a second one.** The digest
 * takes only two `gh` reads and neither was a whole-queue read, so unlike the
 * sweep it had no free witness beside it. Reading the whole open queue and
 * filtering the band out of the answer is the SAME ONE CALL, and the witness
 * arrives with it: `emptyOrderedBandVerdict` — the sweep's own function, not a
 * second implementation of the same judgement — decides whether `[]` is a fact
 * or a blip, and an unbelievable empty comes back `Unreadable`, which this
 * file already renders correctly.
 *
 * ⚠ **THE TRUNCATION RULE MOVED WITH IT AND IS NOT THE OLD ONE.** It used to
 * cap the BAND at 60; the cap is now on the POPULATION, so "at the limit"
 * means the whole-queue read may not have reached the band at all — `gh`
 * returns the NEWEST rows and ordered cards skew OLD, so the band is exactly
 * what falls outside a full window. The marker says which of the two it is.
 */
function nextUp(root: string, network: boolean): { rows: NextUpRow[] | Unreadable; truncated: boolean } {
  const answer = (rows: NextUpRow[] | Unreadable, truncated = false) => ({ rows, truncated });
  if (!network) return answer({ unreadable: "--no-network was passed; NOT an empty queue" });
  const raw = ghJson(root, [
    "issue",
    "list",
    "--state",
    "open",
    "--limit",
    String(OPEN_QUEUE_LIMIT),
    "--json",
    "number,title,labels,createdAt",
  ]);
  if (raw && typeof raw === "object" && "unreadable" in raw) return answer(raw as Unreadable);
  if (!Array.isArray(raw)) return answer({ unreadable: "gh returned something that is not a list" });

  const allOpen = raw.map((row: Record<string, unknown>) => ({
    number: Number(row.number),
    title: String(row.title ?? ""),
    labels: Array.isArray(row.labels)
      ? (row.labels as Record<string, unknown>[]).map((label) => String(label.name ?? ""))
      : [],
    createdAt: String(row.createdAt ?? ""),
  }));

  /* The judgement lives in `lib/nextUpItems.mts` so it can be DRIVEN without
     standing up a `gh` — this function's only remaining job is the call and
     the flattening above. That split is the whole reason the repair is
     testable; the road it replaces fetched and judged in one breath, which is
     how it shipped green. */
  const verdict = bandFromOpenQueue(allOpen, OPEN_QUEUE_LIMIT);
  if ("unreadable" in verdict) return answer({ unreadable: verdict.unreadable });
  return answer(verdict.band, verdict.truncated);
}

/**
 * ⚠ TRUNCATION IS MEASURED ON THE RAW ROWS, NEVER ON THE FILTERED LIST. The
 * search takes a DATE, so `gh` over-returns same-day rows that the instant
 * filter then drops: 43 cards closed, `gh` hands back its 40, four are filtered
 * out, and a post-filter count of 36 reads as a complete list while everything
 * past the 40th was silently lost — the exact drop the named limit exists to
 * catch. The count that answers "did this read hit its ceiling" is the count
 * `gh` returned.
 */
function closedSince(
  root: string,
  utc: string | null,
  network: boolean,
): { cards: string[] | Unreadable; truncated: boolean } {
  const answer = (cards: string[] | Unreadable, truncated = false) => ({ cards, truncated });
  if (!network) return answer({ unreadable: "--no-network was passed; NOT an empty list" });
  if (!utc) return answer({ unreadable: "no previous entry to measure from" });
  const raw = ghJson(root, [
    "issue",
    "list",
    "--state",
    "closed",
    "--search",
    `closed:>=${utc.slice(0, 10)}`,
    "--limit",
    String(CLOSED_LIMIT),
    "--json",
    "number,title,closedAt",
  ]);
  if (raw && typeof raw === "object" && "unreadable" in raw) return answer(raw as Unreadable);
  if (!Array.isArray(raw)) return answer({ unreadable: "gh returned something that is not a list" });
  const truncated = raw.length >= CLOSED_LIMIT;
  /* The search takes a DATE, so it over-returns by up to a day; the instant is
     what the shift asked about, and the filter is on the instant. */
  const cards = raw
    .filter((row: Record<string, unknown>) => String(row.closedAt ?? "") >= utc)
    .map((row: Record<string, unknown>) => `#${row.number}  ${row.title}`);
  return answer(cards, truncated);
}

/**
 * `patrol-clocks.mts`'s own stdout — one implementation of the clocks, not two.
 *
 * ⚠ **It is spawned as `node --import tsx`, not as `npx`, and both wrong turns
 * were measured here rather than reasoned about.** Bare `npx` is a spawn ENOENT
 * on Windows (`execFileSync` does not apply PATHEXT to a `.cmd` shim), and
 * `npx.cmd` is an EINVAL — Node refuses to spawn a batch file without a shell,
 * and running one through a shell is how an argument becomes a command. Both
 * failures arrive looking exactly like a reader that is not there, which is why
 * the fallback below prints the reason rather than an empty clocks table.
 */
function patrolClocks(root: string): string | Unreadable {
  try {
    return run(process.execPath, ["--import", "tsx", "scripts/patrol-clocks.mts"], root).trimEnd();
  } catch (error) {
    const stdout = (error as { stdout?: string }).stdout;
    if (stdout && stdout.trim().length > 0) return stdout.trimEnd();
    return { unreadable: `patrol-clocks.mts failed — ${(error as Error).message.split("\n")[0]}` };
  }
}

function main(argv: string[]): number {
  let options: Options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`shift-digest REFUSES: ${(error as Error).message}`);
    return 1;
  }

  let digest: string;
  try {
    const root = options.root;
    const programMd = readRequired(root, PROGRAM);
    const promptMd = existsSync(path.join(root, PROMPT))
      ? readFileSync(path.join(root, PROMPT), "utf8")
      : ({ unreadable: `${PROMPT} is not there` } as Unreadable);

    const lawSurfaces = LAW_SURFACES.map((surface) => ({
      path: surface,
      text: readRequired(root, surface),
    }));
    const moneyAuthMap = parseMoneyAuthMap(readRequired(root, CHARTER));

    const since = previousShift(root);
    /* ONE absolute instant to both readers. The old road handed git a naive
       local ISO and `gh` a UTC one, which is two answers to one question and is
       how a ten-hour offset silently eats a shift's commits (#960). */
    const sinceIso = isUnreadable(since) ? null : since.iso;

    const queue = nextUp(root, options.network);
    const openPrs = openPullRequests(root, options.network);
    const comments = cardComments(root, options.network);
    const closed = closedSince(root, sinceIso, options.network);

    digest = buildDigest({
      now: new Date(),
      promptMd,
      programMd,
      lawSurfaces,
      roots: topLevelDirectories(root),
      nextUp: queue.rows,
      openPullRequests: openPrs,
      cardComments: comments,
      patrolClocks: patrolClocks(root),
      since,
      commits: commitsSince(root, sinceIso),
      closedCards: closed.cards,
      moneyAuthMap,
      truncated: {
        nextUp: queue.truncated,
        closedCards: closed.truncated,
      },
      request: { paths: options.paths, flags: options.flags },
      sourceBytes: [PROGRAM, ...LAW_SURFACES.filter((surface) => surface !== "CLAUDE.md")].map(
        (relative) => ({
          path: relative,
          bytes: Buffer.byteLength(readRequired(root, relative), "utf8"),
        }),
      ),
    });
  } catch (error) {
    /* A `DigestRefusal` is the library saying a collector came up empty; anything
       else is an unexpected failure. Both are refusals here — the shift must not
       receive a digest that is quietly missing a law either way. */
    const kind = error instanceof DigestRefusal ? "REFUSES" : "FAILED";
    console.error(`shift-digest ${kind}: ${(error as Error).message}`);
    return 1;
  }

  if (options.out) {
    writeFileSync(path.resolve(options.root, options.out), `${digest}\n`, "utf8");
    console.error(`shift-digest: written to ${options.out}`);
  }
  console.log(digest);
  return 0;
}

process.exit(main(process.argv.slice(2)));
