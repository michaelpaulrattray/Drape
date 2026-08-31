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
 */

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
  const missing: string[] = [];
  const unread: string[] = [];
  await Promise.all(
    keys.map(async (key) => {
      const status = await head(`${root}/${key}`).catch(() => null);
      if (status === 200) return;
      if (status === 404 || status === 403) missing.push(key);
      else unread.push(key);
    }),
  );

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
