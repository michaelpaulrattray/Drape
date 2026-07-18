/**
 * W5-E localhost drive: the Model Library exposes one free, atomic Identity
 * Pack action. Seeds a verify-bot-only minted six-view model, downloads and
 * inspects the ZIP, then forces PDF failure and proves no second ZIP/charge.
 */
import 'dotenv/config';
import os from 'node:os';
import path from 'node:path';
import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { SignJWT } from 'jose';
import JSZip from 'jszip';
import mysql from 'mysql2/promise';
import puppeteer from 'puppeteer-core';

const BASE = process.env.VERIFY_BASE_URL ?? 'http://localhost:3001';
if (!/^http:\/\/localhost:\d+$/.test(BASE)) throw new Error(`Refusing non-local base: ${BASE}`);
if (process.env.VITE_APP_ID === 'drape-production') throw new Error('Refusing production app identity');
if (!process.env.DATABASE_URL || !process.env.JWT_SECRET || !process.env.VITE_APP_ID) {
  throw new Error('DATABASE_URL, JWT_SECRET and VITE_APP_ID are required');
}

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const downloadDir = path.join(os.tmpdir(), 'drape-w5-e-downloads');
const evidenceDir = path.join(os.tmpdir(), 'drape-w5-e-evidence');
await rm(downloadDir, { recursive: true, force: true });
await mkdir(downloadDir, { recursive: true });
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

const [templates] = await conn.execute(
  `SELECT m.masterPrompt, m.technicalSchema, m.preferences, a.storageUrl
   FROM models m JOIN model_assets a ON a.modelId = m.id AND a.viewType = 'frontClose'
   WHERE m.userId = ? AND a.storageUrl LIKE 'http%'
     AND m.masterPrompt IS NOT NULL AND LENGTH(m.masterPrompt) > 100
   ORDER BY m.id DESC LIMIT 1`,
  [userId],
);
const template = (templates as Array<{
  masterPrompt: string;
  technicalSchema: unknown;
  preferences: unknown;
  storageUrl: string;
}>)[0];
if (!template) throw new Error('verify-bot needs one real cast template before the W5-E drive');
const jsonValue = (value: unknown) => typeof value === 'string' ? value : JSON.stringify(value ?? {});

const [modelResult] = await conn.execute(
  `INSERT INTO models (userId, name, status, masterPrompt, technicalSchema, preferences)
   VALUES (?, 'W5 E Identity Pack', 'draft', ?, ?, ?)`,
  [userId, template.masterPrompt, jsonValue(template.technicalSchema), jsonValue(template.preferences)],
);
const modelId = (modelResult as { insertId: number }).insertId;
const modelName = `W5 E Identity Pack ${modelId}`;
const agencyId = `MOD-26-${modelId.toString(16).padStart(6, '0').slice(-6).toUpperCase()}`;
await conn.execute(
  `UPDATE models SET name = ?, status = 'active', agencyId = ?, mintedAt = NOW() WHERE id = ?`,
  [modelName, agencyId, modelId],
);
for (const angle of ['frontClose', 'threeQuarter', 'frontFull', 'sideClose', 'sideFull', 'backFull']) {
  await conn.execute(
    `INSERT INTO model_assets (modelId, viewType, resolution, storageUrl, pointsCost)
     VALUES (?, ?, '1K', ?, 0)`,
    [modelId, angle, template.storageUrl],
  );
}

const [balanceBeforeRows] = await conn.execute(`SELECT balance FROM points WHERE userId = ?`, [userId]);
const balanceBefore = Number((balanceBeforeRows as Array<{ balance: number }>)[0].balance);
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
  timeout: 90_000,
  args: ['--window-size=1500,1000'],
  defaultViewport: { width: 1500, height: 1000 },
});
const page = await browser.newPage();
page.setDefaultTimeout(90_000);
page.on('pageerror', (error) => console.log(`BROWSER_ERROR ${error.message}`));
const cdp = await page.target().createCDPSession();
await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir });
await page.setCookie({ name: 'app_session_id', value: token, domain: 'localhost', path: '/' });
await page.goto(`${BASE}/app/models`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.waitForFunction((name: string) => document.body.textContent?.includes(name), {}, modelName);

const openedCard = await page.evaluate((name: string) => {
  const image = [...document.querySelectorAll('img')].find((candidate) => candidate.alt === name);
  const button = image?.closest('button') as HTMLButtonElement | null;
  button?.click();
  return Boolean(button);
}, modelName);
check('E1 minted model opens the Model Library chooser', openedCard);
await sleep(1_000);
await page.screenshot({ path: path.join(evidenceDir, 'chooser-transition.png') });
await page.waitForFunction(() => [...document.querySelectorAll('span')].some(
  (element) => element.textContent?.trim() === 'Export identity pack' && Boolean(element.closest('button')),
));
const launcherCopy = await page.evaluate(() => document.body.textContent ?? '');
check(
  'E2 launcher promises one free current-resolution Identity Pack',
  launcherCopy.includes('Current casting views and the identity document — free.') && !launcherCopy.includes('2K'),
);
await page.evaluate(() => {
  const label = [...document.querySelectorAll('span')].find(
    (candidate) => candidate.textContent?.trim() === 'Export identity pack',
  );
  const button = label?.closest('button') as HTMLButtonElement | null;
  button?.click();
});
await page.waitForFunction(() => document.body.textContent?.includes('Images stay at their current resolution. This export costs 0 credits.'));
await page.waitForFunction(() => [...document.querySelectorAll('button')].some(
  (button) => button.textContent?.trim() === 'Export identity pack' && !button.disabled,
));
const dialogTruth = await page.evaluate(() => ({
  exportActions: [...document.querySelectorAll('button')].filter((button) => button.textContent?.trim() === 'Export identity pack').length,
  has2K: (document.body.textContent ?? '').includes('2K'),
  hasPdfOnly: (document.body.textContent ?? '').includes('PDF only'),
}));
check('E3 dialog has exactly one export action and no 2K/PDF-only choice', dialogTruth.exportActions === 1 && !dialogTruth.has2K && !dialogTruth.hasPdfOnly, JSON.stringify(dialogTruth));
await page.screenshot({ path: path.join(evidenceDir, 'identity-pack-dialog.png') });

await page.evaluate(() => {
  const button = [...document.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === 'Export identity pack',
  ) as HTMLButtonElement | undefined;
  button?.click();
});
let downloaded: string | undefined;
for (let i = 0; i < 180; i++) {
  downloaded = (await readdir(downloadDir)).find((name) => name.endsWith('.zip'));
  if (downloaded) break;
  await sleep(500);
}
check('E4 free Identity Pack downloads', Boolean(downloaded), downloaded ?? 'no ZIP');
let entries: string[] = [];
if (downloaded) {
  const archive = await JSZip.loadAsync(await readFile(path.join(downloadDir, downloaded)));
  entries = Object.keys(archive.files).filter((name) => !archive.files[name].dir).sort();
}
const expectedStems = [
  '01_Headshot_Primary.',
  '02_Three_Quarter_Head.',
  '03_Profile_Head.',
  '04_Full_Body_Standing.',
  '05_Full_Body_Walk.',
  '06_Full_Body_Rear.',
];
check(
  'E5 ZIP contains all six labeled views and the identity PDF',
  expectedStems.every((stem) => entries.some((name) => name.startsWith(stem)))
    && entries.some((name) => name === `LEGAL_IDENTITY_${agencyId}.pdf`),
  JSON.stringify(entries),
);

await page.setRequestInterception(true);
page.on('request', (request) => {
  if (request.method() === 'POST' && request.url().includes('/api/trpc/generation.generatePdf')) {
    void request.respond({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: { json: { message: 'Forced identity document failure', code: -32603, data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500 } } } }),
    });
  } else {
    void request.continue();
  }
});
const filesBeforeFailure = await readdir(downloadDir);
await page.evaluate(() => {
  const button = [...document.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === 'Export identity pack',
  ) as HTMLButtonElement | undefined;
  button?.click();
});
await page.waitForFunction(() => document.body.textContent?.includes('Identity pack was not downloaded'));
await sleep(750);
const filesAfterFailure = await readdir(downloadDir);
const [balanceAfterRows] = await conn.execute(`SELECT balance FROM points WHERE userId = ?`, [userId]);
const balanceAfter = Number((balanceAfterRows as Array<{ balance: number }>)[0].balance);
check(
  'E6 forced PDF failure is honest, delivers no second ZIP and charges nothing',
  filesAfterFailure.length === filesBeforeFailure.length && balanceAfter === balanceBefore,
  JSON.stringify({ filesBefore: filesBeforeFailure.length, filesAfter: filesAfterFailure.length, balanceBefore, balanceAfter }),
);
await page.screenshot({ path: path.join(evidenceDir, 'identity-pack-pdf-failure.png') });

console.log(`EVIDENCE ${evidenceDir}`);
await browser.close();
await conn.end();
if (failures.length) {
  console.error(`${failures.length} W5-E drive assertion(s) failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('W5-E ISOLATED DRIVE PASS');
