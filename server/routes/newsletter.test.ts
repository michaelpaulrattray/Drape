import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { appRouter } from "../routers";
import { testConnection as klaviyoTestConnection } from "../klaviyo";
import type { TrpcContext } from "../_core/context";
import type { User } from "../../drizzle/schema";

/**
 * #2372 — `newsletter.testConnection` was a staff debug control ("admin/debug
 * only", said its comment) declared `protectedProcedure`, so any approved
 * customer could make the server call the email provider with the company's
 * private key, unthrottled. Nothing in the product called it, the admin panel
 * included, so it is deleted.
 *
 * The arms go through tRPC's real request handler over the real `appRouter`,
 * as an ordinary approved customer (`role: "user"`), with the global `fetch`
 * stubbed so no request can leave the machine — and the decisive assertion is
 * not the status code but that the stub saw ZERO outbound requests. The
 * reproduction on the card saw one per call.
 *
 * The positive controls are what make the refusal mean something:
 *   - the same harness, same customer, still gets a 200 from a real procedure,
 *     so a 404 is the missing procedure and not a broken harness;
 *   - the stub DOES see the provider call when the provider helper is called
 *     directly, so "zero requests" is a reading the instrument can get wrong.
 */

function anApprovedCustomer(): User {
  return {
    id: 4242,
    openId: "newsletter-fixture",
    name: "A Customer",
    email: "fixture@example.com",
    approved: true,
    role: "user",
    suspendedAt: null,
    lockedUntil: null,
  } as unknown as User;
}

async function callAsCustomer(path: string): Promise<Response> {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: new Request(`http://localhost/api/trpc/${path}`, { method: "GET" }),
    router: appRouter,
    createContext: (): TrpcContext =>
      ({
        user: anApprovedCustomer(),
        req: { headers: {}, socket: {} } as unknown as TrpcContext["req"],
        res: {} as unknown as TrpcContext["res"],
        correlationId: "newsletter-test",
      }) as TrpcContext,
  });
}

let outbound: string[];

beforeEach(() => {
  outbound = [];
  // A placeholder key, so the provider helper gets as far as its request —
  // without one it fails before `fetch` and every "zero requests" reading
  // below would be true for the wrong reason.
  vi.stubEnv("KLAVIYO_PRIVATE_KEY", "pk_fixture_not_a_real_key");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      outbound.push(String(input instanceof Request ? input.url : input));
      return new Response("{}", { status: 200 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("newsletter.testConnection — a customer cannot reach the email provider's debug check", () => {
  it("REFUSES an approved role:user caller, and no request reaches the provider", async () => {
    const response = await callAsCustomer("newsletter.testConnection");
    expect(response.status).not.toBe(200);
    expect([403, 404]).toContain(response.status);
    expect(outbound).toEqual([]);
  });

  it("refuses it on every call, not only the first (the card's 20-call loop)", async () => {
    for (let i = 0; i < 20; i += 1) {
      const response = await callAsCustomer("newsletter.testConnection");
      expect(response.status).not.toBe(200);
    }
    expect(outbound).toEqual([]);
  });

  it("is absent from the router — deleted, not merely hidden", () => {
    const procedures = (appRouter as unknown as { _def: { procedures: Record<string, unknown> } })
      ._def.procedures;
    expect(Object.keys(procedures)).not.toContain("newsletter.testConnection");
    // The neighbour that is meant to stay.
    expect(Object.keys(procedures)).toContain("newsletter.subscribe");
  });
});

describe("the controls that make the refusal mean something", () => {
  it("the same customer, same harness, still gets a 200 from a real procedure", async () => {
    const response = await callAsCustomer("credits.getCosts");
    expect(response.status).toBe(200);
  });

  it("the stub does see a provider request when one is made", async () => {
    await klaviyoTestConnection();
    expect(outbound).toHaveLength(1);
    expect(outbound[0]).toContain("/lists");
  });
});

/**
 * #2446 — `newsletter.subscribe` answered "This email is already on the list."
 * (and `isNew: false`) for an address the email provider already held, and
 * "Welcome! You've been subscribed…" for a new one: an address oracle on a
 * public endpoint. Driven through tRPC's real request handler over the real
 * `appRouter` and the real provider helper, with only the provider's HTTP
 * answer stubbed — 201 for a new profile, 409 for one it already has.
 */
describe("newsletter.subscribe gives every address the same answer (#2446)", () => {
  let ipSeq = 0;

  function stubProvider(existing: Set<string>) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        outbound.push(String(input instanceof Request ? input.url : input));
        const email = JSON.parse(String(init?.body ?? "{}"))?.data?.attributes?.email;
        return existing.has(email)
          ? new Response(JSON.stringify({ errors: [{ code: "duplicate_profile" }] }), { status: 409 })
          : new Response(JSON.stringify({ data: { id: "prof_fixture" } }), { status: 201 });
      }),
    );
  }

  async function subscribe(email: string): Promise<{ status: number; body: unknown }> {
    ipSeq += 1;
    const response = await fetchRequestHandler({
      endpoint: "/api/trpc",
      req: new Request("http://localhost/api/trpc/newsletter.subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json: { email } }),
      }),
      router: appRouter,
      createContext: (): TrpcContext =>
        ({
          user: null,
          // A fresh address per call, so the per-IP limit never decides an arm.
          req: { headers: {}, socket: {}, ip: `203.0.113.${ipSeq}` } as unknown as TrpcContext["req"],
          res: {} as unknown as TrpcContext["res"],
          correlationId: "newsletter-test",
        }) as TrpcContext,
    });
    return { status: response.status, body: (await response.json())?.result?.data?.json };
  }

  it("a new address and one already on the list get the same status and the same body", async () => {
    stubProvider(new Set(["known@example.com"]));
    const fresh = await subscribe("fresh@example.com");
    const known = await subscribe("known@example.com");
    expect(fresh.status).toBe(200);
    expect(known.status).toBe(200);
    expect(known.body).toEqual(fresh.body);
    expect(fresh.body).toEqual({ success: true, message: "You're on the list." });
  });

  it("the provider really told the two apart — the control that makes the sameness mean something", async () => {
    stubProvider(new Set(["known@example.com"]));
    const { newsletterSignup } = await import("../klaviyo");
    expect((await newsletterSignup("fresh@example.com")).isNew).toBe(true);
    expect((await newsletterSignup("known@example.com")).isNew).toBe(false);
  });

  it("a provider failure is still a refusal, not a pretend success — the negative control", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    const failed = await subscribe("anyone@example.com");
    expect(failed.status).toBe(500);
  });
});
