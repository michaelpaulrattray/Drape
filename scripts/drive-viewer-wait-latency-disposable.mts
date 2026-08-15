/**
 * DOES THE PICTURE SAY IT IS WAITING IN THE SAME FRAME AS THE BUTTON?
 * (fable-582, from the founder: *"it does go into a loading state eventually
 * but it takes awhile."*)
 *
 * The button flips to "Refining…" on the click, because it reads the mutation's
 * own subject. The viewer's wait used to be drawn from the SERVER's pending
 * list alone, so it could not appear until the request had been answered and
 * the variants query refetched — and between those two moments the photograph
 * said nothing at all.
 *
 * The reading is a SAMPLER rather than a screenshot: every 40ms, what does the
 * button say and what does the plate say. The assertion is the one 582 named —
 * **zero frames where the button says Refining and the viewer says nothing.**
 *
 * It costs nothing. The instruction is one the face already satisfies, so the
 * already-true door refuses it for free at the end of the round trip; the whole
 * measurement lives in the seconds before that.
 *
 *   npx tsx scripts/drive-viewer-wait-latency-disposable.mts
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { SignJWT } from "jose";

import { openDatabase } from "./lib/dbConnection.mts";
import { openDrivenPage } from "./lib/drivePage.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const OUT = path.resolve("output/viewer-wait");
const ASK = "give her dangly cross earrings";

const secret = process.env.JWT_SECRET;
const appId = process.env.VITE_APP_ID;
if (!secret || !appId) throw new Error("JWT_SECRET and VITE_APP_ID are required");

const conn = await openDatabase(process.env.DATABASE_URL!);
const [rows] = await conn.query<Array<{ openId: string; session: string; position: number }>>(
  `SELECT u.openId AS openId, s.publicId AS session, c.position AS position
     FROM users u
     JOIN casting_sessions s ON s.userId = u.id
     JOIN casting_candidates c ON c.sessionId = s.id
    WHERE u.openId = 'outside-scope-bot-local' AND c.status = 'ready'
    ORDER BY c.id DESC LIMIT 1`,
);
await conn.end();
if (rows.length === 0) throw new Error("the fixture cast is missing — run the court's `fresh`/`born` first");
const { openId, session, position } = rows[0]!;
const tile = String(position + 1).padStart(2, "0");

const token = await new SignJWT({ openId, appId, name: "Wait sampler" })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("2h")
  .sign(new TextEncoder().encode(secret));

await mkdir(OUT, { recursive: true });
const { browser, page } = await openDrivenPage({ base: BASE, token, width: 1440, height: 1000 });
let failed = 0;
try {
  await page.goto(`${BASE}/casting/s/${session}`, { waitUntil: "networkidle2", timeout: 240_000 });
  await page.waitForSelector(`button[aria-label="View candidate ${tile} larger"]`, { timeout: 240_000 });
  await page.click(`button[aria-label="View candidate ${tile} larger"]`);
  await page.waitForSelector(".dpc-viewer__plate img", { timeout: 240_000 });
  await page.waitForSelector(".dpc-refine__field", { timeout: 240_000 });
  /* Let the face panel's own traffic finish, so the reading is about the
     submit and not about a page still assembling itself. */
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const busy = await page.evaluate(() => Boolean(document.querySelector(".dpc-face__working")));
    if (!busy) break;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  await page.type(".dpc-refine__field", ASK, { delay: 8 });
  const reading = await page.evaluate(`(async () => {
    const field = document.querySelector(".dpc-refine__field");
    const button = field?.closest("form")?.querySelector("button[type=submit]");
    const plate = () => document.querySelector("[data-wait]");
    if (!field || !button) return { error: "no ask box on the page" };
    if (!plate()) return { error: "the plate does not carry data-wait — wrong selector, not an absence" };

    const before = { button: button.textContent.trim(), wait: plate().getAttribute("data-wait") };
    const t0 = performance.now();
    button.click();

    const frames = [];
    for (let tick = 0; tick < 400; tick += 1) {
      const live = document.querySelector(".dpc-refine__field")?.closest("form")
        ?.querySelector("button[type=submit]");
      frames.push({
        at: Math.round(performance.now() - t0),
        button: live ? live.textContent.trim() : null,
        wait: plate() ? plate().getAttribute("data-wait") : null,
        said: document.querySelector(".dpc-viewer__waitSaid")?.textContent?.trim() ?? null,
      });
      await new Promise((resolve) => setTimeout(resolve, 40));
      /* Stop once the round trip is over — the button is the honest end. */
      if (tick > 5 && live && !live.textContent.includes("Refining")) break;
    }
    return { before, frames };
  })()`) as { error?: string; before?: Record<string, string>; frames?: Array<Record<string, unknown>> };

  if (reading.error) throw new Error(reading.error);
  const frames = reading.frames ?? [];
  const refining = frames.filter((frame) => String(frame.button).includes("Refining"));
  const silent = refining.filter((frame) => frame.wait !== "true" && frame.wait !== "settling");
  const firstWait = frames.find((frame) => frame.wait === "true");

  console.log(`before the click: button "${reading.before?.button}" · plate data-wait ${reading.before?.wait}`);
  console.log(`${frames.length} frames sampled · ${refining.length} of them with the button saying Refining`);
  console.log(`the picture began waiting at ${firstWait ? `${firstWait.at}ms` : "NEVER"}`
    + `${firstWait ? ` — "${firstWait.said}"` : ""}`);

  const check = (ok: boolean, name: string, saw: string) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name} — saw ${saw}`);
    if (!ok) failed += 1;
  };
  check(
    refining.length > 0,
    "the sampler caught the request in flight at all",
    `${refining.length} frames with the button saying Refining`,
  );
  check(
    silent.length === 0,
    "ZERO frames where the button says Refining and the picture says nothing",
    silent.length === 0 ? "none" : `${silent.length} silent frames, first at ${silent[0]!.at}ms`,
  );
  check(
    firstWait !== undefined && Number(firstWait.at) <= 200,
    "and it starts within a frame or two of the click, not a round trip later",
    firstWait ? `${firstWait.at}ms` : "it never started",
  );

  await writeFile(`${OUT}/frames.json`, `${JSON.stringify(reading, null, 2)}\n`);

  /*
    AND THE PHOTOGRAPH OF IT, MID-WAIT (working law 6). The sampler's own run
    ends after the round trip, so a screenshot taken then shows the outcome
    rather than the wait. This asks a second time — free again — and photographs
    the frame the founder is looking at while he waits.
  */
  await page.type(".dpc-refine__field", ASK, { delay: 8 });
  await page.evaluate(`document.querySelector(".dpc-refine__field").closest("form")
    .querySelector("button[type=submit]").click()`);
  await new Promise((resolve) => setTimeout(resolve, 350));
  await page.screenshot({ path: `${OUT}/waiting.png` });
  const midWait = await page.evaluate(`(() => {
    const plate = document.querySelector("[data-wait]");
    return { wait: plate?.getAttribute("data-wait") ?? null,
             said: document.querySelector(".dpc-viewer__waitSaid")?.textContent?.trim() ?? null };
  })()`) as { wait: string | null; said: string | null };
  console.log(`the photographed frame: data-wait ${midWait.wait} · "${midWait.said}"`);
} finally {
  await browser.close();
}
console.log(failed === 0 ? "\nall arms passed" : `\n${failed} arm(s) failed`);
process.exit(failed === 0 ? 0 : 1);
