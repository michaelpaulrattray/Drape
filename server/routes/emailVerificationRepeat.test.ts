/**
 * A CUSTOMER WHO IS ALREADY VERIFIED IS TOLD SO, ON BOTH ROADS BACK — #2370.
 *
 * Driven over real HTTP against the real `emailVerificationRouter`, with the
 * database replaced by one in-memory `users` row that the route reads and
 * writes exactly the way it reads and writes the real table.
 *
 * # The two defects, and what each arm proves
 *
 * 1. **A second click on the verification link** (or the customer's first
 *    click after a mail scanner opened the link) said "Authentication Error".
 *    The success path cleared the token, so the repeat found no row and took
 *    `invalid_token`; the friendly branch was dead. The arms click the SAME
 *    link twice through the real route and read where the second one lands —
 *    and that it mints no session.
 * 2. **"Resend" for a verified address** showed "Verification email resent" and
 *    a countdown for an email that was never sent. The arms take the route's
 *    real JSON and feed it to the page's own reader (`readResendAnswer`), so the
 *    field the server writes and the field the page reads are proven to be the
 *    same field at the wire, not two spellings that happen to agree today.
 *
 * Controls on both sides: an unknown token is still refused, an expired one
 * still says expired, and an unverified address still gets a real "sent".
 */
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { baseUrlOf, listenOnFetchablePort } from "../testing/fetchablePort";

/**
 * `eq(column, value)` is replaced by a plain record the fake db can evaluate.
 * Everything else in drizzle is the real module.
 */
vi.mock("drizzle-orm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("drizzle-orm")>()),
  eq: (column: { name: string }, value: unknown) => ({ __eq: [column.name, value] }),
}));

type Row = {
  id: number;
  openId: string;
  name: string;
  email: string;
  emailVerified: boolean;
  emailVerificationToken: string | null;
  emailVerificationExpiresAt: Date | null;
};

let table: Row[] = [];

function matches(row: Row, cond: { __eq: [string, unknown] }): boolean {
  const [column, value] = cond.__eq;
  return (row as unknown as Record<string, unknown>)[column] === value;
}

const fakeDb = {
  select: () => ({
    from: () => ({
      where: (cond: { __eq: [string, unknown] }) => ({
        limit: async (n: number) => table.filter((row) => matches(row, cond)).slice(0, n).map((row) => ({ ...row })),
      }),
    }),
  }),
  update: () => ({
    set: (values: Partial<Row>) => ({
      where: async (cond: { __eq: [string, unknown] }) => {
        for (const row of table) if (matches(row, cond)) Object.assign(row, values);
      },
    }),
  }),
};

vi.mock("../db/connection", () => ({ getDb: vi.fn(async () => fakeDb) }));
vi.mock("../db/users", () => ({
  getUserByEmail: vi.fn(async (email: string) => table.find((row) => row.email === email) ?? null),
}));
vi.mock("../mail", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../mail")>()),
  sendProductEmail: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("../_core/sdk", () => ({
  sdk: { createSessionToken: vi.fn().mockResolvedValue("session-token-stand-in") },
}));
vi.mock("../auditLog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../auditLog")>()),
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../security/rateLimit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../security/rateLimit")>()),
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 9, resetIn: 0 })),
}));

import { COOKIE_NAME } from "@shared/const";

import { readResendAnswer } from "../../client/src/pages/VerifyEmail";
import { sendProductEmail } from "../mail";
import { emailVerificationRouter } from "./emailVerification";

const TOKEN = "a".repeat(96);

function customer(overrides: Partial<Row> = {}): Row {
  return {
    id: 7,
    openId: "email_customer",
    name: "A Customer",
    email: "customer@example.com",
    emailVerified: false,
    emailVerificationToken: TOKEN,
    emailVerificationExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    ...overrides,
  };
}

async function withServer<T>(drive: (origin: string) => Promise<T>): Promise<T> {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", emailVerificationRouter);
  const server = await listenOnFetchablePort((port) => app.listen(port, "127.0.0.1"));
  try {
    return await drive(baseUrlOf(server));
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

async function click(token: string): Promise<{ location: string | null; sessionMinted: boolean }> {
  return withServer(async (origin) => {
    const response = await fetch(`${origin}/api/auth/verify-email?token=${token}`, { redirect: "manual" });
    const cookies = response.headers.getSetCookie();
    return {
      location: response.headers.get("location"),
      sessionMinted: cookies.some((cookie) => cookie.startsWith(`${COOKIE_NAME}=`)),
    };
  });
}

async function resend(email: string): Promise<{ ok: boolean; data: unknown }> {
  return withServer(async (origin) => {
    const response = await fetch(`${origin}/api/auth/resend-verification`, {
      method: "POST",
      /* Same-origin, as the verify page sends it — the router carries the
         cross-site guard (#1659) and must let this through. */
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ email }),
    });
    return { ok: response.ok, data: await response.json() };
  });
}

beforeEach(() => {
  table = [customer()];
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("a repeat click on the verification link (#2370)", () => {
  it("the first click verifies and signs the customer in — the positive control", async () => {
    const first = await click(TOKEN);
    expect(first.location).toBe("/app");
    expect(first.sessionMinted).toBe(true);
    expect(table[0]!.emailVerified).toBe(true);
  });

  it("the SAME link clicked again lands on the calm already-verified note, not an error", async () => {
    await click(TOKEN);
    const second = await click(TOKEN);
    expect(
      second.location,
      "a second click on a used link must say the email is already verified; `invalid_token`"
      + " here is the generic \"Authentication Error\" banner the card was filed for",
    ).toBe("/login?error=already_verified");
  });

  it("and the repeat click mints NO session — the note is all it gets", async () => {
    await click(TOKEN);
    const second = await click(TOKEN);
    expect(second.sessionMinted).toBe(false);
  });

  it("a mail scanner opening the link first leaves the customer's own click calm too", async () => {
    /* The scanner's click is the first click; the customer's is the second. */
    const scanner = await click(TOKEN);
    expect(scanner.location).toBe("/app");
    const customersOwn = await click(TOKEN);
    expect(customersOwn.location).toBe("/login?error=already_verified");
    expect(customersOwn.sessionMinted).toBe(false);
  });

  it("an unknown token is still refused — the negative control", async () => {
    const driven = await click("b".repeat(96));
    expect(driven.location).toBe("/login?error=invalid_token");
    expect(driven.sessionMinted).toBe(false);
    expect(table[0]!.emailVerified).toBe(false);
  });

  it("an expired link for an unverified account still says expired, and mints nothing", async () => {
    table = [customer({ emailVerificationExpiresAt: new Date(Date.now() - 1000) })];
    const driven = await click(TOKEN);
    expect(driven.location).toBe("/login?error=token_expired");
    expect(driven.sessionMinted).toBe(false);
    expect(table[0]!.emailVerified).toBe(false);
  });
});

describe("pressing Resend for an address that is already verified (#2370)", () => {
  it("the page reads the real answer as already verified, not as sent", async () => {
    table = [customer({ emailVerified: true })];
    const answer = await resend("customer@example.com");
    expect(answer.ok).toBe(true);
    expect(readResendAnswer(answer.ok, answer.data)).toEqual({ kind: "already_verified" });
    expect(sendProductEmail).not.toHaveBeenCalled();
  });

  it("an unverified address still reads as sent, and an email really goes — the positive control", async () => {
    const answer = await resend("customer@example.com");
    expect(readResendAnswer(answer.ok, answer.data)).toEqual({ kind: "sent" });
    expect(sendProductEmail).toHaveBeenCalledTimes(1);
  });

  it("a refusal still reads as a failure carrying the server's own sentence", () => {
    expect(readResendAnswer(false, { error: "Too many attempts. Please try again later." }))
      .toEqual({ kind: "failed", error: "Too many attempts. Please try again later." });
    expect(readResendAnswer(false, {})).toEqual({ kind: "failed", error: "Failed to resend. Please try again." });
  });
});
