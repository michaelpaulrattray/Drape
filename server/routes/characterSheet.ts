import { Router, type Request, type Response } from "express";

import { sdk } from "../_core/sdk";
import { checkUserRateLimit } from "../security/rateLimit";
import { getOwnedCastByPublicId, listCastAssets } from "../db/castingV2Sign";
import { composeCharacterSheet } from "../castingV2/characterSheet";
import { loadSheetCells } from "../castingV2/characterSheetPack";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("routes/characterSheet");

/**
 * Composing a sheet costs a handful of R2 fetches and a sharp pass, so it is
 * cheaper than a generation and dearer than a database read. Bounded per user
 * accordingly — generous enough that downloading a roster never trips it.
 */
export const CHARACTER_SHEET_RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 20,
  keyPrefix: "character_sheet",
};

/**
 * The character sheet, downloaded.
 *
 * An Express route rather than a tRPC procedure because the answer is IMAGE
 * BYTES — the same reason `/api/evidence/:kind/:entityId` is one. It follows
 * that route's shape deliberately: authenticate, refuse a suspended or locked
 * account, rate-limit per user, and **re-prove ownership and liveness in the
 * statement that fetches the thing** rather than trusting anything the client
 * sent (access-control invariant 1).
 *
 * The sheet is composed on demand, every time. There is no stored copy to go
 * stale, no key to guess, and nothing to purge when the Cast is deleted —
 * `getOwnedCastByPublicId` excludes deleted and archived rows, so a deleted
 * Cast's sheet stops existing the moment she does.
 *
 * **This is the EXPORT rendering** — labelled, for a person. The unlabelled
 * reference rendering is never served over HTTP: it is composed in-process and
 * handed to an engine as bytes, because a URL is not something an image model
 * can eat and a lettered reference is something it would draw.
 */

export type CharacterSheetRouteDependencies = {
  authenticate: (req: Request) => Promise<{ id: number; suspendedAt: Date | null; lockedUntil: Date | null } | null>;
  loadCast: typeof getOwnedCastByPublicId;
  loadAssets: typeof listCastAssets;
};

const productionDependencies: CharacterSheetRouteDependencies = {
  authenticate: (req) => sdk.authenticateRequest(req, { recordActivity: false }),
  loadCast: getOwnedCastByPublicId,
  loadAssets: listCastAssets,
};

/** Fixed-shape errors, so a probe learns nothing from the difference. */
function refuse(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
}

export function createCharacterSheetRouter(
  dependencies: CharacterSheetRouteDependencies = productionDependencies,
) {
  const router = Router();

  router.get("/api/cast/:castId/sheet", async (req: Request, res: Response) => {
    const user = await dependencies.authenticate(req).catch(() => null);
    if (!user) {
      refuse(res, 401, "Authentication required");
      return;
    }
    if (user.suspendedAt || (user.lockedUntil && new Date(user.lockedUntil) > new Date())) {
      refuse(res, 403, "Access denied");
      return;
    }
    const rate = checkUserRateLimit(user.id, CHARACTER_SHEET_RATE_LIMIT);
    if (!rate.allowed) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil(rate.resetIn / 1000))));
      refuse(res, 429, "Too many requests");
      return;
    }

    const castId = String(req.params.castId ?? "");
    /*
      Owner AND liveness in one statement. A Cast that was deleted, archived or
      never belonged to this account is indistinguishable from one that does not
      exist — the 404 is the same either way, so a stranger cannot use the
      difference to discover that a Cast id is real.
    */
    const cast = await dependencies.loadCast(user.id, castId).catch(() => null);
    if (!cast) {
      refuse(res, 404, "Not found");
      return;
    }

    try {
      const cells = await loadSheetCells(await dependencies.loadAssets(user.id, cast.id));
      const sheet = await composeCharacterSheet(cells, "export");
      if (!sheet) {
        // She exists but has nothing in her pack yet — a building Cast. Not an
        // error, and not a blank image pretending to be one.
        refuse(res, 409, "This cast has no views yet");
        return;
      }
      const name = (cast.name ?? "cast").replace(/[^A-Za-z0-9-_]+/g, "-").slice(0, 40);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Content-Disposition", `attachment; filename="${name}-character-sheet.png"`);
      // Never cached by a shared cache: this is one owner's face behind an
      // authenticated route.
      res.setHeader("Cache-Control", "private, no-store");
      res.end(sheet);
    } catch (error) {
      log.error({ castId, err: error }, "[characterSheet] could not compose the sheet");
      refuse(res, 500, "The character sheet could not be built");
    }
  });

  return router;
}
