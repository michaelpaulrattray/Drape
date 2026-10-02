/**
 * ONE RITE PER CHECKOUT — the lock the deploy rite never had (#1726).
 *
 * # What happened, at the bytes
 *
 * On 2026-10-01 two rites ran in the same working tree 63 seconds apart, and
 * **both wrote a confident false sentence onto their own receipt.**
 *
 * - **Rite A** started 20:23:57Z to deploy `f644f718`. While its pre-checks
 *   ran, a second command in the SAME tree committed `5fb877d5` (a child of
 *   `f644f718`) and started **Rite B** at 20:25:00Z. A's `git push origin
 *   main` pushed the ref AS IT THEN STOOD — `06aa189c..5fb877d5` in its own
 *   receipt — so it shipped B's commit too, and A's post-push check then
 *   compared `origin/main` against A's OWN sha and printed
 *   **`REFUSED: origin/main is at 5fb877d5 — not f644f718`.** Production had
 *   received both commits and Railway served `5fb877d5` at 20:27:03Z.
 * - **B** reached its push, read `Everything up-to-date`, and had taken its
 *   `priorDeployment` reading AFTER A's push created the `5fb877d5` row — so
 *   it recorded **its own commit's deployment as the prior one** and then
 *   waited for something newer. Every later row was a seat's merge, so it
 *   printed `not mine` for 44 minutes and refused with *"Railway never created
 *   a deployment of 5fb877d5"* — while that exact deployment had been built
 *   and served.
 *
 * **Neither refusal was true and both read as production failures.** Nothing
 * was wrong with production. That is the "toward noise" error — the one that
 * gets written into a document as a fact (CLAUDE.md: *a reader may be wrong
 * toward noise as well as toward silence, and only one of those two errors
 * gets written into a document as a fact*).
 *
 * # Why a lock, and not a repair of each symptom
 *
 * A's sentence is separately repaired (`judgeRefLanding` in
 * `ritePushSequence.mts` — a landed push is no longer called REFUSED). B's
 * cannot be repaired that way: its `priorDeployment` reading is *correct* for
 * one rite and meaningless for two, because the two share Railway's single
 * deployment list and neither can tell its own row from the other's. **The
 * only honest answer for B is that B must not start**, which is what this is.
 *
 * ⚠ **IT IS A REFUSAL BEFORE ANY CHECK, NOT A WARNING.** The rite's cheapest
 * guard still costs seconds and its custody checks cost minutes; a warning on
 * a path whose whole output is a receipt is a sentence nobody reads until the
 * receipt is already wrong.
 *
 * # The three properties, and each is paid for
 *
 * **1 · ATOMIC.** The file is created with `flag: "wx"`, so the kernel decides
 * who wins. A read-then-write lock has a window exactly as wide as the race it
 * is meant to close, and 63 seconds of pre-checks is not the only shape this
 * class takes — the runner launches seats in one pass.
 *
 * **2 · STALE-SAFE.** A rite killed at the terminal (the #148 class: exit 143,
 * no receipt) would otherwise lock the checkout forever, and a lock an operator
 * has to delete by hand is a lock they learn to delete by reflex. So the holder
 * records its **pid**, and a lock whose pid is not alive is taken over with a
 * line on the receipt saying whose it was.
 *
 * **3 · IT NEVER DELETES SOMEBODY ELSE'S.** `release` re-reads the file and
 * removes it only while it still names our pid. Without that re-read the
 * taken-over road has two processes believing they own one path, and the second
 * to exit unlocks a checkout the first is still pushing from.
 *
 * ⚠ **STATED LIMIT: A RECYCLED PID READS AS ALIVE.** `isPidAlive` answers
 * "is there a process with this id", not "is it that rite", so a dead rite
 * whose pid the OS later hands to something else refuses a legitimate run.
 * That is the direction a deploy gate must fail in — a refused rite costs one
 * re-run and the refusal names the file to delete, while a second concurrent
 * rite costs two false receipts and a 44-minute wait. The alternative (a start
 * time read back off the OS) buys a rare case with a platform-specific read,
 * and `node:fs` plus `process.kill` read the same everywhere this runs.
 *
 * Nothing here spawns a process or hard-codes a path: the rite injects both the
 * filesystem calls and the liveness reading, which is how two real processes
 * can be raced against a real directory in `server/riteLock.test.ts` while the
 * decision arms stay pure.
 */

/**
 * WHERE THE LOCK LIVES, and why it is `output/`.
 *
 * Per-checkout (the whole subject is "another rite in THIS working tree"),
 * gitignored (`.gitignore`'s `output/` entry, Janitor patrol #1), and beside
 * the receipts, which is where a reader chasing a refusal is already looking.
 */
export const RITE_LOCK_PATH = "output/deploy-rite.lock";

/** Who holds the lock. Written as JSON so a stuck lock can be read by eye. */
export type RiteLockHolder = {
  pid: number;
  startedAt: string;
  /** The receipt the holder is writing — the one line a reader actually wants. */
  receipt: string;
  /** The commit the holder is deploying, so a reader knows what is in flight. */
  sha: string;
};

export type RiteLockOutcome =
  /** The lock is ours. `tookOverFrom` is set when a stale holder was cleared. */
  | { ok: true; tookOverFrom: RiteLockHolder | null; note: string | null }
  /** Somebody else is running. `why` is the message the operator reads. */
  | { ok: false; heldBy: RiteLockHolder | null; why: string };

/**
 * The filesystem, injected. Only the four calls the lock makes, so a fake is
 * four lines and a real run is `node:fs` passed straight through.
 */
export type RiteLockFs = {
  mkdirSync: (path: string, options: { recursive: true }) => void;
  /** MUST honour `flag` — `wx` is the whole of property 1. */
  writeFileSync: (path: string, data: string, options: { flag?: string; encoding: "utf8" }) => void;
  readFileSync: (path: string, encoding: "utf8") => string;
  unlinkSync: (path: string) => void;
};

export type AcquireInput = {
  path: string;
  holder: RiteLockHolder;
  fs: RiteLockFs;
  /** True when a process with this id exists. See the stated limit above. */
  isPidAlive: (pid: number) => boolean;
  /** The directory the lock sits in, so a first-ever run does not fail on it. */
  directory: string;
};

/** `EEXIST` through any shape of error object, including a plain string. */
const isAlreadyExists = (error: unknown): boolean =>
  (error as { code?: unknown } | null)?.code === "EEXIST"
  || /\bEEXIST\b/.test(String((error as { message?: unknown } | null)?.message ?? error));

/**
 * Read a lock file into a holder, or null when it says nothing usable.
 *
 * ⚠ **A FILE THAT CANNOT BE PARSED IS NOT A HOLDER, AND IS NOT AN ERROR
 * EITHER.** A half-written lock (a rite killed between the open and the write)
 * has no pid to ask about, so there is no live process it could be protecting —
 * treating it as held would wedge the checkout on a crash, which is exactly
 * what property 2 exists to prevent. It is cleared, and the receipt says so.
 */
export function readHolder(path: string, fs: RiteLockFs): RiteLockHolder | null {
  let raw: string;
  try {
    raw = fs.readFileSync(path, "utf8");
  } catch {
    /* Gone between the EEXIST and this read — the holder released it. */
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<RiteLockHolder>;
    if (typeof parsed?.pid !== "number" || !Number.isInteger(parsed.pid) || parsed.pid <= 0) return null;
    return {
      pid: parsed.pid,
      startedAt: typeof parsed.startedAt === "string" ? parsed.startedAt : "(unrecorded)",
      receipt: typeof parsed.receipt === "string" ? parsed.receipt : "(unrecorded)",
      sha: typeof parsed.sha === "string" ? parsed.sha : "(unrecorded)",
    };
  } catch {
    return null;
  }
}

/**
 * THE MESSAGE A SHIFT READS AT 2AM, and it has one job: stop them deleting the
 * lock of a rite that is mid-push.
 *
 * Both incidents are named because the cost is not obvious from the refusal —
 * "another rite is running" reads like a queueing inconvenience, and what it
 * actually prevents is two receipts that are confidently wrong about
 * production.
 */
export function riteLockRefusal(holder: RiteLockHolder, path: string): string {
  return [
    "another deploy rite is already running in this checkout.",
    "",
    `    pid ${holder.pid}, started ${holder.startedAt}`,
    `    deploying ${holder.sha.slice(0, 8) || "(unrecorded)"}`,
    `    its receipt: ${holder.receipt}`,
    "",
    "Two rites in one working tree share `main` and share Railway's one deployment",
    "list, and neither can tell its own deploy from the other's. On 2026-10-01 that",
    "cost two false receipts in one hour: one printed REFUSED after a push that had",
    "LANDED, the other waited 44 minutes for a build that had already served (#1726).",
    "",
    "NOTHING HAS BEEN PUSHED by this run and production is untouched. Wait for that",
    "rite to finish — its receipt above records its verdict — then run this one again.",
    "",
    "A dead holder is taken over automatically, so a refusal means that pid is alive.",
    "The one case it can get wrong is a recycled pid: if you have proven that process",
    "is not a rite, the lock is one file and deleting it is safe.",
    "",
    `    ${path}`,
  ].join("\n");
}

/**
 * Take the lock, or refuse.
 *
 * The order is load-bearing: **create first, ask questions second.** Asking
 * "is it held?" before writing is the read-then-write window property 1 is
 * about — the EEXIST is the answer, and everything after it is diagnosis.
 */
export function acquireRiteLock(input: AcquireInput): RiteLockOutcome {
  const { path, holder, fs, isPidAlive: alive, directory } = input;
  const body = `${JSON.stringify(holder, null, 2)}\n`;

  const write = (flag: "wx" | "w"): void => fs.writeFileSync(path, body, { flag, encoding: "utf8" });

  try {
    fs.mkdirSync(directory, { recursive: true });
  } catch {
    /* Already there on every run but the first; a real failure surfaces below,
       where it belongs to the write that could not happen. */
  }

  try {
    write("wx");
    return { ok: true, tookOverFrom: null, note: null };
  } catch (error) {
    if (!isAlreadyExists(error)) {
      /* ⚠ NOT a refusal to deploy. A lock that cannot be written is a broken
         `output/`, and refusing every deploy in the repository over it would be
         a guard doing more damage than the defect it watches. It is reported so
         the receipt carries it, and the rite proceeds unlocked — exactly as it
         did before this module existed. */
      return {
        ok: true,
        tookOverFrom: null,
        note: `lock could not be written (${(error as { code?: string } | null)?.code ?? "unknown"}) — `
          + "running UNLOCKED, so a concurrent rite in this checkout would not be refused",
      };
    }
  }

  const existing = readHolder(path, fs);

  if (existing && alive(existing.pid)) {
    return { ok: false, heldBy: existing, why: riteLockRefusal(existing, path) };
  }

  /* Stale, or unreadable and therefore protecting nobody. Take it. */
  try {
    write("w");
  } catch (error) {
    return {
      ok: false,
      heldBy: existing,
      why: `a stale rite lock at ${path} could not be replaced `
        + `(${(error as { code?: string } | null)?.code ?? "unknown"}). `
        + "Delete it by hand and re-run; nothing has been pushed.",
    };
  }
  return {
    ok: true,
    tookOverFrom: existing,
    note: existing
      ? `took over a stale rite lock — pid ${existing.pid} started ${existing.startedAt} and is gone`
      : "took over an unreadable rite lock — it named no live process",
  };
}

/**
 * Give the lock back, and ONLY while it is still ours (property 3).
 *
 * Returns what it did, because the exit handler prints it: a release that
 * silently did nothing is how a checkout stays locked after a clean run.
 */
export function releaseRiteLock(
  input: { path: string; pid: number; fs: RiteLockFs },
): "released" | "not-ours" | "absent" {
  const holder = readHolder(input.path, input.fs);
  if (!holder) {
    /* Either gone already, or unreadable — and clearing an unreadable file
       here could clear a holder that is mid-write. Neither is ours to remove. */
    return "absent";
  }
  if (holder.pid !== input.pid) return "not-ours";
  try {
    input.fs.unlinkSync(input.path);
    return "released";
  } catch {
    return "absent";
  }
}

/**
 * Is there a process with this id?
 *
 * `process.kill(pid, 0)` sends no signal and only asks. Two error codes, and
 * **confusing them is the whole trap**: `ESRCH` is "no such process", while
 * `EPERM` is "it exists and is not yours" — which on Windows is what a process
 * in another session answers. Reading `EPERM` as dead would take over a live
 * rite's lock, which is the one thing this must never do.
 *
 * ⚠ **`probe` IS INJECTABLE BECAUSE THE EPERM BRANCH IS OTHERWISE UNREACHABLE
 * FROM A TEST, AND A BRANCH NO ARM CAN ASK ABOUT SURVIVES ITS OWN SABOTAGE.**
 * Driven: replacing this whole `catch` with `return false` left
 * `server/riteLock.test.ts` 28/28 GREEN, because every pid a suite can name on
 * one machine is either its own (no throw at all) or exited (`ESRCH`) — the
 * one code that matters is the one a same-user process never produces. The
 * default is the real `process.kill`, so the production road is the tested one;
 * the parameter exists only so the trap can be asked about.
 */
export const isPidAlive = (
  pid: number,
  probe: (pid: number) => void = (target) => { process.kill(target, 0); },
): boolean => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    probe(pid);
    return true;
  } catch (error) {
    return (error as { code?: string } | null)?.code === "EPERM";
  }
};
