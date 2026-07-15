/**
 * Batch 0 UI drive — browser-level closure checks (R6 execution plan,
 * review item 4 + item 2's rendering decision).
 *
 *   UI1  an existing placement whose source model is ARCHIVED renders the
 *        D-12 "Source unavailable" state (stored snapshot retained on the
 *        row; the stored image is not rendered as if the source existed)
 *   UI2  the casting environment (takeover) exposes NO surgical / eraser
 *        controls on any view — the masked-edit surface is closed at the
 *        UI layer, while typed iteration (the refine bar) survives
 *
 * FREE: no generation is triggered; seeded rows are cleaned up. Runs against
 * a LOCAL dev server only (VERIFY_BASE_URL, default http://localhost:3000).
 *
 * Usage: pnpm dev (separate terminal), then: npx tsx scripts/drive-batch0-ui.mts
 */
import "dotenv/config";
import { SignJWT } from "jose";
import mysql from "mysql2/promise";
import puppeteer from "puppeteer-core";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const R2 = process.env.R2_PUBLIC_URL ?? "https://pub-test.r2.dev";

const failures: string[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(name);
};

// ── Session + seeds ────────────────────────────────────────────────────────
const conn = await mysql.createConnection(process.env.DATABASE_URL!);
await conn.execute(
  `INSERT INTO users (openId, name, email, approved, emailVerified, role)
   VALUES ('verify-bot-local', 'Verify Bot', 'verify-bot@local.test', 1, 1, 'user')
   ON DUPLICATE KEY UPDATE approved = 1, emailVerified = 1`,
);
const [users] = await conn.execute(`SELECT id FROM users WHERE openId = 'verify-bot-local'`);
const userId = (users as Array<{ id: number }>)[0].id;

let [boards] = await conn.execute(
  `SELECT id FROM boards WHERE userId = ? AND name = 'batch0-ui-drive' LIMIT 1`,
  [userId],
);
let boardId = (boards as Array<{ id: number }>)[0]?.id;
if (!boardId) {
  const [res] = await conn.execute(
    `INSERT INTO boards (userId, name, startedWith) VALUES (?, 'batch0-ui-drive', 'blank')`,
    [userId],
  );
  boardId = (res as { insertId: number }).insertId;
}
await conn.execute(`DELETE FROM board_items WHERE boardId = ?`, [boardId]);
await conn.execute(`DELETE FROM board_edges WHERE boardId = ?`, [boardId]);
await conn.execute(`UPDATE boards SET viewportX = 0, viewportY = 0, viewportZoom = 100 WHERE id = ?`, [boardId]);

async function insertModel(name: string, status: string, agencyId: string | null) {
  const [res] = await conn.execute(
    `INSERT INTO models (userId, name, status, agencyId, mintedAt, masterPrompt, technicalSchema, preferences)
     VALUES (?, ?, ?, ?, ?, 'drive batch0-ui temp', '{}', '{}')`,
    [userId, name, status, agencyId, agencyId ? new Date() : null],
  );
  return (res as { insertId: number }).insertId;
}
const ARCHIVED_URL = `${R2}/drive-batch0-ui/archived-frontClose.png`;
const MINTED_URL = `${R2}/drive-batch0-ui/minted-frontClose.png`;
const archivedId = await insertModel("B0UI Archived", "archived", null);
const mintedId = await insertModel("B0UI Minted", "active", "MOD-26-DRB0U1");
await conn.execute(
  `INSERT INTO model_assets (modelId, viewType, resolution, storageUrl, pointsCost) VALUES (?, 'frontClose', '1K', ?, 0)`,
  [archivedId, ARCHIVED_URL],
);
await conn.execute(
  `INSERT INTO model_assets (modelId, viewType, resolution, storageUrl, pointsCost) VALUES (?, 'frontClose', '1K', ?, 0)`,
  [mintedId, MINTED_URL],
);
async function insertItem(label: string, modelId: number, imageUrl: string, x: number) {
  const [res] = await conn.execute(
    `INSERT INTO board_items (boardId, type, kind, label, imageUrl, positionX, positionY, width, height, zIndex, metadata, sourceModelId)
     VALUES (?, 'model', 'image', ?, ?, ?, 120, 280, 420, 0, CAST(? AS JSON), ?)`,
    [boardId, label, imageUrl, x, JSON.stringify({ provenance: { type: "library_cast", modelId, viewAngle: "frontClose" }, version: 1 }), modelId],
  );
  return (res as { insertId: number }).insertId;
}
const archivedItemId = await insertItem("B0UI ArchivedSeed", archivedId, ARCHIVED_URL, 200);
const mintedItemId = await insertItem("B0UI MintedSeed", mintedId, MINTED_URL, 600);

const token = await new SignJWT({
  openId: "verify-bot-local",
  appId: process.env.VITE_APP_ID,
  name: "Verify Bot",
})
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("1h")
  .sign(new TextEncoder().encode(process.env.JWT_SECRET));

// ── Browser ────────────────────────────────────────────────────────────────
const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: "new" as never,
  args: ["--window-size=1600,1000"],
  defaultViewport: { width: 1600, height: 1000 },
});

try {
  const page = await browser.newPage();
  await page.setCookie({ name: "app_session_id", value: token, domain: "localhost", path: "/" });
  await page.goto(`${BASE}/app/board/${boardId}`, { waitUntil: "networkidle2", timeout: 60000 });

  // ── UI1: archived-source placement degrades to "Source unavailable" ────
  await page.waitForFunction(
    () => document.body.innerText.includes("Source unavailable"),
    { timeout: 60000 },
  );
  const ui1 = await page.evaluate((archivedUrl: string) => {
    const hasFallbackText = document.body.innerText.includes("Source unavailable");
    // The archived source's stored image must NOT render as a normal image
    const archivedImgRendered = !!document.querySelector(`img[src="${archivedUrl}"]`);
    return { hasFallbackText, archivedImgRendered };
  }, ARCHIVED_URL);
  check(
    "UI1 archived-source node renders 'Source unavailable' (image not rendered as live)",
    ui1.hasFallbackText && !ui1.archivedImgRendered,
    JSON.stringify(ui1),
  );

  // ── UI2: the casting environment exposes no masked-edit controls ───────
  await page.evaluate(
    (itemId: number, modelId: number) => {
      window.dispatchEvent(
        new CustomEvent("board-edit-cast", { detail: { itemId, modelId, draft: false } }),
      );
    },
    mintedItemId,
    mintedId,
  );
  // The takeover's refine bar (typed iteration) must appear…
  await page.waitForFunction(() => !!document.querySelector("textarea"), { timeout: 60000 });
  const ui2 = await page.evaluate(() => {
    const surgical = document.querySelectorAll('[title="Surgical edit"]').length;
    const eraser = document.querySelectorAll('[title="Magic eraser"]').length;
    const refineBar = !!document.querySelector("textarea");
    return { surgical, eraser, refineBar };
  });
  check(
    "UI2 environment has NO surgical/eraser controls; typed refine bar present",
    ui2.surgical === 0 && ui2.eraser === 0 && ui2.refineBar,
    JSON.stringify(ui2),
  );
} finally {
  await browser.close();
  await conn.execute(`DELETE FROM board_items WHERE boardId = ?`, [boardId]);
  await conn.execute(`DELETE FROM model_assets WHERE modelId IN (?, ?)`, [archivedId, mintedId]);
  await conn.execute(`DELETE FROM models WHERE id IN (?, ?)`, [archivedId, mintedId]);
  await conn.end();
}

if (failures.length > 0) {
  console.error(`\n${failures.length} UI invariant(s) FAILED: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nAll Batch 0 UI invariants hold.");
