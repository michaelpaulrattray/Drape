/**
 * ONE OWNER FOR "THIS SCRIPT MAY EXIT THE MOMENT THIS FETCH RETURNS".
 *
 * # The defect (#1517, and #1509 before it)
 *
 * `process.exit()` while a libuv handle the fetch left behind is still closing
 * aborts node itself on Windows:
 *
 *   Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 94
 *
 * and the process reports **3221226505** instead of the code it asked for. The
 * refusal has already printed, so an operator sees it — what is lost is the exit
 * CODE, and **a caller cannot tell a refusal from a bug.** A crash code invites a
 * retry where a refusal asks for a repair.
 *
 * # There are TWO handles, and only one of them was ever addressed
 *
 * **1 · THE TIMER, and it is the one this module removes entirely.**
 * `AbortSignal.timeout(10_000)` arms a timer that is **never cleared when the
 * fetch resolves** — it stays a pending handle until it fires or the process
 * ends. #1509 identified exactly this form as what crashed, replaced it with an
 * explicit controller plus `clearTimeout` in `crew-upload-eye-frame.mts`, and
 * justified leaving the deploy rite on the terser form with: *"The rite can use
 * the terser form because it keeps running afterwards."*
 *
 * ⚠ **THAT SENTENCE IS FALSE OF THE RITE AND IS THE REAL DEFECT #1517 FOUND.**
 * `deploy-rite.mts` calls `die()` — `process.exit(1)` — on the statement
 * immediately after `judgeEyeFramePresence`, and again immediately after
 * `probeProductionHealth`. Both of those fetch policies used
 * `AbortSignal.timeout`. So the rite had the shape #1509 repaired, on the
 * strength of a premise about the rite that was not true.
 *
 * `fetchWithClearedTimeout` is that repair, owned once instead of copied: the
 * timer is cleared in a `finally`, so on both the answer road and the timeout
 * road there is no timer handle left to close. **This is the real fix, and it
 * costs nothing.**
 *
 * **2 · THE SOCKETS, which cannot be cleared, only waited out.**
 * ⚠ **The condition is not observable from JavaScript.** Measured under #1509:
 * `process.getActiveResourcesInfo()` reports the `TCPSocketWrap` gone after 5ms
 * and the crash still fired 1 of 3 at that point — libuv is closing a handle JS
 * can no longer see. Everything that looked like a principled fix crashes:
 *
 * | attempt | result |
 * |---|---|
 * | `setImmediate` | 3/3 crash |
 * | `setTimeout(0)` / `setTimeout(1)` | 3/3 crash |
 * | top-level `throw` (node's own handler exits the same way) | 3/3 crash |
 * | `connection: close` requested | 4/4 crash, socket persists |
 * | `process.exitCode` + natural drain | clean 3/3 |
 * | `setTimeout(50)` / `setTimeout(250)` then exit | clean |
 *
 * `check-eye-frames.mts` measured the same thing independently on 2026-09-26,
 * three runs per arm after one fetch, and adds two findings the table above does
 * not carry: **cancelling the body, sending `Connection: close`, using GET and
 * consuming it, and `controller.abort()` after the read were each driven and each
 * still crashed** — while `abort()` plus a 50ms settle passes and `abort()` plus
 * 1ms does not. **So it is the WINDOW and nothing else.**
 *
 * ⚠ **The wrong exit code is not always the same number**, which matters before
 * believing a reading: `check-eye-frames.mts` measured **127** and #1509 measured
 * **3221226505**, both on node 24 on the same machine three days apart. What is
 * stable is that it is not the code the script asked for.
 *
 * ⚠ **AND IT FAILS SAFE, which is what makes a timing constant acceptable at
 * all**: a settle too short turns a refusal's exit 1 into some other NONZERO
 * code, so a gate step still reddens. It can make a refusal noisier. It cannot
 * make one pass.
 *
 * `process.exitCode` with a natural drain is the honest fix and the script-exit
 * guard forbids it: a command script's terminal statement must be `process.exit`
 * (#216). So `settleSockets` is **250ms, fifty times the observed handle
 * lifetime** — a duration because nothing better is available, not because a
 * duration is nice.
 *
 * # THREE callers, and each had reached 250 on its own
 *
 * `deploy-rite.mts`, `crew-upload-eye-frame.mts` and `check-eye-frames.mts` are
 * one class — a fetch, then a prompt exit — and **each had arrived at 250
 * independently, with its own measurement table beside it.** The third was found
 * by the derived sweep in `server/exitSafeFetch.test.ts` rather than by reading,
 * which is the argument for the sweep: two of the three were named on #1517 and
 * the gate's own checker was not.
 *
 * Three copies of a measured constant on three error paths nobody exercises is
 * working law 4. **The duration is owned here; the PLACEMENT stays each caller's
 * own call**, because the callers disagree for good reasons — the rite drains only
 * on the refusal road (the drain is insurance there, see below), while the checker
 * drains at one terminal door for both roads, having argued that its success path
 * was clean *"by luck rather than design"*.
 *
 * # ⚠ What the drain is worth, stated honestly rather than sold
 *
 * #1517 tried to reproduce the crash in the RITE's own shape and could not:
 * **12 runs — the production bucket answering 404, and an unresolvable host,
 * with and without the drain, using the rite's verbatim `AbortSignal.timeout`
 * policy — every one exited 1.** The reproduced case in #1509 is `storagePut` +
 * the judge + a prompt exit, and **the rite calls no `storagePut`**, so it never
 * had the S3 keep-alive pool that the other half of that case opens.
 *
 * So: the TIMER fix above is a real defect really removed. The DRAIN is
 * insurance on a mechanism measured 3/3 elsewhere and not reproduced here — 12
 * quiet runs are weak evidence of immunity for a race, and a quarter second on a
 * road that has already refused costs nothing. **It therefore sits on the
 * REFUSAL road only and not on the happy road**, which is the placement the
 * evidence supports and #1509's own shape.
 */

/**
 * The measured drain. Exported so a guard can pin it, because the point of one
 * owner is that there is one number to pin.
 */
export const SOCKET_SETTLE_MS = 250;

/**
 * `fetch` whose timeout leaves no pending handle behind, for a caller that may
 * `process.exit` as soon as it returns.
 *
 * ⚠ Prefer this over `AbortSignal.timeout` in any script that exits promptly.
 * The terser form is fine in a long-running process and is the reason the rite
 * carried it for so long — see this module's header for why that reasoning did
 * not hold there.
 */
export const fetchWithClearedTimeout = async (
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    /* THE WHOLE POINT. Both roads clear it: an answer and a timeout alike. */
    clearTimeout(timer);
  }
};

/**
 * Let libuv finish closing the sockets a just-finished `fetch` left behind, so a
 * `process.exit` on the next statement reports its own code.
 *
 * `why` is not used for control — it is there so the call site says which network
 * step it is settling, and so a reader who meets a bare sleep beside a refusal
 * finds the reason without opening this file.
 */
export const settleSockets = async (why: string): Promise<void> => {
  void why;
  await new Promise((resolve) => setTimeout(resolve, SOCKET_SETTLE_MS));
};
