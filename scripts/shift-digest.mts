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
import { LAW_SURFACES } from "./lib/lawText.mts";
import {
  buildDigest,
  DigestRefusal,
  parseMoneyAuthMap,
  type NextUpRow,
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
const MAILBOX = ".agents/mailbox";

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
 * The newest mailbox entry, by the timestamp in its own FILENAME.
 *
 * The names are `foreman-20260904-2340.md` / `retro-…` / `runner-close-…`, and
 * the stamp is LOCAL time — the same convention the standing orders set. Only
 * the winning file is opened, so there is no list-then-read race to lose (#223).
 */
function previousShift(root: string): { label: string; iso: string; utc: string } | Unreadable {
  const dir = path.join(root, MAILBOX);
  if (!existsSync(dir)) return { unreadable: `${MAILBOX} is not there` };
  const NAME = /^([a-z-]+)-(\d{8})-(\d{4})\.md$/;
  let best: { label: string; stamp: string } | null = null;
  for (const name of readdirSync(dir)) {
    const match = NAME.exec(name);
    if (!match) continue;
    const stamp = `${match[2]}${match[3]}`;
    if (!best || stamp > best.stamp) best = { label: name, stamp };
  }
  if (!best) return { unreadable: `no timestamped entry in ${MAILBOX}` };
  const [, , date, time] = NAME.exec(best.label) as RegExpExecArray;
  /* The stamp is LOCAL time — the standing orders' own convention — so it is
     parsed as local and converted once. A `gh` search takes a UTC date and a
     ten-hour machine offset is exactly how a whole shift's commits go missing
     from "what changed": the same zone mistake #504's park gate was carrying. */
  const iso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${time.slice(0, 2)}:${time.slice(2, 4)}:00`;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return { unreadable: `${best.label} does not carry a real date` };
  }
  return { label: best.label, iso, utc: parsed.toISOString() };
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

/* Named, because the truncation marker below compares against them: a read that
   comes back exactly at its limit may have lost rows, and dropping the 61st
   founder-ordered card silently is how a queue stops being the queue. */
const NEXT_UP_LIMIT = 60;
const CLOSED_LIMIT = 40;

function nextUp(root: string, network: boolean): NextUpRow[] | Unreadable {
  if (!network) return { unreadable: "--no-network was passed; NOT an empty queue" };
  const raw = ghJson(root, [
    "issue",
    "list",
    "--label",
    "founder-ordered",
    "--state",
    "open",
    "--limit",
    String(NEXT_UP_LIMIT),
    "--json",
    "number,title,labels,createdAt",
  ]);
  if (raw && typeof raw === "object" && "unreadable" in raw) return raw as Unreadable;
  if (!Array.isArray(raw)) return { unreadable: "gh returned something that is not a list" };
  return raw.map((row: Record<string, unknown>) => ({
    number: Number(row.number),
    title: String(row.title ?? ""),
    labels: Array.isArray(row.labels)
      ? (row.labels as Record<string, unknown>[]).map((label) => String(label.name ?? ""))
      : [],
    createdAt: String(row.createdAt ?? ""),
  }));
}

function closedSince(root: string, utc: string | null, network: boolean): string[] | Unreadable {
  if (!network) return { unreadable: "--no-network was passed; NOT an empty list" };
  if (!utc) return { unreadable: "no previous entry to measure from" };
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
  if (raw && typeof raw === "object" && "unreadable" in raw) return raw as Unreadable;
  if (!Array.isArray(raw)) return { unreadable: "gh returned something that is not a list" };
  /* The search takes a DATE, so it over-returns by up to a day; the instant is
     what the shift asked about, and the filter is on the instant. */
  return raw
    .filter((row: Record<string, unknown>) => String(row.closedAt ?? "") >= utc)
    .map((row: Record<string, unknown>) => `#${row.number}  ${row.title}`);
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
    const sinceIso = "iso" in since ? since.iso : null;
    const sinceUtc = "utc" in since ? since.utc : null;

    const queue = nextUp(root, options.network);
    const closed = closedSince(root, sinceUtc, options.network);

    digest = buildDigest({
      now: new Date(),
      promptMd,
      programMd,
      lawSurfaces,
      roots: topLevelDirectories(root),
      nextUp: queue,
      patrolClocks: patrolClocks(root),
      since,
      commits: commitsSince(root, sinceIso),
      closedCards: closed,
      moneyAuthMap,
      truncated: {
        nextUp: Array.isArray(queue) && queue.length >= NEXT_UP_LIMIT,
        closedCards: Array.isArray(closed) && closed.length >= CLOSED_LIMIT,
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
