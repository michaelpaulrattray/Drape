/**
 * THE SESSION COOKIE IS READ OUT OF THE HEADER THE SAME WAY ON EITHER SIDE OF
 * THE COOKIE 2.x BUMP — #2138.
 *
 * `cookie` 2.0.0 renamed `parse` to `parseCookie` (its own release notes) and
 * types its answer `Record<string, string | undefined>`. The rename is the
 * whole code change; this suite is the proof that the READ did not move with
 * it. It drives the REAL `sdk.authenticateRequest` — the real header parse,
 * the real `cookies.get(COOKIE_NAME)`, the real `jwtVerify` on a session the
 * real `createSessionToken` minted — and substitutes only the database.
 *
 * Every header shape below was run through cookie 1.0.2's `parse` and 2.0.1's
 * `parseCookie` side by side before this suite was written, and every one gave
 * the same entries. The two shapes worth naming:
 *
 * - **A DUPLICATE NAME: THE FIRST ONE WINS, IN BOTH VERSIONS.** 1.0.2 and
 *   2.0.1 both carry the same `// only assign once` guard
 *   (`if (obj[key] === undefined)`), so a later cookie of the same name is
 *   ignored. Both orders are pinned, so a parser that started taking the LAST
 *   one would turn exactly one of them red.
 * - **A HEADER THAT IS NOT A COOKIE AT ALL** (no `=`, only semicolons, a
 *   name with an empty value) reads as no session, never as a throw.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request } from "express";

import { COOKIE_NAME } from "@shared/const";

/* `ENV` freezes these at first import, and CI has no .env — set before the
   module graph loads. The values are not credentials. */
vi.hoisted(() => {
  process.env.JWT_SECRET = "drape-test-session-secret-2138-not-a-real-credential";
  process.env.VITE_APP_ID = "drape-test-app-2138";
});

const KNOWN_OPEN_ID = "open-id-2138";

vi.mock("../db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db")>();
  return {
    ...actual,
    getDb: vi.fn(async () => ({}) as never),
    getUserByOpenId: vi.fn(async (openId: string) =>
      openId === KNOWN_OPEN_ID ? { id: 2138, openId: KNOWN_OPEN_ID, role: "user" } : undefined),
    upsertUser: vi.fn(async () => undefined),
  };
});

const { sdk, SessionRejectedError } = await import("./sdk");

/** A request as express hands it over: the raw header, or none at all. */
function aRequest(cookieHeader: string | undefined): Request {
  return { headers: cookieHeader === undefined ? {} : { cookie: cookieHeader } } as unknown as Request;
}

async function read(cookieHeader: string | undefined) {
  return sdk.authenticateRequest(aRequest(cookieHeader), { recordActivity: false });
}

async function expectRefused(cookieHeader: string | undefined) {
  await expect(read(cookieHeader)).rejects.toBeInstanceOf(SessionRejectedError);
}

let session: string;

beforeEach(async () => {
  session = await sdk.createSessionToken(KNOWN_OPEN_ID, { name: "Verify" });
});

describe("#2138 — the session cookie read, header shape by header shape", () => {
  it("POSITIVE CONTROL: a valid session cookie signs the person in", async () => {
    await expect(read(`${COOKIE_NAME}=${session}`)).resolves.toMatchObject({ id: 2138 });
  });

  it("finds the session among other cookies, wherever it sits", async () => {
    await expect(read(`a=1; ${COOKIE_NAME}=${session}; b=2`)).resolves.toMatchObject({ id: 2138 });
  });

  it("no Cookie header at all → refused", async () => {
    await expectRefused(undefined);
  });

  it("an EMPTY Cookie header → refused", async () => {
    await expectRefused("");
  });

  it("a malformed header — a name with no '=' — → refused, not a throw of another kind", async () => {
    await expectRefused(COOKIE_NAME);
  });

  it("a malformed header — semicolons only — → refused", async () => {
    await expectRefused(";;;");
  });

  it("the session cookie with an EMPTY value → refused", async () => {
    await expectRefused(`${COOKIE_NAME}=`);
  });

  it("a session value that is not a token → refused", async () => {
    await expectRefused(`${COOKIE_NAME}=not-a-jwt`);
  });

  it("DUPLICATE NAMES, valid first → signed in: the FIRST one wins (1.0.2 and 2.0.1 alike)", async () => {
    await expect(read(`${COOKIE_NAME}=${session}; ${COOKIE_NAME}=not-a-jwt`))
      .resolves.toMatchObject({ id: 2138 });
  });

  it("DUPLICATE NAMES, valid second → refused: the later one is never consulted", async () => {
    await expectRefused(`${COOKIE_NAME}=not-a-jwt; ${COOKIE_NAME}=${session}`);
  });
});
