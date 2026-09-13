/**
 * THE EMAIL/PASSWORD AUTH ROUTES, DRIVEN (#697, the card's last file).
 *
 * ⚠ WHAT THIS FILE USED TO BE, because it is the reason the arms below are
 * shaped the way they are. Under a docblock claiming it covered "beta code
 * enforcement, password hashing, and session creation", it imported the route
 * module NOWHERE. Eighteen of its arms could not fail about this product:
 *
 *   · nine  `isDisposableEmail("test@guerrillamail.com") === true`  — the
 *     helper's own unit arms, and a strict SUBSET of the twelve already in
 *     `referral-enhancements.test.ts`. They prove the helper knows
 *     guerrillamail. Nothing proved the REGISTER ROUTE ASKS IT.
 *   · five  `checkRateLimit(ip, { maxRequests: 5, keyPrefix: "email_register_test" })`
 *     — the limiter driven against the test's OWN config literals, a
 *     transcription of the route's numbers into a key the route never uses.
 *     Delete the rate limit from both handlers and all five stayed green.
 *   · four  `bcrypt.hashSync(pw, 4).length === 60` — assertions about a third
 *     party library, at four rounds where the product uses twelve. Delete the
 *     hash from the register handler and all four stayed green.
 *
 * They are replaced, not dropped: every claim each one made about the product
 * is now made by a request travelling through the real `emailAuthRouter`.
 * `isDisposableEmail` is deliberately NOT mocked here — the register arm sends
 * a real guerrillamail address at the real helper, which is the only shape
 * that proves the ask. The db, the mailer, the session mint and the audit log
 * are mocked as the FAR END the handler lands on, never as the subject.
 *
 * INVARIANT 9 LIVES IN THIS FILE (CLAUDE.md): two of the product's five
 * session-issuance sites are the register handler's development-mode branch
 * and the login handler's success. `sessionIssuanceSites.test.ts` COUNTS them
 * by reading this route's source text; nothing until now has driven either,
 * so nothing proved the gates each mint sits behind actually refuse.
 *
 * The schema describes below are untouched and were already honest — they
 * import the real `registerSchema`/`loginSchema` rather than a copy.
 */
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { baseUrlOf, listenOnFetchablePort } from "../testing/fetchablePort";

vi.mock("../db", () => ({
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn(),
  isAccountLocked: vi.fn().mockResolvedValue({ locked: false }),
  recordFailedLogin: vi.fn().mockResolvedValue(undefined),
  resetFailedLogins: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../db/users", () => ({ getUserByEmail: vi.fn() }));
vi.mock("../db/validateInviteCode", () => ({ validateInviteCode: vi.fn() }));
vi.mock("../db/inviteCodes", () => ({ redeemInviteCode: vi.fn() }));
vi.mock("../db/connection", () => ({ getDb: vi.fn() }));
vi.mock("./emailVerification", () => ({
  generateVerificationToken: vi.fn(() => "verification-token-stand-in"),
  storeVerificationToken: vi.fn().mockResolvedValue(undefined),
  sendVerificationEmail: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("../security/loginAttackAlert", () => ({ noteFailedLogin: vi.fn() }));
vi.mock("../_core/sdk", () => ({
  sdk: { createSessionToken: vi.fn().mockResolvedValue("session-token-stand-in") },
}));
/* `AUDIT_ACTIONS` stays REAL through `importOriginal`: an arm asserting the
   route wrote `LOGIN_BLOCKED_SUSPENDED` must be asserting the product's own
   constant, not a string this file invented. Only the writer is a spy. */
vi.mock("../auditLog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../auditLog")>()),
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));
/* Same reasoning for the limiter: `getClientIp` is the real one reading the
   real request, and only the decision is staged. The arms assert the CONFIG
   the route asks with, which is what the deleted transcriptions gestured at. */
vi.mock("../security/rateLimit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../security/rateLimit")>()),
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 4, resetIn: 0 })),
}));

import bcrypt from "bcryptjs";
import { COOKIE_NAME, SESSION_MAX_AGE_MS } from "@shared/const";

import * as db from "../db";
import { AUDIT_ACTIONS, logAuditEvent } from "../auditLog";
import { getDb } from "../db/connection";
import { redeemInviteCode } from "../db/inviteCodes";
import { getUserByEmail } from "../db/users";
import { validateInviteCode } from "../db/validateInviteCode";
import { sdk } from "../_core/sdk";
import { checkRateLimit } from "../security/rateLimit";
import { noteFailedLogin } from "../security/loginAttackAlert";
import {
  generateVerificationToken,
  sendVerificationEmail,
  storeVerificationToken,
} from "./emailVerification";
import { emailAuthRouter } from "./emailAuth";


/*
  ─── Validation schema tests — THE REAL SCHEMAS, NOT A TRANSCRIPTION ───

  These used to be a copy, headed "mirrors emailAuth.ts schemas". It had
  already drifted: the ceilings gained authored messages in the source and the
  copy kept the bare ones, so every assertion below was green about a schema no
  request is ever validated against. Working law 4 — derive, never mirror.
*/
import { loginSchema, registerSchema } from "./emailAuthInput";

describe("Email Auth — Registration Validation", () => {
  it("accepts valid registration input", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "SecurePass1",
      name: "Test User",
      betaCode: "BETA123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email format", () => {
    const result = registerSchema.safeParse({
      email: "not-an-email",
      password: "SecurePass1",
      name: "Test User",
      betaCode: "BETA123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Invalid email address");
    }
  });

  it("rejects empty email", () => {
    const result = registerSchema.safeParse({
      email: "",
      password: "SecurePass1",
      name: "Test User",
      betaCode: "BETA123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password shorter than 8 characters", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "Short1",
      name: "Test User",
      betaCode: "BETA123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "Password must be at least 8 characters"
      );
    }
  });

  it("rejects password without uppercase letter", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "nouppercase1",
      name: "Test User",
      betaCode: "BETA123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain(
        "Password must contain at least one uppercase letter"
      );
    }
  });

  it("rejects password without a number", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "NoNumberHere",
      name: "Test User",
      betaCode: "BETA123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain(
        "Password must contain at least one number"
      );
    }
  });

  it("rejects password longer than 128 characters", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "A1" + "a".repeat(127),
      name: "Test User",
      betaCode: "BETA123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "SecurePass1",
      name: "",
      betaCode: "BETA123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Name is required");
    }
  });

  it("#816's auth row — rejects a WHITESPACE-ONLY name, and trims a padded one before it becomes the display name", () => {
    // Red on the unfixed product: one space passed `.min(1)` and became the account's name.
    const blank = registerSchema.safeParse({
      email: "user@example.com",
      password: "SecurePass1",
      name: " \t ",
      betaCode: "BETA123",
    });
    expect(blank.success).toBe(false);
    if (!blank.success) {
      expect(blank.error.issues[0]?.message).toBe("Name is required");
    }
    const padded = registerSchema.safeParse({
      email: "user@example.com",
      password: "SecurePass1",
      name: "  Ada Lovelace \n",
      betaCode: "BETA123",
    });
    expect(padded.success && padded.data.name).toBe("Ada Lovelace");
  });

  it("rejects name longer than 100 characters", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "SecurePass1",
      name: "A".repeat(101),
      betaCode: "BETA123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty beta code", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "SecurePass1",
      name: "Test User",
      betaCode: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Beta code is required");
    }
  });

  it("rejects missing fields", () => {
    const result = registerSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("accepts password with special characters", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "Str0ng!@#$%",
      name: "Test User",
      betaCode: "BETA123",
    });
    expect(result.success).toBe(true);
  });

  it("accepts email with subdomain", () => {
    const result = registerSchema.safeParse({
      email: "user@mail.example.com",
      password: "SecurePass1",
      name: "Test User",
      betaCode: "BETA123",
    });
    expect(result.success).toBe(true);
  });
});

describe("Email Auth — Login Validation", () => {
  it("accepts valid login input", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "anypassword",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email format", () => {
    const result = loginSchema.safeParse({
      email: "not-valid",
      password: "anypassword",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Password is required");
    }
  });

  it("rejects missing fields", () => {
    const result = loginSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("does not enforce password strength on login (only on register)", () => {
    // Login should accept any non-empty password — strength rules are for registration only
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "weak",
    });
    expect(result.success).toBe(true);
  });
});

/**
 * Both routes send `parsed.error.issues[0].message` to the screen verbatim, so
 * a constraint without an authored message puts zod's own prose — "Too big:
 * expected string to have <=255 characters" — on the signup page, which is the
 * first surface a new customer meets.
 *
 * Every field is driven rather than a sample: the omission was uniform across
 * all six ceilings, so testing one would have proved only that one was
 * remembered.
 */
describe("Email Auth — every ceiling speaks to a person", () => {
  const validRegistration = {
    email: "user@example.com",
    password: "SecurePass1",
    name: "Test User",
    betaCode: "BETA123",
  };

  const ceilings = [
    { field: "email", value: `${"a".repeat(250)}@example.com`, says: "Email address is too long" },
    { field: "password", value: `A1${"a".repeat(127)}`, says: "Password must be 128 characters or fewer" },
    { field: "name", value: "a".repeat(101), says: "Name must be 100 characters or fewer" },
    { field: "betaCode", value: "a".repeat(65), says: "Beta code is too long" },
  ] as const;

  for (const ceiling of ceilings) {
    it(`says what is wrong when ${ceiling.field} is over its limit`, () => {
      const result = registerSchema.safeParse({ ...validRegistration, [ceiling.field]: ceiling.value });
      expect(result.success).toBe(false);
      if (result.success) return;
      const message = result.error.issues[0]?.message ?? "";
      expect(message).toBe(ceiling.says);
      expect(message, "zod's own prose must never reach the signup page").not.toContain("expected string");
    });
  }

  it("says what is wrong when a login field is over its limit", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: `${"a".repeat(129)}`,
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe("Password must be 128 characters or fewer");
  });
});

/*
  ─────────────────────────────────────────────────────────────────────────
  THE ROUTES THEMSELVES — a real `express()` carrying the real router, and a
  real HTTP request through it. Everything asserted below is something the
  handler in `emailAuth.ts` did: what it refused, what it charged the
  collaborators with, what it wrote to the audit log, and whether it minted a
  session cookie. The mocks are the far end; the subject is always the route.
  ─────────────────────────────────────────────────────────────────────────
*/

type DrivenResponse = {
  status: number;
  json: Record<string, unknown>;
  cookies: string[];
};

async function post(path: string, body: unknown): Promise<DrivenResponse> {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", emailAuthRouter);
  const server = await listenOnFetchablePort((port) => app.listen(port, "127.0.0.1"));
  try {
    const response = await fetch(`${baseUrlOf(server)}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "drape-test-agent" },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let json: Record<string, unknown> = {};
    try { json = JSON.parse(text) as Record<string, unknown>; } catch { /* not json */ }
    const cookies = typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie") ?? ""].filter(Boolean);
    return { status: response.status, json, cookies };
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())));
  }
}

function sessionCookie(response: DrivenResponse): string | undefined {
  return response.cookies.find((cookie) => cookie.startsWith(`${COOKIE_NAME}=`));
}

/** Every audit row the handler wrote, in the order it wrote them. */
function auditRows(): Array<Record<string, unknown>> {
  return vi.mocked(logAuditEvent).mock.calls.map(([options]) => options as unknown as Record<string, unknown>);
}

const REGISTRATION = {
  email: "new@example.com",
  password: "SecurePass1",
  name: "Test User",
  betaCode: "BETA123",
} as const;

const NEW_USER = { id: 42, openId: "email_generated", name: "Test User", email: REGISTRATION.email };

/* Hashed at 4 rounds because `bcrypt.compare` reads the cost out of the hash —
   the LOGIN handler's comparison is the real one either way, and the register
   handler's own 12 rounds are asserted where they are actually spent. */
const STORED_HASH = bcrypt.hashSync("SecurePass1", 4);

function anAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    openId: "email_7",
    email: "person@example.com",
    name: "A Person",
    passwordHash: STORED_HASH,
    authProvider: "email",
    emailVerified: true,
    approved: true,
    role: "user",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 4, resetIn: 0 });
  vi.mocked(db.isAccountLocked).mockResolvedValue({ locked: false } as never);
  vi.mocked(db.upsertUser).mockResolvedValue(undefined as never);
  vi.mocked(getUserByEmail).mockResolvedValue(null as never);
  vi.mocked(validateInviteCode).mockResolvedValue({ valid: true });
  vi.mocked(db.getUserByOpenId).mockImplementation((async (openId: string) => ({ ...NEW_USER, openId })) as never);
  vi.mocked(redeemInviteCode).mockResolvedValue({ success: true });
  vi.mocked(generateVerificationToken).mockReturnValue("verification-token-stand-in");
  vi.mocked(storeVerificationToken).mockResolvedValue(undefined as never);
  vi.mocked(sendVerificationEmail).mockResolvedValue({ success: true } as never);
  vi.mocked(sdk.createSessionToken).mockResolvedValue("session-token-stand-in");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/auth/register — the doors, in the order the handler asks them", () => {
  it("refuses a rate-limited caller with 429, before it reads the body at all", async () => {
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, remaining: 0, resetIn: 60_000 });

    const response = await post("/api/auth/register", REGISTRATION);

    expect(response.status).toBe(429);
    expect(response.json.error).toBe("Too many attempts. Please try again later.");
    /* The refusal is ahead of everything: no lookup, no code check, no user. */
    expect(getUserByEmail).not.toHaveBeenCalled();
    expect(validateInviteCode).not.toHaveBeenCalled();
    expect(db.upsertUser).not.toHaveBeenCalled();
  });

  it("asks the limiter for FIVE per fifteen minutes, under the register key", async () => {
    await post("/api/auth/register", REGISTRATION);

    /* The five deleted arms recited these numbers into a key of their own
       invention. This is the number the product actually spends. */
    expect(checkRateLimit).toHaveBeenCalledTimes(1);
    const [key, config] = vi.mocked(checkRateLimit).mock.calls[0]!;
    expect(key).toMatch(/^email-register:/);
    expect(config).toEqual({ maxRequests: 5, windowMs: 15 * 60 * 1000, keyPrefix: "email_register" });
  });

  it("puts the schema's own authored sentence on the screen, never zod's prose", async () => {
    const response = await post("/api/auth/register", { ...REGISTRATION, password: "short" });

    expect(response.status).toBe(400);
    expect(response.json.error).toBe("Password must be at least 8 characters");
    expect(String(response.json.error)).not.toContain("expected string");
    expect(db.upsertUser).not.toHaveBeenCalled();
  });

  it("ASKS the disposable-email helper — a guerrillamail signup is refused 400 and audited", async () => {
    /* The nine deleted arms proved the helper knows this domain. This proves
       the route hands it the address. The helper here is the REAL one. */
    const response = await post("/api/auth/register", { ...REGISTRATION, email: "throwaway@guerrillamail.com" });

    expect(response.status).toBe(400);
    expect(response.json.error).toBe("Disposable email addresses are not allowed");
    expect(db.upsertUser).not.toHaveBeenCalled();

    expect(auditRows()).toHaveLength(1);
    expect(auditRows()[0]).toMatchObject({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      resourceType: "auth",
      severity: "warning",
      metadata: { reason: "Disposable email blocked", email: "throwaway@guerrillamail.com" },
    });
  });

  it("lets an ordinary address past the disposable check", async () => {
    const response = await post("/api/auth/register", REGISTRATION);

    expect(response.status).toBe(201);
  });

  it("refuses a second account on an address already taken, with 409 and no write", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(anAccount({ email: REGISTRATION.email }) as never);

    const response = await post("/api/auth/register", REGISTRATION);

    expect(response.status).toBe(409);
    expect(response.json.error).toBe("An account with this email already exists");
    expect(validateInviteCode).not.toHaveBeenCalled();
    expect(db.upsertUser).not.toHaveBeenCalled();
  });

  it("refuses an invalid beta code in the code checker's own words, and creates nobody", async () => {
    vi.mocked(validateInviteCode).mockResolvedValue({ valid: false, error: "That access code has already been used." });

    const response = await post("/api/auth/register", REGISTRATION);

    expect(response.status).toBe(400);
    expect(response.json.error).toBe("That access code has already been used.");
    expect(validateInviteCode).toHaveBeenCalledWith(REGISTRATION.betaCode);
    expect(db.upsertUser).not.toHaveBeenCalled();
  });

  it("STORES A BCRYPT HASH AND NEVER THE PASSWORD, at the product's own cost of twelve", async () => {
    /* The four deleted arms hashed a literal at four rounds and measured the
       library. This reads what the handler handed the database. */
    await post("/api/auth/register", REGISTRATION);

    const [written] = vi.mocked(db.upsertUser).mock.calls[0]! as unknown as [Record<string, string>];
    expect(written.passwordHash).not.toBe(REGISTRATION.password);
    expect(written.passwordHash).not.toContain(REGISTRATION.password);
    expect(bcrypt.getRounds(written.passwordHash)).toBe(12);
    expect(bcrypt.compareSync(REGISTRATION.password, written.passwordHash)).toBe(true);
    expect(bcrypt.compareSync("NotThePassword1", written.passwordHash)).toBe(false);
  });

  it("mints an email-provider account under a namespaced, unguessable openId", async () => {
    await post("/api/auth/register", REGISTRATION);

    const [written] = vi.mocked(db.upsertUser).mock.calls[0]! as unknown as [Record<string, string>];
    expect(written.openId).toMatch(/^email_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(written.loginMethod).toBe("email");
    expect(written.authProvider).toBe("email");
    expect(written.email).toBe(REGISTRATION.email);
  });

  it("trims a padded name before it becomes the display name (#816's auth row, at the wire)", async () => {
    await post("/api/auth/register", { ...REGISTRATION, name: "   Padded Person   " });

    const [written] = vi.mocked(db.upsertUser).mock.calls[0]! as unknown as [Record<string, string>];
    expect(written.name).toBe("Padded Person");
  });

  it("redeems the code for the NEW user's id, not for the code alone", async () => {
    await post("/api/auth/register", REGISTRATION);

    expect(redeemInviteCode).toHaveBeenCalledWith(NEW_USER.id, REGISTRATION.betaCode);
  });

  it("refuses when the code turns invalid between validate and redeem", async () => {
    vi.mocked(redeemInviteCode).mockResolvedValue({ success: false, error: "Access code just ran out." });

    const response = await post("/api/auth/register", REGISTRATION);

    expect(response.status).toBe(400);
    expect(response.json.error).toBe("Access code just ran out.");
    expect(sessionCookie(response), "a half-registered account never gets a session").toBeUndefined();
  });

  it("says so rather than pretending when the account cannot be read back", async () => {
    vi.mocked(db.getUserByOpenId).mockResolvedValue(null as never);

    const response = await post("/api/auth/register", REGISTRATION);

    expect(response.status).toBe(500);
    expect(response.json.error).toBe("Failed to create account");
    expect(redeemInviteCode).not.toHaveBeenCalled();
  });

  it("sends the verification email and audits it, then parks the caller at /verify-email WITHOUT a session", async () => {
    const response = await post("/api/auth/register", REGISTRATION);

    expect(response.status).toBe(201);
    expect(response.json).toEqual({
      success: true,
      redirect: "/verify-email",
      email: REGISTRATION.email,
      needsVerification: true,
    });
    expect(storeVerificationToken).toHaveBeenCalledWith(NEW_USER.id, "verification-token-stand-in");
    expect(sendVerificationEmail).toHaveBeenCalledWith(
      expect.anything(), REGISTRATION.email, REGISTRATION.name, "verification-token-stand-in",
    );
    /* The gate this proves: an unverified registrant holds no cookie. */
    expect(sdk.createSessionToken).not.toHaveBeenCalled();
    expect(sessionCookie(response)).toBeUndefined();

    expect(auditRows()[0]).toMatchObject({
      userId: NEW_USER.id,
      action: AUDIT_ACTIONS.EMAIL_VERIFICATION_SENT,
      severity: "info",
      metadata: { email: REGISTRATION.email, newAccount: true, betaCode: "BETA123" },
    });
  });

  it("still creates the account when the mailer fails — the customer can resend", async () => {
    vi.mocked(sendVerificationEmail).mockResolvedValue({ success: false, error: "Resend is down" } as never);

    const response = await post("/api/auth/register", REGISTRATION);

    expect(response.status).toBe(201);
    expect(response.json.needsVerification).toBe(true);
  });

  it("DEVELOPMENT ONLY: marks the account verified and mints a session — invariant 9's second site", async () => {
    /* One of the product's five session-issuance sites. The gate it sits
       behind is the environment itself, and the account is already approved
       because the beta code was redeemed two statements earlier. */
    vi.stubEnv("NODE_ENV", "development");
    const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    vi.mocked(getDb).mockResolvedValue({ update: vi.fn().mockReturnValue({ set }) } as never);

    const response = await post("/api/auth/register", REGISTRATION);

    expect(set).toHaveBeenCalledWith({ emailVerified: true });
    expect(response.status).toBe(201);
    expect(response.json).toEqual({ success: true, redirect: "/app", needsVerification: false });

    /* The mint is on the openId the handler JUST GENERATED, read back out of
       what it handed the database — not on a constant this file chose. My
       first version of this arm asserted the fixture's `email_generated` and
       reddened, which is the arm doing its job: a session minted for anyone
       but the account just created is the defect worth catching here. */
    const [created] = vi.mocked(db.upsertUser).mock.calls[0]! as unknown as [Record<string, string>];
    expect(sdk.createSessionToken).toHaveBeenCalledWith(
      created.openId, { name: NEW_USER.name, expiresInMs: SESSION_MAX_AGE_MS },
    );
    expect(created.openId).toMatch(/^email_/);
    const cookie = sessionCookie(response);
    expect(cookie).toContain("session-token-stand-in");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain(`Max-Age=${Math.floor(SESSION_MAX_AGE_MS / 1000)}`);
    /* Plain-HTTP localhost: `lax`, never `none` — the Manus-legacy gotcha. */
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("Secure");

    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("PRODUCTION: takes the verification road, and mints nothing", async () => {
    /* The negative control for the arm above: the same request, the same
       fixtures, the environment the product actually ships in. */
    vi.stubEnv("NODE_ENV", "production");

    const response = await post("/api/auth/register", REGISTRATION);

    expect(response.json.redirect).toBe("/verify-email");
    expect(sdk.createSessionToken).not.toHaveBeenCalled();
    expect(getDb).not.toHaveBeenCalled();
  });

  it("turns a thrown failure into a 500 and an audit row, never a stack trace", async () => {
    vi.mocked(db.upsertUser).mockRejectedValue(new Error("mysql went away"));

    const response = await post("/api/auth/register", REGISTRATION);

    expect(response.status).toBe(500);
    expect(response.json.error).toBe("Registration failed. Please try again.");
    expect(auditRows()[0]).toMatchObject({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      severity: "warning",
      metadata: { reason: "Registration error", error: "mysql went away" },
    });
  });
});

describe("POST /api/auth/login — the doors, in the order the handler asks them", () => {
  const CREDENTIALS = { email: "person@example.com", password: "SecurePass1" } as const;

  beforeEach(() => {
    vi.mocked(getUserByEmail).mockResolvedValue(anAccount() as never);
  });

  it("refuses a rate-limited caller with 429, before it looks anyone up", async () => {
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, remaining: 0, resetIn: 60_000 });

    const response = await post("/api/auth/login", CREDENTIALS);

    expect(response.status).toBe(429);
    expect(getUserByEmail).not.toHaveBeenCalled();
  });

  it("asks the limiter for TEN per fifteen minutes, under the login key", async () => {
    await post("/api/auth/login", CREDENTIALS);

    const [key, config] = vi.mocked(checkRateLimit).mock.calls[0]!;
    expect(key).toMatch(/^email-login:/);
    expect(config).toEqual({ maxRequests: 10, windowMs: 15 * 60 * 1000, keyPrefix: "email_login" });
  });

  it("refuses a malformed body with the schema's sentence", async () => {
    const response = await post("/api/auth/login", { email: "not-an-email", password: "x" });

    expect(response.status).toBe(400);
    expect(response.json.error).toBe("Invalid email address");
  });

  it("COUNTS an unknown address toward the site-wide alarm — the exit credential stuffing hits", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(null as never);

    const response = await post("/api/auth/login", CREDENTIALS);

    expect(response.status).toBe(401);
    expect(noteFailedLogin).toHaveBeenCalledTimes(1);
    /* Global and email-free by design, so the enumeration defence survives. */
    expect(vi.mocked(noteFailedLogin).mock.calls[0]).toEqual([]);
  });

  it("gives an unknown address and a wrong password the SAME answer — no enumeration", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(null as never);
    const unknown = await post("/api/auth/login", CREDENTIALS);

    vi.mocked(getUserByEmail).mockResolvedValue(anAccount() as never);
    const wrongPassword = await post("/api/auth/login", { ...CREDENTIALS, password: "WrongPass1" });

    expect(unknown.status).toBe(wrongPassword.status);
    expect(unknown.json).toEqual(wrongPassword.json);
    expect(unknown.json).toEqual({ error: "Invalid email or password" });
  });

  it("refuses a SUSPENDED account with 403 suspended, audited, and no session", async () => {
    vi.mocked(db.isAccountLocked).mockResolvedValue({ locked: true, lockedUntil: null, reason: "Abuse" } as never);

    const response = await post("/api/auth/login", CREDENTIALS);

    expect(response.status).toBe(403);
    expect(response.json).toEqual({ error: "suspended" });
    expect(sessionCookie(response)).toBeUndefined();
    expect(auditRows()[0]).toMatchObject({
      action: AUDIT_ACTIONS.LOGIN_BLOCKED_SUSPENDED,
      severity: "warning",
      metadata: { reason: "Abuse", email: CREDENTIALS.email },
    });
  });

  it("refuses a LOCKED account with the minutes left, audited under its own action", async () => {
    const lockedUntil = new Date(Date.now() + 7.2 * 60_000);
    vi.mocked(db.isAccountLocked).mockResolvedValue({ locked: true, lockedUntil, reason: "Too many attempts" } as never);

    const response = await post("/api/auth/login", CREDENTIALS);

    expect(response.status).toBe(403);
    expect(response.json).toEqual({ error: "locked", minutes: 8 });
    expect(sessionCookie(response)).toBeUndefined();
    expect(auditRows()[0]).toMatchObject({ action: AUDIT_ACTIONS.LOGIN_BLOCKED_LOCKED });
  });

  it("sends a Google-only account to Google rather than failing it silently", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(anAccount({ passwordHash: null, authProvider: "google" }) as never);

    const response = await post("/api/auth/login", CREDENTIALS);

    expect(response.status).toBe(401);
    expect(response.json.error).toBe("This account uses Google sign-in. Please use Google to log in.");
    expect(db.recordFailedLogin).not.toHaveBeenCalled();
  });

  it("records a wrong password against the account AND the site-wide alarm", async () => {
    const response = await post("/api/auth/login", { ...CREDENTIALS, password: "WrongPass1" });

    expect(response.status).toBe(401);
    /* Two different controls: one slows an attack on ONE person, the other
       says the whole front door is being tried. Both, or neither is proven. */
    expect(db.recordFailedLogin).toHaveBeenCalledWith("email_7");
    expect(noteFailedLogin).toHaveBeenCalledTimes(1);
    expect(db.resetFailedLogins).not.toHaveBeenCalled();
    expect(sessionCookie(response)).toBeUndefined();
    expect(auditRows()[0]).toMatchObject({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      metadata: { reason: "Invalid password", email: CREDENTIALS.email },
    });
  });

  it("refuses an UNVERIFIED email-provider account, and mints nothing", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(anAccount({ emailVerified: false }) as never);

    const response = await post("/api/auth/login", CREDENTIALS);

    expect(response.status).toBe(403);
    expect(response.json.error).toBe("email_not_verified");
    expect(sdk.createSessionToken).not.toHaveBeenCalled();
    expect(sessionCookie(response)).toBeUndefined();
  });

  it("lets an unverified GOOGLE-provider account past the verification gate", async () => {
    /* The gate is scoped to `authProvider === "email"` — a Google account has
       no verification of ours to have completed. */
    vi.mocked(getUserByEmail).mockResolvedValue(
      anAccount({ authProvider: "google", emailVerified: false }) as never,
    );

    const response = await post("/api/auth/login", CREDENTIALS);

    expect(response.status).toBe(200);
    expect(sessionCookie(response)).toBeDefined();
  });

  it("refuses an UNAPPROVED account, and mints nothing", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(anAccount({ approved: false }) as never);

    const response = await post("/api/auth/login", CREDENTIALS);

    expect(response.status).toBe(403);
    expect(response.json.error).toBe("Account not approved. Please enter a valid access code.");
    expect(sdk.createSessionToken).not.toHaveBeenCalled();
    expect(sessionCookie(response)).toBeUndefined();
  });

  it("EXEMPTS an unapproved ADMIN from the approval gate — CLAUDE.md invariant 9's own clause", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(anAccount({ approved: false, role: "admin" }) as never);

    const response = await post("/api/auth/login", CREDENTIALS);

    expect(response.status).toBe(200);
    expect(sessionCookie(response)).toBeDefined();
  });

  it("MINTS THE SESSION on a good login — invariant 9's first site, with its books squared", async () => {
    const response = await post("/api/auth/login", CREDENTIALS);

    expect(response.status).toBe(200);
    expect(response.json).toEqual({ success: true, redirect: "/app" });

    expect(db.resetFailedLogins).toHaveBeenCalledWith("email_7");
    const [signIn] = vi.mocked(db.upsertUser).mock.calls[0]! as unknown as [Record<string, unknown>];
    expect(signIn.openId).toBe("email_7");
    expect(signIn.lastSignedIn).toBeInstanceOf(Date);

    expect(sdk.createSessionToken).toHaveBeenCalledWith(
      "email_7", { name: "A Person", expiresInMs: SESSION_MAX_AGE_MS },
    );
    const cookie = sessionCookie(response);
    expect(cookie).toContain("session-token-stand-in");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");

    expect(auditRows()[0]).toMatchObject({
      userId: 7,
      action: AUDIT_ACTIONS.LOGIN_SUCCESS,
      severity: "info",
      metadata: { email: CREDENTIALS.email, loginMethod: "email" },
    });
  });

  it("turns a thrown failure into a 500 and an audit row", async () => {
    vi.mocked(db.isAccountLocked).mockRejectedValue(new Error("mysql went away"));

    const response = await post("/api/auth/login", CREDENTIALS);

    expect(response.status).toBe(500);
    expect(response.json.error).toBe("Login failed. Please try again.");
    expect(sessionCookie(response)).toBeUndefined();
    expect(auditRows()[0]).toMatchObject({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      metadata: { reason: "Login error", error: "mysql went away" },
    });
  });
});
