/**
 * A DATABASE BLINK ON A COLD PAGE LOAD DOES NOT SEND A SIGNED-IN CUSTOMER TO
 * THE SIGN-IN PAGE — #1997, the client half of #1990.
 *
 * The pages that guard themselves (the lobby at `/app`, the studio, the admin
 * pages) read `useAuth()`'s `!loading && !user` as "signed out" and redirect.
 * With `retry: false`, one failed `auth.me` on first load produced exactly that
 * pair. This suite drives `auth.me`'s REAL options (`AUTH_ME_QUERY_OPTIONS`,
 * the object the hook passes) through react-query's real retry machinery,
 * against a real tRPC server stack — #1990's real `createContext`, the real
 * `sdk` with a real minted cookie, the real `publicProcedure` and error
 * formatter, the real `httpBatchLink` with the app's transformer — so the
 * error the client classifies is the one the server actually sends. Only the
 * database module is substituted.
 *
 * The redirect condition is read off the observer exactly as the hook builds
 * it: `user = data ?? null`, `loading = isLoading`.
 */
import express from "express";
import type { Server } from "node:http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createTRPCClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import superjson from "superjson";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { COOKIE_NAME } from "@shared/const";
import { baseUrlOf, listenOnFetchablePort } from "../../../../server/testing/fetchablePort";

vi.hoisted(() => {
  process.env.JWT_SECRET = "drape-test-session-secret-1997c-not-a-real-credential";
  process.env.VITE_APP_ID = "drape-test-app-1997c";
});

const KNOWN_OPEN_ID = "open-id-1997c";
const dbState = { lookupFailuresLeft: 0, missing: false, lookups: 0 };

vi.mock("../../../../server/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../server/db")>();
  return {
    ...actual,
    getDb: vi.fn(async () => ({}) as never),
    getUserByOpenId: vi.fn(async () => {
      dbState.lookups += 1;
      if (dbState.lookupFailuresLeft > 0) {
        dbState.lookupFailuresLeft -= 1;
        throw Object.assign(new Error("Failed query: select … from `users`"), {
          cause: Object.assign(new Error("Queue limit reached."), { code: "POOL_ENQUEUELIMIT" }),
        });
      }
      if (dbState.missing) return undefined;
      return {
        id: 1997,
        openId: KNOWN_OPEN_ID,
        name: "Verify",
        email: "verify@example.test",
        role: "user",
        approved: true,
        suspendedAt: null,
        lockedUntil: null,
      };
    }),
    upsertUser: vi.fn(async () => undefined),
  };
});

const { createContext } = await import("../../../../server/_core/context");
const { sdk } = await import("../../../../server/_core/sdk");
const { router, publicProcedure } = await import("../../../../server/_core/trpc");
const { AUTH_ME_QUERY_OPTIONS, isTransientSessionCheckFailure } = await import("./useAuth");

/* `auth.me`'s own shape (server/routes/auth.ts): null for a stranger. */
const probeRouter = router({
  me: publicProcedure.query(({ ctx }) => (ctx.user ? { id: ctx.user.id } : null)),
});
type ProbeRouter = typeof probeRouter;

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
  dbState.lookupFailuresLeft = 0;
  dbState.missing = false;
  dbState.lookups = 0;
});

async function clientWith(cookie: string | null) {
  return createTRPCClient<ProbeRouter>({
    links: [
      httpBatchLink({
        url: `${baseUrlOf(server)}/api/trpc`,
        transformer: superjson,
        headers: cookie ? { cookie: `${COOKIE_NAME}=${cookie}` } : {},
      }),
    ],
  });
}

type Seen = { user: unknown; loading: boolean; status: string };

/**
 * Run `auth.me` through a real QueryObserver with the given retry option and
 * record every state the hook would have rendered, until it settles.
 */
async function observe(
  retry: (typeof AUTH_ME_QUERY_OPTIONS)["retry"] | false,
  cookie: string | null,
): Promise<Seen[]> {
  const client = await clientWith(cookie);
  const queryClient = new QueryClient();
  const observer = new QueryObserver(queryClient, {
    queryKey: ["auth.me"],
    queryFn: () => client.me.query(),
    ...AUTH_ME_QUERY_OPTIONS,
    retry,
    retryDelay: 5, // react-query's real retry loop, without its real 1s/2s/4s waits
  });
  const seen: Seen[] = [];
  const record = () => {
    const r = observer.getCurrentResult();
    seen.push({ user: r.data ?? null, loading: r.isLoading, status: r.status });
  };
  await new Promise<void>((resolve) => {
    const unsubscribe = observer.subscribe((r) => {
      record();
      if (r.status !== "pending") {
        unsubscribe();
        resolve();
      }
    });
    record();
  });
  queryClient.clear();
  return seen;
}

/** The redirect condition every self-guarding page applies. */
const wouldRedirect = (s: Seen) => !s.loading && s.user === null;

describe("#1997 — auth.me on a cold load", () => {
  it("positive control: a healthy check signs the customer in, no redirect", async () => {
    const seen = await observe(AUTH_ME_QUERY_OPTIONS.retry, await sdk.createSessionToken(KNOWN_OPEN_ID, { name: "Verify" }));
    expect(seen.at(-1)).toMatchObject({ status: "success", user: { id: 1997 } });
    expect(seen.some(wouldRedirect)).toBe(false);
  });

  it("a database blink on first load (two failed lookups) is waited out — never a moment that would redirect", async () => {
    dbState.lookupFailuresLeft = 2;
    const seen = await observe(AUTH_ME_QUERY_OPTIONS.retry, await sdk.createSessionToken(KNOWN_OPEN_ID, { name: "Verify" }));
    expect(dbState.lookups).toBe(3);
    expect(seen.at(-1)).toMatchObject({ status: "success", user: { id: 1997 } });
    expect(seen.some(wouldRedirect)).toBe(false);
  });

  it("negative control: the OLD options (`retry: false`) on the same blink produce the redirect state", async () => {
    dbState.lookupFailuresLeft = 2;
    const seen = await observe(false, await sdk.createSessionToken(KNOWN_OPEN_ID, { name: "Verify" }));
    expect(seen.at(-1)).toMatchObject({ status: "error", user: null, loading: false });
    expect(seen.some(wouldRedirect)).toBe(true);
  });

  it("a genuinely refused session (user not in the database) still settles signed-out at once, without retrying", async () => {
    dbState.missing = true;
    const seen = await observe(AUTH_ME_QUERY_OPTIONS.retry, await sdk.createSessionToken(KNOWN_OPEN_ID, { name: "Verify" }));
    expect(dbState.lookups).toBe(1);
    expect(seen.at(-1)).toMatchObject({ status: "success", user: null, loading: false });
    expect(wouldRedirect(seen.at(-1)!)).toBe(true);
  });

  it("no cookie at all still settles signed-out at once", async () => {
    const seen = await observe(AUTH_ME_QUERY_OPTIONS.retry, null);
    expect(seen.at(-1)).toMatchObject({ status: "success", user: null, loading: false });
  });
});

describe("#1997 — which failures are worth waiting out", () => {
  const withStatus = (httpStatus: number) =>
    new TRPCClientError("x", { result: { error: { code: -1, message: "x", data: { httpStatus } } } as never });

  it("5xx and 429 are a check that could not finish", () => {
    expect(isTransientSessionCheckFailure(withStatus(503))).toBe(true);
    expect(isTransientSessionCheckFailure(withStatus(500))).toBe(true);
    expect(isTransientSessionCheckFailure(withStatus(429))).toBe(true);
  });

  it("an answer that never arrived (no status) is a check that could not finish", () => {
    expect(isTransientSessionCheckFailure(new TRPCClientError("fetch failed"))).toBe(true);
  });

  it("a deterministic refusal is not retried", () => {
    expect(isTransientSessionCheckFailure(withStatus(401))).toBe(false);
    expect(isTransientSessionCheckFailure(withStatus(403))).toBe(false);
    expect(isTransientSessionCheckFailure(withStatus(400))).toBe(false);
    expect(isTransientSessionCheckFailure(new Error("not a tRPC error"))).toBe(false);
  });
});
