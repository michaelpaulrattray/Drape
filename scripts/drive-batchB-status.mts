/**
 * Batch B status-agreement drive — the model lifecycle read model across the
 * real client/server seam (R6 execution plan, Batch B; hardened per the
 * review corrections).
 *
 * FREE ops only: every leg is a read or a refusal; nothing here can reach
 * Gemini or move credits (B7 proves the balance is untouched). DEV-ONLY and
 * hard-guarded:
 *   - refuses unless DRIVE_ALLOW_DB_FIXTURES=1 is set explicitly (this drive
 *     INSERTS AND DELETES fixture rows in the connected database — the
 *     RUN_PAID_INVARIANTS-style opt-in used by the repo's other drives);
 *   - refuses any non-loopback VERIFY_BASE_URL;
 *   - refuses a production app identity (VITE_APP_ID) or NODE_ENV=production
 *     or an internal-production DATABASE_URL host;
 *   - POSITIVELY binds to the development database: the runtime DATABASE_URL
 *     must exactly equal the repository .env's DATABASE_URL (a lingering
 *     shell override — e.g. a one-off production MYSQL_PUBLIC_URL — refuses
 *     before any connection; values are never printed) and VITE_APP_ID must
 *     be exactly the local dev identity.
 * Fixture rows use run-unique agency IDs, are tracked incrementally from the
 * first insert, and are cleaned up step-robustly (one failed delete cannot
 * skip the rest or leak the connection); leftovers from an interrupted
 * earlier run are swept before inserting.
 *
 *   B1  models.get carries status; archived reads deleted (404)
 *   B2  packageState.minted is status truth for all fixtures — stray/missing
 *       agencyId never flips it; archived 404s
 *   B3  picker (boardOps.listCastableModels): draft flag is status truth;
 *       locked presents as minted; archived absent
 *   B4  gallery source (wardrobe.model.listMinted): active AND legacy locked
 *       arrive, each carrying status; drafts and archived never do
 *   B5  registry lookup AND verify agree — locked retrievable + minted:true;
 *       a stray-ID draft and an archived identity are PUBLICLY ABSENT through
 *       both endpoints (exists:false, no timestamp — review correction 2)
 *   B6  wardrobe.sessions.getRecent carries modelStatus truth (locked) and
 *       surfaces the archived link honestly for the resume path
 *   B7  balance unchanged — the whole drive was free
 *
 * Usage: pnpm dev (separate terminal), then:
 *   DRIVE_ALLOW_DB_FIXTURES=1 npx tsx scripts/drive-batchB-status.mts
 */
import "dotenv/config";
import { SignJWT } from "jose";
import mysql from "mysql2/promise";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

// ── Hard safety gates (before ANY connection or write) ─────────────────────
const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";

function refuse(reason: string): never {
  console.error(`REFUSED: ${reason}`);
  process.exit(2);
}

if (process.env.DRIVE_ALLOW_DB_FIXTURES !== "1") {
  refuse(
    "this drive inserts/deletes DB fixture rows — set DRIVE_ALLOW_DB_FIXTURES=1 explicitly to run it against your LOCAL DEV environment",
  );
}
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
let baseHost: string;
try {
  baseHost = new URL(BASE).hostname;
} catch {
  refuse(`VERIFY_BASE_URL is not a valid URL: ${BASE}`);
}
if (!LOOPBACK_HOSTS.has(baseHost)) {
  refuse(`VERIFY_BASE_URL must be loopback (got ${baseHost}) — this drive never contacts a remote app`);
}
if (process.env.NODE_ENV === "production") {
  refuse("NODE_ENV=production — dev-only drive");
}
if ((process.env.VITE_APP_ID ?? "").includes("production")) {
  refuse(`VITE_APP_ID '${process.env.VITE_APP_ID}' looks like a production identity — dev-only drive`);
}
if (!process.env.DATABASE_URL) {
  refuse("DATABASE_URL is not set");
}
if (process.env.DATABASE_URL.includes("railway.internal")) {
  refuse("DATABASE_URL points at the internal production network — dev-only drive");
}

// ── Positive dev-database binding (final review round B) ───────────────────
// Production is normally reached for one-off work through Railway's PUBLIC
// proxy URL, which none of the pattern checks above can distinguish from the
// dev proxy URL. So the drive requires POSITIVE proof it is talking to the
// configured development database: the runtime DATABASE_URL must EXACTLY
// match the repository's own `.env` DATABASE_URL (dotenv never overrides an
// existing shell variable, so a lingering one-off production override in the
// shell produces a mismatch here), and the app identity must be EXACTLY the
// known local one. Neither value is ever printed.
function readRepoEnvValue(key: string): string | null {
  const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");
  let raw: string;
  try {
    raw = readFileSync(envPath, "utf-8");
  } catch {
    refuse("repository .env not found — the drive can only run in a configured local dev checkout");
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*)\\s*$`));
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}
const EXPECTED_LOCAL_APP_ID = "drape-local";
if (process.env.VITE_APP_ID !== EXPECTED_LOCAL_APP_ID) {
  refuse(`VITE_APP_ID is not the expected local dev identity ('${EXPECTED_LOCAL_APP_ID}') — dev-only drive`);
}
const repoEnvDatabaseUrl = readRepoEnvValue("DATABASE_URL");
if (!repoEnvDatabaseUrl) {
  refuse("repository .env has no DATABASE_URL — the drive can only run against the configured dev database");
}
if (process.env.DATABASE_URL !== repoEnvDatabaseUrl) {
  refuse(
    "runtime DATABASE_URL does not match the repository .env DATABASE_URL — a shell override (e.g. a one-off production URL) is active; refusing before any connection",
  );
}

const failures: string[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(name);
};

// ── Session ────────────────────────────────────────────────────────────────
const conn = await mysql.createConnection(process.env.DATABASE_URL!);

// Everything past this point runs inside try/finally: fixtures are tracked
// incrementally from the FIRST insert, so a mid-setup crash still cleans up.
const createdModelIds: number[] = [];
const createdSessionIds: number[] = [];
const FIXTURE_MARKER = "drive batchB temp";

try {
  await conn.execute(
    `INSERT INTO users (openId, name, email, approved, emailVerified, role)
     VALUES ('verify-bot-local', 'Verify Bot', 'verify-bot@local.test', 1, 1, 'user')
     ON DUPLICATE KEY UPDATE approved = 1, emailVerified = 1`,
  );
  const [users] = await conn.execute(`SELECT id FROM users WHERE openId = 'verify-bot-local'`);
  const userId = (users as Array<{ id: number }>)[0].id;

  // Sweep leftovers from an interrupted earlier run (fixture-marker scoped to
  // the verify bot) so re-runs never collide with stale rows.
  const [stale] = await conn.execute(
    `SELECT id FROM models WHERE userId = ? AND masterPrompt = ?`,
    [userId, FIXTURE_MARKER],
  );
  const staleIds = (stale as Array<{ id: number }>).map((r) => r.id);
  if (staleIds.length > 0) {
    console.log(`(sweeping ${staleIds.length} leftover fixture rows from an interrupted run)`);
    const ph = staleIds.map(() => "?").join(",");
    await conn.execute(`DELETE FROM wardrobe_sessions WHERE modelId IN (${ph})`, staleIds);
    await conn.execute(`DELETE FROM model_assets WHERE modelId IN (${ph})`, staleIds);
    await conn.execute(`DELETE FROM models WHERE id IN (${ph})`, staleIds);
  }

  const token = await new SignJWT({
    openId: "verify-bot-local",
    appId: process.env.VITE_APP_ID,
    name: "Verify Bot",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.JWT_SECRET));
  const COOKIE = `app_session_id=${token}`;

  // ── Fixtures (run-unique agency IDs; tracked as they are created) ─────────
  const R2 = process.env.R2_PUBLIC_URL ?? "https://pub-test.r2.dev";
  // Registry format is MOD-YY-[A-F0-9]{6}: 2 unique hex chars per run + a
  // fixed role hex suffix keeps IDs valid, distinct, and collision-free
  // across interrupted runs.
  const runHex = randomBytes(1).toString("hex").toUpperCase(); // 2 hex chars
  const agencyIdFor = (role: string) => `MOD-26-${runHex}${role}`; // role = 4 hex chars

  async function insertModel(name: string, status: string, agencyId: string | null) {
    const [res] = await conn.execute(
      `INSERT INTO models (userId, name, status, agencyId, mintedAt, masterPrompt, technicalSchema, preferences)
       VALUES (?, ?, ?, ?, ?, ?, '{}', '{}')`,
      [userId, name, status, agencyId, agencyId ? new Date() : null, FIXTURE_MARKER],
    );
    const id = (res as { insertId: number }).insertId;
    createdModelIds.push(id);
    return id;
  }
  async function insertAsset(modelId: number, viewType: string) {
    await conn.execute(
      `INSERT INTO model_assets (modelId, viewType, resolution, storageUrl, pointsCost)
       VALUES (?, ?, '1K', ?, 0)`,
      [modelId, viewType, `${R2}/drive-batchB/${modelId}-${viewType}.png`],
    );
  }
  async function insertSession(modelId: number) {
    const [res] = await conn.execute(
      `INSERT INTO wardrobe_sessions (userId, modelId, modelImageUrl, history, historyIndex, activeGarmentIds)
       VALUES (?, ?, ?, ?, 0, '[]')`,
      [userId, modelId, `${R2}/drive-batchB/${modelId}-frontFull.png`, JSON.stringify([`${R2}/drive-batchB/${modelId}-vto1.png`])],
    );
    const id = (res as { insertId: number }).insertId;
    createdSessionIds.push(id);
    return id;
  }

  const STRAY_ID = agencyIdFor("0DD0");
  const ACTIVE_ID = agencyIdFor("ACC0");
  const LOCKED_ID = agencyIdFor("10CC");
  const ARCHIVED_ID = agencyIdFor("DEAD");

  const draftId = await insertModel("Drive BB Draft", "draft", null);
  const strayDraftId = await insertModel("Drive BB StrayDraft", "draft", STRAY_ID);
  const activeId = await insertModel("Drive BB Active", "active", ACTIVE_ID);
  const activeNoIdId = await insertModel("Drive BB ActiveNoId", "active", null);
  const lockedId = await insertModel("Drive BB Locked", "locked", LOCKED_ID);
  const lockedNoIdId = await insertModel("Drive BB LockedNoId", "locked", null);
  const archivedId = await insertModel("Drive BB Archived", "archived", ARCHIVED_ID);
  for (const id of createdModelIds) {
    await insertAsset(id, "frontClose");
    await insertAsset(id, "frontFull");
  }
  const lockedSessionId = await insertSession(lockedId);
  const archivedSessionId = await insertSession(archivedId);

  // ── Raw tRPC helpers ───────────────────────────────────────────────────
  async function query(path: string, input?: unknown) {
    const url =
      input === undefined
        ? `${BASE}/api/trpc/${path}`
        : `${BASE}/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
    const res = await fetch(url, { headers: { cookie: COOKIE } });
    return { status: res.status, text: await res.text() };
  }
  const json = (text: string) => JSON.parse(text)?.result?.data?.json;

  const balanceBefore = json((await query("credits.getBalance")).text);

  // ── B1: models.get carries status; archived reads deleted ──────────────
  const b1a = json((await query("models.get", { modelId: lockedId })).text);
  check("B1a models.get(locked) returns status 'locked'", b1a?.status === "locked", `status=${b1a?.status}`);
  const b1b = json((await query("models.get", { modelId: strayDraftId })).text);
  check("B1b models.get(stray-ID draft) returns status 'draft'", b1b?.status === "draft", `status=${b1b?.status}`);
  const b1c = await query("models.get", { modelId: archivedId });
  check("B1c models.get(archived) → NOT_FOUND", b1c.status === 404 && b1c.text.includes("NOT_FOUND"), `status=${b1c.status}`);

  // ── B2: packageState.minted is status truth ────────────────────────────
  const b2Table: Array<[string, number, boolean]> = [
    ["draft", draftId, false],
    ["draft+strayId", strayDraftId, false],
    ["active", activeId, true],
    ["active w/o id", activeNoIdId, true],
    ["locked", lockedId, true],
    ["locked w/o id", lockedNoIdId, true],
  ];
  for (const [label, id, expected] of b2Table) {
    const pkg = json((await query("generation.packageState", { modelId: id })).text);
    check(`B2 packageState(${label}).minted === ${expected}`, pkg?.minted === expected, `minted=${pkg?.minted}`);
  }
  const b2Archived = await query("generation.packageState", { modelId: archivedId });
  check("B2 packageState(archived) → NOT_FOUND", b2Archived.status === 404, `status=${b2Archived.status}`);

  // ── B3: picker draft flag is status truth; archived absent ─────────────
  const picker = json((await query("boardOps.listCastableModels")).text) as Array<{ id: number; draft: boolean }>;
  const pickerById = new Map(picker.map((m) => [m.id, m.draft]));
  check("B3a picker: draft → draft:true", pickerById.get(draftId) === true);
  check("B3b picker: stray-ID draft → draft:true (never demoted to minted)", pickerById.get(strayDraftId) === true);
  check("B3c picker: active → draft:false", pickerById.get(activeId) === false);
  check("B3d picker: legacy locked → draft:false (presents as minted)", pickerById.get(lockedId) === false);
  check("B3e picker: archived absent", !pickerById.has(archivedId));

  // ── B4: gallery source includes locked, carries status ─────────────────
  const gallery = json((await query("wardrobe.model.listMinted", { limit: 50 })).text) as Array<{ id: number; status: string }>;
  const galleryById = new Map(gallery.map((m) => [m.id, m.status]));
  check("B4a gallery: active arrives with status", galleryById.get(activeId) === "active");
  check("B4b gallery: LEGACY LOCKED arrives with status (was invisible before Batch B)", galleryById.get(lockedId) === "locked");
  check("B4c gallery: draft never arrives", !galleryById.has(draftId));
  check("B4d gallery: stray-ID draft never arrives", !galleryById.has(strayDraftId));
  check("B4e gallery: archived never arrives", !galleryById.has(archivedId));

  // ── B5: registry lookup AND verify agree; non-minted rows publicly absent ─
  const b5a = await query("registry.lookup", { agencyId: LOCKED_ID });
  check("B5a registry.lookup(locked) returns the bundle", b5a.status === 200 && b5a.text.includes(LOCKED_ID), `status=${b5a.status}`);
  const b5b = json((await query("registry.verify", { agencyId: LOCKED_ID })).text);
  check("B5b registry.verify(locked): exists:true minted:true", b5b?.exists === true && b5b?.minted === true, JSON.stringify(b5b));
  const b5c = await query("registry.lookup", { agencyId: STRAY_ID });
  check("B5c registry.lookup(stray-ID draft) → NOT_FOUND", b5c.status === 404, `status=${b5c.status}`);
  const b5d = json((await query("registry.verify", { agencyId: STRAY_ID })).text);
  check(
    "B5d registry.verify(stray-ID draft): PUBLICLY ABSENT (exists:false, no timestamp)",
    b5d?.exists === false && b5d?.minted === false && b5d?.mintedAt === undefined,
    JSON.stringify(b5d),
  );
  const b5e = await query("registry.lookup", { agencyId: ARCHIVED_ID });
  check("B5e registry.lookup(archived, ID intact) → NOT_FOUND", b5e.status === 404, `status=${b5e.status}`);
  const b5f = json((await query("registry.verify", { agencyId: ARCHIVED_ID })).text);
  check(
    "B5f registry.verify(archived): PUBLICLY ABSENT (exists:false, no timestamp)",
    b5f?.exists === false && b5f?.minted === false && b5f?.mintedAt === undefined,
    JSON.stringify(b5f),
  );
  // The hidden-row shape must be byte-identical to a truly absent ID
  const b5g = json((await query("registry.verify", { agencyId: `MOD-26-${runHex}FFFF` })).text);
  check(
    "B5g verify(hidden row) shape === verify(no row) shape (no existence leak)",
    JSON.stringify(b5f) === JSON.stringify(b5g),
    `hidden=${JSON.stringify(b5f)} absent=${JSON.stringify(b5g)}`,
  );

  // ── B6: session payload carries model status truth ─────────────────────
  const sessions = json((await query("wardrobe.sessions.getRecent")).text) as Array<{
    sessionId: number; modelId: number | null; modelStatus?: string | null;
  }>;
  const lockedSession = sessions?.find((s) => s.sessionId === lockedSessionId);
  const archivedSession = sessions?.find((s) => s.sessionId === archivedSessionId);
  check("B6a getRecent: locked-model session carries modelStatus 'locked'", lockedSession?.modelStatus === "locked", `modelStatus=${lockedSession?.modelStatus}`);
  check(
    "B6b getRecent: archived-model session carries modelStatus 'archived' (resume degrades the link, keeps imagery)",
    archivedSession?.modelStatus === "archived",
    `modelStatus=${archivedSession?.modelStatus}`,
  );

  // ── B7: the whole drive was free ────────────────────────────────────────
  const balanceAfter = json((await query("credits.getBalance")).text);
  check(
    "B7 balance untouched (free drive)",
    JSON.stringify(balanceBefore) === JSON.stringify(balanceAfter),
    `before=${JSON.stringify(balanceBefore)} after=${JSON.stringify(balanceAfter)}`,
  );
} finally {
  // ── Cleanup — step-robust: one failure cannot skip the rest ─────────────
  const cleanup = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      console.error(`CLEANUP FAILED (${label}): ${(e as Error).message}`);
      failures.push(`cleanup:${label}`);
    }
  };
  if (createdSessionIds.length > 0) {
    const ph = createdSessionIds.map(() => "?").join(",");
    await cleanup("wardrobe_sessions", () =>
      conn.execute(`DELETE FROM wardrobe_sessions WHERE id IN (${ph})`, createdSessionIds),
    );
  }
  if (createdModelIds.length > 0) {
    const ph = createdModelIds.map(() => "?").join(",");
    await cleanup("model_assets", () =>
      conn.execute(`DELETE FROM model_assets WHERE modelId IN (${ph})`, createdModelIds),
    );
    await cleanup("models", () => conn.execute(`DELETE FROM models WHERE id IN (${ph})`, createdModelIds));
  }
  try {
    await conn.end();
  } catch {
    conn.destroy();
  }
}

console.log(failures.length === 0 ? "\nAll Batch B status-agreement legs PASSED" : `\n${failures.length} FAILURES:\n${failures.join("\n")}`);
process.exit(failures.length === 0 ? 0 : 1);
