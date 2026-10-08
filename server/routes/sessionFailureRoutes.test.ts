/**
 * A DATABASE HICCUP NEVER READS AS "SIGN IN" ON THE SIX AUTHENTICATED EXPRESS
 * ROUTES — #1997, the Express sibling of #1990.
 *
 * Each route used to read ANY throw from `sdk.authenticateRequest` as
 * `401 Authentication required` (`catch {}` on three, `.catch(() => null)` on
 * three), so a signed-in customer's pictures answered "sign in" while the
 * database blinked.
 *
 * Driven at the wire: each route's PRODUCTION router (its factory called with
 * no arguments, so the production `authenticate` dependency — the real
 * `sdk.authenticateRequest` — is what runs), a real minted session cookie
 * through the real `jwtVerify`, over the real express stack on loopback. Only
 * the database module is substituted, because the database's failure IS the
 * subject. Every arm here is decided before any other dependency of a route is
 * touched (the suspended-account refusal is each route's very next gate).
 *
 * The refusal half matters most on an auth surface: no cookie, a bad cookie,
 * and a user who is genuinely not in the database must STILL be 401. A route
 * that answered 503 to everything would pass the "try again" arms and quietly
 * stop refusing deleted accounts — so both halves run on all six.
 */
import express from "express";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { COOKIE_NAME } from "@shared/const";
import { INK_DESIGN_IMAGE_PATH_PREFIX } from "@shared/inkDesignDelivery";
import { REFERENCE_IMAGE_PATH_PREFIX } from "@shared/referenceDelivery";
import { baseUrlOf, listenOnFetchablePort } from "../testing/fetchablePort";

/* Test-only values, set before env.ts can freeze them (see #1990's suite). */
vi.hoisted(() => {
  process.env.JWT_SECRET = "drape-test-session-secret-1997-not-a-real-credential";
  process.env.VITE_APP_ID = "drape-test-app-1997";
});

type DbState = {
  available: boolean;
  lookup: "found" | "missing" | "throws";
  suspended: boolean;
};

const dbState: DbState = { available: true, lookup: "found", suspended: true };

const KNOWN_OPEN_ID = "open-id-1997";

vi.mock("../db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db")>();
  return {
    ...actual,
    getDb: vi.fn(async () => (dbState.available ? ({} as never) : null)),
    getUserByOpenId: vi.fn(async (openId: string) => {
      if (dbState.lookup === "throws") {
        throw Object.assign(new Error("Failed query: select … from `users`"), {
          cause: Object.assign(new Error("Queue limit reached."), { code: "POOL_ENQUEUELIMIT" }),
        });
      }
      if (dbState.lookup === "missing" || openId !== KNOWN_OPEN_ID) return undefined;
      return {
        id: 1997,
        openId: KNOWN_OPEN_ID,
        name: "Verify",
        email: "verify@example.test",
        role: "admin",
        approved: true,
        suspendedAt: dbState.suspended ? new Date("2026-01-01T00:00:00Z") : null,
        lockedUntil: null,
      };
    }),
    upsertUser: vi.fn(async () => undefined),
  };
});

const { sdk } = await import("../_core/sdk");
const { createImageProxyRouter } = await import("./imageProxy");
const { createEvidenceDeliveryRouter } = await import("./evidenceDelivery");
const { createCharacterSheetRouter } = await import("./characterSheet");
const { createInkDesignDeliveryRouter } = await import("./inkDesignDelivery");
const { createReferenceDeliveryRouter } = await import("./referenceDelivery");
const { createCrewEyeFrameRouter } = await import("./crewEyeFrames");

/** Each route, its production router, a path it serves, and its suspended-account answer. */
const ROUTES = [
  {
    name: "image proxy",
    router: createImageProxyRouter(),
    path: `/api/image-proxy?url=${encodeURIComponent("https://pub-test.r2.dev/casting/head.png")}`,
    suspended: "Access denied",
  },
  {
    name: "evidence",
    router: createEvidenceDeliveryRouter(),
    path: "/api/evidence/plate/10000000-0000-4000-8000-000000000001",
    suspended: "Access denied",
  },
  {
    name: "character sheet",
    router: createCharacterSheetRouter(),
    path: "/api/cast/KI-TEST/sheet",
    suspended: "Access denied",
  },
  {
    name: "ink design",
    router: createInkDesignDeliveryRouter(),
    path: `${INK_DESIGN_IMAGE_PATH_PREFIX}/design-1997`,
    suspended: "Access denied",
  },
  {
    name: "reference",
    router: createReferenceDeliveryRouter(),
    path: `${REFERENCE_IMAGE_PATH_PREFIX}/reference-1997`,
    suspended: "Access denied",
  },
  {
    name: "crew eye frame",
    router: createCrewEyeFrameRouter(),
    path: "/api/crew/eye-frame/frame-1997.png",
    suspended: "Account unavailable",
  },
] as const;

let server: Server;

beforeAll(async () => {
  const app = express();
  for (const route of ROUTES) app.use(route.router);
  server = await listenOnFetchablePort((port) => app.listen(port, "127.0.0.1"));
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

beforeEach(() => {
  dbState.available = true;
  dbState.lookup = "found";
  dbState.suspended = true;
});

async function get(path: string, cookie?: string): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = {};
  if (cookie !== undefined) headers.cookie = `${COOKIE_NAME}=${cookie}`;
  const response = await fetch(`${baseUrlOf(server)}${path}`, { headers });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // not JSON — left as text so a failing arm shows what came back
  }
  return { status: response.status, body };
}

async function validCookie(): Promise<string> {
  return sdk.createSessionToken(KNOWN_OPEN_ID, { name: "Verify" });
}

const SIGN_IN = { status: 401, body: { error: "Authentication required" } };
const TRY_AGAIN = { status: 503, body: { error: "Try again shortly" } };

describe.each(ROUTES)("#1997 — $name", (route) => {
  it("positive control: a valid session reaches the route's next gate (the suspended-account refusal)", async () => {
    expect(await get(route.path, await validCookie())).toEqual({
      status: 403,
      body: { error: route.suspended },
    });
  });

  it("no cookie → still 401", async () => {
    expect(await get(route.path)).toEqual(SIGN_IN);
  });

  it("a malformed cookie → still 401", async () => {
    expect(await get(route.path, "not-a-jwt")).toEqual(SIGN_IN);
  });

  it("a valid cookie whose user is genuinely NOT in the database → still 401", async () => {
    dbState.lookup = "missing";
    expect(await get(route.path, await validCookie())).toEqual(SIGN_IN);
  });

  it("the user lookup THROWS (a saturated pool) → 503, never 'sign in'", async () => {
    dbState.lookup = "throws";
    expect(await get(route.path, await validCookie())).toEqual(TRY_AGAIN);
  });

  it("the database handle is unavailable → 503, never 'sign in'", async () => {
    dbState.available = false;
    expect(await get(route.path, await validCookie())).toEqual(TRY_AGAIN);
  });
});
