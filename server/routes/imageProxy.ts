/**
 * Authenticated image proxy for same-origin download and clipboard actions.
 *
 * Server-owned URL validation, redirect refusal, timeout, byte cap and
 * magic-byte verification all live in `fetchTrustedImage`.
 */
import { Router, type Request, type Response } from "express";
import type { User } from "../../drizzle/schema";
import { sdk } from "../_core/sdk";
import { createModuleLogger } from "../logging/logger";
import {
  checkUserRateLimit,
  rateLimitError,
  type RateLimitConfig,
} from "../security/rateLimit";
import {
  fetchTrustedImage,
  type TrustedImage,
} from "../security/trustedImageFetch";
import { validateProxyUrl } from "../security/urlValidator";

const log = createModuleLogger("imageProxy");

const IMAGE_PROXY_RATE_LIMIT = {
  windowMs: 60 * 1000,
  maxRequests: 60,
  keyPrefix: "image_proxy",
} satisfies RateLimitConfig;

type ImageProxyUser = Pick<User, "id" | "suspendedAt" | "lockedUntil">;

type ImageProxyDependencies = {
  authenticateRequest(req: Request): Promise<ImageProxyUser>;
  fetchImage(url: string): Promise<TrustedImage>;
  rateLimit(userId: number): {
    allowed: boolean;
    remaining: number;
    resetIn: number;
  };
};

const productionDependencies: ImageProxyDependencies = {
  authenticateRequest: (req) => sdk.authenticateRequest(req),
  fetchImage: (url) => fetchTrustedImage(url),
  rateLimit: (userId) => checkUserRateLimit(userId, IMAGE_PROXY_RATE_LIMIT),
};

export function isAllowedUrl(url: string): boolean {
  return validateProxyUrl(url).valid;
}

function safeDownloadFilename(url: string, mime: TrustedImage["mime"]): string {
  const fallbackExtension = mime === "image/jpeg" ? "jpg" : mime.slice("image/".length);
  let candidate = "";
  try {
    const encoded = new URL(url).pathname.split("/").pop() ?? "";
    candidate = decodeURIComponent(encoded);
  } catch {
    // The URL was already validated; a malformed path escape only affects the
    // optional filename and must not become response-header input.
  }
  const safe = candidate.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 128);
  return safe || `drape-image.${fallbackExtension}`;
}

function fixedError(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
}

export function createImageProxyRouter(
  dependencies: ImageProxyDependencies = productionDependencies,
) {
  const router = Router();

  router.get("/api/image-proxy", async (req: Request, res: Response) => {
    let user: ImageProxyUser;
    try {
      user = await dependencies.authenticateRequest(req);
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
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil(rate.resetIn / 1000))));
      fixedError(res, 429, rateLimitError(rate.resetIn));
      return;
    }

    const url = typeof req.query.url === "string" ? req.query.url : "";
    const download = req.query.download === "1";
    if (!url) {
      fixedError(res, 400, "Missing url parameter");
      return;
    }
    if (!isAllowedUrl(url)) {
      fixedError(res, 403, "URL not allowed");
      return;
    }

    try {
      const image = await dependencies.fetchImage(url);
      res.setHeader("Content-Type", image.mime);
      res.setHeader("Cache-Control", "private, max-age=3600");
      if (download) {
        const filename = safeDownloadFilename(url, image.mime);
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      }
      res.status(200).send(image.bytes);
    } catch (error) {
      log.warn(
        {
          userId: user.id,
          errorType: error instanceof Error ? error.name : "unknown",
        },
        "Image proxy fetch refused",
      );
      fixedError(res, 502, "Image unavailable");
    }
  });

  return router;
}

export default createImageProxyRouter();
