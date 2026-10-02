/**
 * THE INTERACTION-LATENCY DRIVE'S OWN SHEET — MINTED, NEVER INHERITED (#1800).
 *
 * # The defect this closes, and it is a CLASS rather than a sheet
 *
 * `pnpm machinist:latency` needs three things: a dev server, a session token,
 * and a sheet whose owner can open it and whose grid holds ready tiles. Patrol
 * run 4 read it on a publicId it was handed — `c19610ad-781e-4f80-bad2-a47c7c2146ad`,
 * session 90 on verify-bot 823 — and wrote that id into its record. **A sheet
 * has an idle clock** (`CASTING_SESSION_IDLE_MS`, 30 days since #1464) **and its
 * candidates purge with it**, so by patrol run 6 that session was `expired` and
 * held 0 candidates. Nothing went red. Nothing errored. The next patrol simply
 * found the sheet gone, and interaction latency went unread for a second run.
 *
 * So the class: **a client reading anchored to an INHERITED fixture decays
 * silently, and the product's own retention is what expires it.** The repair is
 * not a fresher id — that is the same defect with a later date — it is a fixture
 * the instrument MINTS, and re-asserts, every time it runs.
 *
 * Measured in dev the night this was written (#1800's census, re-read at the
 * rows): **7 ready candidates in the entire dev world and every road to them
 * shut** — three sheets behind `outside-scope-bot@local.invalid` (28601,
 * `frozenAt` 2026-08-25T13:05:11Z), one behind #1098's non-UUID publicId
 * (`1086-mixed-2907ac20`), one abandoned. Sessions: 44 expired, 8 open, 2
 * abandoned.
 *
 * # WHAT THIS FIXTURE IS, DECLARED — the fidelity law wants this said out loud
 *
 * **No engine renders here.** The tiles are rows cloned from a donor's
 * already-ready candidate, pointing at an image the product generated earlier,
 * exactly as `ensureOutsider` and `ensureCensusFixture` already do. So it costs
 * no credits, no provider call and no house money, and it can run on every
 * patrol.
 *
 * **What that is honest for, and what it is not.** The probe this fixture exists
 * for is Keep/Unkeep: click, the mutation's round trip, the kept badge and the
 * prompt box. Every line of that is the product's own — the real tile component,
 * the real tRPC mutation, the real database write, the real invalidate and
 * re-render — and **none of it reads the pixels or cares which engine made
 * them**, which is why cloned rows measure the number a rolled sheet would.
 * What a reading here is NOT evidence about: anything downstream of the image
 * itself — render quality, a view check, an engine's own latency. A number taken
 * on this fixture is never quoted as one of those.
 *
 * # Its own account, and it HEALS that account every run
 *
 * The fixture owns `latency-bot-local` rather than borrowing `verify-bot-local`
 * (the donor, which the verify skill and other seats drive) or the outsider
 * (whose whole purpose is to sit OUTSIDE the scopes, and which is frozen).
 *
 * **And the account is re-asserted on every run, which is the half the outsider
 * is missing.** `ensureOutsider` upserts `approved` and `emailVerified` and
 * never touches `frozenAt` — so when the moderator dashboard's discrepancy scan
 * froze 28601 on 2026-08-25, its three fixture sheets became undrivable and the
 * helper could not heal them. This one clears `frozenAt` and `suspendedAt` on
 * its OWN account each run, and says in its receipt what it had to clear. That
 * is not reaching into a shared row to take a reading: the row is this
 * fixture's, it created it, and nothing else drives it.
 *
 * # Idempotent by a constraint, not by a check-then-write
 *
 * The sheet is found by `generation_operations.clientRequestId`, which carries
 * `UNIQUE(userId, clientRequestId)` — so a second run finds the first run's
 * sheet instead of writing a second one. `ensureCensusFixture` established both
 * the column and the reason (#1364); this follows it rather than inventing a tag
 * home.
 *
 * On a run that finds its sheet, the fixture RESETS it: every tile back to
 * `ready` and unkept, the session back to `open`, and `lastActivityAt` /
 * `expiresAt` pushed forward. That is what makes the decay impossible rather
 * than merely later — the clock is reset by the act of measuring.
 *
 * Dev only; it refuses under any deliberate production wrapper.
 *
 *   npx tsx scripts/lib/latencyFixture.mts --prove   # drives mint, re-find, reset and the refusals
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";

import { SignJWT } from "jose";

import { CASTING_SESSION_IDLE_MS } from "../../shared/castingRetention";
import { openDatabase, worldOf } from "./dbConnection.mts";
import { DONOR_OPEN_ID } from "./outsider.mts";

const FIXTURE_OPEN_ID = "latency-bot-local";
const FIXTURE_NAME = "Latency Bot";
const FIXTURE_EMAIL = "latency-bot@local.invalid";

/**
 * THE TAG THE SHEET IS FOUND BY, on the fixture's own operation row.
 *
 * `UNIQUE(userId, clientRequestId)` is the idempotency, so this string IS the
 * fixture's identity: changing it mints a second sheet rather than renaming the
 * first. See `censusFixture.mts`'s own note on why this column is the right home
 * and not merely the nearest one (#1364).
 */
export const LATENCY_FIXTURE_TAG = "latency-fixture-1800";

/**
 * HOW MANY TILES, and why eight rather than one.
 *
 * The drive takes one Keep/Unkeep pair per tile (`--samples`, default 8), tagging
 * each tile as it goes so the next Keep takes a fresh one. One tile is one
 * sample, and a p95 over one sample is not a p95. Eight is the roll's own
 * candidate count, so the grid the drive walks is the shape a real sheet has.
 */
export const LATENCY_FIXTURE_TILES = 8;

export type LatencyFixture = {
  userId: number;
  openId: string;
  /** A session cookie for the sheet's OWNER — the only account the page admits. */
  token: string;
  sessionPublicId: string;
  /** Ready, unkept tiles on the sheet when this returned. */
  readyTiles: number;
  /** `minted` on the first run, `reset` on every run after it. */
  outcome: "minted" | "reset";
  /** What had to be repaired to make the account drivable, for the receipt. */
  healed: string[];
};

function refuseProduction(): void {
  const wrapper = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL"
    : process.env.PUBLIC_DATABASE_URL ? "PUBLIC_DATABASE_URL"
      : process.env.RAILWAY_ENVIRONMENT_NAME ? `a Railway run of "${process.env.RAILWAY_ENVIRONMENT_NAME}"` : null;
  if (wrapper) {
    throw new Error(
      `latencyFixture.mts WRITES ROWS and is dev-only, but ${wrapper} is present — that wrapper exists to `
      + "point a script at production. Run it plainly (npx tsx …) against the dev database, or not at all.",
    );
  }
}

type Row = Record<string, unknown>;

export async function ensureLatencyFixture(
  input: { tiles?: number; donorOpenId?: string } = {},
): Promise<LatencyFixture> {
  refuseProduction();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("no DATABASE_URL");
  const tiles = input.tiles ?? LATENCY_FIXTURE_TILES;
  if (!Number.isInteger(tiles) || tiles < 1) throw new Error(`tiles must be a positive integer, got ${String(tiles)}`);
  const conn = await openDatabase(url);
  const healed: string[] = [];
  try {
    process.stderr.write(`[latency-fixture] writing into ${worldOf(url)}\n`);

    /* ── the account, and its freeze cleared ───────────────────────────────
       The freeze is READ before it is cleared, so the receipt can say what was
       wrong. A fixture that silently repairs itself teaches nobody why the last
       reading was missing, which is the whole complaint behind this card. */
    await conn.execute(
      `INSERT INTO users (openId, name, email, loginMethod, role, approved, emailVerified)
       VALUES (?, ?, ?, 'fixture', 'user', 1, 1)
       ON DUPLICATE KEY UPDATE name = VALUES(name), approved = 1, emailVerified = 1`,
      [FIXTURE_OPEN_ID, FIXTURE_NAME, FIXTURE_EMAIL],
    );
    const [accounts] = await conn.execute(
      `SELECT id, frozenAt, suspendedAt FROM users WHERE openId = ?`,
      [FIXTURE_OPEN_ID],
    );
    const account = (accounts as Row[])[0];
    if (!account) throw new Error(`the fixture account ${FIXTURE_OPEN_ID} was neither found nor created`);
    const userId = Number(account.id);
    if (account.frozenAt !== null) healed.push(`frozenAt was ${String(account.frozenAt)}`);
    if (account.suspendedAt !== null) healed.push(`suspendedAt was ${String(account.suspendedAt)}`);
    if (healed.length > 0) {
      await conn.execute(`UPDATE users SET frozenAt = NULL, suspendedAt = NULL WHERE id = ?`, [userId]);
    }

    /* ── the sheet, found by its tag ──────────────────────────────────────── */
    const [sheets] = await conn.execute(
      `SELECT s.id AS sessionId, s.publicId AS sessionPublicId, r.id AS rollId
         FROM generation_operations o
         JOIN casting_rolls r ON r.operationId = o.id
         JOIN casting_sessions s ON s.id = r.sessionId
        WHERE o.userId = ? AND o.clientRequestId = ?
        ORDER BY r.id ASC LIMIT 1`,
      [userId, LATENCY_FIXTURE_TAG],
    );
    const sheet = (sheets as Row[])[0] ?? null;

    const expiresAt = new Date(Date.now() + CASTING_SESSION_IDLE_MS);
    let sessionId: number;
    let sessionPublicId: string;
    let rollId: number;
    let outcome: "minted" | "reset";

    if (sheet) {
      outcome = "reset";
      sessionId = Number(sheet.sessionId);
      sessionPublicId = String(sheet.sessionPublicId);
      rollId = Number(sheet.rollId);
    } else {
      outcome = "minted";
      /* ── cloned from a donor rather than generated ───────────────────────
         The identity comes WITH the picture: a candidate whose `internalPrompt`
         is null has no resolved identity, which `ensureOutsider` learned the
         expensive way — two paid purchases went into diagnosing it. The donor
         predicate here is that module's, unchanged. */
      const donorOpenId = input.donorOpenId ?? DONOR_OPEN_ID;
      const [donors] = await conn.execute(
        `SELECT c.imageKey, c.thumbKey, c.internalPrompt, c.provider, c.providerModel, r.briefText
           FROM casting_candidates c
           JOIN casting_rolls r ON r.id = c.rollId
           JOIN users u ON u.id = c.userId
          WHERE u.openId = ? AND c.status = 'ready' AND c.imageKey IS NOT NULL
            AND c.internalPrompt IS NOT NULL
          ORDER BY c.id DESC LIMIT 1`,
        [donorOpenId],
      );
      /* Typed at the read rather than cast at each use: the driver's parameter
         list takes no `unknown`, and spelling the shape here is also where a
         column rename would show up as a type error rather than a null row. */
      const donor = (donors as Array<{
        imageKey: string;
        thumbKey: string | null;
        internalPrompt: unknown;
        provider: string | null;
        providerModel: string | null;
        briefText: string;
      }>)[0];
      if (!donor) {
        /* REFUSED rather than minting an empty sheet. An empty grid draws
           "Nothing cast on this sheet yet", the drive's own wait ACCEPTS that
           copy, and the walk then reports Keep as "absent" and exits 0 — a run
           that measured nothing, dressed as a run. That is the exact failure
           #1800 is about, so it is a throw and not a warning. */
        throw new Error(
          `no donor tile to clone: ${donorOpenId} has no ready candidate carrying both an imageKey and an `
          + "internalPrompt. The latency fixture never mints an empty sheet — an empty grid reads as "
          + "\"Keep: absent\" and exits 0, which is a run that measured nothing.",
        );
      }

      sessionPublicId = randomUUID();
      await conn.execute(
        `INSERT INTO casting_sessions (publicId, userId, originType, status, expiresAt)
         VALUES (?, ?, 'roster', 'open', ?)`,
        [sessionPublicId, userId, expiresAt],
      );
      const [sessionRows] = await conn.execute(
        `SELECT id FROM casting_sessions WHERE publicId = ?`,
        [sessionPublicId],
      );
      sessionId = Number((sessionRows as Row[])[0]!.id);

      /* Its OWN settled, zero-credit operation — never the donor's. Pointing two
         accounts at one operation row would be a cross-account reference in the
         one place ownership is denormalized to be single-statement. Complete and
         priced at zero: no charge, no refund, nothing for the recovery sweep. */
      const operationId = randomUUID();
      await conn.execute(
        `INSERT INTO generation_operations
           (id, userId, clientRequestId, kind, payloadHash, status, plannedCredits, chargedCredits)
         VALUES (?, ?, ?, 'casting.fixture', ?, 'succeeded', 0, 0)`,
        [operationId, userId, LATENCY_FIXTURE_TAG, `fixture-${operationId}`],
      );
      const rollPublicId = randomUUID();
      await conn.execute(
        `INSERT INTO casting_rolls
           (publicId, sessionId, userId, rollIndex, briefText, operationId, status, priceCredits)
         VALUES (?, ?, ?, 1, ?, ?, 'complete', 0)`,
        [rollPublicId, sessionId, userId, String(donor.briefText), operationId],
      );
      const [rollRows] = await conn.execute(`SELECT id FROM casting_rolls WHERE publicId = ?`, [rollPublicId]);
      rollId = Number((rollRows as Row[])[0]!.id);

      const internalPrompt = typeof donor.internalPrompt === "string"
        ? donor.internalPrompt
        : JSON.stringify(donor.internalPrompt);
      for (let position = 1; position <= tiles; position += 1) {
        await conn.execute(
          `INSERT INTO casting_candidates
             (publicId, rollId, sessionId, userId, position, status, pointsCost, imageKey, thumbKey,
              internalPrompt, provider, providerModel, expiresAt)
           VALUES (?, ?, ?, ?, ?, 'ready', 0, ?, ?, ?, ?, ?, ?)`,
          [
            randomUUID(), rollId, sessionId, userId, position,
            donor.imageKey, donor.thumbKey, internalPrompt, donor.provider, donor.providerModel, expiresAt,
          ],
        );
      }
    }

    /* ── the reset, on EVERY run including the mint ────────────────────────
       Idempotent by construction rather than by branch: the mint above already
       wrote these values, so running the reset over them ASSERTS them instead of
       trusting the inserts. The clock is pushed forward by the act of measuring,
       which is what makes run 4's silent expiry impossible rather than later.

       Both statements carry `userId` beside the key they already know, which is
       invariant 1 — the owner goes in the WHERE of the statement that writes. */
    await conn.execute(
      `UPDATE casting_candidates
          SET status = 'ready', keptAt = NULL, discardedAt = NULL, expiresAt = ?, expiredReason = NULL
        WHERE rollId = ? AND userId = ? AND status IN ('ready', 'expired')`,
      [expiresAt, rollId, userId],
    );
    await conn.execute(
      `UPDATE casting_sessions
          SET status = 'open', activeRollId = ?, lastActivityAt = CURRENT_TIMESTAMP, expiresAt = ?
        WHERE id = ? AND userId = ?`,
      [rollId, expiresAt, sessionId, userId],
    );

    const [counted] = await conn.execute(
      `SELECT count(*) AS n FROM casting_candidates
        WHERE rollId = ? AND userId = ? AND status = 'ready' AND keptAt IS NULL`,
      [rollId, userId],
    );
    const readyTiles = Number((counted as Row[])[0]!.n);
    if (readyTiles < 1) {
      /* The same refusal as the empty mint, reached from the other direction: a
         reset that did not produce a drivable grid must not be handed to a walk
         that would read it as "absent" and exit 0. */
      throw new Error(
        `the latency fixture sheet ${sessionPublicId} holds ${readyTiles} ready unkept tile(s) after its reset — `
        + "the walk would read Keep as absent. Delete the sheet's rows and let the next run mint a fresh one.",
      );
    }

    /* ── the session cookie, minted exactly as the drivers mint theirs ───── */
    if (!process.env.JWT_SECRET) {
      throw new Error("no JWT_SECRET — the fixture cannot mint the owner's session cookie");
    }
    const token = await new SignJWT({ openId: FIXTURE_OPEN_ID, appId: process.env.VITE_APP_ID, name: FIXTURE_NAME })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));

    return { userId, openId: FIXTURE_OPEN_ID, token, sessionPublicId, readyTiles, outcome, healed };
  } finally {
    await conn.end();
  }
}

/*
  RUN DIRECTLY? ASK THE PLATFORM, NOT `argv[1]` (#668) — and the `--prove` read
  is inside this block rather than at module scope, because a module-scope argv
  read is the IMPORTER's argv: five modules in `scripts/lib` once carried that
  bug, so `npx tsx scripts/drive-interaction-latency.mts --prove` would have run
  this module's self-controls and exited before the drive's own strict parse ever
  saw the unknown word. `server/spendingScriptArguments.test.ts` pins the shape.
*/
const invokedDirectly = import.meta.main;

if (invokedDirectly && process.argv.includes("--prove")) {
  const say = (line: string) => console.log(line);
  let failed = 0;
  const check = (name: string, ok: boolean, saw: string) => {
    say(`${ok ? "PASS" : "FAIL"}  ${name} — saw ${saw}`);
    if (!ok) failed += 1;
  };

  say("LATENCY FIXTURE CONTROLS — does it mint once, re-find, and reset what it finds?\n");

  const first = await ensureLatencyFixture();
  const second = await ensureLatencyFixture();

  check("one account, never two", first.userId === second.userId, `id ${first.userId} then ${second.userId}`);
  check(
    "one sheet, never one per run",
    first.sessionPublicId === second.sessionPublicId,
    `${first.sessionPublicId} then ${second.sessionPublicId}`,
  );
  check(
    "the second run RESET rather than minted",
    second.outcome === "reset",
    `first ${first.outcome}, second ${second.outcome}`,
  );
  check(
    "the grid is drivable — more than one tile, so a p95 has samples",
    second.readyTiles >= 2,
    `${second.readyTiles} ready unkept tile(s)`,
  );
  check(
    "the sheet's publicId is a UUID — #1098's BAD_REQUEST is what killed the last fixture",
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(second.sessionPublicId),
    second.sessionPublicId,
  );
  check(
    "the token carries the fixture account, not the donor",
    JSON.parse(Buffer.from(first.token.split(".")[1]!, "base64url").toString()).openId === FIXTURE_OPEN_ID,
    String(JSON.parse(Buffer.from(first.token.split(".")[1]!, "base64url").toString()).openId),
  );

  /*
    THE ARM THAT MATTERS, and it is the one run 4's fixture had no equivalent of:
    the reset must UNDO a kept tile. Without it the second patrol inherits eight
    tiles its predecessor kept, every `Keep` reads as absent, and the walk exits
    0 having measured nothing — which is the silent-decay class in miniature.
    Driven by keeping one for real and asking for the fixture again.
  */
  const url = process.env.DATABASE_URL!;
  const conn = await openDatabase(url);
  let keptBefore = 0;
  try {
    /* The id is chosen first and the write keys on it: MySQL refuses `LIMIT` on
       a multi-table UPDATE (`ER_WRONG_USAGE`), which this arm found by trying. */
    const [picked] = await conn.execute(
      `SELECT c.id FROM casting_candidates c
         JOIN casting_sessions s ON s.id = c.sessionId
        WHERE s.publicId = ? AND c.userId = ? AND c.keptAt IS NULL
        ORDER BY c.position ASC LIMIT 1`,
      [second.sessionPublicId, second.userId],
    );
    const victim = (picked as Row[])[0];
    if (!victim) throw new Error("the control could not find an unkept tile to keep — the fixture is not drivable");
    await conn.execute(
      `UPDATE casting_candidates SET keptAt = CURRENT_TIMESTAMP WHERE id = ? AND userId = ?`,
      [Number(victim.id), second.userId],
    );
    const [rows] = await conn.execute(
      `SELECT count(*) AS n FROM casting_candidates c
         JOIN casting_sessions s ON s.id = c.sessionId
        WHERE s.publicId = ? AND c.userId = ? AND c.keptAt IS NOT NULL`,
      [second.sessionPublicId, second.userId],
    );
    keptBefore = Number((rows as Row[])[0]!.n);
  } finally {
    await conn.end();
  }
  check("POSITIVE CONTROL — a tile really was left kept", keptBefore === 1, `${keptBefore} kept tile(s)`);

  const third = await ensureLatencyFixture();
  check(
    "the reset UNKEPT it — the grid is whole again",
    third.readyTiles === second.readyTiles,
    `${second.readyTiles} before, ${third.readyTiles} after a kept tile`,
  );

  /* The dev-only refusal, driven rather than asserted — it is the one thing in
     here that could write production rows if it ever stopped firing. */
  const savedWrapper = process.env.MYSQL_PUBLIC_URL;
  process.env.MYSQL_PUBLIC_URL = "mysql://root:x@production.invalid:23768/railway";
  let refusedProduction = false;
  try { await ensureLatencyFixture(); } catch (error) {
    refusedProduction = String(error instanceof Error ? error.message : error).includes("MYSQL_PUBLIC_URL");
  }
  if (savedWrapper === undefined) delete process.env.MYSQL_PUBLIC_URL;
  else process.env.MYSQL_PUBLIC_URL = savedWrapper;
  check("POSITIVE — a production wrapper is refused", refusedProduction, "threw naming MYSQL_PUBLIC_URL");

  let refusedZeroTiles = false;
  try { await ensureLatencyFixture({ tiles: 0 }); } catch { refusedZeroTiles = true; }
  check("POSITIVE — a zero-tile fixture is refused", refusedZeroTiles, "threw");

  say(failed === 0 ? "\nthe fixture holds" : `\n${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}
