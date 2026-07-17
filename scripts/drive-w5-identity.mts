/**
 * W5-A paid identity-gate calibration against the local app and dev DB.
 *
 * Modes:
 *   legitimate  — fixed matrix legs 1-4
 *   forced-fail — checked same-person iteration/refund legs 5-6 (server: IDENTITY_GATE_FORCE_FAIL=1)
 *   unavailable — fail-closed leg 7 (server: IDENTITY_GATE_FORCE_UNAVAILABLE=1)
 *   retry       — first-candidate rejection leg 8 (server: IDENTITY_GATE_FORCE_FAIL_FIRST=1)
 *
 * The drive refuses every non-local base URL and production app id. It uses
 * only the clearly labelled verify-bot-local account and W5 calibration rows.
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { SignJWT } from "jose";
import mysql from "mysql2/promise";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const MODE = process.env.W5_DRIVE_MODE ?? "legitimate";
const allowedModes = new Set(["legitimate", "forced-fail", "unavailable", "retry"]);
if (!allowedModes.has(MODE)) throw new Error(`Unknown W5_DRIVE_MODE: ${MODE}`);
if (!/^http:\/\/localhost:\d+$/.test(BASE)) throw new Error(`W5 drive refuses non-local base URL: ${BASE}`);
if (process.env.VITE_APP_ID === "drape-production") throw new Error("W5 drive refuses the production app id");
if (process.env.W5_DRIVE_DB_OK !== "local-development-database") {
  throw new Error("W5 drive requires W5_DRIVE_DB_OK=local-development-database after confirming DATABASE_URL is not production");
}
if (!process.env.DATABASE_URL) throw new Error("W5 drive requires a confirmed local-development DATABASE_URL");

type TrpcResult = { status: number; ok: boolean; data: any; message: string };
type Evidence = {
  mode: string;
  startedAt: string;
  balanceBefore: number;
  balanceAfter?: number;
  modelId?: number;
  itemId?: number;
  legs: Array<Record<string, unknown>>;
};

const conn = await mysql.createConnection(process.env.DATABASE_URL!);
await conn.execute(
  `INSERT INTO users (openId, name, email, approved, emailVerified, role)
   VALUES ('verify-bot-local', 'Verify Bot', 'verify-bot@local.test', 1, 1, 'user')
   ON DUPLICATE KEY UPDATE approved = 1, emailVerified = 1`,
);
const [userRows] = await conn.execute(`SELECT id FROM users WHERE openId = 'verify-bot-local'`);
const userId = (userRows as Array<{ id: number }>)[0].id;
await conn.execute(
  `INSERT INTO points (userId, balance, planTier)
   VALUES (?, 5000, 'studio')
   ON DUPLICATE KEY UPDATE balance = GREATEST(balance, 5000), planTier = 'studio'`,
  [userId],
);

let [boardRows] = await conn.execute(
  `SELECT id FROM boards WHERE userId = ? AND name = 'W5 identity calibration' LIMIT 1`,
  [userId],
);
let boardId = (boardRows as Array<{ id: number }>)[0]?.id;
if (!boardId) {
  const [created] = await conn.execute(
    `INSERT INTO boards (userId, name, startedWith) VALUES (?, 'W5 identity calibration', 'casting')`,
    [userId],
  );
  boardId = (created as { insertId: number }).insertId;
}

const [balanceRows] = await conn.execute(`SELECT balance FROM points WHERE userId = ?`, [userId]);
const evidence: Evidence = {
  mode: MODE,
  startedAt: new Date().toISOString(),
  balanceBefore: (balanceRows as Array<{ balance: number }>)[0].balance,
  legs: [],
};

const token = await new SignJWT({
  openId: "verify-bot-local",
  appId: process.env.VITE_APP_ID,
  name: "Verify Bot",
})
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("2h")
  .sign(new TextEncoder().encode(process.env.JWT_SECRET));

async function trpc(procedure: string, input: unknown): Promise<TrpcResult> {
  const response = await fetch(`${BASE}/api/trpc/${procedure}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `app_session_id=${token}`,
    },
    body: JSON.stringify({ json: input }),
  });
  const body = await response.json().catch(() => null) as any;
  return {
    status: response.status,
    ok: response.ok,
    data: body?.result?.data?.json ?? body?.result?.data ?? null,
    message: body?.error?.json?.message ?? body?.error?.message ?? "",
  };
}

function requireOk(label: string, result: TrpcResult): any {
  if (!result.ok) throw new Error(`${label} failed (${result.status}): ${result.message}`);
  return result.data;
}

async function latestFrontClose(modelId: number) {
  const [rows] = await conn.execute(
    `SELECT id, storageUrl FROM model_assets
     WHERE modelId = ? AND viewType = 'frontClose' AND storageUrl IS NOT NULL
     ORDER BY id DESC LIMIT 1`,
    [modelId],
  );
  const asset = (rows as Array<{ id: number; storageUrl: string }>)[0];
  if (!asset) throw new Error(`Model ${modelId} has no headshot`);
  return asset;
}

async function balance() {
  const [rows] = await conn.execute(`SELECT balance FROM points WHERE userId = ?`, [userId]);
  return (rows as Array<{ balance: number }>)[0].balance;
}

async function auditFor(modelId: number) {
  const [rows] = await conn.execute(
    `SELECT id, status, pointsCost, metadata, errorMessage FROM generations
     WHERE userId = ? AND modelId = ? ORDER BY id DESC LIMIT 1`,
    [userId, modelId],
  );
  return (rows as Array<Record<string, unknown>>)[0] ?? null;
}

function jsonObject(value: unknown): Record<string, any> {
  if (value && typeof value === "object") return value as Record<string, any>;
  if (typeof value === "string") return JSON.parse(value) as Record<string, any>;
  return {};
}

async function recastState(modelId: number, itemId: number) {
  const [modelRows] = await conn.execute(
    `SELECT preferences, identityRevisionId FROM models WHERE id = ? AND userId = ? LIMIT 1`,
    [modelId, userId],
  );
  const [itemRows] = await conn.execute(
    `SELECT imageUrl, metadata FROM board_items WHERE id = ? AND boardId = ? LIMIT 1`,
    [itemId, boardId],
  );
  const [versionRows] = await conn.execute(
    `SELECT COUNT(*) AS count FROM board_item_versions WHERE itemId = ?`,
    [itemId],
  );
  const [staleRows] = await conn.execute(
    `SELECT COUNT(*) AS count FROM model_assets
     WHERE modelId = ? AND viewType <> 'frontClose' AND storageUrl IS NOT NULL
       AND JSON_UNQUOTE(JSON_EXTRACT(status, '$.state')) = 'stale'`,
    [modelId],
  );
  const model = (modelRows as Array<Record<string, unknown>>)[0] ?? {};
  const item = (itemRows as Array<Record<string, unknown>>)[0] ?? {};
  return {
    preferences: jsonObject(model.preferences),
    identityRevisionId: model.identityRevisionId ?? null,
    boardImageUrl: item.imageUrl ?? null,
    boardMetadata: jsonObject(item.metadata),
    versionCount: Number((versionRows as Array<{ count: number }>)[0]?.count ?? 0),
    staleSiblingCount: Number((staleRows as Array<{ count: number }>)[0]?.count ?? 0),
  };
}

function requireRecastProof(input: {
  label: string;
  field: string;
  value: unknown;
  imageUrl: string;
  creditNet: number;
  before: Awaited<ReturnType<typeof recastState>>;
  after: Awaited<ReturnType<typeof recastState>>;
  audit: Record<string, unknown> | null;
}) {
  const metadata = jsonObject(input.audit?.metadata);
  if (input.creditNet !== 350) throw new Error(`${input.label}: expected 350 credits, got ${input.creditNet}`);
  if (input.after.preferences[input.field] !== input.value) {
    throw new Error(`${input.label}: durable ${input.field} did not equal ${String(input.value)}`);
  }
  if (!input.after.identityRevisionId || input.after.identityRevisionId === input.before.identityRevisionId) {
    throw new Error(`${input.label}: identity revision did not advance`);
  }
  if (input.after.boardImageUrl !== input.imageUrl) throw new Error(`${input.label}: board did not land the recast image`);
  if (input.after.versionCount !== input.before.versionCount + 1) throw new Error(`${input.label}: board version did not advance exactly once`);
  if (metadata.operationMode !== "structured_recast") throw new Error(`${input.label}: audit did not record structured_recast`);
}

async function saveImage(label: string, url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not fetch ${label} image: ${response.status}`);
  const contentType = response.headers.get("content-type") ?? "image/png";
  const ext = contentType.includes("jpeg") ? "jpg" : contentType.includes("webp") ? "webp" : "png";
  const dir = path.join(os.tmpdir(), "drape-w5-identity-evidence");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${MODE}-${label}.${ext}`);
  await writeFile(file, Buffer.from(await response.arrayBuffer()));
  return file;
}

async function createFixture() {
  const preferences = {
    gender: "Male",
    age: "27",
    ethnicity: "South Asian",
    ethnicityBlend: [{ name: "South Asian", pct: 100 }],
    bodyType: "Athletic",
    faceShape: "Oval",
    jawline: "Sharp / Chiseled",
    cheekbones: "High",
    cheeks: "Balanced",
    eyeShape: "Thin Almond",
    noseShape: "Straight Bridge",
    lipShape: "Full",
    eyebrowStyle: "Straight",
    skinTone: "Deep / Brown",
    skinTexture: "Raw / Standard",
    skinFinish: "Natural",
    eyeColor: "Dark",
    hairStyle: "Short Textured",
    hairColor: "Jet Black",
    hairLength: "Short",
    hairTexture: "Straight",
    hairFringe: "None",
    hairParting: "Side",
    hairVolume: "Natural",
    hairFlyaways: "None",
    hairTuck: "None",
    hairFade: "Low Taper",
    facialHair: "Clean Shaven",
    castingBrand: "Prada",
    castingVibe: { editorial: 0.7, commercial: 0.2, runway: 0.1 },
  };
  const created = requireOk("models.create", await trpc("models.create", {
    name: `W5 calibration ${MODE}`,
    preferences,
  }));
  const modelId = created.modelId as number;
  const cast = requireOk("generation.castingImage", await trpc("generation.castingImage", { modelId }));
  const metadata = {
    provenance: { type: "cast_root", modelId, draft: true, attributes: preferences },
    attributes: preferences,
    status: null,
    isGenerating: false,
    version: 1,
  };
  const [item] = await conn.execute(
    `INSERT INTO board_items
      (boardId, type, kind, label, imageUrl, positionX, positionY, width, height, zIndex, sourceModelId, metadata)
     VALUES (?, 'model', 'cast_config', ?, ?, 100, 100, 280, 360, 0, ?, ?)`,
    [boardId, `W5 calibration ${MODE}`, cast.imageUrl, modelId, JSON.stringify(metadata)],
  );
  return { modelId, itemId: (item as { insertId: number }).insertId, sourceUrl: cast.imageUrl as string };
}

try {
  const existingModelId = Number(process.env.W5_EXISTING_MODEL_ID || 0);
  const existingItemId = Number(process.env.W5_EXISTING_ITEM_ID || 0);
  const fixture = existingModelId && existingItemId
    ? {
        modelId: existingModelId,
        itemId: existingItemId,
        sourceUrl: (await latestFrontClose(existingModelId)).storageUrl,
      }
    : await createFixture();
  evidence.modelId = fixture.modelId;
  evidence.itemId = fixture.itemId;
  evidence.legs.push({ leg: "baseline", ok: true, image: await saveImage("baseline", fixture.sourceUrl) });

  if (MODE === "legitimate") {
    const startLeg = Number(process.env.W5_START_LEG || 1);
    // Leg 1 deliberately creates another candidate first. A user-only Gemini
    // session map would now contaminate the original model's next edit.
    if (process.env.W5_SKIP_VARIATION !== "1") {
      const variation = await trpc("boardOps.runVariations.execute", {
        boardId, itemId: fixture.itemId, count: 1,
      });
      requireOk("variation", variation);
    }
    if (startLeg <= 1) {
      const before1 = await balance();
      const anchor1 = await latestFrontClose(fixture.modelId);
      const hairColor = await trpc("generation.iterate", {
        modelId: fixture.modelId,
        assetId: anchor1.id,
        feedback: "Change only his hair color to vivid hot pink. Keep the same person, skin tone, face, age, build, ethnicity, hair length, and hairstyle exactly unchanged.",
      });
      const after1 = await balance();
      const data1 = requireOk("leg 1 hair color", hairColor);
      const creditNet1 = before1 - after1;
      if (creditNet1 !== 350) throw new Error(`leg 1: expected 350 credits, got ${creditNet1}`);
      evidence.legs.push({
        leg: 1, ok: true, status: hairColor.status, creditNet: creditNet1,
        image: await saveImage("leg1-hair-color", data1.imageUrl), audit: await auditFor(fixture.modelId),
      });
    }

    if (startLeg <= 2) {
      const before2 = await balance();
      const anchor2 = await latestFrontClose(fixture.modelId);
      const hairLength = await trpc("generation.iterate", {
        modelId: fixture.modelId,
        assetId: anchor2.id,
        feedback: "Change only hair length to Very Long.",
      });
      const after2 = await balance();
      const data2 = requireOk("leg 2 hair length", hairLength);
      const creditNet2 = before2 - after2;
      if (creditNet2 !== 350) throw new Error(`leg 2: expected 350 credits, got ${creditNet2}`);
      evidence.legs.push({
        leg: 2, ok: true, status: hairLength.status, creditNet: creditNet2,
        image: await saveImage("leg2-hair-length", data2.imageUrl), audit: await auditFor(fixture.modelId),
      });
    }

    if (startLeg <= 3) {
      const stateBefore3 = await recastState(fixture.modelId, fixture.itemId);
      const before3 = await balance();
      const skinTone = await trpc("boardOps.applyModelEdit.execute", {
        boardId, itemId: fixture.itemId, decision: "update", changes: { skinTone: "Tan / Bronze" }, intent: "edit",
      });
      const after3 = await balance();
      const data3 = requireOk("leg 3 structured skin tone recast", skinTone);
      const stateAfter3 = await recastState(fixture.modelId, fixture.itemId);
      const audit3 = await auditFor(fixture.modelId);
      requireRecastProof({
        label: "leg 3", field: "skinTone", value: "Tan / Bronze", imageUrl: data3.imageUrl,
        creditNet: before3 - after3, before: stateBefore3, after: stateAfter3, audit: audit3,
      });
      evidence.legs.push({
        leg: 3, ok: true, operation: "structured_recast", status: skinTone.status, creditNet: before3 - after3,
        image: await saveImage("leg3-skin-tone", data3.imageUrl), audit: audit3,
        before: stateBefore3, after: stateAfter3,
      });
    }

    if (startLeg <= 4) {
      const stateBefore4 = await recastState(fixture.modelId, fixture.itemId);
      const before4 = await balance();
      const jawline = await trpc("boardOps.applyModelEdit.execute", {
        boardId, itemId: fixture.itemId, decision: "update", changes: { jawline: "Strong / Pronounced" }, intent: "edit",
      });
      const after4 = await balance();
      const data4 = requireOk("leg 4 structured jawline recast", jawline);
      const stateAfter4 = await recastState(fixture.modelId, fixture.itemId);
      const audit4 = await auditFor(fixture.modelId);
      requireRecastProof({
        label: "leg 4", field: "jawline", value: "Strong / Pronounced", imageUrl: data4.imageUrl,
        creditNet: before4 - after4, before: stateBefore4, after: stateAfter4, audit: audit4,
      });
      evidence.legs.push({
        leg: 4, ok: true, operation: "structured_recast", status: jawline.status, creditNet: before4 - after4,
        image: await saveImage("leg4-jawline", data4.imageUrl), audit: audit4,
        before: stateBefore4, after: stateAfter4,
      });
    }
  } else {
    // Legs 5-8 exercise the same-person iteration door. Structured panel
    // changes are intentional recasts and therefore do not use this gate.
    const cases = MODE === "forced-fail"
      ? [
          { leg: 5, label: "injected-hair-color-drift", feedback: "Change only hair color to Copper." },
          { leg: 6, label: "injected-jawline-drift", feedback: "Make only the jawline Strong / Pronounced." },
        ]
      : [{
          leg: MODE === "unavailable" ? 7 : 8,
          label: MODE,
          feedback: "Change only hair color to Copper.",
        }];

    for (const testCase of cases) {
      const before = await balance();
      const anchor = await latestFrontClose(fixture.modelId);
      const result = await trpc("generation.iterate", {
        modelId: fixture.modelId,
        assetId: anchor.id,
        feedback: testCase.feedback,
      });
      const after = await balance();
      const anchorAfter = await latestFrontClose(fixture.modelId);
      const audit = await auditFor(fixture.modelId);
      const expectedPass = MODE === "retry";
      const creditNet = before - after;
      if (expectedPass && !result.ok) throw new Error(`leg ${testCase.leg}: retry should pass (${result.status} ${result.message})`);
      if (!expectedPass && result.ok) throw new Error(`leg ${testCase.leg}: fail-closed drive unexpectedly passed`);
      if (expectedPass && creditNet !== 350) throw new Error(`leg ${testCase.leg}: expected 350 credits, got ${creditNet}`);
      if (!expectedPass && creditNet !== 0) throw new Error(`leg ${testCase.leg}: refusal did not net to zero credits (${creditNet})`);
      if (expectedPass && anchorAfter.id === anchor.id) throw new Error(`leg ${testCase.leg}: passing retry did not commit a new anchor`);
      if (!expectedPass && anchorAfter.id !== anchor.id) throw new Error(`leg ${testCase.leg}: refused iteration committed an anchor`);
      evidence.legs.push({
        leg: testCase.leg,
        ok: true,
        status: result.status,
        message: result.message,
        creditNet,
        anchorBefore: anchor.id,
        anchorAfter: anchorAfter.id,
        audit,
        ...(result.ok && result.data?.imageUrl
          ? { image: await saveImage(testCase.label, result.data.imageUrl) }
          : {}),
      });
    }
  }
} finally {
  evidence.balanceAfter = await balance();
  const evidenceDir = path.join(os.tmpdir(), "drape-w5-identity-evidence");
  await mkdir(evidenceDir, { recursive: true });
  const evidenceFile = path.join(evidenceDir, `${MODE}-report.json`);
  await writeFile(evidenceFile, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ evidenceFile, ...evidence }, null, 2));
  await conn.end();
}
