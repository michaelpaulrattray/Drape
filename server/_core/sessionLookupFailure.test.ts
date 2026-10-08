/**
 * A DATABASE HICCUP NEVER SIGNS A CUSTOMER OUT — #1990.
 *
 * Reproduced by accident while rendering #1962: `account.exportData` saturated
 * the pool, the very next call with the SAME valid cookie answered
 * `401 "Please login (10001)"`, and the client — which redirects on exactly
 * that string — sent the customer to the sign-in page. The chain was
 * `createContext`'s one catch-all: every failure inside `authenticateRequest`,
 * including a database that could not be reached, became `user = null`.
 *
 * Driven at the wire: the REAL `createContext`, the REAL `sdk` (a real minted
 * session cookie verified by the real `jwtVerify`), the REAL `protectedProcedure`
 * and `publicProcedure` (with their real error formatter and cross-site guard),
 * over the REAL express adapter on a loopback port. Only the database module
 * is substituted, because the database's failure IS the subject.
 *
 * Both halves are asserted, and the rejection half is the one that matters
 * most on an auth surface: a session that is absent, malformed, or whose user
 * is genuinely not in the database must STILL be refused with the sign-in
 * message (CLAUDE.md: "A session whose user is missing from the DB is rejected
 * outright"). A fix that answered 503 to everything would pass every
 * "not signed out" arm here and quietly stop refusing deleted accounts.
 */
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";

import { COOKIE_NAME, UNAUTHED_ERR_MSG } from "@shared/const";
import { baseUrlOf, listenOnFetchablePort } from "../testing/fetchablePort";

type DbState = {
  available: boolean;
  lookup: "found" | "missing" | "throws";
  activityWriteThrows: boolean;
};

const dbState: DbState = { available: true, lookup: "found", activityWriteThrows: false };

const KNOWN_OPEN_ID = "open-id-1990";

function userRow() {
  return {
    id: 1990,
    openId: KNOWN_OPEN_ID,
    name: "Verify",
    email: "verify@example.test",
    role: "user",
    approved: true,
    suspendedAt: null,
    lockedUntil: null,
  };
}

vi.mock("../db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db")>();
  return {
    ...actual,
    getDb: vi.fn(async () => (dbState.available ? ({} as never) : null)),
    getUserByOpenId: vi.fn(async (openId: string) => {
      if (dbState.lookup === "throws") {
        // The shape mysql2 gives a saturated pool, wrapped the way drizzle wraps it.
        throw Object.assign(new Error("Failed query: select … from `users`"), {
          cause: Object.assign(new Error("Queue limit reached."), { code: "POOL_ENQUEUELIMIT" }),
        });
      }
      if (dbState.lookup === "missing") return undefined;
      return openId === KNOWN_OPEN_ID ? userRow() : undefined;
    }),
    upsertUser: vi.fn(async () => {
      if (dbState.activityWriteThrows) throw new Error("read ECONNRESET");
    }),
  };
});

const { createContext, SESSION_CHECK_UNAVAILABLE_MESSAGE } = await import("./context");
const { sdk } = await import("./sdk");
const { router, protectedProcedure, publicProcedure } = await import("./trpc");

const probeRouter = router({
  whoami: protectedProcedure.mutation(({ ctx }) => ({ id: ctx.user.id })),
  hello: publicProcedure.mutation(({ ctx }) => ({ signedIn: Boolean(ctx.user) })),
});

let server: Server;

beforeAll(async () => {
  const app = express();
  app.use("/api/trpc", createExpressMiddleware({ router: probeRouter, createContext }));
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
  dbState.activityWriteThrows = false;
});

type WireAnswer = {
  status: number;
  code?: string;
  message?: string;
  data?: unknown;
};

async function call(path: "whoami" | "hello", cookie?: string): Promise<WireAnswer> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cookie !== undefined) headers.cookie = `${COOKIE_NAME}=${cookie}`;
  const response = await fetch(`${baseUrlOf(server)}/api/trpc/${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ json: null }),
  });
  const parsed = JSON.parse(await response.text()) as {
    result?: { data?: { json?: unknown } };
    error?: { json?: { message?: string; data?: { code?: string } } };
  };
  if (parsed.error?.json) {
    return {
      status: response.status,
      code: parsed.error.json.data?.code,
      message: parsed.error.json.message,
    };
  }
  return { status: response.status, data: parsed.result?.data?.json };
}

async function validCookie(): Promise<string> {
  return sdk.createSessionToken(KNOWN_OPEN_ID, { name: "Verify" });
}

function expectSignedOut(answer: WireAnswer) {
  expect(answer.status).toBe(401);
  expect(answer.code).toBe("UNAUTHORIZED");
  // The client's redirect keys on this exact string — this is the sign-out.
  expect(answer.message).toBe(UNAUTHED_ERR_MSG);
}

function expectNotSignedOut(answer: WireAnswer) {
  expect(answer.status).toBe(503);
  expect(answer.code).toBe("SERVICE_UNAVAILABLE");
  expect(answer.message).toBe(SESSION_CHECK_UNAVAILABLE_MESSAGE);
  expect(answer.message).not.toBe(UNAUTHED_ERR_MSG);
}

describe("#1990 — a refused session is still refused", () => {
  it("no cookie at all → the sign-in message", async () => {
    expectSignedOut(await call("whoami"));
  });

  it("a malformed cookie → the sign-in message", async () => {
    expectSignedOut(await call("whoami", "not-a-jwt"));
  });

  it("a valid cookie whose user is genuinely NOT in the database → the sign-in message", async () => {
    dbState.lookup = "missing";
    expectSignedOut(await call("whoami", await validCookie()));
  });

  it("a public procedure with no cookie still answers, as a stranger", async () => {
    const answer = await call("hello");
    expect(answer.status).toBe(200);
    expect(answer.data).toEqual({ signedIn: false });
  });
});

describe("#1990 — a session that could not be CHECKED is not a sign-out", () => {
  it("positive control: the harness can succeed — valid cookie, healthy database", async () => {
    const answer = await call("whoami", await validCookie());
    expect(answer.status).toBe(200);
    expect(answer.data).toEqual({ id: 1990 });
  });

  it("the user lookup THROWS (a saturated pool) → 503, never the sign-in message", async () => {
    dbState.lookup = "throws";
    expectNotSignedOut(await call("whoami", await validCookie()));
  });

  it("the database handle is unavailable → 503, never read as 'User not found'", async () => {
    dbState.available = false;
    expectNotSignedOut(await call("whoami", await validCookie()));
  });

  it("the activity write throws after the user was found → 503, never the sign-in message", async () => {
    dbState.activityWriteThrows = true;
    expectNotSignedOut(await call("whoami", await validCookie()));
  });

  it("a public procedure does not silently proceed as a stranger when the lookup failed", async () => {
    dbState.lookup = "throws";
    expectNotSignedOut(await call("hello", await validCookie()));
  });
});
