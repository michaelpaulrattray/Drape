/**
 * THE STANDING OUTSIDE-THE-SCOPE ACTOR. (Ordered in fable-544 §2.)
 *
 * # Why a second account is a tool and not a one-off
 *
 * *"A driver that only ever plays the enabled user cannot see an over-wide
 * gate."* Every scope-gated surface in this program is dark for most people and
 * lit for the founder, and every driver we have signs in as the ONE account
 * that is inside every flag. Such a driver cannot fail on a gate that admits
 * everybody: it never asks the question from outside.
 *
 * Three needs share this fixture, which is why it lives in the toolshed:
 *
 *   (a) the negative arm of any scope-gated affordance — the surface must be
 *       ABSENT for this actor, driven rather than assumed;
 *   (b) the un-scanned / un-flagged default of a panel or a page, which is what
 *       most users actually see and what nobody looks at;
 *   (c) the widening rehearsals — when a flag opens beyond the founder, this
 *       account is the one that goes in first.
 *
 * # One line to invoke
 *
 * ```ts
 * import { ensureOutsider, assertOutsideScope } from "./lib/outsider.mts";
 *
 * const outsider = await ensureOutsider();          // upserts, clones a sheet, mints a token
 * assertOutsideScope(outsider, "CASTING_REPAINT_SCOPE");   // refuses a vacuous negative arm
 * ```
 *
 * `assertOutsideScope` reads THIS process's environment, which is the same one
 * a plainly-started dev server reads — but not when the server was started with
 * flags of its own. In that case the account's standing is a fact about the
 * SERVER, and the only honest proof is asking it: see
 * `scripts/probe-panel-gate-disposable.mts`, which puts the same question to
 * one server as both accounts.
 *
 * `assertOutsideScope` is the half that matters. If the flag under test reads
 * `all` — which dev often does — then NOBODY is outside it, the negative arm
 * would pass while proving nothing, and this throws instead of letting a driver
 * report a green that means "the flag is open". That is the false-negative-arm
 * class, and a fixture that cannot detect it is worse than no fixture.
 *
 * # What it writes, and where it refuses to
 *
 * Dev only. It refuses under any deliberate production wrapper
 * (`MYSQL_PUBLIC_URL`, `PUBLIC_DATABASE_URL`, or a Railway run), and it prints
 * the world it opened either way — the two-databases lesson, on a module that
 * WRITES rows rather than reads them.
 *
 * The account is minted the way `verify-bot-local` is: approved, verified, no
 * role. Its sheet is CLONED rather than generated — a session, a roll and one
 * ready candidate pointing at a donor's existing image — so the fixture costs
 * no credits, no generation and no provider call, and two runs produce one
 * account rather than two.
 *
 *   npx tsx scripts/lib/outsider.mts --prove    # drives idempotence + the scope refusal
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";

import { SignJWT } from "jose";

import { openDatabase, worldOf } from "./dbConnection.mts";

export const OUTSIDER_OPEN_ID = "outside-scope-bot-local";
export const OUTSIDER_NAME = "Outside Scope Bot";
/** Whose sheet is copied when the outsider has none. Any ready cast will do. */
export const DONOR_OPEN_ID = "verify-bot-local";

export type Outsider = {
  id: number;
  openId: string;
  name: string;
  /** A signed `app_session_id` value — set it as the cookie, as the drivers do. */
  token: string;
  /** Her own cast, cloned. Null only if the donor had none to clone. */
  candidatePublicId: string | null;
  sessionPublicId: string | null;
  /** Every scope flag this account is INSIDE, by name. Empty is the useful case. */
  insideScopes: string[];
};

/** The flags a driver might want to be outside of, and the env var each reads. */
export const SCOPE_FLAGS = [
  "CASTING_V2_SCOPE",
  "CASTING_SEGMENTS_SCOPE",
  "CASTING_SEGMENTS_DELIVERED_SCOPE",
  "CASTING_REFERENCE_LIBRARY_SCOPE",
  "CASTING_REPAINT_SCOPE",
  "CASTING_FACE_SCAN_SCOPE",
] as const;
export type ScopeFlag = (typeof SCOPE_FLAGS)[number];

/**
 * Is this user inside that flag? Read here rather than imported from the server
 * so the fixture states the rule it is asserting: `all` admits everyone, absent
 * or `off` admits nobody, `users:1,7` admits exactly those ids.
 */
export function scopeAdmits(raw: string | undefined, userId: number): boolean {
  const value = (raw ?? "").trim();
  if (value === "" || value.toLowerCase() === "off") return false;
  if (value.toLowerCase() === "all") return true;
  const listed = value.toLowerCase().startsWith("users:") ? value.slice("users:".length) : "";
  return listed.split(",").map((one) => one.trim()).filter(Boolean).includes(String(userId));
}

function refuseProduction(): void {
  const wrapper = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL"
    : process.env.PUBLIC_DATABASE_URL ? "PUBLIC_DATABASE_URL"
      : process.env.RAILWAY_ENVIRONMENT_NAME ? `a Railway run of "${process.env.RAILWAY_ENVIRONMENT_NAME}"` : null;
  if (wrapper) {
    throw new Error(
      `outsider.mts WRITES ROWS and is dev-only, but ${wrapper} is present — that wrapper exists to point a `
      + "script at production. Run it plainly (npx tsx …) against the dev database, or not at all.",
    );
  }
}

export async function ensureOutsider(input: { donorOpenId?: string } = {}): Promise<Outsider> {
  refuseProduction();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("no DATABASE_URL");
  const conn = await openDatabase(url);
  try {
    process.stderr.write(`[outsider] writing into ${worldOf(url)}\n`);

    /* ── the account ─────────────────────────────────────────────────────── */
    await conn.execute(
      `INSERT INTO users (openId, name, email, loginMethod, role, approved, emailVerified)
       VALUES (?, ?, ?, 'fixture', 'user', 1, 1)
       ON DUPLICATE KEY UPDATE name = VALUES(name), approved = 1, emailVerified = 1`,
      [OUTSIDER_OPEN_ID, OUTSIDER_NAME, "outside-scope-bot@local.invalid"],
    );
    const [found] = await conn.execute(`SELECT id FROM users WHERE openId = ?`, [OUTSIDER_OPEN_ID]);
    const id = (found as Array<{ id: number }>)[0]!.id;

    /* ── her sheet, cloned rather than generated ─────────────────────────── */
    const [mine] = await conn.execute(
      `SELECT c.publicId AS candidatePublicId, s.publicId AS sessionPublicId
         FROM casting_candidates c JOIN casting_sessions s ON s.id = c.sessionId
        WHERE c.userId = ? AND c.status = 'ready' ORDER BY c.id DESC LIMIT 1`,
      [id],
    );
    let candidatePublicId = (mine as Array<{ candidatePublicId: string }>)[0]?.candidatePublicId ?? null;
    let sessionPublicId = (mine as Array<{ sessionPublicId: string }>)[0]?.sessionPublicId ?? null;

    if (!candidatePublicId) {
      const donorOpenId = input.donorOpenId ?? DONOR_OPEN_ID;
      /*
        THE IDENTITY COMES WITH THE PICTURE, and the first version of this took
        only the pixels.

        A cast whose `internalPrompt` is null has no resolved identity, so a
        render's verification can state almost no facts about her — measured:
        every render on the first fixture produced ONE carried check
        (`hairWorn`) and never the facet the ask wrote, so nothing was ever
        earned and the library filed nothing. Two paid purchases went into
        diagnosing what turned out to be this line.

        A fixture that is not shaped like a real account measures itself.
      */
      const [donors] = await conn.execute(
        `SELECT c.imageKey, c.thumbKey, c.personaLine, c.internalPrompt, c.provider,
                c.providerModel, r.briefText
           FROM casting_candidates c
           JOIN casting_rolls r ON r.id = c.rollId
           JOIN users u ON u.id = c.userId
          WHERE u.openId = ? AND c.status = 'ready' AND c.imageKey IS NOT NULL
            AND c.internalPrompt IS NOT NULL
          ORDER BY c.id DESC LIMIT 1`,
        [donorOpenId],
      );
      const donor = (donors as Array<{
        imageKey: string; thumbKey: string | null; personaLine: string | null;
        internalPrompt: unknown; provider: string | null; providerModel: string | null;
        briefText: string;
      }>)[0];
      if (donor) {
        sessionPublicId = randomUUID();
        await conn.execute(
          `INSERT INTO casting_sessions (publicId, userId, originType, status) VALUES (?, ?, 'roster', 'open')`,
          [sessionPublicId, id],
        );
        const [session] = await conn.execute(`SELECT id FROM casting_sessions WHERE publicId = ?`, [sessionPublicId]);
        const sessionId = (session as Array<{ id: number }>)[0]!.id;
        /* A roll is born of an operation and the column says so (`operationId`
           NOT NULL, uniquely indexed). The clone gets its OWN settled operation
           rather than borrowing the donor's — a fixture that pointed two
           accounts at one operation row would be a cross-account reference in
           the one place ownership is denormalized to be single-statement. It is
           complete and priced at zero: no charge, no refund, nothing for the
           recovery sweep to find. */
        const operationId = randomUUID();
        await conn.execute(
          `INSERT INTO generation_operations
             (id, userId, clientRequestId, kind, payloadHash, status, plannedCredits, chargedCredits)
           VALUES (?, ?, ?, 'casting.fixture', ?, 'succeeded', 0, 0)`,
          [operationId, id, randomUUID(), `fixture-${operationId}`],
        );
        const rollPublicId = randomUUID();
        await conn.execute(
          `INSERT INTO casting_rolls (publicId, sessionId, userId, rollIndex, briefText, operationId, status, priceCredits)
           VALUES (?, ?, ?, 1, ?, ?, 'complete', 0)`,
          [rollPublicId, sessionId, id, donor.briefText, operationId],
        );
        const [roll] = await conn.execute(`SELECT id FROM casting_rolls WHERE publicId = ?`, [rollPublicId]);
        const rollId = (roll as Array<{ id: number }>)[0]!.id;
        candidatePublicId = randomUUID();
        await conn.execute(
          `INSERT INTO casting_candidates
             (publicId, rollId, sessionId, userId, position, status, pointsCost, imageKey, thumbKey,
              personaLine, internalPrompt, provider, providerModel)
           VALUES (?, ?, ?, ?, 1, 'ready', 0, ?, ?, ?, ?, ?, ?)`,
          [
            candidatePublicId, rollId, sessionId, id, donor.imageKey, donor.thumbKey, donor.personaLine,
            typeof donor.internalPrompt === "string" ? donor.internalPrompt : JSON.stringify(donor.internalPrompt),
            donor.provider, donor.providerModel,
          ],
        );
        await conn.execute(`UPDATE casting_sessions SET activeRollId = ? WHERE id = ?`, [rollId, sessionId]);
      }
    }

    /* ── the session cookie, minted exactly as the drivers mint theirs ───── */
    const token = await new SignJWT({ openId: OUTSIDER_OPEN_ID, appId: process.env.VITE_APP_ID, name: OUTSIDER_NAME })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));

    const insideScopes = SCOPE_FLAGS.filter((flag) => scopeAdmits(process.env[flag], id));
    return { id, openId: OUTSIDER_OPEN_ID, name: OUTSIDER_NAME, token, candidatePublicId, sessionPublicId, insideScopes };
  } finally {
    await conn.end();
  }
}

/**
 * REFUSE A VACUOUS NEGATIVE ARM.
 *
 * The point of this actor is to be outside something. If the flag is `all`,
 * nobody is outside it and a driver's "the surface is absent" would be a green
 * about the flag rather than about the gate.
 */
export function assertOutsideScope(outsider: Outsider, flag: ScopeFlag): void {
  const raw = process.env[flag];
  if (!scopeAdmits(raw, outsider.id)) return;
  throw new Error(
    `${flag} is "${raw}", which ADMITS the outsider (user ${outsider.id}) — so a negative arm run now would pass `
    + "without proving anything. Point the flag at the inside actor instead (users:<verify-bot id>) and re-run.",
  );
}

/* ------------------------------------------------------------------ controls */

if (process.argv.includes("--prove")) {
  const say = (line: string) => console.log(line);
  let failed = 0;
  const check = (name: string, ok: boolean, saw: string) => {
    say(`${ok ? "PASS" : "FAIL"}  ${name} — saw ${saw}`);
    if (!ok) failed += 1;
  };

  const first = await ensureOutsider();
  const second = await ensureOutsider();
  check("the same account twice, never two", first.id === second.id, `id ${first.id} then ${second.id}`);
  check("it has a cast of its own", first.candidatePublicId !== null, `candidate ${first.candidatePublicId ?? "(none)"}`);
  check(
    "one cast, not one per run",
    first.candidatePublicId === second.candidatePublicId,
    `${first.candidatePublicId} then ${second.candidatePublicId}`,
  );
  check(
    "the token carries the outsider, not the bot",
    JSON.parse(Buffer.from(first.token.split(".")[1]!, "base64url").toString()).openId === OUTSIDER_OPEN_ID,
    JSON.parse(Buffer.from(first.token.split(".")[1]!, "base64url").toString()).openId,
  );

  /* THE ARM THAT MATTERS: the refusal must fire on an admitting flag and stay
     silent on a refusing one. Driven on both, never on one. */
  const savedAll = process.env.CASTING_REPAINT_SCOPE;
  process.env.CASTING_REPAINT_SCOPE = "all";
  let threwOnAll = false;
  try { assertOutsideScope(first, "CASTING_REPAINT_SCOPE"); } catch { threwOnAll = true; }
  process.env.CASTING_REPAINT_SCOPE = "users:1";
  let threwOnUsers1 = false;
  try { assertOutsideScope(first, "CASTING_REPAINT_SCOPE"); } catch { threwOnUsers1 = true; }
  process.env.CASTING_REPAINT_SCOPE = `users:${first.id}`;
  let threwOnSelf = false;
  try { assertOutsideScope(first, "CASTING_REPAINT_SCOPE"); } catch { threwOnSelf = true; }
  process.env.CASTING_REPAINT_SCOPE = savedAll;

  check("POSITIVE — an `all` flag refuses the arm", threwOnAll, "threw");
  check("NEGATIVE — a flag naming somebody else does not", !threwOnUsers1, "did not throw");
  check("POSITIVE — a flag naming the outsider itself refuses", threwOnSelf, "threw");
  check(
    "and it reports what it is inside",
    Array.isArray(first.insideScopes),
    first.insideScopes.length > 0 ? first.insideScopes.join(", ") : "(outside every flag in this env)",
  );

  say(failed === 0 ? "\nthe fixture holds" : `\n${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}
