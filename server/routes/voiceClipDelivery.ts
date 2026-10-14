import { createHash } from "node:crypto";
import { Router, type Request, type Response } from "express";

import {
  VOICE_CLIP_CONTENT_TYPE,
  VOICE_CLIP_PATH_PREFIX,
  VOICE_CLIP_READS_PER_MINUTE,
} from "../../shared/voiceClipDelivery";
import { answerForSessionFailure, sdk } from "../_core/sdk";
import { readOwnedCastVoiceClipByPublicId, touchCastVoiceUsed } from "../db/castVoices";
import { createModuleLogger } from "../logging/logger";
import { storageReadAudioBytes } from "../storage";
import { checkUserRateLimit, type RateLimitConfig } from "../security/rateLimit";

const log = createModuleLogger("routes/voiceClipDelivery");

/**
 * LISTENING TO A CAST'S OWN VOICE — N4b-2 (#2470), design
 * `docs/specs/N4B_VOICE_DESIGN_2026-10-13.md` §4.
 *
 * **THE EIGHTH authenticated Express route, and it is on the enumerated list in
 * `CLAUDE.md` in the same commit that created it.** That is the card's own
 * requirement and it is not ceremony: two of the first four were absent from
 * that sentence until 2026-08-20 — the character sheet since it shipped — and
 * *"a route that exists but is not on the list is how the list stops being the
 * list"* (invariant 5's type specimen).
 *
 * An Express route rather than a tRPC procedure because the answer is AUDIO
 * BYTES, and it follows `referenceDelivery` / `creationCertificate` deliberately,
 * clause for clause: authenticate, refuse a suspended or locked account,
 * rate-limit per user, and **prove ownership inside the statement that loads the
 * row** rather than trusting anything the client sent.
 *
 * # WHY THIS ROUTE EXISTS AT ALL — the clip is closer to a recipe than a picture
 *
 * `shared/voiceClipDelivery.ts` carries the full reading. In short: ninety
 * seconds of a voice is a cloning source, instant voice cloning is ON on the
 * account today, and `server/storage.ts` writes to a permanently public bucket
 * whose objects are *"protected only by the URL being hard to guess"*. So the
 * clip is never projected as a URL anywhere, and this is the only way to hear
 * it.
 *
 * ⚠ **WHAT IT DOES NOT DO, said first because it is the easy thing to misread.**
 * It does not make the object private. The bytes sit at an ordinary public R2
 * key, and this route does not move them. What it buys is that the ADDRESS is
 * never handed out. A control described as more than it is, is how a dead
 * control keeps a live reputation.
 *
 * # THE THREE REFUSALS THAT ARE NOT ABOUT WHO IS ASKING
 *
 * 1. **The content type comes off the ROW** and must be the one the Keep road
 *    writes. A row naming anything else is refused rather than served under a
 *    guessed type — and unlike the picture routes there is exactly one
 *    servable type here, because the provider is asked for `mp3_44100_128`
 *    explicitly on every call (design §3).
 * 2. **The bytes must be the bytes the row describes.** `clipSha256` was taken
 *    off the object that was written. Playing a customer something else and
 *    captioning it as their cast's voice is the failure this check exists to
 *    prevent, and the ink-design and reference routes both already refuse on
 *    the same comparison.
 * 3. **The size must match too.** The row records `clipBytes`, and a short read
 *    would otherwise be caught only by the digest — true, but a digest
 *    mismatch reads as tampering in the log where a truncated transfer is an
 *    ordinary transport fault. Both are refused; they are told apart in the
 *    log line so a diagnosis starts in the right place.
 *
 * # NO SCOPE FLAG ON THE READ, AND THAT IS THE SAME ARGUMENT AS THE OTHERS
 *
 * A voice row only exists for an account that was inside `CASTING_VOICE_SCOPE`
 * when it kept one. Gating the READ on a flag that can move would make an
 * owner's own kept voice unplayable the day the flag changed under them — a
 * refusal about our configuration wearing the shape of a refusal about their
 * cast. The control here is ownership, and it is in the statement.
 * (`inkDesignDelivery`'s own argument, and it transfers whole.)
 *
 * # NO ETAG AND NO RANGE, AND BOTH ARE DECISIONS
 *
 * `private, no-store`: one person's cast's voice behind an authenticated route,
 * with no shared cache it may sit in. An etag over `no-store` is validation
 * machinery that can never fire.
 *
 * **Range is not supported, and the player is built knowing that.** A 2.1 MB
 * body is one bounded read; honouring Range would mean serving slices whose
 * digest cannot be checked against the row, which would quietly retire refusal
 * 2 above for exactly the requests a browser makes most. The client fetches the
 * whole clip once and plays it from a blob, so nothing asks for a range.
 */

const VOICE_CLIP_RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: VOICE_CLIP_READS_PER_MINUTE,
  keyPrefix: "voice_clip_delivery",
} satisfies RateLimitConfig;

type DeliveryUser = {
  id: number;
  suspendedAt: Date | null;
  lockedUntil: Date | null;
};

export type VoiceClipDeliveryDependencies = {
  authenticate: (req: Request) => Promise<DeliveryUser | null>;
  rateLimit: (userId: number) => { allowed: boolean; resetIn: number };
  load: (
    userId: number,
    castId: string,
  ) => Promise<{
    modelId: number;
    clipStorageKey: string;
    clipSha256: string;
    clipBytes: number;
    clipContentType: string;
  } | null>;
  readBytes: (key: string) => Promise<{ bytes: Buffer }>;
  /** The cache's `lastUsedAt`. Best effort — see the call site. */
  touch: (input: { userId: number; modelId: number }) => Promise<void>;
};

const productionDependencies: VoiceClipDeliveryDependencies = {
  /* A room drawing a player authenticates once per visit; authentication stays
     a fresh session and user read and must not amplify into a `lastSignedIn`
     write (the reference route's own reasoning). */
  authenticate: (req) => sdk.authenticateRequest(req, { recordActivity: false }),
  rateLimit: (userId) => checkUserRateLimit(userId, VOICE_CLIP_RATE_LIMIT),
  load: readOwnedCastVoiceClipByPublicId,
  readBytes: storageReadAudioBytes,
  touch: touchCastVoiceUsed,
};

/** Fixed-shape errors, so a probe learns nothing from the difference. */
function refuse(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
}

export function createVoiceClipDeliveryRouter(
  dependencies: VoiceClipDeliveryDependencies = productionDependencies,
) {
  const router = Router();

  /* Express answers HEAD with the GET handler; `req.method` tells them apart,
     and the room uses HEAD for "is there a voice to offer" exactly as the
     certificate button does. */
  /*
    ⚠ REGISTERED AS `CONSTANT + "literal"`, WHICH IS THE ONE COMPOSED SHAPE THE
    ARCHITECTURE ATLAS CAN RESOLVE — the form `referenceDelivery` and
    `inkDesignDelivery` use, and the named positive control in
    `architectureExpressSurfaces.test.ts`. Measured on this card: passing the
    whole pattern as an imported identifier recorded this route in the Atlas as
    *"(declares no path this reader can see)"*, which that same suite refuses
    and which would have left invariant 5's newest route unresolvable on the
    map. `VOICE_CLIP_ROUTE_PATTERN` is still the one spelling of the answer and
    the suite holds the two equal.
  */
  router.get(VOICE_CLIP_PATH_PREFIX + "/:castId/voice-clip", async (req: Request, res: Response) => {
    const probe = req.method === "HEAD";
    let user: Awaited<ReturnType<VoiceClipDeliveryDependencies["authenticate"]>>;
    try {
      user = await dependencies.authenticate(req);
    } catch (error) {
      // A refused session is 401 as before; a lookup that could not finish is
      // 503 "try again" — never read as "not signed in" (#1997).
      const answer = answerForSessionFailure(error);
      if (answer.status === 503) log.error({ err: error }, "[Auth] Session check could not finish — answering 503, not a sign-in refusal (#1997)");
      refuse(res, answer.status, answer.message);
      return;
    }
    if (!user) {
      refuse(res, 401, "Authentication required");
      return;
    }
    if (user.suspendedAt || (user.lockedUntil && new Date(user.lockedUntil) > new Date())) {
      refuse(res, 403, "Access denied");
      return;
    }
    const rate = dependencies.rateLimit(user.id);
    if (!rate.allowed) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil(rate.resetIn / 1000))));
      refuse(res, 429, "Too many requests");
      return;
    }

    const castId = String(req.params.castId ?? "");

    /*
      THE OWNER IS IN THE STATEMENT (invariant 1), and the cast id is
      re-anchored to the owned live signed cast in that same statement
      (invariant 2) — `readOwnedCastVoiceClipByPublicId` joins the voice to the
      cast with the owner on both tables. A voice belonging to somebody else, a
      cast that is not signed, and one that never existed are the same 404, so
      the response cannot be used to discover that an id is real.

      The user id is the AUTHENTICATED one (invariant 3). Nothing from the URL
      but the cast's own public name reaches this call.
    */
    let voice: Awaited<ReturnType<VoiceClipDeliveryDependencies["load"]>>;
    try {
      voice = await dependencies.load(user.id, castId);
    } catch (error) {
      log.error({ userId: user.id, err: error }, "[voiceClip] the voice lookup failed");
      res.setHeader("Retry-After", "2");
      refuse(res, 503, "Try again shortly");
      return;
    }
    if (!voice) {
      refuse(res, 404, "Not found");
      return;
    }

    if (voice.clipContentType !== VOICE_CLIP_CONTENT_TYPE) {
      /* Not a caller's mistake and not a missing voice — a row describing an
         object this product's own Keep road cannot write. Refused rather than
         served under a guessed type. */
      log.error(
        { userId: user.id, modelId: voice.modelId, contentType: voice.clipContentType },
        "[voiceClip] the row names a content type the Keep road cannot write",
      );
      refuse(res, 500, "This voice could not be played");
      return;
    }

    if (probe) {
      /*
        A HEAD says only "there is a voice here to offer", which is what the
        room needs to decide whether to draw a player. It reads no bytes: the
        clip is ~2.1 MB, and fetching it to answer a question about its
        existence would make every room visit pay for a download nobody plays.
        The two byte-level refusals below therefore cannot be answered by a
        HEAD, and the room never treats a 200 here as a promise about bytes —
        it draws the player, and the GET says the rest.
      */
      res.setHeader("Content-Type", VOICE_CLIP_CONTENT_TYPE);
      res.setHeader("Cache-Control", "private, no-store");
      res.status(200).end();
      return;
    }

    let stored: { bytes: Buffer };
    try {
      stored = await dependencies.readBytes(voice.clipStorageKey);
    } catch (error) {
      /* ⚠ THE KEY IS NOT LOGGED. On a public bucket the key IS the credential
         (CLAUDE.md: *"protected only by the URL being hard to guess"*), and a
         cloning source's address must not travel to wherever logs go — the
         relay's third requirement on this card. The cast is what a diagnosis
         needs, and the key can be read from its row. */
      log.error(
        { userId: user.id, modelId: voice.modelId, err: error },
        "[voiceClip] the clip's bytes could not be read",
      );
      refuse(res, 500, "This voice could not be played");
      return;
    }

    if (stored.bytes.byteLength !== voice.clipBytes) {
      log.error(
        { userId: user.id, modelId: voice.modelId, expected: voice.clipBytes, got: stored.bytes.byteLength },
        "[voiceClip] the object at the voice's key is a different size from the one the row describes",
      );
      refuse(res, 500, "This voice could not be played");
      return;
    }

    /*
      THE BYTES ARE THE FACT. `clipSha256` was taken off the object that was
      actually written, by the Keep that wrote it. Playing a customer a
      different recording and calling it their cast's voice is what this
      comparison exists to prevent, and the ink-design route already refuses on
      exactly this ground.
    */
    const digest = createHash("sha256").update(stored.bytes).digest("hex");
    if (digest !== voice.clipSha256) {
      log.error(
        { userId: user.id, modelId: voice.modelId, byteSize: stored.bytes.byteLength },
        "[voiceClip] the object at the voice's key is not the object the row describes",
      );
      refuse(res, 500, "This voice could not be played");
      return;
    }

    /*
      THE CACHE GETS ITS TIMESTAMP, AND A FAILURE HERE NEVER FAILS THE PLAY.
      `lastUsedAt` is what N4b-4's least-recently-used eviction will rank by, so
      it has to be written before that code exists or every voice looks equally
      cold on the day it lands. It is bookkeeping about OUR cache, and a
      customer pressing play must not be refused because a bookkeeping write
      lost — so it is awaited (to keep the ordering honest under a test) and its
      failure is logged, never propagated.
    */
    try {
      await dependencies.touch({ userId: user.id, modelId: voice.modelId });
    } catch (error) {
      log.warn({ userId: user.id, modelId: voice.modelId, err: error }, "[voiceClip] lastUsedAt was not written");
    }

    res.setHeader("Content-Type", VOICE_CLIP_CONTENT_TYPE);
    /* The type is the row's and must not be second-guessed by a browser. */
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", "inline");
    /* One cast's voice behind an authenticated route — never in a shared cache,
       and never revalidated (see the header on why there is no etag). */
    res.setHeader("Cache-Control", "private, no-store");
    res.end(stored.bytes);
  });

  return router;
}
