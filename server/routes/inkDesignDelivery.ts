import { createHash } from "node:crypto";
import { Router, type Request, type Response } from "express";

import {
  INK_DESIGN_IMAGE_PATH_PREFIX,
  INK_DESIGN_READS_PER_MINUTE,
} from "../../shared/inkDesignDelivery";
import { sdk } from "../_core/sdk";
import {
  INK_DESIGN_FORMATS,
  inkDesignContentType,
} from "../castingV2/inkUploadDoor";
import { readInkDesign, type StoredInkDesign } from "../db/castingV2InkDesigns";
import { createModuleLogger } from "../logging/logger";
import { storageReadBytes } from "../storage";
import { checkUserRateLimit, type RateLimitConfig } from "../security/rateLimit";

const log = createModuleLogger("routes/inkDesignDelivery");

/**
 * LOOKING AT A STORED DESIGN — the shown cut (ruled fable-1127 §2, ratified
 * fable-1135 §4d, precondition of the `CASTING_INK_CUT_SCOPE` flip per
 * opus-841 §4).
 *
 * An Express route rather than a tRPC procedure because the answer is IMAGE
 * BYTES — `characterSheet.ts`'s own reason, and this follows that route's shape
 * deliberately: authenticate, refuse a suspended or locked account, rate-limit
 * per user, and **re-prove ownership in the statement that loads the row**
 * rather than trusting anything the client sent (access-control invariant 1).
 *
 * # WHAT THIS DOES NOT DO, said first because it is the easy thing to misread
 *
 * **It does not make the object private.** A design's bytes sit at an ordinary
 * permanently public R2 key like every other object this product writes
 * (`server/storage.ts`), and this route does not move them. What it buys is
 * that the ADDRESS is never handed out — the same thing `askReference` buys by
 * returning a storage key and never a URL, and the same reason the upload
 * projection carries no key. A control described as more than it is, is how a
 * dead control keeps a live reputation.
 *
 * # WHY THERE IS NO SCOPE FLAG ON IT
 *
 * A design row only exists for an account that was inside
 * `CASTING_INK_STUDIO_SCOPE` when it uploaded. Gating the READ on a flag that
 * can move would make an owner's own stored picture unviewable the day the flag
 * changed under her — a refusal about our configuration wearing the shape of a
 * refusal about her design. The control here is ownership, and it is in the
 * statement.
 *
 * # THE TWO REFUSALS THAT ARE NOT ABOUT WHO IS ASKING
 *
 * 1. **The content type comes off the ROW and must be one the door can write.**
 *    Never sniffed, never from the request. `INK_DESIGN_FORMATS` is
 *    `png | jpeg | webp`, so there is no script-in-an-image question to answer
 *    here — and a row carrying anything else is a row this route refuses rather
 *    than guesses about. That branch is driven by its own test: an
 *    `image/svg+xml` row is refused, so the absence of SVG is a fact rather
 *    than a comment.
 * 2. **The bytes must be the bytes the row describes.** `digest` is the sha256
 *    of the object that was actually written (`inkUploadService.ts`), and the
 *    plate mint already refuses on a mismatch rather than drawing from an
 *    object that has moved. The same comparison holds here: a viewer is an
 *    instrument too, and showing her SOMETHING and captioning it as her design
 *    is exactly the failure the shown cut exists to prevent.
 *
 * # NO ETAG, AND THAT IS A DECISION
 *
 * The response is `private, no-store`: this is one person's picture behind an
 * authenticated route, and there is no shared cache it may sit in. An etag over
 * `no-store` is validation machinery that can never fire. The evidence route
 * has one because it serves grids that revalidate dozens of objects together;
 * a Cast holds at most eight designs and they are looked at, not scrolled.
 */

export const INK_DESIGN_DELIVERY_RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: INK_DESIGN_READS_PER_MINUTE,
  keyPrefix: "ink_design_delivery",
} satisfies RateLimitConfig;

/** `randomUUID`'s own shape — the only thing `publicId` is ever written from. */
const DESIGN_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * Every content type the upload door is capable of writing, derived from the
 * format list rather than spelled a second time (working law 4).
 */
const SERVABLE_CONTENT_TYPES: readonly string[] =
  INK_DESIGN_FORMATS.map(inkDesignContentType);

type DeliveryUser = {
  id: number;
  suspendedAt: Date | null;
  lockedUntil: Date | null;
};

export type InkDesignDeliveryDependencies = {
  authenticate: (req: Request) => Promise<DeliveryUser | null>;
  rateLimit: (userId: number) => { allowed: boolean; resetIn: number };
  load: (input: {
    userId: number;
    designPublicId: string;
  }) => Promise<StoredInkDesign | null>;
  readBytes: (key: string) => Promise<{ bytes: Buffer }>;
};

const productionDependencies: InkDesignDeliveryDependencies = {
  /* A room drawing several designs authenticates several times together.
     Authentication stays a fresh session and user read; it must not amplify
     that into several `lastSignedIn` writes. */
  authenticate: (req) => sdk.authenticateRequest(req, { recordActivity: false }),
  rateLimit: (userId) => checkUserRateLimit(userId, INK_DESIGN_DELIVERY_RATE_LIMIT),
  load: readInkDesign,
  readBytes: storageReadBytes,
};

/** Fixed-shape errors, so a probe learns nothing from the difference. */
function refuse(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
}

export function createInkDesignDeliveryRouter(
  dependencies: InkDesignDeliveryDependencies = productionDependencies,
) {
  const router = Router();

  router.get(
    INK_DESIGN_IMAGE_PATH_PREFIX + "/:designId",
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

      const designId = String(req.params.designId ?? "");
      if (!DESIGN_ID_PATTERN.test(designId)) {
        /* A malformed id is answered exactly the way a stranger's is: the
           statement below is never reached, and nothing about the difference
           reaches the caller. */
        refuse(res, 404, "Not found");
        return;
      }

      /*
        THE OWNER IS IN THE STATEMENT (invariant 1), and `readInkDesign` carries
        it on BOTH sides of the join — the design row's denormalized `userId`
        and the candidate's. A design belonging to somebody else and one that
        never existed are the same 404, so the response cannot be used to
        discover that an id is real.

        The user id is the AUTHENTICATED one (invariant 3). Nothing from the URL
        but the design's own name reaches this call.
      */
      let design: StoredInkDesign | null;
      try {
        design = await dependencies.load({ userId: user.id, designPublicId: designId });
      } catch (error) {
        log.error({ userId: user.id, err: error }, "[inkDesign] the design lookup failed");
        res.setHeader("Retry-After", "2");
        refuse(res, 503, "Try again shortly");
        return;
      }
      if (!design) {
        refuse(res, 404, "Not found");
        return;
      }

      if (!SERVABLE_CONTENT_TYPES.includes(design.mime)) {
        /* Not a caller's mistake and not a missing design — a row describing an
           object this product's own door cannot write. Refused rather than
           served under a guessed type. */
        log.error(
          { userId: user.id, designId, mime: design.mime },
          "[inkDesign] the row names a content type the upload door cannot write",
        );
        refuse(res, 500, "This design could not be served");
        return;
      }

      let stored: { bytes: Buffer };
      try {
        stored = await dependencies.readBytes(design.storageKey);
      } catch (error) {
        log.error(
          { userId: user.id, designId, err: error },
          "[inkDesign] the design's bytes could not be read",
        );
        refuse(res, 500, "This design could not be served");
        return;
      }

      /*
        THE BYTES ARE THE FACT. `digest` was taken off the object that was
        actually written, and the plate mint already refuses to draw from a
        design whose bytes have moved. Showing a customer a different object and
        captioning it as her design is precisely what the shown cut exists to
        prevent, so this route refuses on the same comparison rather than
        serving whatever is at the key.
      */
      const fetchedDigest = createHash("sha256").update(stored.bytes).digest("hex");
      if (fetchedDigest !== design.digest) {
        log.error(
          { userId: user.id, designId, byteSize: stored.bytes.byteLength },
          "[inkDesign] the object at the design's key is not the object the row describes",
        );
        refuse(res, 500, "This design could not be served");
        return;
      }

      res.setHeader("Content-Type", design.mime);
      /* The type is the row's and must not be second-guessed by a browser. */
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Disposition", "inline");
      /* One owner's picture behind an authenticated route — never in a shared
         cache, and never revalidated (see the header on why there is no etag). */
      res.setHeader("Cache-Control", "private, no-store");
      res.end(stored.bytes);
    },
  );

  return router;
}
