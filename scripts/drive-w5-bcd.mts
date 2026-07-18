/**
 * Isolated W5-B/C/D browser drive. Localhost + verify-bot only.
 * Seeds one dedicated board, exercises live naming and the five strip states,
 * proves refreshing-over-stale and warning clear from fresh package truth,
 * then runs two real variations and observes optimistic + settled connectors.
 */
import 'dotenv/config';
import os from 'node:os';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { SignJWT } from 'jose';
import mysql from 'mysql2/promise';
import puppeteer from 'puppeteer-core';

const BASE = process.env.VERIFY_BASE_URL ?? 'http://localhost:3001';
if (!/^http:\/\/localhost:\d+$/.test(BASE)) throw new Error(`Refusing non-local base: ${BASE}`);
if (process.env.VITE_APP_ID === 'drape-production') throw new Error('Refusing production app identity');
if (!process.env.DATABASE_URL || !process.env.JWT_SECRET || !process.env.VITE_APP_ID) {
  throw new Error('DATABASE_URL, JWT_SECRET and VITE_APP_ID are required');
}

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const evidenceDir = path.join(os.tmpdir(), 'drape-w5-bcd-evidence');
await mkdir(evidenceDir, { recursive: true });
const failures: string[] = [];
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
};
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const conn = await mysql.createConnection(process.env.DATABASE_URL);
await conn.execute(
  `INSERT INTO users (openId, name, email, approved, emailVerified, role)
   VALUES ('verify-bot-local', 'Verify Bot', 'verify-bot@local.test', 1, 1, 'user')
   ON DUPLICATE KEY UPDATE approved = 1, emailVerified = 1`,
);
const [userRows] = await conn.execute(`SELECT id FROM users WHERE openId = 'verify-bot-local'`);
const userId = (userRows as Array<{ id: number }>)[0].id;
await conn.execute(
  `INSERT INTO points (userId, balance, planTier) VALUES (?, 5000, 'studio')
   ON DUPLICATE KEY UPDATE balance = GREATEST(balance, 5000), planTier = 'studio'`,
  [userId],
);

let [boardRows] = await conn.execute(
  `SELECT id FROM boards WHERE userId = ? AND name = 'W5 BCD isolated drive' LIMIT 1`,
  [userId],
);
let boardId = (boardRows as Array<{ id: number }>)[0]?.id;
if (!boardId) {
  const [created] = await conn.execute(
    `INSERT INTO boards (userId, name, startedWith) VALUES (?, 'W5 BCD isolated drive', 'blank')`,
    [userId],
  );
  boardId = (created as { insertId: number }).insertId;
}
await conn.execute(`DELETE FROM board_edges WHERE boardId = ?`, [boardId]);
await conn.execute(`DELETE FROM board_item_versions WHERE itemId IN (SELECT id FROM board_items WHERE boardId = ?)`, [boardId]);
await conn.execute(`DELETE FROM board_items WHERE boardId = ?`, [boardId]);
await conn.execute(`UPDATE boards SET viewportX = 100, viewportY = 100, viewportZoom = 100 WHERE id = ?`, [boardId]);

const [templates] = await conn.execute(
  `SELECT m.masterPrompt, m.technicalSchema, m.preferences, a.storageUrl
   FROM models m JOIN model_assets a ON a.modelId = m.id AND a.viewType = 'frontClose'
   WHERE m.userId = ? AND a.storageUrl LIKE 'http%'
     AND m.masterPrompt IS NOT NULL AND LENGTH(m.masterPrompt) > 100
     AND m.preferences IS NOT NULL
   ORDER BY m.id DESC LIMIT 1`,
  [userId],
);
const template = (templates as Array<{
  masterPrompt: string;
  technicalSchema: unknown;
  preferences: unknown;
  storageUrl: string;
}>)[0];
if (!template) throw new Error('verify-bot needs one real cast template; run the W5-A legitimate drive first');
const jsonValue = (value: unknown) => typeof value === 'string' ? value : JSON.stringify(value ?? {});

const [modelResult] = await conn.execute(
  `INSERT INTO models (userId, name, status, masterPrompt, technicalSchema, preferences)
   VALUES (?, 'W5 BCD Daniel', 'draft', ?, ?, ?)`,
  [userId, template.masterPrompt, jsonValue(template.technicalSchema), jsonValue(template.preferences)],
);
const modelId = (modelResult as { insertId: number }).insertId;
const assetIds: Record<string, number> = {};
for (const angle of ['frontClose', 'threeQuarter', 'frontFull']) {
  const [assetResult] = await conn.execute(
    `INSERT INTO model_assets (modelId, viewType, resolution, storageUrl, pointsCost, status)
     VALUES (?, ?, '1K', ?, 0, ?)`,
    [
      modelId,
      angle,
      template.storageUrl,
      angle === 'threeQuarter'
        ? JSON.stringify({ state: 'stale', at: new Date().toISOString() })
        : null,
    ],
  );
  assetIds[angle] = (assetResult as { insertId: number }).insertId;
}
const [failedAsset] = await conn.execute(
  `INSERT INTO model_assets (modelId, viewType, resolution, storageUrl, pointsCost, status)
   VALUES (?, 'sideClose', '1K', '', 0, ?)`,
  [modelId, JSON.stringify({ state: 'failed', reason: 'W5 drive gate marker', refunded: 300, at: new Date().toISOString() })],
);
const failedAssetId = (failedAsset as { insertId: number }).insertId;

const place = async (x: number, label: string, customLabel = false) => {
  const metadata = {
    provenance: { type: 'library_cast', modelId, viewAngle: 'frontClose', draft: true },
    version: 1,
    ...(customLabel ? { customLabel: true } : {}),
  };
  const [result] = await conn.execute(
    `INSERT INTO board_items
      (boardId, type, kind, label, imageUrl, positionX, positionY, width, height, zIndex, metadata, sourceModelId)
     VALUES (?, 'model', 'image', ?, ?, ?, 120, 280, 420, 0, ?, ?)`,
    [boardId, label, template.storageUrl, x, JSON.stringify(metadata), modelId],
  );
  return (result as { insertId: number }).insertId;
};
const firstItemId = await place(120, 'Draft Model');
const secondItemId = await place(520, 'Old snapshot label');

const token = await new SignJWT({
  openId: 'verify-bot-local',
  appId: process.env.VITE_APP_ID,
  name: 'Verify Bot',
})
  .setProtectedHeader({ alg: 'HS256' })
  .setExpirationTime('2h')
  .sign(new TextEncoder().encode(process.env.JWT_SECRET));

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new' as never,
  pipe: true,
  args: ['--window-size=1600,1000'],
  defaultViewport: { width: 1600, height: 1000 },
});
const page = await browser.newPage();
page.setDefaultTimeout(90_000);
await page.setCookie({ name: 'app_session_id', value: token, domain: 'localhost', path: '/' });
await page.goto(`${BASE}/app/board/${boardId}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.waitForSelector('button[aria-label="Select"]');
await page.waitForSelector(`.react-flow__node[data-id="item-${firstItemId}"]`);
await sleep(1200);

const labelsBefore = await page.evaluate((ids: number[]) => ids.map((id) => ({
  id,
  text: document.querySelector(`.react-flow__node[data-id="item-${id}"]`)?.textContent ?? '',
})), [firstItemId, secondItemId]);
check(
  'C1 duplicate placements display the live source name over stale snapshots',
  labelsBefore.every((row) => row.text.includes('W5 BCD Daniel')),
  JSON.stringify(labelsBefore),
);

await page.click(`.react-flow__node[data-id="item-${firstItemId}"]`, { button: 'right' });
await page.waitForFunction(
  () => [...document.querySelectorAll('button')].some((button) => button.textContent?.trim() === 'Rename node (this placement only)'),
);
check('C2 context menu explains placement-only rename', true);
await page.evaluate(() => {
  const button = [...document.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === 'Rename node (this placement only)',
  ) as HTMLElement | undefined;
  button?.click();
});
const renameInput = await page.waitForSelector(`.react-flow__node[data-id="item-${firstItemId}"] input`);
await renameInput?.click({ clickCount: 3 });
await renameInput?.type('Hero placement');
await renameInput?.press('Enter');
for (let i = 0; i < 20; i++) {
  const [rows] = await conn.execute(`SELECT label, metadata FROM board_items WHERE id = ?`, [firstItemId]);
  const row = (rows as Array<{ label: string; metadata: unknown }>)[0];
  const metadata = typeof row?.metadata === 'string' ? JSON.parse(row.metadata) : row?.metadata as Record<string, unknown>;
  if (row?.label === 'Hero placement' && metadata?.customLabel === true) break;
  await sleep(250);
}
await conn.execute(`UPDATE models SET name = 'W5 BCD Renamed' WHERE id = ?`, [modelId]);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector(`.react-flow__node[data-id="item-${secondItemId}"]`);
await sleep(1000);
const labelsAfter = await page.evaluate((ids: number[]) => ids.map((id) =>
  document.querySelector(`.react-flow__node[data-id="item-${id}"]`)?.textContent ?? '',
), [firstItemId, secondItemId]);
check(
  'C3 custom placement stays custom while ordinary duplicate follows renamed model',
  labelsAfter[0].includes('Hero placement') && labelsAfter[1].includes('W5 BCD Renamed'),
  JSON.stringify(labelsAfter),
);

await page.evaluate((detail) => {
  window.dispatchEvent(new CustomEvent('board-edit-cast', { detail }));
}, { itemId: secondItemId, modelId, draft: true });
await page.waitForFunction(() => document.body.textContent?.includes('W5 BCD Renamed — draft'));
check('C4 Studio quietly shows the honest draft name', true);

await page.waitForSelector('button[aria-label^="3/4 is out of sync"]');
const stripTruth = await page.evaluate(() => ({
  current: !!document.querySelector('button[aria-label="Head"]'),
  stale: !!document.querySelector('button[aria-label^="3/4 is out of sync"]'),
  failed: [...document.querySelectorAll('button')].some((button) => button.textContent?.includes('Side · Retry')),
  missing: ['Walk', 'Back'].every((label) => [...document.querySelectorAll('button')].some(
    (button) => button.textContent?.trim() === label && button.title.startsWith('Add this view'),
  )),
}));
check('B1 strip distinguishes current, stale, failed and missing states', Object.values(stripTruth).every(Boolean), JSON.stringify(stripTruth));
await page.screenshot({ path: path.join(evidenceDir, 'strip-states.png') });

await page.evaluate(async (mId: number) => {
  const module = await import('/src/features/casting/stores/useCastingRefreshStore.ts');
  module.useCastingRefreshStore.getState().begin(mId, ['threeQuarter']);
}, modelId);
await page.waitForSelector('button[aria-label^="3/4 is refreshing"][aria-busy="true"]');
const refreshingTruth = await page.evaluate(() => ({
  refreshing: !!document.querySelector('button[aria-label^="3/4 is refreshing"][aria-busy="true"]'),
  staleDot: !!document.querySelector('button[aria-label^="3/4 is refreshing"] span[title^="Out of sync"]'),
  summary: [...document.querySelectorAll('button')].some((button) => button.textContent?.trim() === '1 refreshing'),
}));
check('B2 refreshing overrides stale on the exact slot', refreshingTruth.refreshing && !refreshingTruth.staleDot && refreshingTruth.summary, JSON.stringify(refreshingTruth));
await page.screenshot({ path: path.join(evidenceDir, 'strip-refreshing.png') });
await page.evaluate(async (mId: number) => {
  const module = await import('/src/features/casting/stores/useCastingRefreshStore.ts');
  module.useCastingRefreshStore.getState().end(mId, ['threeQuarter']);
}, modelId);

await page.evaluate(async () => {
  const module = await import('/src/features/casting/stores/useCastingGenerationStore.ts');
  module.useCastingGenerationStore.getState().setIdentityWarning('W5 drive warning');
});
await page.waitForFunction(() => document.body.textContent?.includes('W5 drive warning'));
await conn.execute(`DELETE FROM model_assets WHERE id = ?`, [failedAssetId]);
await page.evaluate(() => window.dispatchEvent(new CustomEvent('casting-open-package-health')));
await page.waitForFunction(() => document.body.textContent?.includes('Package health'));
await page.waitForFunction(() => [...document.querySelectorAll('button')].some(
  (button) => button.textContent?.trim().startsWith('Refresh ·'),
));
const clickedRefresh = await page.evaluate(() => {
  // The failed marker was removed before opening this dialog, so the stale
  // Three-quarter row is the only individual Refresh action.
  const button = [...document.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim().startsWith('Refresh ·'),
  ) as HTMLElement | undefined;
  button?.click();
  return Boolean(button);
});
check('B3 package-health stale refresh is reachable', clickedRefresh);
if (clickedRefresh) {
  await page.waitForSelector('button[aria-label^="3/4 is refreshing"][aria-busy="true"]', { timeout: 10_000 }).catch(() => null);
  await page.waitForFunction(
    () => !document.body.textContent?.includes('W5 drive warning'),
    { timeout: 180_000, polling: 500 },
  ).catch(() => null);
}
const packageAfter = await page.evaluate(async (mId: number) => {
  const response = await fetch(`/api/trpc/generation.packageState?input=${encodeURIComponent(JSON.stringify({ json: { modelId: mId } }))}`, { credentials: 'include' });
  const body = await response.json();
  const slots = body?.result?.data?.json?.slots ?? [];
  return {
    warningGone: !document.body.textContent?.includes('W5 drive warning'),
    stale: slots.filter((slot: any) => slot.stale).length,
    failed: slots.filter((slot: any) => slot.failed).length,
  };
}, modelId);
check('B4 banner clears only after fetched package truth is clean', packageAfter.warningGone && packageAfter.stale === 0 && packageAfter.failed === 0, JSON.stringify(packageAfter));

await page.goto(`${BASE}/app/board/${boardId}`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector(`.react-flow__node[data-id="item-${secondItemId}"]`);
await sleep(800);
const beforeCounts = await page.evaluate(() => ({
  nodes: document.querySelectorAll('.react-flow__node').length,
  edges: document.querySelectorAll('.react-flow__edge').length,
}));
await page.evaluate((detail) => {
  window.dispatchEvent(new CustomEvent('board-run-variations', { detail }));
}, {
  itemId: secondItemId,
  count: 2,
  positions: [{ x: 920, y: 120 }, { x: 1260, y: 120 }],
});
await page.waitForFunction(
  (before: { nodes: number; edges: number }) =>
    document.querySelectorAll('.react-flow__node').length === before.nodes + 2
      && document.querySelectorAll('.react-flow__edge').length === before.edges + 2,
  { timeout: 5_000, polling: 50 },
  beforeCounts,
).catch(() => null);
const loadingCounts = await page.evaluate(() => ({
  nodes: document.querySelectorAll('.react-flow__node').length,
  edges: document.querySelectorAll('.react-flow__edge').length,
  tempNodes: [...document.querySelectorAll('.react-flow__node')].filter((node) => (node.getAttribute('data-id') ?? '').startsWith('item--')).length,
}));
check(
  'D1 two loading variations immediately show two lineage connectors',
  loadingCounts.nodes === beforeCounts.nodes + 2 && loadingCounts.edges === beforeCounts.edges + 2 && loadingCounts.tempNodes === 2,
  JSON.stringify({ beforeCounts, loadingCounts }),
);
await page.screenshot({ path: path.join(evidenceDir, 'variations-loading.png') });

let durableEdges = 0;
for (let i = 0; i < 180; i++) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS count FROM board_edges
     WHERE boardId = ? AND sourceItemId = ? AND relation = 'variant_of'`,
    [boardId, secondItemId],
  );
  durableEdges = Number((rows as Array<{ count: number }>)[0]?.count ?? 0);
  if (durableEdges === 2) break;
  await sleep(1000);
}
await page.waitForFunction(
  (before: { edges: number }) => document.querySelectorAll('.react-flow__edge').length === before.edges + 2
    && ![...document.querySelectorAll('.react-flow__node')].some((node) => (node.getAttribute('data-id') ?? '').startsWith('item--')),
  { timeout: 30_000, polling: 250 },
  beforeCounts,
).catch(() => null);
const settledCounts = await page.evaluate(() => ({
  edges: document.querySelectorAll('.react-flow__edge').length,
  tempNodes: [...document.querySelectorAll('.react-flow__node')].filter((node) => (node.getAttribute('data-id') ?? '').startsWith('item--')).length,
}));
check(
  'D2 settlement leaves exactly one durable connector per candidate',
  durableEdges === 2 && settledCounts.edges === beforeCounts.edges + 2 && settledCounts.tempNodes === 0,
  JSON.stringify({ durableEdges, settledCounts }),
);
await page.screenshot({ path: path.join(evidenceDir, 'variations-settled.png') });

const [balanceRows] = await conn.execute(`SELECT balance FROM points WHERE userId = ?`, [userId]);
console.log(`EVIDENCE ${evidenceDir}`);
console.log(`VERIFY_BALANCE ${(balanceRows as Array<{ balance: number }>)[0]?.balance}`);

await browser.close();
await conn.end();
if (failures.length) {
  console.error(`${failures.length} W5 B/C/D drive assertion(s) failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('W5 B/C/D ISOLATED DRIVE PASS');
