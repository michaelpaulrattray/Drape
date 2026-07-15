/**
 * Batch 0 authority drive — raw-tRPC invariants E6–E10 (R6 execution plan).
 *
 * FREE ops only: every leg asserts a refusal or a free read; nothing here
 * can reach Gemini or move credits (E10 additionally proves the balance is
 * untouched). Runs against a LOCAL dev server (VERIFY_BASE_URL, default
 * http://localhost:3000) with the verify-bot session — never production.
 *
 *   E6  models.update carries no status authority (strict input) + FR-3(B)
 *   E7  legacy generation.mint is gone
 *   E8  archived reads as deleted (get / list / picker / packageState)
 *   E9  reconcile: legacy imageUrl rejected; foreign asset id rejected
 *   E10 masked iterate refused before any money moves
 *
 * Usage: pnpm dev (separate terminal), then: npx tsx scripts/drive-batch0-authority.mts
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

// ── Session ────────────────────────────────────────────────────────────────
const conn = await mysql.createConnection(process.env.DATABASE_URL!);
await conn.execute(
  `INSERT INTO users (openId, name, email, approved, emailVerified, role)
   VALUES ('verify-bot-local', 'Verify Bot', 'verify-bot@local.test', 1, 1, 'user')
   ON DUPLICATE KEY UPDATE approved = 1, emailVerified = 1`,
);
const [users] = await conn.execute(`SELECT id FROM users WHERE openId = 'verify-bot-local'`);
const userId = (users as Array<{ id: number }>)[0].id;

const token = await new SignJWT({
  openId: "verify-bot-local",
  appId: process.env.VITE_APP_ID,
  name: "Verify Bot",
})
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("1h")
  .sign(new TextEncoder().encode(process.env.JWT_SECRET));
const COOKIE = `app_session_id=${token}`;

// ── Temp fixtures (cleaned up at the end) ──────────────────────────────────
const R2 = process.env.R2_PUBLIC_URL ?? "https://pub-test.r2.dev";
async function insertModel(name: string, status: string, agencyId: string | null) {
  const [res] = await conn.execute(
    `INSERT INTO models (userId, name, status, agencyId, mintedAt, masterPrompt, technicalSchema, preferences)
     VALUES (?, ?, ?, ?, ?, 'drive batch0 temp', '{}', '{}')`,
    [userId, name, status, agencyId, agencyId ? new Date() : null],
  );
  return (res as { insertId: number }).insertId;
}
async function insertAsset(modelId: number, viewType: string) {
  const [res] = await conn.execute(
    `INSERT INTO model_assets (modelId, viewType, resolution, storageUrl, pointsCost)
     VALUES (?, ?, '1K', ?, 0)`,
    [modelId, viewType, `${R2}/drive-batch0/${modelId}-${viewType}.png`],
  );
  return (res as { insertId: number }).insertId;
}

const draftId = await insertModel("Drive B0 Draft", "draft", null);
const mintedId = await insertModel("Drive B0 Minted", "active", "MOD-26-DRB000");
const archivedId = await insertModel("Drive B0 Archived", "archived", null);
const draftHeadshotId = await insertAsset(draftId, "frontClose");
await insertAsset(mintedId, "frontClose");
const mintedAssetId = await insertAsset(mintedId, "frontFull");
await insertAsset(archivedId, "frontClose");

// ── Raw tRPC helpers ───────────────────────────────────────────────────────
async function mutate(path: string, input: unknown) {
  const res = await fetch(`${BASE}/api/trpc/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: COOKIE },
    body: JSON.stringify({ json: input }),
  });
  return { status: res.status, text: await res.text() };
}
async function query(path: string, input: unknown) {
  const url = `${BASE}/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
  const res = await fetch(url, { headers: { cookie: COOKIE } });
  return { status: res.status, text: await res.text() };
}

try {
  // ── E6: status authority ──────────────────────────────────────────────
  const e6a = await mutate("models.update", { modelId: draftId, status: "active" });
  check("E6a update with status-only is rejected (strict)", e6a.status === 400 && e6a.text.includes("BAD_REQUEST"), `status=${e6a.status}`);

  const e6b = await mutate("models.update", { modelId: draftId, name: "Sneak", status: "active" });
  check("E6b update with name+status is rejected", e6b.status === 400, `status=${e6b.status}`);

  const [afterE6] = await conn.execute(`SELECT status, name FROM models WHERE id = ?`, [draftId]);
  const draftRow = (afterE6 as Array<{ status: string; name: string }>)[0];
  check("E6c draft status and name untouched in DB", draftRow.status === "draft" && draftRow.name === "Drive B0 Draft", JSON.stringify(draftRow));

  const e6d = await mutate("models.update", { modelId: mintedId, name: "Drive B0 Renamed" });
  const [mintedRow] = await conn.execute(`SELECT status, agencyId, name FROM models WHERE id = ?`, [mintedId]);
  const m = (mintedRow as Array<{ status: string; agencyId: string; name: string }>)[0];
  check(
    "E6e FR-3(B): minted rename succeeds; status+agencyId untouched",
    e6d.status === 200 && m.name === "Drive B0 Renamed" && m.status === "active" && m.agencyId === "MOD-26-DRB000",
    `status=${e6d.status} row=${JSON.stringify(m)}`,
  );

  const e6f = await mutate("models.update", { modelId: archivedId, name: "Nope" });
  check("E6f archived rename → NOT_FOUND", e6f.status === 404 && e6f.text.includes("NOT_FOUND"), `status=${e6f.status}`);

  // ── E7: legacy mint gone ──────────────────────────────────────────────
  const e7 = await mutate("generation.mint", { modelId: draftId });
  check("E7 legacy generation.mint is removed (404)", e7.status === 404 && e7.text.includes("NOT_FOUND"), `status=${e7.status}`);
  const [e7row] = await conn.execute(`SELECT status, agencyId FROM models WHERE id = ?`, [draftId]);
  const e7m = (e7row as Array<{ status: string; agencyId: string | null }>)[0];
  check("E7b draft not minted by the attempt", e7m.status === "draft" && e7m.agencyId === null, JSON.stringify(e7m));

  // ── E8: archived reads as deleted ─────────────────────────────────────
  const e8a = await query("models.get", { modelId: archivedId });
  check("E8a models.get on archived → NOT_FOUND", e8a.status === 404 && e8a.text.includes("NOT_FOUND"), `status=${e8a.status}`);

  const e8b = await query("models.list", { limit: 100 });
  const listHasArchived = e8b.text.includes(`"Drive B0 Archived"`);
  check("E8b models.list excludes archived", e8b.status === 200 && !listHasArchived, `status=${e8b.status}`);

  const e8c = await query("boardOps.listCastableModels", {});
  const pickerHasDraft = e8c.text.includes(`"Drive B0 Draft"`) || e8c.text.includes(`${R2}/drive-batch0/${draftId}-frontClose.png`);
  const pickerHasArchived = e8c.text.includes(`${R2}/drive-batch0/${archivedId}-frontClose.png`);
  check("E8c picker includes the draft, excludes archived", e8c.status === 200 && pickerHasDraft && !pickerHasArchived, `status=${e8c.status} draft=${pickerHasDraft}`);

  const e8d = await query("generation.packageState", { modelId: archivedId });
  check("E8d packageState on archived → NOT_FOUND", e8d.status === 404, `status=${e8d.status}`);

  // ── E9: reconcile input authority ─────────────────────────────────────
  const e9a = await mutate("generation.reconcile", { modelId: draftId, imageUrl: "https://evil.example/x.png" });
  check("E9a legacy imageUrl input rejected (strict)", e9a.status === 400 && e9a.text.includes("BAD_REQUEST"), `status=${e9a.status}`);

  const e9b = await mutate("generation.reconcile", { modelId: draftId, assetId: mintedAssetId });
  check("E9b another model's asset id → NOT_FOUND", e9b.status === 404 && e9b.text.includes("NOT_FOUND"), `status=${e9b.status}`);

  // ── E10: masked iterate refused before money ──────────────────────────
  const balBefore = await query("credits.getBalance", undefined);
  const e10 = await mutate("generation.iterate", {
    modelId: draftId,
    feedback: "FIX ARTIFACT: Remove the content in the masked area.",
    assetId: draftHeadshotId,
    maskBase64: "data:image/png;base64,AAAA",
  });
  const balAfter = await query("credits.getBalance", undefined);
  check("E10 masked iterate → PRECONDITION_FAILED", e10.status === 412 && e10.text.includes("PRECONDITION_FAILED"), `status=${e10.status}`);
  check("E10b balance untouched by the refused mask", balBefore.text === balAfter.text, "");
} finally {
  // ── Cleanup (temp rows only) ───────────────────────────────────────────
  await conn.execute(`DELETE FROM model_assets WHERE modelId IN (?, ?, ?)`, [draftId, mintedId, archivedId]);
  await conn.execute(`DELETE FROM models WHERE id IN (?, ?, ?)`, [draftId, mintedId, archivedId]);
  await conn.end();
}

if (failures.length > 0) {
  console.error(`\n${failures.length} invariant(s) FAILED: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nAll Batch 0 authority invariants hold.");
