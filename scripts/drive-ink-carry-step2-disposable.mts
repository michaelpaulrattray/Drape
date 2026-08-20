/**
 * STEP TWO OF THE CARRY RE-DRIVE — the ordinary next edit (fable-1167 §4).
 *
 * Step one is bought and landed: `use this tattoo design on her neck` minted
 * design `f43039e5` and wrote `inkApplied: {"ink:neck": …}` onto variant 478's
 * record, which is clause (a)'s write half proving itself on the paid road.
 *
 * This is the half that was LOST before the fix: an ordinary second edit,
 * NO picture attached and nothing about ink in the sentence. If the design
 * rides, the tattoo is on his neck in the frame this buys.
 *
 * # IT WAITS ON THE RAIL, NOT ON A SENTENCE
 *
 * Step one's own driver called a delivered render *"did not settle"* because it
 * waited for an outcome sentence that a successful refine does not leave — the
 * render had landed 15 minutes earlier. A new VERSION appearing on the rail is
 * the thing that actually happens, so that is what is waited on.
 *
 *   pnpm dev            (in another shell)
 *   npx tsx scripts/drive-ink-carry-step2-disposable.mts
 */
import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";

import { SignJWT } from "jose";

import { openDrivenPage } from "./lib/drivePage.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const OUT = "output/ink-carry-fixed";
const SESSION = "af5011d8-ca5f-4bd8-a785-7cc516c8361d";
const ASK = process.env.CARRY_ASK ?? "colour his hair silver";

const log: string[] = [];
const say = (line: string) => { console.log(line); log.push(line); };

await mkdir(OUT, { recursive: true });

const token = await new SignJWT({
  openId: "verify-bot-local",
  appId: process.env.VITE_APP_ID,
  name: "Verify Bot",
})
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("3h")
  .sign(new TextEncoder().encode(process.env.JWT_SECRET));

const { browser, page } = await openDrivenPage({ base: BASE, token, width: 1440, height: 960 });

const stop = async (why: string) => {
  say(`STOPPED: ${why}`);
  await browser.close();
  await writeFile(`${OUT}/step2.log`, `${log.join("\n")}\n`);
  process.exit(1);
};

await page.goto(`${BASE}/casting/s/${SESSION}`, { waitUntil: "domcontentloaded" });
const tile = await page.waitForSelector('button[aria-label^="View candidate"]', { timeout: 120_000 })
  .catch(() => null);
if (!tile) await stop("no candidate tile");
await tile!.click();
if (!(await page.waitForSelector(".dpc-refine__field", { timeout: 120_000 }).catch(() => null))) {
  await stop("no ask box");
}
await page.waitForSelector(".dpc-refine__pick", { timeout: 60_000 }).catch(() => null);

/* THE NECK VERSION — the newest chip whose own words name the neck design. */
const chosen = await page.evaluate(() => {
  const picks = Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__pick"));
  const labels = picks.map((one) => one.getAttribute("aria-label") ?? "");
  for (let at = picks.length - 1; at >= 0; at -= 1) {
    if (!/neck/i.test(labels[at] ?? "")) continue;
    picks[at]?.click();
    return { at, label: labels[at] ?? "", count: picks.length };
  }
  return { at: -1, label: "", count: picks.length };
});
say(`versions on the rail: ${chosen.count}; chose ${chosen.at} — "${chosen.label}"`);
if (chosen.at === -1) await stop("no version names the neck design — step one has not landed");

const made = await page.waitForFunction(
  () => document.querySelector(".dpc-refine__madeText")?.textContent?.trim() || null,
  { timeout: 60_000, polling: 500 },
).then((handle) => handle.jsonValue() as Promise<string>, () => "");
say(`the version on screen was made by: "${made}"`);
if (!/neck/i.test(made)) await stop("the viewer is not on the neck version");

const before = await page.evaluate(() => document.querySelectorAll(".dpc-refine__pick").length);
await page.type(".dpc-refine__field", ASK);
await page.evaluate(() => {
  Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__ask button"))
    .find((button) => button.type === "submit")
    ?.click();
});
say(`asked: "${ASK}" — no picture, nothing about ink in the sentence`);

const landed = await page.waitForFunction(
  (was: number) => document.querySelectorAll(".dpc-refine__pick").length > was
    || (document.querySelector(".dpc-refine__outcome")?.textContent ?? "").length > 0,
  { timeout: 900_000, polling: 3000 },
  before,
).then(() => true, () => false);
say(`settled: ${landed}`);
say(`said: ${await page.evaluate(() =>
  document.querySelector(".dpc-refine__outcome")?.textContent?.replace("×", "").trim() ?? "(nothing)")}`);

/* The newest version's frame, at full size — his eyes judge the artwork. */
const src = await page.evaluate(() => {
  const picks = Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__pick"));
  const last = picks[picks.length - 1];
  last?.click();
  return last?.getAttribute("data-frame") ?? "";
});
if (!src) { say("frame: (the newest chip carries no frame url)"); } else {
  const bytes = await page.evaluate(async (from: string) => {
    const response = await fetch(from, { credentials: "include" });
    return Array.from(new Uint8Array(await response.arrayBuffer()));
  }, src);
  await writeFile(`${OUT}/2-after-unrelated-edit.png`, Buffer.from(bytes));
  say(`frame: ${OUT}/2-after-unrelated-edit.png (${bytes.length} bytes)`);
}

await browser.close();
await writeFile(`${OUT}/step2.log`, `${log.join("\n")}\n`);
console.log(`\nlog: ${OUT}/step2.log`);

/* END BY ENDING THE PROCESS — puppeteer leaves handles alive. */
process.exit(0);
