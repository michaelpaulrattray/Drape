/**
 * W5-F browser drive: post-close fresh-cast outcomes and dismissible Add Views.
 * Local verify-bot only. One real fresh cast plus three real Core views; the
 * forced-failure leg aborts its castingImage request before server work begins.
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
  `SELECT id FROM boards WHERE userId = ? AND name = 'W5-F isolated drive' LIMIT 1`,
  [userId],
);
let boardId = (boards as Array<{ id: number }>)[0]?.id;
if (!boardId) {
  const [created] = await conn.execute(
    `INSERT INTO boards (userId, name, startedWith) VALUES (?, 'W5-F isolated drive', 'blank')`,
    [userId],
  );
  boardId = (created as { insertId: number }).insertId;
}
await conn.execute(`DELETE FROM board_edges WHERE boardId = ?`, [boardId]);
await conn.execute(`DELETE FROM board_item_versions WHERE itemId IN (SELECT id FROM board_items WHERE boardId = ?)`, [boardId]);
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
await addEmptyNode(220);

const token = await new SignJWT({
  openId: 'verify-bot-local', appId: process.env.VITE_APP_ID, name: 'Verify Bot',
}).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('2h')
  .sign(new TextEncoder().encode(process.env.JWT_SECRET));
const browser = await puppeteer.launch({
  executablePath: EDGE, headless: 'new' as never, pipe: true,
  args: ['--window-size=1600,1000'], defaultViewport: { width: 1600, height: 1000 },
});
const page = await browser.newPage();
await page.setCookie({ name: 'app_session_id', value: token, domain: 'localhost', path: '/' });

const bodyIncludes = (text: string) => page.evaluate((value) => (document.body.textContent ?? '').includes(value), text);
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
const openFreshCast = async () => {
  await page.waitForFunction(() => [...document.querySelectorAll('button')]
    .some((button) => button.textContent?.trim() === 'Choose or cast a model'), { timeout: 30_000 });
  await clickText('Choose or cast a model', true);
  await page.waitForFunction(() => document.body.textContent?.includes('+ Cast new'), { timeout: 30_000 });
  await clickText('+ Cast new');
  await page.waitForSelector('[data-debug-generate]', { timeout: 30_000 });
  await clickText('Randomize');
  await page.waitForFunction(() => !(document.querySelector('[data-debug-generate]') as HTMLButtonElement | null)?.disabled);
};
const startAndClose = async () => {
  const request = page.waitForRequest((candidate) => candidate.url().includes('generation.castingImage'), { timeout: 30_000 });
  await page.evaluate(() => (document.querySelector('[data-debug-generate]') as HTMLButtonElement).click());
  await request;
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.body.textContent?.includes('Leave casting?'), { timeout: 10_000 });
  await clickText('Leave');
};

let abortNextCastingImage = false;
let abortSeen: (() => void) | null = null;
const intercepted = async (request: HTTPRequest) => {
  if (abortNextCastingImage && request.url().includes('generation.castingImage')) {
    abortNextCastingImage = false;
    abortSeen?.();
    await sleep(1500);
    await request.abort('failed');
    return;
  }
  await request.continue();
};

try {
  await page.goto(`${BASE}/app/board/${boardId}`, { waitUntil: 'networkidle2', timeout: 60_000 });
  await openFreshCast();
  await startAndClose();
  await page.waitForFunction(() => document.body.textContent?.includes('Draft generated and saved to Drafts'), { timeout: 120_000 });
  check('F1 post-close fresh cast reports success once',
    (await page.evaluate(() => [...document.querySelectorAll('[data-sonner-toast]')]
      .filter((node) => node.textContent?.includes('Draft generated and saved to Drafts')).length)) === 1);
  check('F2 success notice offers Open Draft', await bodyIncludes('Open Draft'));

  await clickText('Open Draft');
  await page.waitForFunction(() => [...document.querySelectorAll('button')]
    .some((button) => button.textContent?.trim() === 'Cast this model' && !button.disabled), { timeout: 30_000 });
  check('F3 Open Draft returns to the completed draft', await bodyIncludes('Cast this model'));

  await clickText('Cast this model');
  await page.waitForFunction(() => [...document.querySelectorAll('button')]
    .some((button) => button.textContent?.trim() === 'Add views' && !button.disabled), { timeout: 30_000 });
  await clickText('Add views');
  await page.waitForFunction(() => document.body.textContent?.includes('These views will continue generating'), { timeout: 10_000 });
  check('F4 Add Views explains that dismissed work continues', await bodyIncludes('These views will continue generating'));
  await clickText('Keep editing');
  await page.waitForFunction(() => !document.body.textContent?.includes('These views will continue generating'), { timeout: 10_000 });
  const generatingCount = await page.evaluate(() => document.querySelectorAll('[aria-label$="is generating"]').length);
  check('F5 modal dismisses while all three missing Core views remain visibly generating', generatingCount === 3, `count=${generatingCount}`);

  await page.waitForFunction(() => document.querySelectorAll('[aria-label$="is generating"]').length === 0, { timeout: 180_000 });
  const assetCount = await page.evaluate(() => (window as any).__castGenStore?.getState()?.currentAssets?.length ?? 0);
  check('F6 dismissed Add Views lands its generated slots', assetCount >= 4, `assets=${assetCount}`);

  await page.keyboard.press('Escape');
  await sleep(300);
  if (await bodyIncludes('Leave casting?')) await clickText('Leave');
  await addEmptyNode(600);
  await page.reload({ waitUntil: 'networkidle2', timeout: 60_000 });

  await page.setRequestInterception(true);
  page.on('request', intercepted);
  await openFreshCast();
  abortNextCastingImage = true;
  const sawAbort = new Promise<void>((resolve) => { abortSeen = resolve; });
  const generationStarted = page.waitForRequest((candidate) => candidate.url().includes('generation.castingImage'), { timeout: 30_000 });
  await page.evaluate(() => (document.querySelector('[data-debug-generate]') as HTMLButtonElement).click());
  await Promise.all([generationStarted, sawAbort]);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.body.textContent?.includes('Leave casting?'), { timeout: 10_000 });
  await clickText('Leave');
  await page.waitForFunction(() => [...document.querySelectorAll('[data-sonner-toast]')]
    .some((node) => !node.textContent?.includes('Draft generated and saved to Drafts')), { timeout: 30_000 });
  const failureNotices = await page.evaluate(() => [...document.querySelectorAll('[data-sonner-toast]')]
    .map((node) => node.textContent?.trim() ?? '')
    .filter((text) => text && !text.includes('Draft generated and saved to Drafts')));
  check('F7 post-close failure produces one visible notice', failureNotices.length === 1, JSON.stringify(failureNotices));
} finally {
  page.off('request', intercepted);
  await browser.close();
  await conn.end();
}

if (failures.length > 0) {
  console.error(`W5-F drive failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('W5-F drive complete: 7/7 PASS');
