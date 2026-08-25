/**
 * THE EYE GALLERY'S BYTES — `/api/crew/eye-frame/:frameName` (issue #75).
 *
 * The founder, verbatim: *"when these things run and require my eyes is there
 * a gallery built into this page so i can genuinely view the tests with an
 * explaination about what im looking at?"* The gallery renders on
 * `/admin/crew`; this route is the only address its images load from.
 *
 * # THE ALLOWLIST IS THE DEPLOYED BRIEFING
 *
 * Frames live in the public bucket under `crew-eye/<uuid>.<ext>` — the same
 * protection class as the paid renders they usually show (random keys, never
 * listed). But this route does not serve "whatever is under the prefix": it
 * serves EXACTLY the keys the deployed briefing's `eyeItems` name, and answers
 * 404 for everything else. The briefing ships inside the bundle, so the
 * allowlist can only change by a deploy — the same honesty rule as reply
 * acknowledgement. A request is (1) authenticated fresh, (2) admin-only,
 * (3) inside CREW_TAB_SCOPE, (4) user-rate-limited, (5) checked against the
 * allowlist — and only then are bytes read, through the bounded image-only
 * reader the Sign package uses.
 *
 * # WHY 404 AND NOT 403 FOR flag-off and unknown keys
 *
 * Outside the scope the page does not exist (`crew.getState` answers
 * NOT_FOUND), so its images do not either — a distinct status would leak that
 * the surface is real but dark. An unknown key is genuinely not found.
 *
 * # LIFECYCLE, DECLARED
 *
 * A frame outlives its eye item in the bucket — there is no worker sweeping
 * `crew-eye/`. Declared scaffolding, not an oversight: the population is a
 * handful of court frames a week, git history names every key any edition
 * ever carried, and the Janitor's litter clock owns sweeping keys no edition
 * references. A worker arrives if the population ever stops being a handful.
 */
import { Router, type Request, type Response } from "express";

import type { User } from "../../drizzle/schema";
import { sdk } from "../_core/sdk";
import { eyeFrameKeys, readCrewBriefing } from "../crew/crewBriefing";
import { captureCrewTabEnabled } from "../crew/crewTabScope";
import { createModuleLogger } from "../logging/logger";
import {
  checkUserRateLimit,
  type RateLimitConfig,
} from "../security/rateLimit";
import { storageReadBytes } from "../storage";

const log = createModuleLogger("routes/crewEyeFrames");

/** One gallery is at most a few dozen images; a reload burst must fit. */
export const CREW_EYE_FRAME_RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 120,
  keyPrefix: "crew_eye_frame",
} satisfies RateLimitConfig;

/** The basename shape the briefing schema pins, re-proven at the request. */
const FRAME_NAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp)$/;

type CrewEyeUser = Pick<User, "id" | "role" | "suspendedAt" | "lockedUntil">;

export interface CrewEyeFrameRouteDependencies {
  authenticate(req: Request): Promise<CrewEyeUser>;
  crewTabEnabled(userId: number): boolean;
  rateLimit(userId: number): { allowed: boolean };
  servableKeys(): ReadonlySet<string>;
  readBytes(key: string): Promise<{ bytes: Buffer; contentType: string }>;
}

const productionDependencies: CrewEyeFrameRouteDependencies = {
  /* recordActivity false — a gallery load is a burst of image requests and
     must not amplify into a burst of lastSignedIn writes (the evidence
     route's own reasoning). */
  authenticate: (req) => sdk.authenticateRequest(req, { recordActivity: false }),
  crewTabEnabled: captureCrewTabEnabled,
  rateLimit: (userId) => checkUserRateLimit(userId, CREW_EYE_FRAME_RATE_LIMIT),
  servableKeys: () => eyeFrameKeys(readCrewBriefing()),
  readBytes: storageReadBytes,
};

function fixedError(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
}

export function createCrewEyeFrameRouter(
  dependencies: CrewEyeFrameRouteDependencies = productionDependencies,
): Router {
  const router = Router();

  router.get("/api/crew/eye-frame/:frameName", async (req: Request, res: Response) => {
    let user: CrewEyeUser;
    try {
      user = await dependencies.authenticate(req);
    } catch {
      fixedError(res, 401, "Authentication required");
      return;
    }

    if (user.suspendedAt || (user.lockedUntil && user.lockedUntil > new Date())) {
      fixedError(res, 403, "Account unavailable");
      return;
    }
    if (user.role !== "admin") {
      fixedError(res, 403, "Admin access required");
      return;
    }
    if (!dependencies.crewTabEnabled(user.id)) {
      /* Same sentence-shape as crew.getState: outside the scope, the surface
         does not exist. */
      fixedError(res, 404, "Not found");
      return;
    }
    if (!dependencies.rateLimit(user.id).allowed) {
      fixedError(res, 429, "Too many requests");
      return;
    }

    const frameName = req.params.frameName ?? "";
    if (!FRAME_NAME_PATTERN.test(frameName)) {
      fixedError(res, 404, "Not found");
      return;
    }
    const key = `crew-eye/${frameName}`;
    if (!dependencies.servableKeys().has(key)) {
      fixedError(res, 404, "Not found");
      return;
    }

    try {
      const { bytes, contentType } = await dependencies.readBytes(key);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Length", String(bytes.length));
      /* Private: an admin's browser may keep it; nothing shared may. The key
         is content-addressed-ish (a mint-time UUID), so an hour is safe. */
      res.setHeader("Cache-Control", "private, max-age=3600");
      res.end(bytes);
    } catch (cause) {
      /* A key the briefing names but the bucket lacks is a shift's upload
         mistake — logged loudly, answered plainly. */
      log.error({ key, err: cause }, "eye frame named by the briefing could not be read");
      fixedError(res, 502, "The frame could not be read from storage");
    }
  });

  return router;
}

const crewEyeFramesRouter = createCrewEyeFrameRouter();
export default crewEyeFramesRouter;
