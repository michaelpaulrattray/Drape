import { createHash } from "node:crypto";
import { Router, type Request, type Response } from "express";

import {
  REFERENCE_IMAGE_PATH_PREFIX,
  REFERENCE_READS_PER_MINUTE,
} from "../../shared/referenceDelivery";
import { sdk } from "../_core/sdk";
import { readOwnedReferenceAttachment } from "../db/castingV2ReferenceAttachments";
import { createModuleLogger } from "../logging/logger";
import { storageReadBytes } from "../storage";
import { checkUserRateLimit, type RateLimitConfig } from "../security/rateLimit";

const log = createModuleLogger("routes/referenceDelivery");

/**
 * LOOKING AT A PICTURE SHE ATTACHED — the Use chip's thumbnail (founder ruling
 * fable-1419 §2, route countersigned fable-1423 §2).
 *
 * **THE FIFTH authenticated Express image route, and it is on the enumerated
 * list in `CLAUDE.md` in the same commit that created it.** That is not
 * ceremony: two of the four were absent from that sentence until 2026-08-20 —
 * the character sheet since it shipped — and *"a route that exists but is not on
 * the list is how the list stops being the list"* (invariant 5's own type
 * specimen).
 *
 * An Express route rather than a tRPC procedure because the answer is IMAGE
 * BYTES, and it follows `inkDesignDelivery`'s shape deliberately, clause for
 * clause: authenticate, refuse a suspended or locked account, rate-limit per
 * user, and **re-prove ownership in the statement that loads the row** rather
 * than trusting anything the client sent (access-control invariant 1).
 *
 * # WHAT IT DOES NOT DO, said first because it is the easy thing to misread
 *
 * **It does not make the object private.** An attachment's bytes sit at an
 * ordinary permanently public R2 key like every other object this product
 * writes, and this route does not move them. What it buys is that the ADDRESS
 * is never handed out — exactly what `askReference` buys by returning a storage
 * key and never a URL. A control described as more than it is, is how a dead
 * control keeps a live reputation.
 *
 * # WHY IT SERVES THE ATTACHMENT AND NOT THE CARRIER
 *
 * The `source` reference on a render is the CARRIER, the crop cut from her
 * picture for one ask, and `mintHairCarrier` writes it under a cleanup manifest
 * that is never discharged — so it is swept, and a thumbnail pointing at it
 * would go broken with age even if it were served. The attachment is kept until
 * her Cast is purged, and it is the picture she actually recognises.
 *
 * # WHY THERE IS NO SCOPE FLAG ON IT
 *
 * An attachment row only exists for an account that was inside
 * `CASTING_REFERENCE_ATTACH_SCOPE` when it uploaded. Gating the READ on a flag
 * that can move would make an owner's own stored picture unviewable the day the
 * flag changed under her — a refusal about our configuration wearing the shape
 * of a refusal about her picture. The control here is ownership, and it is in
 * the statement. (`inkDesignDelivery`'s own argument, and it transfers whole.)
 *
 * # THE TWO REFUSALS THAT ARE NOT ABOUT WHO IS ASKING
 *
 * 1. **The content type comes off the ROW** — never sniffed, never from the
 *    request — and must be one the attach door can write.
 * 2. **The bytes must be the bytes the row describes.** `digest` is the sha256
 *    of the object that was written, and the repaint road already refuses a
 *    reference whose bytes have moved. Showing her SOMETHING and captioning it
 *    as her picture is the failure the chip exists to prevent.
 *
 * # NO ETAG, AND THAT IS A DECISION
 *
 * `private, no-store`: one person's photograph behind an authenticated route,
 * with no shared cache it may sit in. An etag over `no-store` is validation
 * machinery that can never fire.
 */

export const REFERENCE_DELIVERY_RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: REFERENCE_READS_PER_MINUTE,
  keyPrefix: "reference_delivery",
} satisfies RateLimitConfig;

/** `randomUUID`'s own shape — the only thing `publicId` is ever written from. */
const REFERENCE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * Every content type the attach door is capable of writing.
 *
 * The door's own list, one layer along: an attachment is accepted as png, jpeg
 * or webp and its mime is stored from that decision, so a row naming anything
 * else is a row this route refuses rather than serves under a guessed type.
 * There is no script-in-an-image question to answer here because none of the
 * three can carry one.
 */
const SERVABLE_CONTENT_TYPES: readonly string[] = ["image/png", "image/jpeg", "image/webp"];

type DeliveryUser = {
  id: number;
  suspendedAt: Date | null;
  lockedUntil: Date | null;
};

export type ReferenceDeliveryDependencies = {
  authenticate: (req: Request) => Promise<DeliveryUser | null>;
  rateLimit: (userId: number) => { allowed: boolean; resetIn: number };
  load: (input: {
    userId: number;
    attachmentPublicId: string;
  }) => Promise<{ storageKey: string; digest: string; mime: string } | null>;
  readBytes: (key: string) => Promise<{ bytes: Buffer }>;
};

const productionDependencies: ReferenceDeliveryDependencies = {
  /* A rail drawing several versions authenticates several times together.
     Authentication stays a fresh session and user read; it must not amplify
     that into several `lastSignedIn` writes. */
  authenticate: (req) => sdk.authenticateRequest(req, { recordActivity: false }),
  rateLimit: (userId) => checkUserRateLimit(userId, REFERENCE_DELIVERY_RATE_LIMIT),
  load: readOwnedReferenceAttachment,
  readBytes: storageReadBytes,
};

/** Fixed-shape errors, so a probe learns nothing from the difference. */
function refuse(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
}

export function createReferenceDeliveryRouter(
  dependencies: ReferenceDeliveryDependencies = productionDependencies,
) {
  const router = Router();

  router.get(
    REFERENCE_IMAGE_PATH_PREFIX + "/:referenceId",
    async (req: Request, res: Response) => {
      const user = await dependencies.authenticate(req).catch(() => null);
      if (!user) {
        refuse(res, 401, "Authentication required");
        return;
      }
      if (
        user.suspendedAt
        || (user.lockedUntil && new Date(user.lockedUntil) > new Date())
      ) {
        refuse(res, 403, "Access denied");
        return;
      }
      const rate = dependencies.rateLimit(user.id);
      if (!rate.allowed) {
        res.setHeader("Retry-After", String(Math.max(1, Math.ceil(rate.resetIn / 1000))));
        refuse(res, 429, "Too many requests");
        return;
      }

      const referenceId = String(req.params.referenceId ?? "");
      if (!REFERENCE_ID_PATTERN.test(referenceId)) {
        /* A malformed id is answered exactly the way a stranger's is: the
           statement below is never reached, and nothing about the difference
           reaches the caller. */
        refuse(res, 404, "Not found");
        return;
      }

      /*
        THE OWNER IS IN THE STATEMENT (invariant 1) — `userId` sits in the WHERE
        beside the public id rather than being read first and compared after, so
        there is no window between the check and the use. An attachment
        belonging to somebody else and one that never existed are the same 404,
        so the response cannot be used to discover that an id is real.

        The user id is the AUTHENTICATED one (invariant 3). Nothing from the URL
        but the attachment's own name reaches this call.
      */
      let attachment: { storageKey: string; digest: string; mime: string } | null;
      try {
        attachment = await dependencies.load({ userId: user.id, attachmentPublicId: referenceId });
      } catch (error) {
        log.error({ userId: user.id, err: error }, "[reference] the attachment lookup failed");
        res.setHeader("Retry-After", "2");
        refuse(res, 503, "Try again shortly");
        return;
      }
      if (!attachment) {
        refuse(res, 404, "Not found");
        return;
      }

      if (!SERVABLE_CONTENT_TYPES.includes(attachment.mime)) {
        /* Not a caller's mistake and not a missing picture — a row describing
           an object this product's own door cannot write. Refused rather than
           served under a guessed type. */
        log.error(
          { userId: user.id, referenceId, mime: attachment.mime },
          "[reference] the row names a content type the attach door cannot write",
        );
        refuse(res, 500, "This picture could not be served");
        return;
      }

      let stored: { bytes: Buffer };
      try {
        stored = await dependencies.readBytes(attachment.storageKey);
      } catch (error) {
        log.error(
          { userId: user.id, referenceId, err: error },
          "[reference] the picture's bytes could not be read",
        );
        refuse(res, 500, "This picture could not be served");
        return;
      }

      /*
        THE BYTES ARE THE FACT. `digest` was taken off the object that was
        actually written, and the repaint road already refuses a reference whose
        bytes have moved since the library minted them. Showing a customer a
        different object and captioning it as the picture she gave is exactly
        what this chip exists to prevent, so the same comparison holds here.
      */
      const fetchedDigest = createHash("sha256").update(stored.bytes).digest("hex");
      if (fetchedDigest !== attachment.digest) {
        log.error(
          { userId: user.id, referenceId, byteSize: stored.bytes.byteLength },
          "[reference] the object at the attachment's key is not the object the row describes",
        );
        refuse(res, 500, "This picture could not be served");
        return;
      }

      res.setHeader("Content-Type", attachment.mime);
      /* The type is the row's and must not be second-guessed by a browser. */
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Disposition", "inline");
      /* One owner's photograph behind an authenticated route — never in a shared
         cache, and never revalidated (see the header on why there is no etag). */
      res.setHeader("Cache-Control", "private, no-store");
      res.end(stored.bytes);
    },
  );

  return router;
}
