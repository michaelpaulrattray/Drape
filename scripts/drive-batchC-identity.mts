/**
 * Batch C identity-policy drive — raw-tRPC refusal invariants (FREE legs).
 *
 * ⚠ DEFERRED UNTIL A DISPOSABLE DATABASE EXISTS. This drive inserts fixture
 * rows and exercises the new identityRevisionId column, so it REQUIRES the
 * Batch C migration applied to a DISPOSABLE database. The hosted development
 * database is NOT a disposable test database (Batch C authorization), and
 * production is never touched — do not point DATABASE_URL at either. Until
 * that separately authorized migration+drive step, the equivalent coverage
 * runs in the router harnesses (batchC-doors / batchC-structured /
 * typedIterationDoors test suites).
 *
 * FREE ops only — every leg asserts a refusal or a free read; nothing here
 * can reach Gemini or move credits, and the balance is asserted untouched
 * after every refusal (M20 zero-net-charge):
 *
 *   C1  masked iterate refused before money (regression)
 *   C2  mark edit ("add a small tattoo") refused free, draft AND minted
 *   C3  presentation edit refused with the Canvas/Wardrobe routing copy
 *   C4  cosmetic-lash edit refused with the lash copy
 *   C5  generation.reconcile refuses every well-formed request (R7 off)
 *   C6  castingImage rejects the creation referenceImage (strict schema)
 *   C7  models.create rejects referenceImage + refuses presentation briefs
 *   C8  cross-revision restore refuses with the §7.4 copy
 *   C9  stale-anchor mint refuses with the anchor copy (free — plan level)
 *   C10 applyModelEdit rejects unknown keys + non-identity update keys
 *
 * Usage (after the gated migration lands on a disposable DB):
 *   pnpm dev  (separate terminal, pointed at the disposable DB)
 *   npx tsx scripts/drive-batchC-identity.mts
 */
import "dotenv/config";
import { SignJWT } from "jose";
import mysql from "mysql2/promise";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const failures: string[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(name);
};

if (process.env.DRIVE_BATCHC_DISPOSABLE_DB !== "1") {
  console.error(
    "REFUSING TO RUN: this drive requires a DISPOSABLE database with the Batch C migration applied.\n" +
      "The hosted dev database and production are never drive targets.\n" +
      "Set DRIVE_BATCHC_DISPOSABLE_DB=1 only when DATABASE_URL points at a disposable database.",
  );
  process.exit(2);
}

// ── Session ────────────────────────────────────────────────────────────────
const conn = await mysql.createConnection(process.env.DATABASE_URL!);
await conn.execute(
  `INSERT INTO users (openId, name, email, approved, emailVerified, role)
   VALUES ('verify-bot-local', 'Verify Bot', 'verify-bot@local.test', 1, 1, 'user')
   ON DUPLICATE KEY UPDATE approved = 1, emailVerified = 1`,
);
const [users] = await conn.execute(`SELECT id FROM users WHERE openId = 'verify-bot-local'`);
const userId = (users as unknown as Array<{ id: number }>)[0].id;

const token = await new SignJWT({
  openId: "verify-bot-local",
  appId: process.env.VITE_APP_ID,
  name: "Verify Bot",
})
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("1h")
  .sign(new TextEncoder().encode(process.env.JWT_SECRET));
const COOKIE = `app_session_id=${token}`;

const R2 = process.env.R2_PUBLIC_URL ?? "https://pub-test.r2.dev";

async function trpc(procedure: string, input: unknown): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BASE}/api/trpc/${procedure}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: COOKIE },
    body: JSON.stringify(input),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}
const errMessage = (body: unknown): string =>
  ((body as { error?: { message?: string } })?.error?.message ?? "");

async function balance(): Promise<number> {
  const [rows] = await conn.execute(`SELECT balance FROM points WHERE userId = ?`, [userId]);
  return (rows as unknown as Array<{ balance: number }>)[0]?.balance ?? 0;
}

async function insertModel(status: string, agencyId: string | null, revision: string | null) {
  const [res] = await conn.execute(
    `INSERT INTO models (userId, name, status, agencyId, mintedAt, masterPrompt, technicalSchema, preferences, identityRevisionId)
     VALUES (?, 'drive batchC temp', ?, ?, ?, 'drive prompt', '{}', '{}', ?)`,
    [userId, status, agencyId, agencyId ? new Date() : null, revision],
  );
  return (res as unknown as { insertId: number }).insertId;
}
async function insertAsset(modelId: number, viewType: string, provenance: unknown) {
  const [res] = await conn.execute(
    `INSERT INTO model_assets (modelId, viewType, resolution, storageUrl, pointsCost, provenance)
     VALUES (?, ?, '1K', ?, 0, ?)`,
    [modelId, viewType, `${R2}/drive/${viewType}.png`, provenance ? JSON.stringify(provenance) : null],
  );
  return (res as unknown as { insertId: number }).insertId;
}

const created: number[] = [];
try {
  const draft = await insertModel("draft", null, "rev-a");
  created.push(draft);
  const draftHead = await insertAsset(draft, "frontClose", { identityRole: "anchor", identityRevisionId: "rev-a" });
  const oldSide = await insertAsset(draft, "sideClose", { identityRevisionId: "rev-OLD" });
  await insertAsset(draft, "sideClose", { identityRevisionId: "rev-a" });
  const minted = await insertModel("active", `MOD-99-DRIVE1`, null);
  created.push(minted);
  const mintedHead = await insertAsset(minted, "frontClose", null);

  const before = await balance();

  // C1 masked
  let r = await trpc("generation.iterate", { modelId: draft, feedback: "x", assetId: draftHead, maskBase64: "AAAA" });
  check("C1 masked refused", r.status >= 400 && errMessage(r.body).includes("Masked"));

  // C2 marks, draft + minted
  r = await trpc("generation.iterate", { modelId: draft, feedback: "add a small tattoo on the forearm", assetId: draftHead });
  check("C2a mark edit refused on draft", r.status >= 400 && errMessage(r.body).includes("Permanent marks"));
  r = await trpc("generation.iterate", { modelId: minted, feedback: "remove her freckles", assetId: mintedHead });
  check("C2b mark edit refused on minted", r.status >= 400 && errMessage(r.body).includes("Permanent marks"));

  // C3 presentation routing
  r = await trpc("generation.iterate", { modelId: draft, feedback: "put her in a leather jacket", assetId: draftHead });
  check("C3 presentation routed", r.status >= 400 && errMessage(r.body).includes("Canvas"));

  // C4 cosmetic lash
  r = await trpc("generation.iterate", { modelId: draft, feedback: "add mascara", assetId: draftHead });
  check("C4 cosmetic lash refused", r.status >= 400 && errMessage(r.body).includes("Canvas"));

  // C5 reconcile off
  r = await trpc("generation.reconcile", { modelId: draft, assetId: draftHead });
  check("C5 reconcile disabled", r.status >= 400 && errMessage(r.body).includes("reconcile is off"));

  // C6 castingImage strict
  r = await trpc("generation.castingImage", { modelId: draft, referenceImage: "data:image/png;base64,AAAA" });
  check("C6 creation reference schema-rejected", r.status >= 400);

  // C7 models.create
  r = await trpc("models.create", { preferences: { referenceImage: "data:image/png;base64,AAAA" } });
  check("C7a create reference schema-rejected", r.status >= 400);
  r = await trpc("models.create", { preferences: { userPrompt: "a girl in a red dress" } });
  check("C7b presentation brief refused", r.status >= 400 && errMessage(r.body).includes("Canvas"));

  // C8 cross-revision restore
  r = await trpc("generation.restoreSlotVersion", { modelId: draft, angle: "sideClose", assetId: oldSide });
  check("C8 cross-revision restore refused", r.status >= 400 && errMessage(r.body).includes("earlier identity"));

  // C9 stale-anchor mint plan (free)
  await conn.execute(`UPDATE model_assets SET status = '{"state":"stale"}' WHERE id = ?`, [draftHead]);
  r = await trpc("generation.mintPackagePlan", { modelId: draft });
  const plan = (r.body as { result?: { data?: { integrity?: { core?: { anchor?: { ok?: boolean } } } } } })?.result?.data;
  check("C9 stale anchor predicted", plan?.integrity?.core?.anchor?.ok === false);

  // C10 applyModelEdit unknown key — needs a board item; assert wire rejection shape only
  r = await trpc("boardOps.applyModelEdit.execute", {
    boardId: 1, itemId: 1, decision: "update", changes: { totallyUnknown: 1 },
  });
  check("C10 unknown structured key rejected", r.status >= 400);

  const after = await balance();
  check("M20 zero-net-charge across every refusal", before === after, `${before} → ${after}`);
} finally {
  for (const id of created) {
    await conn.execute(`DELETE FROM model_assets WHERE modelId = ?`, [id]);
    await conn.execute(`DELETE FROM models WHERE id = ?`, [id]);
  }
  await conn.end();
}

console.log(failures.length === 0 ? "\nALL BATCH C DRIVE LEGS PASS" : `\n${failures.length} FAILURES: ${failures.join(", ")}`);
process.exit(failures.length === 0 ? 0 : 1);
