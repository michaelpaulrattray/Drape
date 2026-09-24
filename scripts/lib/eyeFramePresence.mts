/**
 * AN EDITION NAMING AN EYE FRAME THAT IS NOT IN THE PRODUCTION BUCKET DOES NOT
 * SHIP (#320).
 *
 * The founder, 2026-08-31: *"this card on my desk isnt rendering correctly"* —
 * broken-image glyphs under the captions on eye item `queue-titles-285-frames`.
 * The briefing was correct, the serving route's allowlist was correct, the
 * deploy was green. **Only the bytes were in the wrong bucket**: the frames were
 * uploaded from a local shell, which reads `.env` and therefore points at DEV.
 *
 * ⚠ **A wrong-bucket upload is indistinguishable from a right one at the call
 * site.** `crew-upload-eye-frame.mts` succeeds against either bucket and hands
 * back a key; the key is real, the caption is real, the schema is satisfied, and
 * nothing between that moment and his eyes ever asks whether the object exists
 * where the page will look for it. It had happened twice — the concept frames
 * days earlier, repaired by hand the same way — plus a third near-miss on the
 * same script (#265). Three incidents, one script, no guard.
 *
 * This is working law 1 at its most literal: **the upload's returned key is a
 * CLAIM; the object in the bucket is the FACT.** So the rite reads the fact,
 * before the push, against the bucket the founder's browser will actually ask.
 *
 * # WHY THE PUBLIC URL AND NOT AN S3 CLIENT
 *
 * `crew-eye/` objects live in the main R2 bucket, which is public by design
 * (`server/storage.ts`: served URLs are public bucket URLs, never presigned).
 * So presence is answerable with a credential-free `HEAD` against
 * `R2_PUBLIC_URL` — the same shape the rite's static-asset pass already uses,
 * and it means this check never handles an R2 secret. Measured at the real
 * bucket 2026-08-31: a live frame answers **200**, a UUID that cannot exist
 * answers **404**.
 *
 * ⚠ **The base comes off the SERVICE and is never defaulted.** An absent
 * `R2_PUBLIC_URL` is a REFUSAL, not a skip: falling back to the ambient `.env`
 * would check the dev bucket and pass, which is the exact mistake this exists
 * to catch (the card's bar item 2).
 *
 * # A FAILED READ IS NOT A PASS
 *
 * A `HEAD` that throws, or answers anything other than 200 / 404 / 403, is
 * UNREAD and refuses. That is the opposite of the rite's static-asset rule, on
 * purpose: an unreachable bucket there costs a REPORT, while here it would cost
 * the founder a broken card he cannot tell from a real one. Fail closed
 * (invariant 7), and say "unread" rather than "missing" — they are different
 * facts and only one of them names a repair.
 *
 * This is a MODULE (imported by the rite and by its suite) and it never exits.
 *
 * # ONE ANSWER IS NOT AN ANSWER — THE BURST AND THE RETRY (#1177)
 *
 * The first version asked every key at once: `Promise.all(keys.map(...))`. On
 * 2026-09-24 that was **314 HEAD requests launched at one CDN host in the same
 * tick**, four of them came back with no answer at all, and the rite REFUSED a
 * push whose frames were all present — read afterwards at the bucket with
 * `curl -I`, four 200s, and an unchanged re-run passed. The population only
 * grows: every edition with an eye item adds keys permanently, so the odds of
 * at least one dropped connection rise with every shift.
 *
 * ⚠ **The defect was never the three-way split, and it must not be "fixed" by
 * folding `unread` into a pass.** Refusing on an unanswered request is
 * invariant 7 and it is the good part of this module. What was missing is the
 * ability to tell *"this bucket will not answer"* from *"I asked 314 questions
 * at once and four got dropped"* — and the only way to tell them apart is to
 * ask a second time, quietly.
 *
 * So: every key is asked, and then every key still unread is asked ONCE MORE,
 * SERIALLY. A `missing` is never retried — a 404 is an answer.
 *
 * # ⚠ THE CARD ALSO ASKED FOR A BOUNDED POOL. IT WAS BUILT, MEASURED AT THE
 * REAL BUCKET, AND REMOVED — THE MEASUREMENT SAYS IT IS THE WRONG MEDICINE.
 *
 * Driven against the production bucket over the 312 keys the committed briefing
 * names, one reading per process with a cooldown between (the first attempt
 * measured the previous attempt, and reported a 12x slowdown that was its own
 * contamination):
 *
 * - **Cold, unbounded: 1.4s, 0 unread. Cold, pool of 16: 2.6s, 0 unread.** The
 *   bound does not prevent a drop; it costs a second.
 * - Drops track SUSTAINED VOLUME, not the burst. Three back-to-back sweeps go
 *   `0 unread -> 9-13 unread -> 312 unread`, and pool sizes 16/32/64 scattered
 *   `5/17/6` with no relationship to the bound at all.
 * - ⚠ **And with a timeout in hand the bound INVERTS**: unbounded, a dead host
 *   aborts all 312 together for one 10s wait; at a pool of 16 that is 20 waves,
 *   200s. The bound would make the worst case twenty times worse to buy nothing
 *   the measurement can see.
 *
 * **So the concurrency is left exactly as it was, deliberately.** What changed
 * is that one unanswered request no longer decides a push.
 *
 * ⚠ **THE TIMEOUT IS THE OTHER HALF, AND IT IS MEASURED TOO.** A bare
 * `fetch(url, {method:"HEAD"})` against a host that accepts the connection and
 * never answers takes **306.6 seconds** to reject (node 24, undici's
 * `headersTimeout`, driven against a local server that never responds). The
 * rite hands in a `head` carrying `AbortSignal.timeout`, so a dead bucket costs
 * ten seconds and not five minutes. This module owns no fetch policy.
 */

/**
 * How many retries in a row may come back unread before the retry pass stops.
 *
 * ⚠ **THIS NUMBER CAME FROM THE BUCKET, NOT FROM AN ARGUMENT, AND THE ARGUMENT
 * WAS WRONG.** The first draft reasoned that three unanswered serial requests
 * meant a bucket that would not answer, so walking the rest was waste. Then the
 * real bucket was driven into a total blackout — a sweep where **all 312 keys
 * came back unread** — and the serial retry recovered **308 of 312**. A bucket
 * answering nothing at all is exactly the case the retry rescues, so "it has
 * stopped answering" is not a reason to stop asking.
 *
 * What the same runs DID show is the honest discriminator: across two blackout
 * recoveries the **longest run of consecutive unanswered retries was 1**, and
 * the first retry answered 344ms and 94ms in. A genuinely unreachable host
 * answers none of them, so three in a row separates the two cases with margin,
 * and the budget can never trip on a recovery that is working.
 *
 * It exists only to bound the wall clock: a full serial pass over 312 keys took
 * ~85s when every one of them had to be re-asked, and against a host that never
 * answers it would be 312 timeouts. Keys not reached stay UNREAD and still
 * refuse, with the same wording; nothing is ever passed for not being asked.
 */
export const EYE_FRAME_RETRY_GIVE_UP_AFTER = 3;

export type EyeFramePresence = {
  ok: boolean;
  why: string;
  /** Distinct keys the edition names. */
  checked: number;
  /** Keys the bucket answered 404/403 for. */
  missing: string[];
  /** Keys whose presence could not be read at all. */
  unread: string[];
};

/**
 * Every distinct `crew-eye/` key an edition names, in first-appearance order.
 * Frames are reused across items (the same follow-court anchor appears under
 * two), so the population is a SET — a key checked twice is one fact.
 *
 * Returns `null` when the bytes are not a briefing this reader understands; the
 * caller already has the schema judge for that, and guessing here would let a
 * malformed briefing report "no frames named" and pass.
 */
export const eyeFrameKeysOf = (headBriefing: string): string[] | null => {
  let parsed: any;
  try {
    parsed = JSON.parse(headBriefing);
  } catch {
    return null;
  }
  if (!parsed || !Array.isArray(parsed.eyeItems)) return null;
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const item of parsed.eyeItems) {
    if (!item || !Array.isArray(item.frames)) return null;
    for (const frame of item.frames) {
      const key = frame?.key;
      if (typeof key !== "string") return null;
      if (seen.has(key)) continue;
      seen.add(key);
      keys.push(key);
    }
  }
  return keys;
};

/**
 * `head` answers the HTTP status the bucket gave, or `null` if the request
 * could not be made at all. It is injected so the suite can drive every arm
 * without a network, and so this module never owns a fetch policy.
 */
export const judgeEyeFramePresence = async (
  keys: string[] | null,
  base: string | undefined | null,
  head: (url: string) => Promise<number | null>,
): Promise<EyeFramePresence> => {
  if (keys === null) {
    return {
      ok: false,
      why: "the briefing could not be read for eye frames — the schema judge names why",
      checked: 0,
      missing: [],
      unread: [],
    };
  }
  if (!base) {
    return {
      ok: false,
      why:
        "the service names no R2_PUBLIC_URL, so the production bucket cannot be read — "
        + "this check must never fall back to the ambient .env, which is the dev bucket and would pass",
      checked: keys.length,
      missing: [],
      unread: [],
    };
  }
  if (keys.length === 0) {
    return { ok: true, why: "the edition names no eye frames", checked: 0, missing: [], unread: [] };
  }

  const root = base.replace(/\/+$/, "");

  /* An answer per key, kept BY INDEX rather than pushed on arrival, so the
     refusal names the same five keys every run. Under `Promise.all` the two
     lists were in completion order, which made the message a lottery over a
     population of 314 — and a repair instruction that names different files
     each time is a repair instruction nobody can act on. */
  const answers: ("present" | "missing" | "unread")[] = new Array(keys.length).fill("unread");
  const classify = (status: number | null) =>
    status === 200 ? "present" as const
      : status === 404 || status === 403 ? "missing" as const
        : "unread" as const;
  const ask = async (index: number) => {
    const status = await head(`${root}/${keys[index]!}`).catch(() => null);
    answers[index] = classify(status);
  };

  /* Pass one, every key at once — unchanged on purpose, and the docblock above
     carries the measurement that kept it that way. */
  await Promise.all(keys.map((_, index) => ask(index)));

  /* Pass two: every key still unread asked ONCE more, alone. `missing` is not
     retried — a 404 is an answer, and re-asking it would only make an absent
     frame cost twice as long to report. */
  let consecutiveUnread = 0;
  for (let index = 0; index < keys.length; index += 1) {
    if (answers[index] !== "unread") continue;
    if (consecutiveUnread >= EYE_FRAME_RETRY_GIVE_UP_AFTER) break;
    await ask(index);
    consecutiveUnread = answers[index] === "unread" ? consecutiveUnread + 1 : 0;
  }

  const missing = keys.filter((_, index) => answers[index] === "missing");
  const unread = keys.filter((_, index) => answers[index] === "unread");

  if (missing.length === 0 && unread.length === 0) {
    return {
      ok: true,
      why: `${keys.length} eye frame${keys.length === 1 ? "" : "s"} present in the production bucket`,
      checked: keys.length,
      missing: [],
      unread: [],
    };
  }
  const parts: string[] = [];
  if (missing.length > 0) {
    parts.push(
      `${missing.length} of ${keys.length} eye frames ${missing.length === 1 ? "is" : "are"} NOT in the production bucket `
      + `(uploaded to dev?): ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? ` and ${missing.length - 5} more` : ""}`,
    );
  }
  if (unread.length > 0) {
    parts.push(
      `${unread.length} could not be read at all — UNREAD, not missing: `
      + `${unread.slice(0, 5).join(", ")}${unread.length > 5 ? ` and ${unread.length - 5} more` : ""}`,
    );
  }
  return { ok: false, why: parts.join(" · "), checked: keys.length, missing, unread };
};
