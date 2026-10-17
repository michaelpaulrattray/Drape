/**
 * THE REFINE LOADER, PHOTOGRAPHED IN THE RUNNING APP (#55, #2613, working law 6).
 *
 *     npx tsx scripts/drive-refine-loader.mts [--base http://localhost:3000] [--out <dir>]
 *
 * No credit is spent and no row is written. The wait is a fact the SERVER
 * reports, so the fact is injected AT THE WIRE — `window.fetch` is wrapped
 * before the app loads and the `castingV2.variants` answer comes back carrying
 * a pending row with the step under test. That is the builder-seat rule of
 * 2026-09-26: a render's fixture goes on the response, never into a shared dev
 * database row somebody else is also reading.
 *
 * #2613 replaced the two loaders (the dot field, then the particle dust) with
 * ONE: the softened picture with one soft light crossing it — his pick, *"go
 * with B"*. So the frames are the states a customer really reaches, plus the
 * one that used to flip:
 *
 *   - `sending` and `painting`, the two moments the old flip sat between;
 *   - `painting` with the server's shape map still on the row, which is what
 *     used to switch the dot field for the dust;
 *   - a settling row — no light, because nobody is rendering it;
 *   - reduced motion — no sweep, the bar and the word stay;
 *   - and a SEQUENCE: one page whose row moves from `preparing` with no map to
 *     `rendering` with one, sampled every 200 ms, proving the light is the same
 *     element across the move and that neither old loader ever appears.
 *
 * The subject is the dev fixture account `verify-bot-local` (user 823).
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { SignJWT } from "jose";
import type { Page } from "puppeteer-core";

import { openDatabase } from "./lib/dbConnection.mts";
import { openDrivenPage } from "./lib/drivePage.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

assertOneWorld(["DATABASE_URL"]);

const arg = (name: string, fallback: string) => process.argv.includes(name)
  ? process.argv[process.argv.indexOf(name) + 1]
  : fallback;
const BASE = arg("--base", "http://localhost:3000");
const OUT = arg("--out", "output/2613-loader");
const THEMES = ["light", "dark"] as const;
/* `--only <case>` photographs one case in both themes and skips the sequence. */
const ONLY = process.argv.includes("--only") ? arg("--only", "") : null;
const SUBJECT_USER = 823;

/* The map the server still sends on a row (the client no longer reads it). */
const MAP = { w: 2, h: 1, cells: "90" };

type Case = {
  name: string;
  stage: string;
  step: string | null;
  figure?: unknown;
  reduce?: boolean;
  expect: string;
};
const CASES: Case[] = [
  { name: "01-sending", stage: "dispatched", step: "preparing", expect: "sending, bar at a quarter, the light" },
  { name: "02-painting", stage: "dispatched", step: "rendering", expect: "painting, bar at a half, the light" },
  { name: "03-painting-withmap", stage: "dispatched", step: "rendering", figure: MAP, expect: "identical to 02 — the map changes nothing" },
  { name: "04-settling", stage: "settling", step: "reading", expect: "no bar, no word, no light, the money sentence" },
  { name: "05-reducedmotion", stage: "dispatched", step: "rendering", reduce: true, expect: "no light; bar and word stay" },
];

const secret = process.env.JWT_SECRET;
const appId = process.env.VITE_APP_ID;
if (!secret || !appId) throw new Error("JWT_SECRET and VITE_APP_ID are required to mint a session");

const conn = await openDatabase(process.env.DATABASE_URL!);
const [rows] = await conn.query(`
  SELECT s.publicId AS sessionPublicId, c.position, s.userId, u.openId
    FROM casting_candidates c
    JOIN casting_rolls r ON r.id = c.rollId
    JOIN casting_sessions s ON s.id = r.sessionId
    JOIN users u ON u.id = s.userId
   WHERE c.status = 'ready' AND c.signedCastId IS NULL AND s.status <> 'expired' AND u.id = ?
   ORDER BY c.id DESC
   LIMIT 1
`, [SUBJECT_USER]) as any[];
await conn.end();
const subject = (rows as any[])[0];
if (!subject) throw new Error(`no ready unsigned candidate for user ${SUBJECT_USER} to open the viewer on`);
const SESSION = String(subject.sessionPublicId);
console.log(`subject: session ${SESSION}, user ${subject.userId}`);

const token = await new SignJWT({ openId: String(subject.openId), appId, name: "#2613 loader frames" })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("2h")
  .sign(new TextEncoder().encode(secret));

await mkdir(OUT, { recursive: true });

/**
 * THE INJECTION, INSIDE THE PAGE. `phases` is a list of row fields; the row
 * answered is `phases[window.__phase ?? 0]`, so the driver can move one page's
 * row from one step to the next once the viewer is open (the sheet's load time
 * on the remote dev database varies too much for a clock to do it).
 */
async function injectWait(page: Page, phases: Array<Record<string, unknown>>): Promise<void> {
  await page.evaluateOnNewDocument(`(() => {
    const PHASES = ${JSON.stringify(phases)};
    const row = () => {
      const fields = PHASES[Math.min(window.__phase ?? 0, PHASES.length - 1)];
      return {
        variantId: "fixture-wait",
        instruction: "their teeth — vampire fangs",
        regenerating: null,
        startedAt: new Date().toISOString(),
        waitedMs: 41000,
        ...fields,
      };
    };
    const patch = (payload) => {
      const data = payload?.result?.data?.json;
      if (data && Array.isArray(data.pending)) data.pending = [row()];
      return payload;
    };
    const original = window.fetch;
    window.fetch = async (input, init) => {
      const response = await original(input, init);
      const url = typeof input === "string" ? input : (input && input.url) || "";
      if (!url.includes("castingV2.variants")) return response;
      const body = await response.clone().json();
      const patched = Array.isArray(body) ? body.map(patch) : patch(body);
      return new Response(JSON.stringify(patched), {
        status: response.status,
        headers: { "content-type": "application/json" },
      });
    };
  })()`);
}

async function openViewer(theme: string, phases: Array<Record<string, unknown>>, reduce = false) {
  const { browser, page } = await openDrivenPage({ base: BASE, token, width: 1280, height: 960 });
  /* Seed the theme BEFORE any app code runs (memory: theme-seed-before-app-code). */
  await page.evaluateOnNewDocument(`localStorage.setItem("drape_theme", ${JSON.stringify(theme)})`);
  await injectWait(page, phases);
  if (reduce) await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  /* Nothing in this run may spend. Watched at the wire rather than assumed. */
  const spends: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && /castingV2\.(refine|roll|sign|retry|follow)/.test(request.url())) {
      spends.push(request.url().slice(0, 140));
    }
  });
  await page.goto(`${BASE}/app/casting/s/${SESSION}`, { waitUntil: "networkidle2", timeout: 180_000 });
  /* The tile's label is its place in the sheet, not the row's position, so the
     first openable tile is taken rather than one named in advance. */
  await page.waitForSelector(`button.dpc-card__open`, { timeout: 180_000 });
  const opened = await page.evaluate(`(() => {
    const button = document.querySelector("button.dpc-card__open");
    if (!button) return false;
    button.click();
    return true;
  })()`);
  if (!opened) throw new Error(`no openable tile on ${SESSION}`);
  await page.waitForSelector(".dpc-viewer", { timeout: 60_000 });
  await page.waitForSelector(".dpc-viewer__wait", { timeout: 90_000 });
  return { browser, page, spends };
}

const READ = `(() => {
  const fill = document.querySelector(".dpc-viewer__barFill");
  const step = document.querySelector(".dpc-viewer__step");
  const light = document.querySelector(".dpc-viewer__light");
  const img = document.querySelector('.dpc-viewer__frame[data-wait="true"] img');
  return {
    theme: document.documentElement.getAttribute("data-theme"),
    lights: document.querySelectorAll(".dpc-viewer__light").length,
    lightShown: light ? getComputedStyle(light).display !== "none" : false,
    lightAnimation: light ? getComputedStyle(light).animationName + " " + getComputedStyle(light).animationDuration : null,
    lightTransform: light ? getComputedStyle(light).transform : null,
    lightBox: light ? Math.round(light.getBoundingClientRect().left) + ".." + Math.round(light.getBoundingClientRect().right) : null,
    plateBox: (() => { const p = document.querySelector(".dpc-viewer__plate"); return p ? Math.round(p.getBoundingClientRect().left) + ".." + Math.round(p.getBoundingClientRect().right) : null; })(),
    held: document.getAnimations().filter((a) => a.animationName === "dpc-light").map((a) => a.playState + "@" + Math.round(Number(a.currentTime))).join(","),
    sameLight: light ? (window.__light ??= light) === light : null,
    dots: document.querySelectorAll(".dpc-viewer__dots").length,
    dust: document.querySelectorAll(".dpc-viewer__dust, [data-dust], .dpc-viewer canvas").length,
    imgFilter: img ? getComputedStyle(img).filter : null,
    fillWidth: fill ? getComputedStyle(fill).width : null,
    word: step ? step.textContent : null,
  };
})()`;

/*
  THE MOMENT OF THE FRAME IS CHOSEN, NOT LEFT TO CHANCE. The band spends a third
  of every pass off-frame, so a screenshot at an arbitrary instant may show no
  light at all. The light's own animation is moved to 30% of its pass and held
  for the screenshot only — the frame shows where the band really is at that
  point of its sweep.
*/
async function holdLightMidSweep(page: Page): Promise<void> {
  /* The full picture, decoded, before anything is read off it: a frame taken
     while the bytes are still arriving shows a half-drawn photograph. */
  await page.waitForFunction(`(() => {
    const img = document.querySelector(".dpc-viewer__plate img:not(.dpc-viewer__sizer):not(.dpc-viewer__compare)");
    return Boolean(img && img.complete && img.naturalWidth > 0 && img.dataset.preview !== "true");
  })()`, { timeout: 120_000 });
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await page.evaluate(`(() => {
    for (const a of document.getAnimations()) {
      if (a.animationName === "dpc-light") { a.pause(); a.currentTime = 4600 * 0.3; }
    }
  })()`);
}

async function shoot(page: Page, file: string): Promise<void> {
  const plate = await page.$(".dpc-viewer__plate");
  const box = plate ? await plate.boundingBox() : null;
  if (!box) throw new Error("no plate to photograph");
  await writeFile(file, Buffer.from(await page.screenshot({ clip: box, encoding: "binary" }) as Uint8Array));
}

const seen: Array<Record<string, unknown>> = [];

for (const theme of THEMES) {
  for (const probe of CASES) {
    if (ONLY && probe.name !== ONLY) continue;
    const { browser, page, spends } = await openViewer(
      theme,
      [{ stage: probe.stage, step: probe.step, figure: probe.figure ?? null }],
      probe.reduce,
    );
    await holdLightMidSweep(page);
    const read = await page.evaluate(READ) as Record<string, unknown>;
    await shoot(page, `${OUT}/${theme}-${probe.name}.png`);
    seen.push({ theme, case: probe.name, expected: probe.expect, spends: spends.length, ...read });
    console.log(`${theme} ${probe.name}: ${JSON.stringify(read)} spends=${spends.length}`);
    await browser.close();
  }

  if (ONLY) continue;
  /*
    THE SEQUENCE — the flip he reported, watched on one page. The row answers
    `preparing` with no map until 6 s after the viewer opens and `rendering`
    with a map after; the page is sampled every 200 ms for 20 s. Any dot field, any dust, a second
    light or a different light element anywhere in the run is the bug back.
  */
  const { browser, page, spends } = await openViewer(theme, [
    { stage: "dispatched", step: "preparing", figure: null },
    { stage: "dispatched", step: "rendering", figure: MAP },
  ]);
  const samples: Array<Record<string, unknown>> = [];
  for (let i = 0; i < 100; i += 1) {
    if (i === 30) await page.evaluate("window.__phase = 1");
    samples.push(await page.evaluate(READ) as Record<string, unknown>);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  const words = [...new Set(samples.map((s) => s.word))];
  const summary = {
    theme,
    case: "06-sequence",
    samples: samples.length,
    words,
    firstPainting: samples.findIndex((s) => s.word === "painting"),
    maxLights: Math.max(...samples.map((s) => Number(s.lights))),
    minLights: Math.min(...samples.map((s) => Number(s.lights))),
    everDots: samples.some((s) => Number(s.dots) > 0),
    everDust: samples.some((s) => Number(s.dust) > 0),
    alwaysSameLight: samples.every((s) => s.sameLight === true),
    spends: spends.length,
  };
  seen.push(summary);
  console.log(`${theme} 06-sequence: ${JSON.stringify(summary)}`);
  await browser.close();
}

await writeFile(`${OUT}/seen.json`, `${JSON.stringify(seen, null, 2)}\n`);
console.log(`\n${seen.length} readings in ${OUT}`);
process.exit(0);
