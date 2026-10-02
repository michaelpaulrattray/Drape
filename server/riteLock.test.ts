/**
 * #1726 — ONE RITE PER CHECKOUT, AND A LANDED PUSH IS NOT A REFUSAL.
 *
 * Two rites ran in one working tree 63 seconds apart on 2026-10-01 and **both
 * wrote a confident false sentence onto their own receipt**: one printed
 * `REFUSED: origin/main is at 5fb877d5 — not f644f718` after a push that had
 * landed and that Railway served two minutes later; the other waited 44 minutes
 * for a deployment of a commit that had already been built, and refused saying
 * Railway never created it. Nothing was wrong with production either time.
 *
 * Three halves, and the middle one is the one the card asked for by name:
 *
 * - the **decision** arms drive `riteLock.mts` and `judgeRefLanding` with
 *   injected filesystem calls and an injected ancestry reading, so every road
 *   including `unreadable` is provable without a remote;
 * - the **race** arms spawn TWO REAL `node` PROCESSES seconds apart against a
 *   real scratch directory, because atomicity is the one property a fake
 *   filesystem cannot demonstrate — a `wx` write and a read-then-write look
 *   identical to every unit arm written over a stub;
 * - the **producer** arms read `scripts/deploy-rite.mts` itself, because a
 *   correct lock the rite does not take is invariant 7's dead control. They are
 *   driven by SABOTAGE — each mutates the real source in memory and asserts the
 *   reading goes red, so a green run means the arm can still fail (working law
 *   2: verify the instrument before believing its finding).
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";
import {
  RITE_LOCK_PATH,
  acquireRiteLock,
  isPidAlive,
  readHolder,
  releaseRiteLock,
  riteLockRefusal,
  type RiteLockFs,
  type RiteLockHolder,
} from "../scripts/lib/riteLock.mts";
import {
  judgeRefLanding,
  refAdvancedLines,
  unreadableRefMessage,
  type Ancestry,
} from "../scripts/lib/ritePushSequence.mts";

/* This suite spawns real `node` and real `git`. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

const RITE_PATH = path.join(process.cwd(), "scripts", "deploy-rite.mts");
const riteSource = () => readFileSync(RITE_PATH, "utf8");

const holderAt = (pid: number, over: Partial<RiteLockHolder> = {}): RiteLockHolder => ({
  pid,
  startedAt: "2026-10-01T20:23:57.186Z",
  receipt: "output/deploy-receipts/2026-10-01T20-23-57-186Z-43552.txt",
  sha: "f644f7181234567890abcdef",
  ...over,
});

/**
 * A filesystem in a Map, honouring `wx` — which is the only behaviour of the
 * real one these arms depend on.
 */
function fakeFs(seed: Record<string, string> = {}): RiteLockFs & { files: Map<string, string> } {
  const files = new Map(Object.entries(seed));
  return {
    files,
    mkdirSync: () => undefined,
    writeFileSync: (p, data, options) => {
      if (options.flag === "wx" && files.has(p)) {
        throw Object.assign(new Error(`EEXIST: file already exists, open '${p}'`), { code: "EEXIST" });
      }
      files.set(p, data);
    },
    readFileSync: (p) => {
      const found = files.get(p);
      if (found === undefined) throw Object.assign(new Error(`ENOENT: no such file '${p}'`), { code: "ENOENT" });
      return found;
    },
    unlinkSync: (p) => { files.delete(p); },
  };
}

const acquire = (fs: RiteLockFs, pid: number, alive: (p: number) => boolean) =>
  acquireRiteLock({
    path: RITE_LOCK_PATH,
    directory: "output",
    holder: holderAt(pid),
    fs,
    isPidAlive: alive,
  });

describe("#1726 · the lock refuses a second rite in the same checkout", () => {
  it("takes a free lock and writes the holder", () => {
    const fs = fakeFs();
    const outcome = acquire(fs, 1001, () => true);

    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.tookOverFrom).toBeNull();
    expect(readHolder(RITE_LOCK_PATH, fs)?.pid).toBe(1001);
  });

  it("REFUSES while the holder's pid is alive, and names it", () => {
    const fs = fakeFs();
    expect(acquire(fs, 43552, () => true).ok).toBe(true);

    const second = acquire(fs, 43476, (pid) => pid === 43552);

    expect(second.ok).toBe(false);
    if (second.ok) throw new Error("the second rite was allowed to start");
    expect(second.heldBy?.pid).toBe(43552);
    /* The three facts a reader needs: whose, when, and where its receipt is. */
    expect(second.why).toContain("pid 43552");
    expect(second.why).toContain("2026-10-01T20:23:57.186Z");
    expect(second.why).toContain("2026-10-01T20-23-57-186Z-43552.txt");
    expect(second.why).toContain("NOTHING HAS BEEN PUSHED");
    /* The lock file still names the FIRST rite — a refusal must not stamp it. */
    expect(readHolder(RITE_LOCK_PATH, fs)?.pid).toBe(43552);
  });

  it("takes over a STALE lock whose pid is gone, and says whose it was", () => {
    const fs = fakeFs();
    expect(acquire(fs, 43552, () => true).ok).toBe(true);

    const second = acquire(fs, 43476, () => false);

    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error("a dead holder wedged the checkout");
    expect(second.tookOverFrom?.pid).toBe(43552);
    expect(second.note).toContain("43552");
    expect(second.note).toContain("stale");
    expect(readHolder(RITE_LOCK_PATH, fs)?.pid).toBe(43476);
  });

  it("takes over a HALF-WRITTEN lock — it names no live process, so it protects nobody", () => {
    /* A rite killed between the open and the write (#148's exit 143 class).
       Reading it as held would wedge the checkout on every future run. */
    const fs = fakeFs({ [RITE_LOCK_PATH]: '{"pid":' });

    const outcome = acquire(fs, 43476, () => {
      throw new Error("liveness must not be asked about a file with no pid in it");
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("an unparseable lock wedged the checkout");
    expect(outcome.note).toContain("unreadable");
    expect(readHolder(RITE_LOCK_PATH, fs)?.pid).toBe(43476);
  });

  it("a lock naming no integer pid is not a holder", () => {
    for (const body of ['{"pid":"43552"}', '{"pid":0}', '{"pid":-1}', '{"pid":1.5}', "{}", "not json"]) {
      expect(readHolder(RITE_LOCK_PATH, fakeFs({ [RITE_LOCK_PATH]: body })), body).toBeNull();
    }
  });

  it("an unwritable lock runs UNLOCKED and SAYS so — it does not refuse every deploy", () => {
    /* A broken `output/` must not stop the repository deploying. What it costs
       is the protection, and the receipt has to carry that sentence. */
    const fs: RiteLockFs = {
      ...fakeFs(),
      writeFileSync: () => { throw Object.assign(new Error("EACCES"), { code: "EACCES" }); },
    };

    const outcome = acquire(fs, 1001, () => true);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("a broken output/ blocked the deploy");
    expect(outcome.note).toContain("UNLOCKED");
    expect(outcome.note).toContain("EACCES");
  });

  it("release removes OUR lock and never somebody else's", () => {
    const fs = fakeFs();
    expect(acquire(fs, 43552, () => true).ok).toBe(true);

    /* The taken-over road: two processes believing they own one path. The one
       that does NOT hold it must leave it alone. */
    expect(releaseRiteLock({ path: RITE_LOCK_PATH, pid: 43476, fs })).toBe("not-ours");
    expect(readHolder(RITE_LOCK_PATH, fs)?.pid).toBe(43552);

    expect(releaseRiteLock({ path: RITE_LOCK_PATH, pid: 43552, fs })).toBe("released");
    expect(fs.files.has(RITE_LOCK_PATH)).toBe(false);
    expect(releaseRiteLock({ path: RITE_LOCK_PATH, pid: 43552, fs })).toBe("absent");
  });

  it("the refusal never invites a force or a delete-first", () => {
    const why = riteLockRefusal(holderAt(43552), RITE_LOCK_PATH);
    expect(why).toContain("Wait for that");
    /* It DOES name the file, because a recycled pid is a real false positive —
       what it must not do is lead with that. */
    expect(why.indexOf("NOTHING HAS BEEN PUSHED")).toBeLessThan(why.indexOf(RITE_LOCK_PATH));
  });
});

describe("#1726 · isPidAlive reads EPERM as alive, which is the whole trap", () => {
  it("says yes about this very process and no about a pid that cannot exist", () => {
    expect(isPidAlive(process.pid)).toBe(true);
    /* 0 and negatives are signals-to-groups in POSIX terms, never a process. */
    expect(isPidAlive(0)).toBe(false);
    expect(isPidAlive(-1)).toBe(false);
  });

  it("says no about a process that has exited — driven, not assumed", () => {
    const child = spawnSync(process.execPath, ["-e", "process.exit(0)"], { encoding: "utf8" });
    expect(child.status).toBe(0);
    expect(child.pid).toBeGreaterThan(0);
    expect(isPidAlive(child.pid!)).toBe(false);
  });

  it("⚠ EPERM is ALIVE and ESRCH is dead — the branch no real pid on one machine can reach", () => {
    /* This arm exists because its absence was MEASURED: replacing the whole
       `catch` with `return false` left this file 28/28 green. Every pid a suite
       can name here is either its own (no throw) or exited (ESRCH), so the one
       code that decides whether a live rite's lock gets stolen was the one no
       fixture could produce. `probe` is injected for exactly this. */
    const throwing = (code: string) => () => { throw Object.assign(new Error(code), { code }); };

    expect(isPidAlive(43552, throwing("EPERM"))).toBe(true);
    expect(isPidAlive(43552, throwing("ESRCH"))).toBe(false);
    /* An unrecognised code is not alive — a lock protecting a process nothing
       can confirm exists would wedge the checkout, which property 2 forbids. */
    expect(isPidAlive(43552, throwing("EINVAL"))).toBe(false);
  });
});

/* ───────────────────────── the race, in real processes ───────────────────── */

/**
 * ⚠ **THIS IS THE ARM THE CARD ASKED FOR, AND IT CANNOT BE WRITTEN OVER A
 * STUB.** A read-then-write lock passes every unit arm above: the fake
 * filesystem is single-threaded, so the window never opens. Two real processes
 * against a real directory are the only thing that distinguishes `wx` from a
 * check followed by a write.
 */
const RACE_RUNNER = `
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { acquireRiteLock, isPidAlive } from PATH;
const [lockPath, startedAt] = process.argv.slice(2);
const outcome = acquireRiteLock({
  path: lockPath,
  directory: lockPath.replace(/[\\\\/][^\\\\/]+$/, ""),
  holder: { pid: process.pid, startedAt, receipt: "receipt-" + process.pid + ".txt", sha: "abc1234def" },
  fs: { mkdirSync, writeFileSync, readFileSync, unlinkSync },
  isPidAlive,
});
console.log(JSON.stringify({ pid: process.pid, ok: outcome.ok, why: outcome.ok ? "" : outcome.why }));
/* Hold it, so the sibling meets a LIVE holder rather than a stale one. */
setTimeout(() => process.exit(0), 2500);
`;

function scratch(): { dir: string; runner: string; lock: string; clean: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), "rite-lock-1726-"));
  mkdirSync(path.join(dir, "output"), { recursive: true });
  const runner = path.join(dir, "race-1726.mjs");
  const libUrl = JSON.stringify(
    new URL(`file:///${path.join(process.cwd(), "scripts", "lib", "riteLock.mts").replace(/\\/g, "/")}`).href,
  );
  writeFileSync(runner, RACE_RUNNER.replace("PATH", libUrl), "utf8");
  return {
    dir,
    runner,
    lock: path.join(dir, "output", "deploy-rite.lock"),
    clean: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/** Run the runner with tsx's loader, so it can import a `.mts` source. */
function startRite(runner: string, lock: string, startedAt: string) {
  return spawnSync(process.execPath, ["--import", "tsx", runner, lock, startedAt], {
    encoding: "utf8",
    timeout: 60_000,
  });
}

describe("#1726 · two real rites, seconds apart, in one scratch checkout", () => {
  it("the second REFUSES and names the first — and the lock still holds the first's pid", () => {
    const { runner, lock, clean } = scratch();
    try {
      /* One real rite takes a free lock through the real filesystem. */
      const first = startRite(runner, lock, "2026-10-01T20:23:57.186Z");
      expect(JSON.parse(first.stdout.trim().split(/\r?\n/).at(-1)!).ok, first.stderr).toBe(true);

      /* ⚠ THEN THE HOLDER IS RESTAMPED WITH *THIS TEST PROCESS'S* PID, AND
         THAT IS DELIBERATE RATHER THAN A SHORTCUT. `spawnSync` waits, so the
         rite above has already EXITED — its lock is genuinely stale and a
         second rite would correctly WIN, which proves the takeover road (the
         next arm) and not the refusal. The only pid this suite can prove is
         alive at the instant a child reads the file is its own. What follows is
         still a real second process meeting a real live holder through a real
         filesystem, which is the property under test. */
      writeFileSync(
        lock,
        JSON.stringify({
          pid: process.pid,
          startedAt: "2026-10-01T20:23:57.186Z",
          receipt: "output/deploy-receipts/first.txt",
          sha: "f644f7181234",
        }),
        "utf8",
      );

      const second = startRite(runner, lock, "2026-10-01T20:25:00.492Z");
      const secondSaid = JSON.parse(second.stdout.trim().split(/\r?\n/).at(-1)!);

      expect(secondSaid.ok, second.stderr).toBe(false);
      expect(secondSaid.why).toContain(`pid ${process.pid}`);
      expect(secondSaid.why).toContain("2026-10-01T20:23:57.186Z");
      expect(secondSaid.why).toContain("output/deploy-receipts/first.txt");

      /* AND THE REFUSAL LEFT THE HOLDER ALONE. A second rite that stamps the
         lock on its way out unlocks the checkout for a third. */
      expect(JSON.parse(readFileSync(lock, "utf8")).pid).toBe(process.pid);
    } finally {
      clean();
    }
  });

  it("the second rite WINS when the first is dead — atomically, with no hand-cleanup", () => {
    const { runner, lock, clean } = scratch();
    try {
      const first = startRite(runner, lock, "2026-10-01T20:23:57.186Z");
      expect(JSON.parse(first.stdout.trim().split(/\r?\n/).at(-1)!).ok, first.stderr).toBe(true);
      /* The child exits without releasing (it is killed by its own timeout
         exit, the #148 shape), so this is a genuinely stale lock on disk. */
      const stale = JSON.parse(readFileSync(lock, "utf8")).pid as number;
      expect(isPidAlive(stale)).toBe(false);

      const second = startRite(runner, lock, "2026-10-01T20:25:00.492Z");
      const said = JSON.parse(second.stdout.trim().split(/\r?\n/).at(-1)!);

      expect(said.ok, second.stderr).toBe(true);
      expect(JSON.parse(readFileSync(lock, "utf8")).pid).toBe(said.pid);
    } finally {
      clean();
    }
  });

  it("`wx` is what makes it a lock — the negative control, driven in one process", () => {
    /* Working law 2 pointed at this module: if `writeFileSync` ignored `flag`,
       every arm above would still pass. This is the arm that could not. */
    const { lock, clean } = scratch();
    try {
      writeFileSync(lock, "first", { flag: "wx", encoding: "utf8" });
      let threw: { code?: string } | null = null;
      try {
        writeFileSync(lock, "second", { flag: "wx", encoding: "utf8" });
      } catch (error) {
        threw = error as { code?: string };
      }
      expect(threw?.code).toBe("EEXIST");
      expect(readFileSync(lock, "utf8")).toBe("first");
    } finally {
      clean();
    }
  });
});

/* ──────────────── a landed push is not a refusal ──────────────── */

const CHECKED = "f644f7181234567890abcdef12345678";
const CHILD = "5fb877d54321098765fedcba87654321";

const landing = (remote: string, ancestry: Ancestry) =>
  judgeRefLanding({ ref: "main", checked: CHECKED, remote, ancestry: () => ancestry });

describe("#1726 · the post-push check asks whether the commit LANDED", () => {
  it("the ordinary night: the ref is exactly the checked commit", () => {
    const result = landing(CHECKED, "no");
    expect(result.kind).toBe("exact");
    expect(result.shipped).toBe(CHECKED);
  });

  it("THE INCIDENT: a descendant means it landed, and what SHIPPED is the descendant", () => {
    const result = landing(CHILD, "yes");
    expect(result.kind).toBe("advanced");
    /* The whole repair. `shipped` is what the watch and the health read must
       name; on 2026-10-01 both were pointed at `checked`, which was never a
       tip, and the rite waited 44 minutes and then refused. */
    expect(result.shipped).toBe(CHILD);
  });

  it("a tip that does NOT carry the commit is the real #317 divergence", () => {
    const result = landing("deadbeefdeadbeefdeadbeefdeadbeef", "no");
    expect(result.kind).toBe("diverged");
    expect(result.shipped).toBe("");
  });

  it("an absent ref is its own answer and is never read as a descendant", () => {
    const result = landing("", "yes");
    expect(result.kind).toBe("absent");
    expect(result.shipped).toBe("");
  });

  it("⚠ an object this clone does not have is UNREADABLE, not `diverged`", () => {
    /* `git merge-base --is-ancestor` exits 128 for a missing object, which
       happens on every tip that moved from another clone. Folding it into
       `diverged` prints the race diagnosis — whose first instruction is a
       merge — over a tree that needs nothing but a fetch. */
    const result = landing(CHILD, "unknown");
    expect(result.kind).toBe("unreadable");
    expect(result.shipped).toBe("");

    const why = unreadableRefMessage(result);
    expect(why).toContain("git fetch origin");
    expect(why).toContain("NOT the #317 race");
    expect(why).toContain("DO NOT force push");
    /* And it must not hand over the merge the race message leads with. */
    expect(why).not.toMatch(/^\s*git merge origin/m);
  });

  it("the advanced note names BOTH shas and which one production builds", () => {
    const lines = refAdvancedLines(landing(CHILD, "yes")).join("\n");
    expect(lines).toContain(CHECKED.slice(0, 8));
    expect(lines).toContain(CHILD.slice(0, 8));
    expect(lines).toContain("landed");
    expect(lines).toContain("#1726");
  });
});

/* ─────────────────── the rite actually calls all of it ──────────────────── */

/**
 * Each arm names the one line in `deploy-rite.mts` the reading cannot exist
 * without, deletes it from a copy of the real source, and asserts the reading
 * goes RED. A correct helper the rite never calls is invariant 7's dead
 * control, and five of the six sentences below are about the rite's source
 * rather than about a function.
 */
const sabotage = (source: string, line: string): string => {
  if (!source.includes(line)) {
    throw new Error(`the sabotage anchor is not in deploy-rite.mts: ${line}`);
  }
  return source.replace(line, "/* sabotaged */");
};

describe("#1726 · the rite takes the lock and reads the landing (invariant 7)", () => {
  it("it acquires the lock, and dies when it cannot have it", () => {
    const source = riteSource();
    const reads = (text: string) => /acquireRiteLock\(\{/.test(text) && /if \(!lock\.ok\) die\(lock\.why\)/.test(text);

    expect(reads(source)).toBe(true);
    expect(reads(sabotage(source, "if (!lock.ok) die(lock.why);"))).toBe(false);
  });

  it("the lock is taken BEFORE every check — ahead of core.hooksPath, the first one", () => {
    const source = riteSource();
    const lockAt = source.indexOf("acquireRiteLock({");
    const firstCheckAt = source.indexOf('const hooksPath = git("config", "core.hooksPath")');

    expect(lockAt).toBeGreaterThan(0);
    expect(firstCheckAt).toBeGreaterThan(0);
    /* The card's own words: "a REFUSAL before any check, not a warning". */
    expect(lockAt).toBeLessThan(firstCheckAt);
  });

  it("the lock is taken AFTER the receipt handler, so a refused start leaves a receipt", () => {
    const source = riteSource();
    const receiptAt = source.indexOf('process.on("exit", (code) => {');
    const lockAt = source.indexOf("acquireRiteLock({");

    expect(receiptAt).toBeGreaterThan(0);
    /* Reversed, a refused-to-start rite writes nothing and is indistinguishable
       from a rite nobody ran — and `index.log` loses its one line per rite. */
    expect(receiptAt).toBeLessThan(lockAt);
  });

  it("it releases the lock on exit", () => {
    const source = riteSource();
    const reads = (text: string) => /releaseRiteLock\(\{ path: RITE_LOCK_PATH, pid: process\.pid/.test(text);

    expect(reads(source)).toBe(true);
    expect(reads(sabotage(source, "const outcome = releaseRiteLock({ path: RITE_LOCK_PATH, pid: process.pid, fs: lockFs });"))).toBe(false);
  });

  it("the ancestry reading is taken from the STATUS, with 128 kept apart from 1", () => {
    const source = riteSource();
    const reads = (text: string) =>
      /spawnSync\("git", \["merge-base", "--is-ancestor"/.test(text)
      && /if \(result\.status === 1\) return "no";/.test(text)
      && /return "unknown";/.test(text);

    expect(reads(source)).toBe(true);
    /* Without the `=== 1` arm, a missing object returns "no" and the rite
       prints the merge repair at a tree that needs a fetch. */
    expect(reads(sabotage(source, 'if (result.status === 1) return "no";'))).toBe(false);
  });

  it("the WATCH is pointed at the shipped tip, not at the checked sha", () => {
    const source = riteSource();
    const reads = (text: string) => /decideWatch\(priorDeployment, listDeployments\(\), shippedSha\)/.test(text);

    expect(reads(source)).toBe(true);
    expect(reads(sabotage(source, "decideWatch(priorDeployment, listDeployments(), shippedSha)"))).toBe(false);
    /* And the refusal that says no build appeared names the same tip, which is
       the sentence that was false for 44 minutes. */
    expect(source).toContain("Railway never created a deployment of ${shippedShort}");
  });

  it("`--dry` is not offered the advanced road, because it pushed nothing", () => {
    const source = riteSource();
    const reads = (text: string) => /ancestry: DRY \? \(\) => "no" : gitAncestry/.test(text);

    expect(reads(source)).toBe(true);
    expect(reads(sabotage(source, 'ancestry: DRY ? () => "no" : gitAncestry,'))).toBe(false);
  });
});

/**
 * ⚠ **AND THE REAL `deploy-rite.mts` IS DRIVEN INTO ITS OWN REFUSAL, which is
 * the only arm here that proves the ORDERING behaviourally rather than by
 * reading character offsets out of the source.**
 *
 * It runs the actual script, in a scratch directory, against a lock naming a
 * pid that is provably alive — this vitest process. What it must show is not
 * only the refusal but the SILENCE after it: `core.hooksPath` is the rite's
 * first real check and its refusal is unmistakable, so its absence from the
 * output is the card's *"a REFUSAL before any check"* measured instead of
 * asserted.
 *
 * ⚠ The scratch directory is deliberately NOT a git repository. The rite's own
 * `run()` swallows a git failure into text, so `core.hooksPath` reads as
 * `Command failed: …` and that check REFUSES — which is what makes it a usable
 * tripwire here: if the lock ever stopped refusing first, this arm would see
 * the hooksPath refusal instead of the lock's and go red.
 */
const TSX_LOADER = new URL(
  `file:///${createRequire(import.meta.url).resolve("tsx").replace(/\\/g, "/")}`,
).href;

describe("#1726 · the real rite refuses to start, before any check", () => {
  it("prints the lock refusal, never reaches core.hooksPath, exits 1 and leaves a receipt", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "rite-real-1726-"));
    try {
      mkdirSync(path.join(dir, "output"), { recursive: true });
      writeFileSync(
        path.join(dir, "output", "deploy-rite.lock"),
        JSON.stringify({
          pid: process.pid,
          startedAt: "2026-10-01T20:23:57.186Z",
          receipt: "output/deploy-receipts/2026-10-01T20-23-57-186Z-43552.txt",
          sha: "f644f7181234567890ab",
        }),
        "utf8",
      );

      /* RAILWAY_* scrubbed so the #148 guard's verdict cannot depend on
         whatever launched the test run. */
      const env = { ...process.env };
      for (const key of Object.keys(env)) if (key.startsWith("RAILWAY_")) delete env[key];

      const result = spawnSync(process.execPath, ["--import", TSX_LOADER, RITE_PATH], {
        cwd: dir,
        encoding: "utf8",
        env,
        timeout: 90_000,
      });
      const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

      expect(result.status, output).toBe(1);
      expect(output).toContain("another deploy rite is already running in this checkout");
      expect(output).toContain(`pid ${process.pid}`);
      expect(output).toContain("2026-10-01T20-23-57-186Z-43552.txt");
      /* THE SILENCE THAT IS THE POINT: the first real check never ran. */
      expect(output, "the rite reached its first check before refusing").not.toContain("core.hooksPath");

      /* And the refused-to-start rite left a receipt saying why, plus its one
         line in the index — the card's fourth done-when. */
      const receipts = path.join(dir, "output", "deploy-receipts");
      const index = readFileSync(path.join(receipts, "index.log"), "utf8").trim().split(/\r?\n/);
      expect(index).toHaveLength(1);
      expect(index[0]).toContain("EXIT 1");

      const transcripts = readdirSync(receipts).filter((name) => name.endsWith(".txt"));
      expect(transcripts).toHaveLength(1);
      /* The index line points at the transcript, rather than the two being read
         independently and hoped to agree. */
      expect(index[0]).toContain(transcripts[0]!);
      const transcript = readFileSync(path.join(receipts, transcripts[0]!), "utf8");
      expect(transcript).toContain("another deploy rite is already running");
      expect(transcript).toContain("EXIT STATUS: EXIT 1");

      /* The refusal did not steal the lock on its way out. */
      expect(JSON.parse(readFileSync(path.join(dir, "output", "deploy-rite.lock"), "utf8")).pid).toBe(process.pid);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("#1726 · the lock path is gitignored, so it can never be committed", () => {
  it("git itself says so — asked, not inferred from reading .gitignore", () => {
    /* `output/` is on the ignore list for the Janitor's reason (#96: it holds
       minted session JWTs), and the lock lives there deliberately. Asking git
       rather than grepping the file covers a negation rule arriving later. */
    const result = spawnSync("git", ["check-ignore", "-q", RITE_LOCK_PATH], { encoding: "utf8" });
    expect(result.status, `git check-ignore said ${result.status} for ${RITE_LOCK_PATH}`).toBe(0);
  });

  it("and it is not tracked", () => {
    const tracked = execFileSync("git", ["ls-files", "--", RITE_LOCK_PATH], { encoding: "utf8" }).trim();
    expect(tracked).toBe("");
  });
});
