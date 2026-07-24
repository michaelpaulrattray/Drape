import 'dotenv/config';
import puppeteer from 'puppeteer-core';
import { SignJWT } from 'jose';

const [, , modelIdArg, boardIdArg] = process.argv;
const modelId = Number(modelIdArg);
const boardId = Number(boardIdArg);
if (!Number.isSafeInteger(modelId) || modelId <= 0 || !Number.isSafeInteger(boardId) || boardId <= 0) {
  throw new Error('Usage: tsx scripts/r7-b4-browser-drive.mts <modelId> <boardId>');
}
const secret = process.env.JWT_SECRET;
const appId = process.env.VITE_APP_ID;
const baseUrl = process.env.VERIFY_BASE_URL ?? 'http://localhost:3000';
if (!secret || !appId) throw new Error('JWT_SECRET and VITE_APP_ID are required');
if (appId.toLowerCase().includes('production')) throw new Error('Refusing browser drive under a production app id');

const token = await new SignJWT({
  openId: 'verify-bot-local',
  appId,
  name: 'Verify Bot',
})
  .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
  .setExpirationTime(Math.floor(Date.now() / 1000) + 60 * 30)
  .sign(new TextEncoder().encode(secret));

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  protocolTimeout: 60_000,
  args: ['--no-sandbox'],
});

const pageA = await browser.newPage();
const pageB = await browser.newPage();
for (const page of [pageA, pageB]) {
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.setCookie({
    name: 'app_session_id',
    value: token,
    domain: 'localhost',
    path: '/',
  });
}

const waitForText = async (page: typeof pageA, text: string, timeout = 60_000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await page.evaluate((value) => document.body.innerText.includes(value), text)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const state = await page.evaluate(() => ({
    href: window.location.href,
    body: document.body.innerText.slice(0, 500),
  }));
  throw new Error(`Text not found: ${text}; state=${JSON.stringify(state)}`);
};
const waitForSvgCount = async (page: typeof pageA, selector: string, count: number) => {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const actual = await page.evaluate(
      (value) => document.querySelectorAll(value).length,
      selector,
    );
    if (actual >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Expected ${count} selected SVG images for ${selector}`);
};
const clickButton = async (page: typeof pageA, text: string) => {
  await page.evaluate((value) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const target = buttons.find((button) =>
      Array.from(button.querySelectorAll('span'))
        .some((span) => span.textContent?.trim() === value),
    );
    if (!target) throw new Error(`Button not found: ${value}`);
    (target as HTMLButtonElement).click();
  }, text);
};
const clickAriaLabel = async (page: typeof pageA, label: string) => {
  await page.evaluate((value) => {
    const target = document.querySelector(`button[aria-label="${CSS.escape(value)}"]`);
    if (!(target instanceof HTMLButtonElement)) throw new Error(`Button not found: ${value}`);
    target.click();
  }, label);
};
const fillInput = async (page: typeof pageA, label: string, value: string) => {
  await page.evaluate(({ targetLabel, targetValue }) => {
    const target = document.querySelector(`input[aria-label="${CSS.escape(targetLabel)}"]`);
    if (!(target instanceof HTMLInputElement)) throw new Error(`Input not found: ${targetLabel}`);
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    valueSetter?.call(target, targetValue);
    target.dispatchEvent(new Event('input', { bubbles: true }));
  }, { targetLabel: label, targetValue: value });
};

try {
  console.log('[browser] warming tab B library');
  await pageB.goto(`${baseUrl}/app/models`, { waitUntil: 'domcontentloaded' });
  await waitForText(pageB, 'R7-B4 Verify Cast');
  console.log('[browser] opening tab A library');
  await pageA.goto(`${baseUrl}/app/models`, { waitUntil: 'domcontentloaded' });
  await waitForText(pageA, 'R7-B4 Verify Cast');

  console.log('[browser] opening model chooser');
  await pageA.evaluate(() => {
    const label = Array.from(document.querySelectorAll('span'))
      .find((element) => element.textContent?.trim() === 'R7-B4 Verify Cast');
    const card = label?.closest('[role="button"]') as HTMLElement | null;
    if (!card) throw new Error('Model card not found');
    card.click();
  });
  await waitForText(pageA, 'View comp card');
  console.log('[browser] opening comp card');
  await clickButton(pageA, 'View comp card');
  await waitForSvgCount(pageA, '.fixed.inset-0 img[src^="data:image/svg+xml"]', 3);
  const chooserSources = await pageA.evaluate(() =>
    Array.from(document.querySelectorAll('.fixed.inset-0 img[src^="data:image/svg+xml"]'))
      .map((image) => (image as HTMLImageElement).src),
  );
  if (new Set(chooserSources).size < 3) throw new Error('Comp card did not render three selected package views');

  console.log('[browser] opening Cast profile');
  await clickAriaLabel(pageA, 'Back');
  await waitForText(pageA, 'View cast profile');
  // Use a fresh navigation for the cross-surface assertion. Framer Motion's
  // lobby→studio exit can be throttled indefinitely by headless Chromium,
  // while a real route load exercises the same URL contract deterministically.
  await pageA.goto(`${baseUrl}/studio?tool=casting&modelId=${modelId}`, {
    waitUntil: 'domcontentloaded',
  });
  await waitForText(pageA, 'Cast profile');
  console.log('[browser] renaming Cast');
  await clickAriaLabel(pageA, 'Rename cast');
  await fillInput(pageA, 'Cast name', 'R7-B4 Verify Cast Renamed');
  await clickAriaLabel(pageA, 'Save name');
  await waitForText(pageA, 'R7-B4 Verify Cast Renamed');

  // Tab B has a warm 30-second library query. The cross-tab signal must
  // invalidate it immediately rather than waiting for stale-time/focus.
  console.log('[browser] checking warm tab B invalidation');
  await waitForText(pageB, 'R7-B4 Verify Cast Renamed', 15_000);

  console.log('[browser] opening Canvas board');
  await pageB.goto(`${baseUrl}/app/board/${boardId}`, { waitUntil: 'domcontentloaded' });
  await waitForText(pageB, 'R7-B4 Verify Board');
  await waitForSvgCount(pageB, 'img[src^="data:image/svg+xml"]', 3);
  const boardSources = await pageB.evaluate(() =>
    Array.from(document.querySelectorAll('img[src^="data:image/svg+xml"]'))
      .map((image) => (image as HTMLImageElement).src),
  );
  if (new Set(boardSources).size < 3) throw new Error('Canvas comp card did not render the selected package views');

  console.log(JSON.stringify({
    ok: true,
    modelId,
    boardId,
    chooserSelectedViews: new Set(chooserSources).size,
    canvasSelectedViews: new Set(boardSources).size,
    crossTabRename: true,
  }));
} finally {
  await browser.close();
}
