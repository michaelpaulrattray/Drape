/**
 * W6-A browser drive: same-tab background casting handoff.
 *
 * Local verify-bot only. Uses real local generation for two headshots, one
 * headshot iteration and the Core-view package. The final failure leg aborts
 * a request in the browser before server work or credit movement begins.
 */
import 'dotenv/config';
import { SignJWT } from 'jose';
import mysql from 'mysql2/promise';
import puppeteer, { type HTTPRequest } from 'puppeteer-core';

const BASE = process.env.VERIFY_BASE_URL ?? 'http://localhost:3000';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const failures: string[] = [];
const check = (label: string, pass: boolean, detail = '') => {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!pass) failures.push(label);
};

const conn = await mysql.createConnection(process.env.DATABASE_URL!);
await conn.execute(
  `INSERT INTO users (openId, name, email, approved, emailVerified, role)
   VALUES ('verify-bot-local', 'Verify Bot', 'verify-bot@local.test', 1, 1, 'user')
   ON DUPLICATE KEY UPDATE approved = 1, emailVerified = 1`,
);
const [users] = await conn.execute(`SELECT id FROM users WHERE openId = 'verify-bot-local'`);
const userId = (users as Array<{ id: number }>)[0].id;
await conn.execute(
  `INSERT INTO points (userId, balance, planTier) VALUES (?, 10000, 'studio')
   ON DUPLICATE KEY UPDATE balance = GREATEST(balance, 10000), planTier = 'studio'`,
  [userId],
);
let [boards] = await conn.execute(
  `SELECT id FROM boards WHERE userId = ? AND name = 'W6-A isolated drive' LIMIT 1`,
  [userId],
);
let boardId = (boards as Array<{ id: number }>)[0]?.id;
if (!boardId) {
  const [created] = await conn.execute(
    `INSERT INTO boards (userId, name, startedWith) VALUES (?, 'W6-A isolated drive', 'blank')`,
    [userId],
  );
  boardId = (created as { insertId: number }).insertId;
}
await conn.execute(`DELETE FROM board_edges WHERE boardId = ?`, [boardId]);
await conn.execute(
  `DELETE FROM board_item_versions WHERE itemId IN (SELECT id FROM board_items WHERE boardId = ?)`,
  [boardId],
);
await conn.execute(`DELETE FROM board_items WHERE boardId = ?`, [boardId]);

const addEmptyNode = async (x: number) => {
  const [result] = await conn.execute(
    `INSERT INTO board_items
       (boardId, type, kind, label, imageUrl, positionX, positionY, width, height, zIndex, metadata)
     VALUES (?, 'model', 'cast_config', NULL, NULL, ?, 160, 280, 420, 0, '{}')`,
    [boardId, x],
  );
  return (result as { insertId: number }).insertId;
};
const firstItemId = await addEmptyNode(180);

const boardItem = async (itemId: number) => {
  const [rows] = await conn.execute(
    `SELECT id, imageUrl, sourceModelId FROM board_items WHERE id = ? LIMIT 1`,
    [itemId],
  );
  return (rows as Array<{ id: number; imageUrl: string | null; sourceModelId: number | null }>)[0] ?? null;
};
const waitForBoardFill = async (itemId: number, timeoutMs = 150_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const item = await boardItem(itemId);
    if (item?.imageUrl && item.sourceModelId) return item;
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for board item ${itemId} to fill`);
};
const assetCount = async (modelId: number, viewType?: string) => {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS count FROM model_assets WHERE modelId = ?${viewType ? ' AND viewType = ?' : ''}`,
    viewType ? [modelId, viewType] : [modelId],
  );
  return Number((rows as Array<{ count: number }>)[0].count);
};
const waitForAssetCount = async (modelId: number, minimum: number, timeoutMs = 210_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const count = await assetCount(modelId);
    if (count >= minimum) return count;
    await sleep(1200);
  }
  throw new Error(`Timed out waiting for model ${modelId} to reach ${minimum} assets`);
};

const token = await new SignJWT({
  openId: 'verify-bot-local', appId: process.env.VITE_APP_ID, name: 'Verify Bot',
}).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('2h')
  .sign(new TextEncoder().encode(process.env.JWT_SECRET));
const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new' as never,
  pipe: true,
  args: ['--window-size=1600,1000'],
  defaultViewport: { width: 1600, height: 1000 },
});
const page = await browser.newPage();
await page.setCookie({ name: 'app_session_id', value: token, domain: 'localhost', path: '/' });

const bodyIncludes = (text: string) => page.evaluate(
  (value) => (document.body.textContent ?? '').includes(value),
  text,
);
const clickText = async (text: string, last = false) => {
  const clicked = await page.evaluate(({ wanted, useLast }) => {
    const matches = [...document.querySelectorAll('button')]
      .filter((button) => button.textContent?.trim() === wanted) as HTMLElement[];
    const element = useLast ? matches[matches.length - 1] : matches[0];
    element?.click();
    return !!element;
  }, { wanted: text, useLast: last });
  if (!clicked) throw new Error(`Button not found: ${text}`);
};
const waitForButton = (text: string, enabled = true) => page.waitForFunction(
  ({ wanted, requireEnabled }) => [...document.querySelectorAll('button')]
    .some((button) => button.textContent?.trim() === wanted && (!requireEnabled || !button.disabled)),
  { timeout: 30_000 },
  { wanted: text, requireEnabled: enabled },
);
const openFreshCast = async (itemId: number) => {
  await page.waitForFunction((targetItemId) => {
    const node = document.querySelector(`[data-id="item-${targetItemId}"]`);
    return [...(node?.querySelectorAll('button') ?? [])]
      .some((button) => button.textContent?.trim() === 'Choose or cast a model');
  }, { timeout: 30_000 }, itemId);
  const opened = await page.evaluate((targetItemId) => {
    const node = document.querySelector(`[data-id="item-${targetItemId}"]`);
    const button = [...(node?.querySelectorAll('button') ?? [])]
      .find((candidate) => candidate.textContent?.trim() === 'Choose or cast a model') as HTMLElement | undefined;
    button?.click();
    return !!button;
  }, itemId);
  if (!opened) throw new Error(`Fresh-cast door not found for item ${itemId}`);
  await page.waitForFunction(() => document.body.textContent?.includes('+ Cast new'), { timeout: 30_000 });
  await clickText('+ Cast new');
  await page.waitForSelector('[data-debug-generate]', { timeout: 30_000 });
  await clickText('Randomize');
  await page.waitForFunction(
    () => !(document.querySelector('[data-debug-generate]') as HTMLButtonElement | null)?.disabled,
    { timeout: 30_000 },
  );
};
const leaveCasting = async () => {
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.body.textContent?.includes('Leave casting?'), { timeout: 10_000 });
  await clickText('Leave');
  await page.waitForFunction(() => !document.body.textContent?.includes('Leave casting?'), { timeout: 10_000 });
  // CastingTakeover deliberately folds for 210ms before unmounting. Wait for
  // its own top action to disappear, rather than guessing at animation time.
  await page.waitForFunction(() => ![...document.querySelectorAll('button')]
    .some((button) => button.textContent?.trim() === 'Cast this model'), { timeout: 10_000 });
};
const startFreshAndLeave = async () => {
  const request = page.waitForRequest(
    (candidate) => candidate.url().includes('generation.castingImage'),
    // models.create writes the master spec before castingImage begins; text
    // generation can legitimately exceed 30 seconds under queue pressure.
    { timeout: 90_000 },
  );
  await page.evaluate(() => (document.querySelector('[data-debug-generate]') as HTMLButtonElement).click());
  await request;
  await leaveCasting();
};
const openDraft = async (itemId: number, modelId: number) => {
  await page.evaluate(({ targetItemId, targetModelId }) => {
    window.dispatchEvent(new CustomEvent('board-edit-cast', {
      detail: { itemId: targetItemId, modelId: targetModelId, draft: true },
    }));
  }, { targetItemId: itemId, targetModelId: modelId });
  // A reopened in-flight session correctly disables minting while still
  // rendering the action; visibility, not enabled state, proves the room is open.
  await waitForButton('Cast this model', false);
};

let abortNextCastingImage = false;
let abortSeen: (() => void) | null = null;
const intercepted = async (request: HTTPRequest) => {
  if (abortNextCastingImage && request.url().includes('generation.castingImage')) {
    abortNextCastingImage = false;
    abortSeen?.();
    await sleep(1000);
    await request.abort('failed');
    return;
  }
  await request.continue();
};

try {
  await page.goto(`${BASE}/app/board/${boardId}`, { waitUntil: 'networkidle2', timeout: 60_000 });

  // Leg 1: the originating empty node owns progress immediately and the app
  // owner fills it without requiring the toast action.
  await openFreshCast(firstItemId);
  await startFreshAndLeave();
  await page.waitForFunction(() => document.body.textContent?.includes('Generating ·'), { timeout: 10_000 });
  check('A1 immediate close leaves a visible generating node', await bodyIncludes('Generating ·'));
  const firstFill = await waitForBoardFill(firstItemId);
  await page.waitForFunction(
    () => document.body.textContent?.includes('Draft generated and saved to Drafts'),
    { timeout: 150_000 },
  );
  check('A2 fresh draft auto-lands on its originating node', !!firstFill.imageUrl && !!firstFill.sourceModelId);
  check('A3 background fresh cast reports success exactly once',
    (await page.evaluate(() => [...document.querySelectorAll('[data-sonner-toast]')]
      .filter((node) => node.textContent?.includes('Draft generated and saved to Drafts')).length)) === 1);
  check('A4 landed success notice retains Open Draft', await bodyIncludes('Open Draft'));

  // Leg 2: BoardPage may unmount, but the app-level subscriber still lands
  // against the captured board/item origin.
  const secondItemId = await addEmptyNode(580);
  await page.reload({ waitUntil: 'networkidle2', timeout: 60_000 });
  await openFreshCast(secondItemId);
  await startFreshAndLeave();
  await page.waitForFunction(() => document.body.textContent?.includes('Generating ·'), { timeout: 10_000 });
  const navigatedToLobby = await page.evaluate(() => {
    const button = document.querySelector('[aria-label="Back to lobby"]') as HTMLElement | null;
    button?.click();
    return !!button;
  });
  if (!navigatedToLobby) throw new Error('In-app Back to lobby button not found');
  await page.waitForFunction(() => window.location.pathname === '/app', { timeout: 30_000 });
  const secondFill = await waitForBoardFill(secondItemId);
  check('A5 navigation away does not lose the durable node landing',
    !!secondFill.imageUrl && !!secondFill.sourceModelId);
  await page.waitForFunction(() => [...document.querySelectorAll('[role="button"]')]
    .some((node) => node.textContent?.includes('W6-A isolated drive')), { timeout: 30_000 });
  const returnedToBoard = await page.evaluate(() => {
    const card = [...document.querySelectorAll('[role="button"]')]
      .find((node) => node.textContent?.includes('W6-A isolated drive')) as HTMLElement | undefined;
    card?.click();
    return !!card;
  });
  if (!returnedToBoard) throw new Error('W6-A lobby board card not found');
  await page.waitForFunction(
    (targetBoardId) => window.location.pathname === `/app/board/${targetBoardId}`,
    { timeout: 30_000 },
    boardId,
  );
  await page.waitForFunction(() => document.querySelectorAll('img').length >= 2, { timeout: 30_000 });
  check('A6 in-app return rehydrates the node without a stuck generating job',
    (await boardItem(secondItemId))?.sourceModelId === secondFill.sourceModelId
      && !(await bodyIncludes('Generating ·')));

  // Leg 3: a headshot-only edit remains visible on the node, is discoverable
  // by a reopened session, and appends once without a second charge path.
  const modelId = firstFill.sourceModelId!;
  const beforeEditAssets = await assetCount(modelId, 'frontClose');
  await openDraft(firstItemId, modelId);
  await page.waitForSelector('[data-refine-input]', { timeout: 30_000 });
  await page.evaluate(() => {
    const input = document.querySelector('[data-refine-input]') as HTMLTextAreaElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    setter?.call(input, 'Make the lighting slightly softer');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await waitForButton('Apply');
  const iterateRequest = page.waitForRequest(
    (candidate) => candidate.url().includes('generation.iterate'),
    { timeout: 30_000 },
  );
  await clickText('Apply');
  await iterateRequest;
  await leaveCasting();
  await page.waitForFunction(() => document.body.textContent?.includes('Generating ·'), { timeout: 10_000 });
  check('A7 closed headshot edit stays visible on the originating node', await bodyIncludes('Generating ·'));
  await openDraft(firstItemId, modelId);
  await page.waitForFunction(
    () => document.body.textContent?.includes('An earlier edit is still finishing')
      || document.querySelectorAll('[aria-label$="is generating"]').length > 0,
    { timeout: 15_000 },
  );
  check('A8 reopened draft reports the earlier in-flight edit',
    await bodyIncludes('An earlier edit is still finishing')
      || await page.evaluate(() => document.querySelectorAll('[aria-label$="is generating"]').length > 0));
  await leaveCasting();
  const afterEditAssets = await waitForAssetCount(modelId, beforeEditAssets + 1);
  check('A9 background edit appends exactly one new asset', afterEditAssets === beforeEditAssets + 1,
    `before=${beforeEditAssets}, after=${afterEditAssets}`);

  // Leg 4: dismiss Add Views, then leave Casting. The per-node job survives
  // the takeover and all three generated slots settle into server truth.
  await openDraft(firstItemId, modelId);
  await waitForButton('Cast this model');
  await clickText('Cast this model');
  await waitForButton('Add views');
  const viewsBefore = await assetCount(modelId);
  await clickText('Add views');
  await page.waitForFunction(
    () => document.body.textContent?.includes('These views will continue generating'),
    { timeout: 10_000 },
  );
  await clickText('Keep editing');
  await page.waitForFunction(
    () => document.querySelectorAll('[aria-label$="is generating"]').length === 3,
    { timeout: 15_000 },
  );
  await leaveCasting();
  await page.waitForFunction(() => document.body.textContent?.includes('Generating ·'), { timeout: 10_000 });
  check('A10 dismissed Add Views remains visible after leaving Casting', await bodyIncludes('Generating ·'));
  const afterViews = await waitForAssetCount(modelId, viewsBefore + 3);
  check('A11 dismissed Core views land without reopening', afterViews >= viewsBefore + 3,
    `before=${viewsBefore}, after=${afterViews}`);

  // Failure publication: abort a fresh cast before the server sees it. This
  // proves one background notice and job cleanup without spending credits.
  const failureItemId = await addEmptyNode(980);
  await page.reload({ waitUntil: 'networkidle2', timeout: 60_000 });
  await page.setRequestInterception(true);
  page.on('request', intercepted);
  await openFreshCast(failureItemId);
  abortNextCastingImage = true;
  const sawAbort = new Promise<void>((resolve) => { abortSeen = resolve; });
  const generationStarted = page.waitForRequest(
    (candidate) => candidate.url().includes('generation.castingImage'),
    { timeout: 90_000 },
  );
  await page.evaluate(() => (document.querySelector('[data-debug-generate]') as HTMLButtonElement).click());
  await Promise.all([generationStarted, sawAbort]);
  await leaveCasting();
  await page.waitForFunction(() => [...document.querySelectorAll('[data-sonner-toast]')]
    .some((node) => !node.textContent?.includes('Draft generated and saved to Drafts')), { timeout: 30_000 });
  const failureNotices = await page.evaluate(() => [...document.querySelectorAll('[data-sonner-toast]')]
    .map((node) => node.textContent?.trim() ?? '')
    .filter((text) => text && !text.includes('Draft generated and saved to Drafts')));
  check('A12 failed background operation reports one visible failure', failureNotices.length === 1,
    JSON.stringify(failureNotices));
} finally {
  page.off('request', intercepted);
  await browser.close();
  await conn.end();
}

if (failures.length > 0) {
  console.error(`W6-A drive failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('W6-A drive complete: 12/12 PASS');
