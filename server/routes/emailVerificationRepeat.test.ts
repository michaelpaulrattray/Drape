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
 *    a countdown for an email that was never sent. Since #2446 the route gives
 *    every address one answer, so the page no longer claims anything was sent;
 *    the arms feed the route's real JSON to the page's own reader
 *    (`readResendAnswer`) and check what really went out.
 *
 * Controls on both sides: an unknown token is still refused, an expired one
 * still says expired, and an unverified address still really gets an email.
 */
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { baseUrlOf, listenOnFetchablePort } from "../testing/fetchablePort";

/* `ENV` freezes `process.env.JWT_SECRET` at import, and the link mac (#2401)
   signs with it. A checkout with no `.env` (CI) would leave it empty, and the
   route then issues unsigned links that can never be recognised as replaced —
   so a stand-in is planted BEFORE the module graph loads, and only where the
   real one is absent (the same shape as `googleAuth.test.ts`). */
vi.hoisted(() => {
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = "drape-test-link-secret-not-a-real-credential";
  }
});

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
import { emailVerificationRouter, generateVerificationToken, issuedLinkAccount } from "./emailVerification";

const TOKEN = "a".repeat(96);

function customer(overrides: Partial<Row> = {}): Row {
  return {
    id: 7,
    openId: "email_3f2b8c1e-9d4a-4c6b-8e2f-1a7d5c9b0e43",
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

/** The send happens after the answer (#2446), so an arm that reads it waits for it. */
async function delivered(): Promise<void> {
  await vi.waitFor(() => expect(sendProductEmail).toHaveBeenCalled());
}

/** Long enough for any work behind the answer to have run, for arms asserting it did not. */
async function afterTheAnswer(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 50));
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

describe("pressing Resend for an address that is already verified (#2370, #2446)", () => {
  it("sends nothing, keeps the token, and the page does not claim an email went", async () => {
    table = [customer({ emailVerified: true })];
    const answer = await resend("customer@example.com");
    expect(answer.ok).toBe(true);
    expect(readResendAnswer(answer.ok, answer.data)).toEqual({ kind: "answered" });
    await afterTheAnswer();
    expect(sendProductEmail).not.toHaveBeenCalled();
    expect(table[0]!.emailVerificationToken).toBe(TOKEN);
  });

  it("an unverified address really gets an email — the positive control", async () => {
    const answer = await resend("customer@example.com");
    expect(readResendAnswer(answer.ok, answer.data)).toEqual({ kind: "answered" });
    await delivered();
    expect(sendProductEmail).toHaveBeenCalledTimes(1);
  });

  it("a refusal still reads as a failure carrying the server's own sentence", () => {
    expect(readResendAnswer(false, { error: "Too many attempts. Please try again later." }))
      .toEqual({ kind: "failed", error: "Too many attempts. Please try again later." });
    expect(readResendAnswer(false, {})).toEqual({ kind: "failed", error: "Failed to resend. Please try again." });
  });
});

/**
 * ONE ANSWER, WHOEVER ASKS — #2446.
 *
 * The resend route used to answer an unknown address, a verified one and an
 * unverified one three different ways, so anyone could test an email against
 * the account list. The arms put all three through the real route and compare
 * the status and the parsed body; then they prove the answer is written BEFORE
 * any email is sent, by holding the send open and reading the answer anyway —
 * the timing half of the same oracle.
 */
describe("the resend route tells a stranger nothing about the address (#2446)", () => {
  beforeEach(() => {
    table = [
      customer(),
      customer({
        id: 8,
        openId: "email_9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
        email: "verified@example.com",
        emailVerified: true,
        emailVerificationToken: "d".repeat(96),
      }),
    ];
  });

  it("an unknown, a verified and an unverified address get the same status and body", async () => {
    const unknown = await resend("nobody@example.com");
    const verified = await resend("verified@example.com");
    const unverified = await resend("customer@example.com");
    expect(unknown.ok).toBe(true);
    expect(verified).toEqual(unknown);
    expect(unverified).toEqual(unknown);
    expect(unknown.data).toEqual({ success: true, message: "If that address needs verifying, we've sent a new link." });
  });

  it("only the unverified account is sent anything — and it really is sent", async () => {
    await resend("nobody@example.com");
    await resend("verified@example.com");
    await afterTheAnswer();
    expect(sendProductEmail).not.toHaveBeenCalled();
    await resend("customer@example.com");
    await delivered();
    expect(sendProductEmail).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(sendProductEmail).mock.calls[0]![0])).toContain("customer@example.com");
  });

  it("the answer arrives while the email is still being sent — no timing difference to read", async () => {
    let release: (() => void) | undefined;
    vi.mocked(sendProductEmail).mockImplementationOnce(
      () => new Promise((resolve) => { release = () => resolve({ success: true }); }),
    );
    const answer = await resend("customer@example.com");
    expect(answer.data).toEqual({ success: true, message: "If that address needs verifying, we've sent a new link." });
    await delivered();
    release?.();
  });

  it("a failed send is still the same answer — the outcome is logged, never told", async () => {
    vi.mocked(sendProductEmail).mockResolvedValueOnce({ success: false, error: "provider down" });
    const failed = await resend("customer@example.com");
    const unknown = await resend("nobody@example.com");
    expect(failed).toEqual(unknown);
  });

  it("a malformed address is still refused — the negative control", async () => {
    const bad = await resend("not-an-email");
    expect(bad.ok).toBe(false);
    expect(readResendAnswer(bad.ok, bad.data)).toEqual({ kind: "failed", error: "Invalid email address" });
  });
});

/**
 * AN OLDER LINK AFTER ASKING FOR A NEW EMAIL — #2401.
 *
 * The customer registers (email one), presses Resend (email two, which REPLACES
 * the token), then opens email one. Driven through the real resend route so the
 * replacement is the route's own write, not a row the test edits by hand.
 */
describe("an older verification link after a resend (#2401)", () => {
  const OLD = generateVerificationToken(customer().openId);

  beforeEach(() => {
    table = [customer({ emailVerificationToken: OLD })];
  });

  it("the resend really replaces the stored token — the premise, driven", async () => {
    await resend("customer@example.com");
    await delivered();
    expect(table[0]!.emailVerificationToken).not.toBe(OLD);
    expect(table[0]!.emailVerificationToken).not.toBeNull();
  });

  it("the older link lands on the replaced note, verifies nothing and mints no session", async () => {
    await resend("customer@example.com");
    await delivered();
    const replacement = table[0]!.emailVerificationToken;
    const driven = await click(OLD);
    expect(
      driven.location,
      "an older link must tell the customer to use the newest email; `invalid_token` here is"
      + " the generic \"Authentication Error\" banner the card was filed for",
    ).toBe("/login?error=verification_link_replaced");
    expect(driven.sessionMinted).toBe(false);
    expect(table[0]!.emailVerified).toBe(false);
    expect(table[0]!.emailVerificationToken, "the older link must not disturb the newest one").toBe(replacement);
  });

  it("the newest link still verifies and signs in — the positive control", async () => {
    await resend("customer@example.com");
    await delivered();
    const driven = await click(table[0]!.emailVerificationToken!);
    expect(driven.location).toBe("/app");
    expect(driven.sessionMinted).toBe(true);
    expect(table[0]!.emailVerified).toBe(true);
  });

  it("the older link opened AFTER the newest one verified says already verified, and mints nothing", async () => {
    await resend("customer@example.com");
    await delivered();
    await click(table[0]!.emailVerificationToken!);
    const driven = await click(OLD);
    expect(driven.location).toBe("/login?error=already_verified");
    expect(driven.sessionMinted).toBe(false);
  });

  it("a link with a forged signature is still the generic refusal — the negative control", async () => {
    const [id, nonce] = OLD.split(".");
    const forged = `${id}.${nonce}.${"0".repeat(32)}`;
    await resend("customer@example.com");
    await delivered();
    const driven = await click(forged);
    expect(driven.location).toBe("/login?error=invalid_token");
    expect(driven.sessionMinted).toBe(false);
  });

  it("a signed link cannot be re-pointed at another account by editing its openId", async () => {
    /* The second account exists and is unverified, so a re-pointed link that
       were believed would be told "replaced" — the mac must refuse it first. */
    const OTHER = "email_7c1d0e2a-4b3f-4a8e-9c6d-2e5f8a1b3c70";
    table.push(customer({ id: 8, openId: OTHER, email: "other@example.com", emailVerificationToken: "c".repeat(96) }));
    const [, nonce, mac] = OLD.split(".");
    const driven = await click(`${OTHER}.${nonce}.${mac}`);
    expect(driven.location).toBe("/login?error=invalid_token");
    expect(driven.sessionMinted).toBe(false);
    expect(table[1]!.emailVerified).toBe(false);
  });

  it("the link carries the openId and never the sequential account id", () => {
    expect(OLD.startsWith(`${customer().openId}.`)).toBe(true);
    expect(OLD.startsWith("7.")).toBe(false);
  });

  it("a genuinely signed link for an account that no longer exists is the generic refusal", async () => {
    const driven = await click(generateVerificationToken("email_00000000-0000-4000-8000-000000000000"));
    expect(driven.location).toBe("/login?error=invalid_token");
    expect(driven.sessionMinted).toBe(false);
  });

  it("every link fits the 128-character column, and names the account it was issued for", () => {
    /* An email account's openId: `email_` + a uuid, 42 characters — the real shape. */
    const emailOpenId = customer().openId;
    expect(emailOpenId).toHaveLength(42);
    const token = generateVerificationToken(emailOpenId);
    expect(token).toHaveLength(108);
    expect(issuedLinkAccount(token)).toBe(emailOpenId);
    /* The longest openId that is signed lands exactly on the column's limit. */
    const longest = "x".repeat(62);
    expect(generateVerificationToken(longest)).toHaveLength(128);
    expect(issuedLinkAccount(generateVerificationToken(longest))).toBe(longest);
    /* Longer than that (the column allows 64) gets a plain token, never a truncated one. */
    const tooLong = generateVerificationToken("y".repeat(64));
    expect(tooLong.length).toBeLessThanOrEqual(128);
    expect(issuedLinkAccount(tooLong)).toBeNull();
    expect(issuedLinkAccount("a".repeat(96))).toBeNull();
  });
});
