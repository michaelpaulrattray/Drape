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
 * it: `user = data ?? null`, `loading = isSessionCheckPending(result)` — the
 * hook's own function, imported, so this suite cannot read a different
 * condition from the one the hook renders (#2026).
 */
import express from "express";
import type { Server } from "node:http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createTRPCClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import { focusManager, onlineManager, QueryClient, QueryObserver } from "@tanstack/react-query";
import superjson from "superjson";
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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
const {
  AUTH_ME_QUERY_OPTIONS,
  AUTH_ME_RECONNECTING_AFTER_FAILURES,
  isSessionCheckPending,
  isSessionCheckReconnecting,
  isTransientSessionCheckFailure,
} = await import("./useAuth");

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

type Seen = { user: unknown; loading: boolean; status: string; reconnecting: boolean };

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
    seen.push({
      user: r.data ?? null,
      loading: isSessionCheckPending(r),
      status: r.status,
      reconnecting: isSessionCheckReconnecting(r),
    });
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

/**
 * #2018 — A SUSTAINED OUTAGE SAYS SO, A BLINK DOES NOT. Driven through the same
 * real stack: `reconnecting` is read off the real observer result exactly as
 * the hook reads it (`isSessionCheckReconnecting(meQuery)`).
 */
describe("#2018 — when the wait becomes something to say", () => {
  const token = () => sdk.createSessionToken(KNOWN_OPEN_ID, { name: "Verify" });

  it("a sustained outage turns `reconnecting` on after the threshold, keeps retrying, and clears on recovery", async () => {
    dbState.lookupFailuresLeft = AUTH_ME_RECONNECTING_AFTER_FAILURES + 2;
    const seen = await observe(AUTH_ME_QUERY_OPTIONS.retry, await token());
    expect(dbState.lookups).toBe(AUTH_ME_RECONNECTING_AFTER_FAILURES + 3);
    expect(seen.some((s) => s.reconnecting)).toBe(true);
    // Only ever while still loading — never alongside a settled answer.
    expect(seen.filter((s) => s.reconnecting).every((s) => s.loading)).toBe(true);
    expect(seen.at(-1)).toMatchObject({ status: "success", user: { id: 1997 }, reconnecting: false });
    expect(seen.some(wouldRedirect)).toBe(false);
  });

  it("negative control: a blink one short of the threshold never shows it", async () => {
    dbState.lookupFailuresLeft = AUTH_ME_RECONNECTING_AFTER_FAILURES - 1;
    const seen = await observe(AUTH_ME_QUERY_OPTIONS.retry, await token());
    expect(seen.at(-1)).toMatchObject({ status: "success", user: { id: 1997 } });
    expect(seen.some((s) => s.reconnecting)).toBe(false);
  });

  it("a healthy load never shows it", async () => {
    const seen = await observe(AUTH_ME_QUERY_OPTIONS.retry, await token());
    expect(seen.some((s) => s.reconnecting)).toBe(false);
  });

  it("a genuinely refused session never shows it and still settles signed-out at once", async () => {
    dbState.missing = true;
    const seen = await observe(AUTH_ME_QUERY_OPTIONS.retry, await token());
    expect(seen.some((s) => s.reconnecting)).toBe(false);
    expect(wouldRedirect(seen.at(-1)!)).toBe(true);
  });

  it("a signed-in page whose background re-check keeps failing is NOT replaced by the notice", async () => {
    const client = await clientWith(await token());
    const queryClient = new QueryClient();
    const observer = new QueryObserver(queryClient, {
      queryKey: ["auth.me"],
      queryFn: () => client.me.query(),
      ...AUTH_ME_QUERY_OPTIONS,
      retryDelay: 5,
    });
    const seen: { reconnecting: boolean; failureCount: number; hasUser: boolean }[] = [];
    const unsubscribe = observer.subscribe((r) => {
      seen.push({
        reconnecting: isSessionCheckReconnecting(r),
        failureCount: r.failureCount,
        hasUser: r.data != null,
      });
    });
    await observer.refetch(); // the first load succeeds
    dbState.lookupFailuresLeft = AUTH_ME_RECONNECTING_AFTER_FAILURES + 2;
    await observer.refetch(); // a background re-check rides out a sustained outage
    unsubscribe();
    queryClient.clear();
    // The re-check really did fail past the threshold while the user was on screen…
    expect(seen.some((s) => s.hasUser && s.failureCount >= AUTH_ME_RECONNECTING_AFTER_FAILURES)).toBe(true);
    // …and the page was never swapped for the notice.
    expect(seen.some((s) => s.reconnecting)).toBe(false);
  });
});

/**
 * #2026 — A PAUSED RETRY IS STILL WAITING. In react-query v5 `isLoading` is
 * `isPending && isFetching`; a retry paused by a background tab or the browser
 * going offline has `fetchStatus: 'paused'`, so `isLoading` reads false with no
 * answer yet — and the hook used to read that as signed out. Driven with
 * react-query's own `onlineManager` / `focusManager`, through the same real
 * stack, with the hook's own `isSessionCheckPending` / `isSessionCheckReconnecting`.
 */
describe("#2026 — a paused session check is still a session check", () => {
  const token = () => sdk.createSessionToken(KNOWN_OPEN_ID, { name: "Verify" });

  afterEach(() => {
    onlineManager.setOnline(true);
    focusManager.setFocused(undefined);
  });

  type PausedSeen = Seen & { fetchStatus: string; oldIsLoading: boolean };

  /**
   * Fail the check past the reconnect threshold, then `pause()` (offline or
   * hidden tab) before the next retry; record every state until the retry is
   * PAUSED; then `resume()` with the database healthy and record until it
   * settles.
   */
  async function pauseMidRetry(pause: () => void, resume: () => void) {
    const client = await clientWith(await token());
    const queryClient = new QueryClient();
    queryClient.mount(); // subscribes the cache to onlineManager / focusManager, as the app's provider does
    const observer = new QueryObserver(queryClient, {
      queryKey: ["auth.me"],
      queryFn: () => client.me.query(),
      ...AUTH_ME_QUERY_OPTIONS,
      retryDelay: 5,
    });
    dbState.lookupFailuresLeft = 1000;
    const seen: PausedSeen[] = [];
    let paused = false;
    const settled = new Promise<void>((resolve) => {
      const reachedPause = new Promise<void>((onPaused) => {
        const unsubscribe = observer.subscribe((r) => {
          seen.push({
            user: r.data ?? null,
            loading: isSessionCheckPending(r),
            status: r.status,
            reconnecting: isSessionCheckReconnecting(r),
            fetchStatus: r.fetchStatus,
            oldIsLoading: r.isLoading,
          });
          if (!paused && r.failureCount >= AUTH_ME_RECONNECTING_AFTER_FAILURES) {
            paused = true;
            pause();
          }
          if (r.fetchStatus === "paused") onPaused();
          if (r.status !== "pending") {
            unsubscribe();
            resolve();
          }
        });
      });
      void reachedPause.then(async () => {
        // Sit paused for a while: nothing may move toward a redirect.
        await new Promise((r) => setTimeout(r, 60));
        dbState.lookupFailuresLeft = 0;
        resume();
      });
    });
    await settled;
    queryClient.unmount();
    queryClient.clear();
    return seen;
  }

  for (const [name, pause, resume] of [
    ["the browser goes offline", () => onlineManager.setOnline(false), () => onlineManager.setOnline(true)],
    ["the tab goes to the background", () => focusManager.setFocused(false), () => focusManager.setFocused(true)],
  ] as const) {
    it(`${name} mid-retry: still loading, still reconnecting, never a redirect — and it recovers`, async () => {
      const seen = await pauseMidRetry(pause, resume);
      const pausedStates = seen.filter((s) => s.fetchStatus === "paused");
      // The instrument really reached the case: the retry was paused with no answer…
      expect(pausedStates.length).toBeGreaterThan(0);
      expect(pausedStates.every((s) => s.user === null && s.status === "pending")).toBe(true);
      // …negative control: the OLD reading (`isLoading`) called that state settled-and-signed-out.
      expect(pausedStates.every((s) => s.oldIsLoading === false)).toBe(true);
      // The hook's reading: still waiting, and saying so.
      expect(pausedStates.every((s) => s.loading && s.reconnecting)).toBe(true);
      expect(seen.some(wouldRedirect)).toBe(false);
      // On resume it carries on and signs the customer in.
      expect(seen.at(-1)).toMatchObject({ status: "success", user: { id: 1997 }, reconnecting: false });
    });
  }

  it("offline before the very first check: waits (no redirect, nothing to say yet) and checks on reconnect", async () => {
    onlineManager.setOnline(false);
    const client = await clientWith(await token());
    const queryClient = new QueryClient();
    queryClient.mount();
    const observer = new QueryObserver(queryClient, {
      queryKey: ["auth.me"],
      queryFn: () => client.me.query(),
      ...AUTH_ME_QUERY_OPTIONS,
      retryDelay: 5,
    });
    const seen: PausedSeen[] = [];
    const settled = new Promise<void>((resolve) => {
      const unsubscribe = observer.subscribe((r) => {
        seen.push({
          user: r.data ?? null,
          loading: isSessionCheckPending(r),
          status: r.status,
          reconnecting: isSessionCheckReconnecting(r),
          fetchStatus: r.fetchStatus,
          oldIsLoading: r.isLoading,
        });
        if (r.status !== "pending") {
          unsubscribe();
          resolve();
        }
      });
    });
    await new Promise((r) => setTimeout(r, 30));
    const whileOffline = observer.getCurrentResult();
    expect(whileOffline.fetchStatus).toBe("paused");
    expect(dbState.lookups).toBe(0);
    expect(whileOffline.isLoading).toBe(false); // the old reading would have redirected here
    expect(isSessionCheckPending(whileOffline)).toBe(true);
    expect(isSessionCheckReconnecting(whileOffline)).toBe(false);
    onlineManager.setOnline(true);
    await settled;
    queryClient.unmount();
    queryClient.clear();
    expect(seen.some(wouldRedirect)).toBe(false);
    expect(seen.at(-1)).toMatchObject({ status: "success", user: { id: 1997 } });
  });

  it("a genuinely refused session still redirects at once even when the tab is in the background", async () => {
    focusManager.setFocused(false);
    dbState.missing = true;
    const seen = await observe(AUTH_ME_QUERY_OPTIONS.retry, await token());
    expect(dbState.lookups).toBe(1);
    expect(seen.some((s) => s.reconnecting)).toBe(false);
    expect(wouldRedirect(seen.at(-1)!)).toBe(true);
  });
});

/**
 * #2026 — THE HOOK READS THE FUNCTION THE SUITE DRIVES. There is no DOM
 * renderer in this repository's test stack, so `useAuth` itself is not
 * mounted; the arms above drive `isSessionCheckPending` /
 * `isSessionCheckReconnecting` through the real query machinery, and this arm
 * holds the hook's body to those functions. It is a reading of the source,
 * and says so: it proves the hook's `loading`, its redirect guard and its
 * `reconnecting` cannot quietly go back to `isLoading`.
 */
describe("#2026 — the hook keys on the driven functions", () => {
  const source = readFileSync(new URL("./useAuth.ts", import.meta.url), "utf8");
  const start = source.indexOf("export function useAuth(");
  const body = source.slice(start);

  it("the hook body is found (positive control on the slice)", () => {
    expect(start).toBeGreaterThan(0);
    expect(body).toContain("trpc.auth.me.useQuery");
  });

  it("`loading`, the redirect guard and `reconnecting` read the driven functions, and nothing reads `isLoading`", () => {
    expect(body).toMatch(/loading:\s*isSessionCheckPending\(meQuery\)/);
    expect(body).toMatch(/if \(isSessionCheckPending\(meQuery\) \|\| logoutMutation\.isPending\) return;/);
    expect(body).toMatch(/reconnecting:\s*isSessionCheckReconnecting\(meQuery\)/);
    expect(body).not.toMatch(/\.isLoading\b/);
  });
});
