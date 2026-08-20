/**
 * THE FLOOR LADDER'S PAID HALF — one rung, one draw, one render per invocation
 * (ordered fable-1183 §3, designed opus-900/901, ratified fable-1207/1208).
 *
 *   COURT_RUNG=A COURT_DRAW=1 npx tsx scripts/court-floor-ladder-drive-disposable.mts
 *
 * # The question, and why it is worth 150 dev credits
 *
 * `INK_DESIGN_MIN_EDGE = 256` refuses a design below 256 px on its shortest
 * side, and **it has never been measured against a render** — its whole
 * justification is an asserted sentence in its own docblock (*"a reference
 * smaller than this cannot describe a tattoo"*). These frames are that
 * number's first evidence.
 *
 * # ONE VARIABLE, and the routing made it cleaner than the design expected
 *
 * The T-rex design routes `rideWhole` (read off the dev row: `#14 u823 cand232
 * neck@centre route=rideWhole`), so **nothing is cut** — no segmenter, no mask,
 * no cut geometry differs between arms. The three rungs are the same picture at
 * three pixel sizes and nothing else:
 *
 * ```
 *   A  1200x1697   as supplied            clears the floor
 *   B   183x259    S1's real arm edge     UNDER it — needs the bypass below
 *   C   732x1036   B through aura-sr      clears it again
 * ```
 *
 * # ⚠ THE SENTENCE IS VERBATIM FROM THE FRAME HE ALREADY SCORED
 *
 * *"use this tattoo design on her neck"* — the cast is male and the pronoun is
 * wrong, and it is KEPT wrong on purpose: fable-1179 §1 passed the frame that
 * this exact sentence produced, so arm A is judged against a founder-scored
 * anchor. Fixing the pronoun here would make A a new experiment instead of a
 * control. (The pronoun itself is a real defect and belongs in its own change.)
 *
 * # ⚠ AND THE FLOOR IS LOWERED IN THE DEV TREE WHILE THIS RUNS
 *
 * Rung B cannot pass the shipped upload door — 183 < 256 — which IS the court.
 * The server this drives is booted with `INK_DESIGN_MIN_EDGE` at 128, restored
 * from a `cp` backup verified by `sha256sum` afterwards (never `git checkout`,
 * which wipes uncommitted work in the same file). A and C clear 256 either way,
 * so the lowered floor cannot touch them and the arms stay comparable.
 *
 * # What one invocation costs
 *
 * ONE render: 25 dev credits on verify-bot (823). The rung/draw split exists so
 * a plumbing fault costs one render and not six — the reason `COURT_STEP` is on
 * the realism court, learned the expensive way.
 */
import { mkdir, writeFile } from "node:fs/promises";

import "dotenv/config";
import { SignJWT } from "jose";
import type { ElementHandle } from "puppeteer-core";

import { openDrivenPage } from "./lib/drivePage.mts";
import { openDatabase } from "./lib/dbConnection.mts";

const RUNG = process.env.COURT_RUNG ?? "";
if (!["A", "B", "C"].includes(RUNG)) {
  console.error("COURT_RUNG must be A (native), B (183 short edge) or C (upscaled)");
  process.exit(1);
}
const DRAW = process.env.COURT_DRAW ?? "1";
if (!["1", "2"].includes(DRAW)) {
  console.error("COURT_DRAW must be 1 or 2 — two draws per rung, because the same recipe twice has drifted 0.0% and 21.3%");
  process.exit(1);
}

const PICTURE = {
  A: "output/court-floor/A-native.png",
  B: "output/court-floor/B-small.png",
  C: "output/court-floor/C-upscaled.png",
}[RUNG]!;

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const OUT = "output/court-floor/frames";
const SESSION = "af5011d8-ca5f-4bd8-a785-7cc516c8361d";
/* The one refinable Cast on that session; every other candidate is signed or expired. */
const CANDIDATE = 232;
/* VERBATIM — see the docblock. The pronoun is wrong and stays wrong. */
const ASK = "use this tattoo design on her neck";

const log: string[] = [];
const say = (line: string) => { console.log(line); log.push(line); };

await mkdir(OUT, { recursive: true });

const secret = process.env.JWT_SECRET;
const appId = process.env.VITE_APP_ID;
if (!secret || !appId) {
  console.error("REFUSING: JWT_SECRET and VITE_APP_ID are needed to mint the driving session");
  process.exit(1);
}
/* THE PAYLOAD IS `openId`, NOT `userId` — `verifySession` resolves the account
   from the open id, and a `userId` claim is silently nobody: the page redirects
   to /login and the driver reports "no candidate tiles", which is a login
   failure wearing a data failure's sentence. Cost one debugging round. */
const token = await new SignJWT({ openId: "verify-bot-local", appId, name: "Verify Bot" })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("3h")
  .sign(new TextEncoder().encode(secret));

const { browser, page } = await openDrivenPage({ base: BASE, token, width: 1440, height: 960 });

const finish = async (code: number, why: string): Promise<never> => {
  say(why);
  await writeFile(`${OUT}/rung-${RUNG}-draw-${DRAW}.log`, `${log.join("\n")}\n`, "utf8");
  await browser.close();
  await database.end().catch(() => undefined);
  process.exit(code);
};

/*
  THE WIRE. A court that reads its own outcome off a banner is reading a
  claim; the variant row is the fact (working law 1).
*/
const publicBase = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");
if (!publicBase) {
  console.error("REFUSING: R2_PUBLIC_URL is not set — the frame could be rendered and never fetched");
  process.exit(1);
}
const database = await openDatabase(process.env.DATABASE_URL ?? "");
const newestVariantId = async (): Promise<number> => {
  const [rows] = await database.query<any[]>(
    "SELECT id FROM casting_candidate_variants WHERE candidateId = ? ORDER BY id DESC LIMIT 1",
    [CANDIDATE],
  );
  return rows[0]?.id ?? 0;
};
const waitForNewVariant = async (was: number): Promise<{ id: number; imageKey: string } | null> => {
  const deadline = Date.now() + 900_000;
  while (Date.now() < deadline) {
    await new Promise((done) => setTimeout(done, 5_000));
    const [rows] = await database.query<any[]>(
      "SELECT id, imageKey FROM casting_candidate_variants WHERE candidateId = ? AND id > ? ORDER BY id DESC LIMIT 1",
      [CANDIDATE, was],
    );
    if (rows[0]?.imageKey) return { id: rows[0].id, imageKey: rows[0].imageKey };
  }
  return null;
};

say(`══ RUNG ${RUNG}, DRAW ${DRAW} — reference ${PICTURE}`);
const health = await fetch(`${BASE}/api/health`).then(
  async (response) => `${response.status} ${(await response.text()).slice(0, 120)}`,
  (error: unknown) => `unreachable — ${String(error)}`,
);
say(`   health: ${health}`);
if (!health.startsWith("200")) await finish(1, "STOPPED: no server on the port this rung is aimed at");

await page.goto(`${BASE}/casting/s/${SESSION}`, { waitUntil: "domcontentloaded" });
if (!(await page.waitForSelector('button[aria-label^="View candidate"]', { timeout: 120_000 }).catch(() => null))) {
  await finish(1, "STOPPED: no candidate tiles");
}
const opened = await page.evaluate(() => {
  const tiles = Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-label^="View candidate"]'));
  tiles[0]?.click();
  return { count: tiles.length, label: tiles[0]?.getAttribute("aria-label") ?? "" };
});
say(`   tile 0 of ${opened.count}: ${opened.label || "(none)"}`);
if (!(await page.waitForSelector(".dpc-refine__field", { timeout: 120_000 }).catch(() => null))) {
  await finish(1, "STOPPED: no ask box");
}

/*
  EVERY RUNG BRANCHES FROM THE SAME INK-FREE VERSION, which is what makes six
  renders a ladder rather than six experiments. The rail is oldest-first, so the
  version immediately before the first inked one is the newest chain with no ink
  in it — and it stays the same version however many inked ones pile up after.
*/
await page.waitForSelector(".dpc-refine__pick", { timeout: 60_000 }).catch(() => null);
const chose = await page.evaluate(() => {
  const picks = Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__pick"));
  const labels = picks.map((one) => one.getAttribute("aria-label") ?? "");
  const firstInked = labels.findIndex((one) => /tattoo|design/i.test(one));
  const at = firstInked === -1 ? picks.length - 1 : firstInked - 1;
  picks[Math.max(at, 0)]?.click();
  return { count: picks.length, at, label: (labels[Math.max(at, 0)] ?? "").trim() };
});
say(`   versions on the rail: ${chose.count}; chose ${chose.at} — ${chose.label}`);
const startedFrom = await page.waitForFunction(
  () => document.querySelector(".dpc-refine__madeText")?.textContent?.trim() ?? "(the original)",
  { timeout: 60_000, polling: 500 },
).then((handle) => handle.jsonValue() as Promise<string>, () => "");
say(`   branching from: "${startedFrom}"`);
if (/tattoo|design/i.test(startedFrom)) {
  await finish(1, "STOPPED: no version without ink in its chain — this ask would be walled");
}

const input = (await page.$(".dpc-refine__readInput")) as ElementHandle<HTMLInputElement> | null;
if (!input) await finish(1, "STOPPED: no attach door — is the scope armed?");
await input!.uploadFile(PICTURE);
if (!(await page.waitForSelector(".dpc-refine__thumb img", { timeout: 30_000 }).catch(() => null))) {
  await finish(1, `STOPPED: the picture never became a chip — on rung ${RUNG} that may be the floor refusing it`);
}
/* "I have permission" — picked by its WORDS, so a reordered enum cannot file a
   different claim. */
await page.evaluate(() => {
  Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__claim button"))
    .find((one) => (one.textContent ?? "").toLowerCase().includes("permission"))
    ?.click();
});
await page.waitForFunction(() => document.querySelector(".dpc-refine__claim") === null, { timeout: 60_000 })
  .catch(() => null);

/* THE STICKY BANNER IS DISMISSED BEFORE THE ASK — it holds the LAST outcome for
   this Cast, including one from a previous rung, and a wait that is already
   satisfied is a coin flip that always lands the same way. */
await page.evaluate(() => {
  document.querySelector<HTMLButtonElement>(".dpc-refine__outcome .dpc-refine__dismiss")?.click();
});
await page.waitForFunction(() => document.querySelector(".dpc-refine__outcome") === null,
  { timeout: 30_000, polling: 500 }).catch(() => null);
const bannerLeft = await page.evaluate(() => document.querySelector(".dpc-refine__outcome") !== null);
say(`   banner:  ${bannerLeft ? "STILL THERE — a wait below may be reading somebody else's answer" : "cleared before the ask"}`);

const before = await newestVariantId();
say(`   newest variant before the ask: v#${before}`);
say(`   ask:     "${ASK}"`);
await page.type(".dpc-refine__field", ASK);
await page.evaluate(() => {
  Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__ask button"))
    .find((button) => button.type === "submit")?.click();
});

/*
  ⚠ THE SETTLE IS READ AT THE WIRE, NOT OFF THE BANNER — and rung A paid for
  that lesson.

  The realism court's driver waits on `.dpc-refine__outcome` appearing. Driven
  here it sat the full fifteen minutes and reported *"the ask never settled"*
  while the server had already logged `repainted the whole frame`, minted the
  delivery crop and written variant `494` — **twenty-five seconds after the
  ask**. A driver whose verdict disagrees with the database is not a slow
  driver; it MISREPORTS, and the same sentence in the realism court's own log
  ("did not settle inside 15 minutes", beside a frame it had just saved) says
  this is that harness's flake and not something new.

  So the question asked here is the one the database can answer: *is there a
  new variant on this candidate?* The DOM is still driven — it is the only way
  to exercise the real road — but it is not believed about outcomes.
*/
const offeredOrDone = await page.waitForFunction(
  () => document.querySelector(".dpc-refine__shownCut img") !== null
    || (document.querySelector(".dpc-refine__outcome")?.textContent ?? "").length > 0,
  { timeout: 120_000, polling: 2000 },
).then(() => true, () => false);
if (offeredOrDone) {
  const first = await page.evaluate(() => ({
    outcome: document.querySelector(".dpc-refine__outcome")?.textContent?.replace("×", "").trim() ?? "",
    cut: document.querySelector<HTMLImageElement>(".dpc-refine__shownCut img") !== null,
  }));
  say(`   said:    ${first.outcome || "(nothing)"}`);
  say(`   offered a cut: ${first.cut}`);
  if (first.cut) {
    await page.evaluate(() => {
      Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__answer"))
        .find((one) => (one.textContent ?? "").toLowerCase().startsWith("yes"))?.click();
    });
  }
} else say("   said:    (the banner never appeared — the wire below is the reading)");

const landedRow = await waitForNewVariant(before);
const landed = landedRow !== null;
say(`   render:  ${landed ? `settled as v#${landedRow!.id}` : "no new variant inside fifteen minutes"}`);
if (landedRow) {
  const bytes = await fetch(`${publicBase}/${landedRow.imageKey}`).then(
    async (response) => (response.ok ? Buffer.from(await response.arrayBuffer()) : null),
    () => null,
  );
  if (bytes) {
    await writeFile(`${OUT}/rung-${RUNG}-draw-${DRAW}.png`, bytes);
    say(`   frame:   ${OUT}/rung-${RUNG}-draw-${DRAW}.png (${bytes.length} bytes)  ← ${landedRow.imageKey}`);
  } else say(`   frame:   (could not fetch ${landedRow.imageKey})`);
}

await finish(landed ? 0 : 1, landed
  ? `\nlog: ${OUT}/rung-${RUNG}-draw-${DRAW}.log — the frame is for eyes, and this script grades nothing`
  : "STOPPED: the render did not settle");

/* END BY ENDING THE PROCESS — puppeteer leaves handles alive, and
   `scriptExitDiscipline` wants the LAST top-level statement to be this one. */
process.exit(0);
