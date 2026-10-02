/**
 * A DEPLOY-PATH SCRIPT EXITS ON A BOUNDED CLOCK (#1745).
 *
 * # What happened, at the bytes
 *
 * Production deployment `0a455a43` of `f7381022` — PR #1743's squash, a
 * client-only diff, gate green — never started its app container. Railway's
 * deploy log, timestamps as logged:
 *
 *     00:49:44  Starting Container
 *     00:49:44  predeploy: mysql.railway.internal:3306/railway
 *     00:49:44  [db] mysql.railway.internal:3306/railway
 *     00:49:44    nothing pending — the service holds everything the code declares
 *     00:59:45  Stopping Container
 *
 * **The verdict was decided and printed in the same second, and then the
 * process sat for ten minutes.** Railway killed it and marked the deployment
 * FAILED; `deploy-verify` on main went red for the same reason. A normal
 * deploy's pre-deploy container starts and stops inside one second.
 *
 * Nothing was wrong with the build: the image had built, its healthcheck had
 * succeeded, production was never switched and kept serving `08f2c184`
 * healthily. **The design worked. The script did not.**
 *
 * # Where it hung, and why there was nothing to see
 *
 * `scripts/predeploy-migrate.mts` ended:
 *
 *     } finally {
 *       try { await connection?.end(); } catch { ... }
 *     }
 *     process.exit(code);
 *
 * A MySQL `end()` sends a quit packet and **waits for the server to
 * acknowledge it**. On a half-dead socket that acknowledgement never comes, and
 * `await` has no clock — so `process.exit(code)` was unreachable. There was no
 * timeout and no `destroy()` fallback, so a transport hiccup *after the verdict
 * was already decided* turned into a failed deploy of a correct build.
 *
 * ⚠ **AND THE EXIT CODE IS THE ONLY THING RAILWAY READS.** The verdict line is
 * printed before this ever runs. So once the decision exists, every second
 * spent being polite to a socket is a second of pure risk with nothing to gain:
 * a clean `end()` and a `destroy()` are indistinguishable to the platform.
 *
 * # The shape, and the two traps in it
 *
 * Race `end()` against a short timer; on expiry `destroy()` the socket and
 * carry on. Both traps below are failures that would have produced the SAME
 * ten-minute symptom this module exists to remove, by a different road.
 *
 * ⚠ **TRAP 1 · THE TIMER IS A HANDLE.** An armed `setTimeout` that is never
 * cleared is a live libuv handle, and `exitSafeFetch.mts` records at length
 * what this repository has already paid for that: `process.exit()` while a
 * handle is still closing aborts node itself on Windows and reports
 * **3221226505** or **127** instead of the code the script asked for — and a
 * caller cannot tell a refusal from a bug. The timer is cleared on both roads,
 * in the same statement that ends the race.
 *
 * ⚠ **TRAP 2 · A LATE REJECTION IS AN UNHANDLED REJECTION.** If the bound
 * expires, we move on — and the abandoned `end()` may reject a moment later.
 * Node's default for an unhandled rejection is to **kill the process with a
 * nonzero code of its own**, which would destroy the very exit code this
 * function exists to deliver, and do it *after* the verdict line had printed.
 * So the handlers are attached to the ORIGINAL promise, before the race, rather
 * than to the race's result. `server/predeployBoundedExit.test.ts` drives that
 * case in a real child process, because it is the one trap no in-process
 * assertion can see.
 *
 * # Two bounds, because they answer two different questions
 *
 * `CLOSE_BOUND_MS` is 2,000 — long enough that a healthy `end()` on a working
 * socket (measured in single-digit milliseconds against Railway's internal
 * network) is never cut short, and short enough that the worst case is
 * invisible beside a deploy. It is NOT tuned against the ten-minute hang,
 * because a hang has no duration to tune against; it is sized against the
 * success case, which is the only one with a number.
 *
 * ⚠ **IT FAILS SAFE, which is what makes a timing constant acceptable here at
 * all** — the same argument `settleSockets` makes for its 250 ms. A bound too
 * short destroys a socket that was about to close cleanly, which costs nothing:
 * the verdict is already decided, the quit packet is a courtesy, and the server
 * reaps the connection. A bound too long is the defect. There is no road on
 * which this changes a verdict.
 *
 * # What it is NOT
 *
 * Not a retry, and not a reason to skip the close: a clean `end()` is still
 * attempted first and still wins on every ordinary run. What changed is only
 * that failing to get one is no longer unbounded.
 */

/** The connection shape this needs, and nothing more — so a stub is two keys. */
export type BoundedCloseable = {
  end: () => Promise<unknown>;
  /**
   * ⚠ OPTIONAL BECAUSE A POOL HAS NO `destroy`. `mysql2/promise` proxies
   * `destroy` onto a CONNECTION as a synchronous function, and does not put one
   * on `Pool` or `PoolCluster` at all. A pool therefore reaches the bound and
   * leaves its sockets to the `process.exit` that follows — which is correct,
   * and is why this is a `?` rather than a cast.
   */
  destroy?: () => void;
};

export type CloseOutcome =
  /** `end()` resolved inside the bound — the ordinary road. */
  | { kind: "closed" }
  /** The bound expired or `end()` failed; the socket was destroyed instead. */
  | { kind: "destroyed"; why: "timeout" | "error"; detail: string }
  /** There was nothing open to close. */
  | { kind: "absent" };

/** See the two-bounds note above: sized against the SUCCESS case. */
export const CLOSE_BOUND_MS = 2_000;

/** `error.code` only — never a driver message, which can carry the DSN. */
const codeOf = (error: unknown): string =>
  (error as { code?: unknown } | null)?.code
    ? String((error as { code: unknown }).code)
    : ((error as { constructor?: { name?: string } } | null)?.constructor?.name ?? "Error");

/** Best effort by definition: the next statement is an exit either way. */
function destroyQuietly(connection: BoundedCloseable): void {
  try {
    connection.destroy?.();
  } catch {
    /* A destroy that throws has still stopped us waiting, which is the job. */
  }
}

/**
 * Close within a bound, then stop waiting.
 *
 * Always resolves — there is no failure mode a caller could usefully handle,
 * because every road here ends in the same place. The OUTCOME is returned so
 * the caller can print it: the one thing worth knowing an hour later is whether
 * the connection closed or was cut, and a destroyed socket that said nothing is
 * how this class stays invisible until it costs a deploy.
 */
export async function closeWithin(
  connection: BoundedCloseable | null | undefined,
  options: { bound?: number } = {},
): Promise<CloseOutcome> {
  if (!connection) return { kind: "absent" };
  const bound = options.bound ?? CLOSE_BOUND_MS;

  /*
    TRAP 2. Both handlers go on the ORIGINAL promise, BEFORE the race, so an
    `end()` that rejects after the bound has expired is already handled and
    cannot take the process down with a code of node's choosing.

    ⚠ The outcome is the promise's VALUE rather than a flag the handlers set.
    The flag version typechecks as dead code — TypeScript narrows a `let` to its
    initialiser's literal type and cannot see an assignment made inside a
    callback, so `settled === "resolved"` read as a comparison with no overlap.
    A cast would have silenced that; carrying the answer in the value removes
    the mutable state the question was about.
  */
  const BOUND_EXPIRED = Symbol("bound expired");
  const ending: Promise<{ ok: true } | { ok: false; code: string }> = connection.end().then(
    () => ({ ok: true }) as const,
    (error: unknown) => ({ ok: false, code: codeOf(error) }) as const,
  );

  /*
    TRAP 1. `clearTimeout` on both roads, in the `finally` below, so there is no
    armed or closing handle left for `process.exit` to trip over.

    ⚠ **AND THE TIMER IS DELIBERATELY NOT `unref`'d — THE FIRST CUT OF THIS WAS,
    AND IT TRADED THE TEN-MINUTE HANG FOR A DIFFERENT WRONG EXIT CODE.** Driven
    in a real child (`server/predeployBoundedExit.test.ts`): with the timer
    unref'd, a never-resolving `end()` leaves the loop with nothing referenced,
    so node decides the top-level await will never settle and **exits 13** — the
    decided code is lost exactly as it was before, just faster and under
    another name. This timer is the only thing holding the process up while the
    bound runs, which is the opposite of the usual reason to unref one; it is
    safe because it cannot outlive the race that awaits it.
  */
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expiry = new Promise<typeof BOUND_EXPIRED>((resolve) => {
    timer = setTimeout(() => resolve(BOUND_EXPIRED), bound);
  });

  let raced: Awaited<typeof ending> | typeof BOUND_EXPIRED;
  try {
    raced = await Promise.race([ending, expiry]);
  } finally {
    clearTimeout(timer);
  }

  if (raced !== BOUND_EXPIRED && raced.ok) return { kind: "closed" };
  destroyQuietly(connection);
  return raced === BOUND_EXPIRED
    ? { kind: "destroyed", why: "timeout", detail: `${bound} ms` }
    : { kind: "destroyed", why: "error", detail: raced.code };
}

/**
 * The one line a reader wants in the deploy log, or null when there is nothing
 * worth saying.
 *
 * ⚠ **`closed` AND `absent` RETURN NULL ON PURPOSE.** This runs on a path whose
 * entire output is four lines in a Railway log that somebody reads once, during
 * an incident. A line on every ordinary deploy saying the connection closed
 * normally is the noise that makes the one interesting line invisible — and the
 * interesting line is the only reason this function exists.
 */
export function closeLine(outcome: CloseOutcome): string | null {
  if (outcome.kind !== "destroyed") return null;
  return outcome.why === "timeout"
    ? `the database connection did not close within ${outcome.detail} — socket destroyed instead (#1745).`
      + " The verdict above was already decided; this changes nothing about it."
    : `closing the database connection failed (${outcome.detail}) — socket destroyed instead (#1745).`
      + " The verdict above was already decided; this changes nothing about it.";
}
