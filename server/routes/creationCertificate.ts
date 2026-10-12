import { createHash } from "node:crypto";
import { Router, type Request, type Response } from "express";

import { answerForSessionFailure, sdk } from "../_core/sdk";
import { checkUserRateLimit } from "../security/rateLimit";
import { getOwnedCastByPublicId, readCastOriginalAnchorKey } from "../db/castingV2Sign";
import { getCastCreationRecord } from "../db/castCreationRecords";
import { ensureCastCreationRecord } from "../castingV2/creationRecordService";
import {
  prepareCertificateMaster,
  readSignedRecord,
  renderCreationCertificate,
} from "../castingV2/creationCertificate";
import {
  CREATION_RECORD_PRIVATE_KEY_VARIABLE,
  loadCreationRecordKey,
  type CreationRecordPublicJwk,
} from "../castingV2/creationRecordSigning";
import { storageReadBytes } from "../storage";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("routes/creationCertificate");

/**
 * Rendering reads the master from storage and draws a PDF, and the FIRST
 * request for an older cast also signs and stamps its record. Bounded per user
 * the way the character sheet is — the room's own probe (a HEAD on page load,
 * a couple of retries while a stamp lands) stays far inside it.
 */
const CREATION_CERTIFICATE_RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 20,
  keyPrefix: "creation_certificate",
};

/**
 * THE CERTIFICATE OF CREATION, downloaded — N2d-2 (#2312).
 *
 * `GET /api/cast/:castId/certificate` answers the owner's PDF. `HEAD` on the
 * same path is the room's question "is there one to offer?" — it runs the same
 * door and the same record road and answers 200 with no body, so the button is
 * drawn only when a download would succeed (design §5: *"until a token lands
 * the certificate simply does not offer itself"*).
 *
 * The character sheet route's shape, clause for clause: authenticate, refuse a
 * suspended or locked account, rate-limit per user, and **re-prove the owner
 * and the cast's liveness in the statement that loads it** —
 * `getOwnedCastByPublicId` scopes owner + not deleted + not archived, and the
 * record itself is read through `getCastCreationRecord`, which joins the live
 * signed cast in its own statement. A deleted cast's certificate is the same
 * 404 as a cast that never existed (the tombstone already scrubbed the model,
 * and the record died inside the deletion's transaction).
 *
 * **Behind `CASTING_CREATION_RECORD_SCOPE`.** Off for this account, the record
 * road answers `dark` before any statement runs and this route answers 404 —
 * the same "nothing here" a stranger gets, so the room draws no button.
 *
 * **Backfill on first request.** A cast signed before the record existed gets
 * its record here, through `ensureCastCreationRecord` — that entrance's first
 * production caller. A stamp that has not landed yet answers 409, and the
 * next request retries it.
 *
 * ⚠ **Nothing from the recipe reaches the document.** The `models` row the
 * owner check loads is used for its id and its name and nothing else; the
 * document is drawn from the signed record (bound-checked twice — at signing
 * and again in the renderer) and the master picture, which the owner may see.
 */

export type CreationCertificateRouteDependencies = {
  authenticate: (req: Request) => Promise<{ id: number; suspendedAt: Date | null; lockedUntil: Date | null } | null>;
  loadCast: (userId: number, castId: string) => Promise<{ id: number; name: string | null } | null>;
  ensureRecord: (input: { userId: number; modelId: number }) => ReturnType<typeof ensureCastCreationRecord>;
  loadRecord: typeof getCastCreationRecord;
  loadMasterKey: typeof readCastOriginalAnchorKey;
  readBytes: (key: string) => Promise<{ bytes: Buffer }>;
  publicKey: () => { kid: string; publicJwk: CreationRecordPublicJwk } | null;
};

const productionDependencies: CreationCertificateRouteDependencies = {
  authenticate: (req) => sdk.authenticateRequest(req, { recordActivity: false }),
  /* Only the id and the name leave this statement's result — the recipe
     columns the row also carries go no further than this line. */
  loadCast: async (userId, castId) => {
    const cast = await getOwnedCastByPublicId(userId, castId);
    return cast ? { id: cast.id, name: cast.name ?? null } : null;
  },
  ensureRecord: (input) => ensureCastCreationRecord({}, input),
  loadRecord: getCastCreationRecord,
  loadMasterKey: readCastOriginalAnchorKey,
  readBytes: storageReadBytes,
  publicKey: () => {
    try {
      const key = loadCreationRecordKey(process.env[CREATION_RECORD_PRIVATE_KEY_VARIABLE]);
      return { kid: key.kid, publicJwk: key.publicJwk };
    } catch {
      return null;
    }
  },
};

/** Fixed-shape errors, so a probe learns nothing from the difference. */
function refuse(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
}

export function createCreationCertificateRouter(
  dependencies: CreationCertificateRouteDependencies = productionDependencies,
) {
  const router = Router();

  /* Express answers HEAD with the GET handler; `req.method` tells them apart. */
  router.get("/api/cast/:castId/certificate", async (req: Request, res: Response) => {
    const probe = req.method === "HEAD";
    let user: Awaited<ReturnType<CreationCertificateRouteDependencies["authenticate"]>>;
    try {
      user = await dependencies.authenticate(req);
    } catch (error) {
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
    const rate = checkUserRateLimit(user.id, CREATION_CERTIFICATE_RATE_LIMIT);
    if (!rate.allowed) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil(rate.resetIn / 1000))));
      refuse(res, 429, "Too many requests");
      return;
    }

    const castId = String(req.params.castId ?? "");
    let cast: Awaited<ReturnType<CreationCertificateRouteDependencies["loadCast"]>>;
    try {
      cast = await dependencies.loadCast(user.id, castId);
    } catch (error) {
      log.error({ castId, err: error }, "[creationCertificate] could not load the cast");
      refuse(res, 503, "Try again shortly");
      return;
    }
    if (!cast) {
      refuse(res, 404, "Not found");
      return;
    }

    try {
      const outcome = await dependencies.ensureRecord({ userId: user.id, modelId: cast.id });
      /* Dark for this account, or a cast this road cannot certify (not a
         signed cast, not finished, no master): the same 404 as no cast. */
      if (outcome.kind !== "recorded") {
        refuse(res, 404, "Not found");
        return;
      }
      const record = await dependencies.loadRecord(user.id, cast.id);
      if (!record) {
        refuse(res, 404, "Not found");
        return;
      }
      if (!record.timestampToken || !record.stampedAt) {
        refuse(res, 409, "The certificate is not ready yet");
        return;
      }
      if (probe) {
        res.setHeader("Cache-Control", "private, no-store");
        res.status(200).end();
        return;
      }

      const signed = readSignedRecord(record.recordJson);
      const masterKey = await dependencies.loadMasterKey(user.id, cast.id);
      if (!masterKey) throw new Error("the cast has no master picture to print");
      const { bytes } = await dependencies.readBytes(masterKey);
      /* The picture printed beside the fingerprint IS the fingerprinted one,
         proven here rather than assumed — a certificate whose picture and
         fingerprint disagree would fail the first check anyone ran. */
      const digest = createHash("sha256").update(bytes).digest("hex");
      if (digest !== signed.master.sha256) {
        throw new Error("the master picture no longer matches the record's fingerprint");
      }
      const key = dependencies.publicKey();
      const pdf = renderCreationCertificate({
        castName: cast.name,
        recordJson: record.recordJson,
        signature: record.signature,
        signingKeyId: record.signingKeyId,
        publicJwk: key && key.kid === record.signingKeyId ? key.publicJwk : null,
        timestampTokenBase64: record.timestampToken,
        stampedAt: record.stampedAt,
        master: await prepareCertificateMaster(bytes),
      });
      const name = (cast.name ?? "cast").replace(/[^A-Za-z0-9-_]+/g, "-").slice(0, 40) || "cast";
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${name}-certificate-of-creation.pdf"`);
      res.setHeader("Cache-Control", "private, no-store");
      res.end(pdf);
    } catch (error) {
      log.error({ castId, err: error }, "[creationCertificate] could not build the certificate");
      refuse(res, 500, "The certificate could not be built");
    }
  });

  return router;
}
