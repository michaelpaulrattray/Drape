import { Router, type Request, type Response } from "express";
import type { User } from "../../drizzle/schema";
import { EVIDENCE_DELIVERY_REQUESTS_PER_MINUTE } from "../../shared/evidenceDelivery";
import { sdk } from "../_core/sdk";
import type {
  EvidenceStorageKind,
  PrivateEvidenceStorageAdapter,
} from "../casting/evidence/evidenceDelivery";
import {
  prepareEvidenceHttpRead,
  type AuthorizedEvidenceDelivery,
} from "../casting/evidence/evidenceDeliveryHttp";
import { getEvidenceDeliveryAdapter } from "../casting/evidence/evidenceDeliveryRuntime";
import { readOwnedEvidenceDelivery } from "../db/evidenceDelivery";
import { createModuleLogger } from "../logging/logger";
import {
  checkUserRateLimit,
  type RateLimitConfig,
} from "../security/rateLimit";

const log = createModuleLogger("routes/evidenceDelivery");
const ENTITY_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const EVIDENCE_DELIVERY_RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: EVIDENCE_DELIVERY_REQUESTS_PER_MINUTE,
  keyPrefix: "evidence_delivery",
} satisfies RateLimitConfig;

type EvidenceDeliveryUser = Pick<User, "id" | "suspendedAt" | "lockedUntil">;

export interface EvidenceDeliveryRouteDependencies {
  authenticate(req: Request): Promise<EvidenceDeliveryUser>;
  rateLimit(userId: number): {
    allowed: boolean;
    resetIn: number;
  };
  load(input: {
    userId: number;
    kind: EvidenceStorageKind;
    entityId: string;
  }): Promise<AuthorizedEvidenceDelivery | null>;
  adapter(): PrivateEvidenceStorageAdapter | null;
  jwtSecret(): string;
}

const productionDependencies: EvidenceDeliveryRouteDependencies = {
  // Image grids can revalidate dozens of objects together. Authentication
  // remains a fresh session/user read, but must not amplify that burst into
  // dozens of lastSignedIn writes.
  authenticate: (req) => sdk.authenticateRequest(req, { recordActivity: false }),
  rateLimit: (userId) => checkUserRateLimit(
    userId,
    EVIDENCE_DELIVERY_RATE_LIMIT,
  ),
  load: readOwnedEvidenceDelivery,
  adapter: () => getEvidenceDeliveryAdapter(),
  jwtSecret: () => process.env.JWT_SECRET ?? "",
};

function fixedError(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
}

function waitForDrainOrClose(res: Response): Promise<void> {
  return new Promise((resolve) => {
    const settle = () => {
      res.off("drain", settle);
      res.off("close", settle);
      resolve();
    };
    res.once("drain", settle);
    res.once("close", settle);
  });
}

function routeIdentity(req: Request): {
  kind: EvidenceStorageKind;
  entityId: string;
} | null {
  const kind = req.params.kind;
  const entityId = req.params.entityId;
  if (
    (kind !== "plate" && kind !== "crop")
    || typeof entityId !== "string"
    || !ENTITY_ID_PATTERN.test(entityId)
  ) {
    return null;
  }
  return { kind, entityId };
}

export function createEvidenceDeliveryRouter(
  dependencies: EvidenceDeliveryRouteDependencies = productionDependencies,
) {
  const router = Router();
  router.get(
    "/api/evidence/:kind/:entityId",
    async (req: Request, res: Response) => {
      let user: EvidenceDeliveryUser;
      try {
        user = await dependencies.authenticate(req);
      } catch {
        fixedError(res, 401, "Authentication required");
        return;
      }
      if (
        user.suspendedAt
        || (user.lockedUntil && new Date(user.lockedUntil) > new Date())
      ) {
        fixedError(res, 403, "Access denied");
        return;
      }
      const rate = dependencies.rateLimit(user.id);
      if (!rate.allowed) {
        res.setHeader(
          "Retry-After",
          String(Math.max(1, Math.ceil(rate.resetIn / 1000))),
        );
        fixedError(res, 429, "Evidence image requests are temporarily limited");
        return;
      }
      const identity = routeIdentity(req);
      if (!identity) {
        fixedError(res, 404, "Evidence image not found");
        return;
      }
      let evidence: AuthorizedEvidenceDelivery | null;
      try {
        evidence = await dependencies.load({
          userId: user.id,
          ...identity,
        });
      } catch (error) {
        log.warn({
          userId: user.id,
          entityId: identity.entityId,
          errorType: error instanceof Error ? error.name : "unknown",
        }, "Evidence authority lookup failed");
        res.setHeader("Retry-After", "2");
        fixedError(res, 503, "Evidence image is temporarily unavailable");
        return;
      }
      if (!evidence) {
        fixedError(res, 404, "Evidence image not found");
        return;
      }
      const adapter = dependencies.adapter();
      if (!adapter) {
        res.setHeader("Retry-After", "2");
        fixedError(res, 503, "Evidence image is temporarily unavailable");
        return;
      }

      let objectAbort: (() => void) | undefined;
      const abort = () => objectAbort?.();
      const close = () => {
        if (!res.writableEnded) abort();
      };
      req.once("aborted", abort);
      res.once("close", close);
      try {
        const prepared = await prepareEvidenceHttpRead({
          adapter,
          evidence,
          jwtSecret: dependencies.jwtSecret(),
          ifNoneMatch: req.get("if-none-match"),
        });
        res.setHeader("ETag", prepared.etag);
        res.setHeader("Cache-Control", "private, no-cache");
        res.setHeader("Vary", "Cookie");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
        if (prepared.status === "not_modified") {
          res.status(304).end();
          return;
        }
        objectAbort = prepared.object.abort;
        if (req.aborted || res.destroyed) {
          objectAbort();
          return;
        }
        res.setHeader("Content-Type", "image/webp");
        res.setHeader("Content-Length", String(prepared.object.byteSize));
        res.status(200);
        for await (const chunk of prepared.object.body) {
          if (res.destroyed) return;
          if (!res.write(Buffer.from(chunk))) await waitForDrainOrClose(res);
        }
        res.end();
      } catch (error) {
        log.warn({
          userId: user.id,
          entityId: identity.entityId,
          errorType: error instanceof Error ? error.name : "unknown",
        }, "Evidence delivery refused");
        if (res.headersSent) {
          res.destroy();
        } else {
          res.setHeader("Retry-After", "2");
          fixedError(res, 503, "Evidence image is temporarily unavailable");
        }
      } finally {
        objectAbort?.();
        req.off("aborted", abort);
        res.off("close", close);
      }
    },
  );
  return router;
}

export default createEvidenceDeliveryRouter();
