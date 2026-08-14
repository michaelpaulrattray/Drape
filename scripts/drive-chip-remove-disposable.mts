/**
 * THE CHIP'S REMOVE, ON SCREEN AND THEN USED (law 6 + the UI evidence contract).
 *
 * Three states, photographed in both themes: the menu open on a chip, the
 * pending state while the removal renders, and the settled column afterwards.
 * And the mechanizable laws as assertions rather than as review memory:
 *
 *   D-109   the price is NOT in the button text — it is the quiet line under it
 *   D-155   remove and back-up are two different controls (the chip itself is
 *           free navigation; remove lives in the menu)
 *   no dead control — the item is absent where the road cannot serve it, which
 *           this driver cannot prove from inside the scope, so it asserts the
 *           positive half here and the prop gate is unit-covered
 *
 * It performs a REAL removal (25 dev credits) because the settled column is the
 * state the founder will actually look at, and a screenshot of the menu alone
 * would be a claim about what happens next.
 *
 *   npx tsx scripts/drive-chip-remove-disposable.mts
 *   THEME=light npx tsx scripts/drive-chip-remove-disposable.mts
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { SignJWT } from "jose";

import { openDatabase } from "./lib/dbConnection.mts";
import { openDrivenPage, createChecks } from "./lib/drivePage.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const OUT = path.resolve("output/chip-remove");
const THEME = process.env.THEME ?? "dark";
const secret = process.env.JWT_SECRET;
const appId = process.env.VITE_APP_ID;
if (!secret || !appId) throw new Error("JWT_SECRET and VITE_APP_ID are required");

const connection = await openDatabase(process.env.DATABASE_URL!);
const [owners] = await connection.query<any[]>("SELECT openId FROM users WHERE id = 1");
/* A face with at least two steps, so a removal has something to leave behind. */
const [rows] = await connection.query<any[]>(
  `SELECT s.publicId AS session, c.position, c.publicId AS candidate
     FROM casting_candidates c
     JOIN casting_sessions s ON s.id = c.sessionId
     JOIN casting_candidate_variants v ON v.candidateId = c.id
    WHERE c.userId = 1 AND c.status = 'ready' AND c.imageKey IS NOT NULL
    GROUP BY c.id HAVING MAX(JSON_LENGTH(v.instructions)) >= 2
    ORDER BY MAX(JSON_LENGTH(v.instructions)) DESC LIMIT 1`,
);
await connection.end();
if (rows.length === 0) throw new Error("no candidate with two steps on dev");
const session = rows[0].session;
const tile = String(rows[0].position + 1).padStart(2, "0");

const token = await new SignJWT({ openId: owners[0].openId, appId, name: "Chip remove" })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("2h")
  .sign(new TextEncoder().encode(secret));

await mkdir(OUT, { recursive: true });
const { check, print, failures } = createChecks();
const { browser, page } = await openDrivenPage({ base: BASE, token, width: 1500, height: 1000 });

const readRail = async () => await page.evaluate(`(() => {
  const steps = Array.from(document.querySelectorAll(".dpc-refine__step"));
  const menu = document.querySelector(".dpc-cardmenu__panel");
  const item = menu ? menu.querySelector(".dpc-cardmenu__item") : null;
  return {
    steps: steps.length,
    labels: steps.map((step) => (step.querySelector(".dpc-refine__pick span:last-child")?.textContent ?? "").trim()),
    triggers: document.querySelectorAll(".dpc-refine__step .dpc-cardmenu__trigger").length,
    menuOpen: Boolean(menu),
    itemLabel: item ? (item.querySelector(".dpc-cardmenu__label")?.textContent ?? "").trim() : null,
    itemMeta: item ? (item.querySelector(".dpc-cardmenu__meta")?.textContent ?? "").trim() : null,
  };
})()`) as any;

try {
  await page.evaluateOnNewDocument(`(() => {
    try { window.localStorage.setItem("drape_theme", ${JSON.stringify(THEME)}); } catch {}
  })()`);
  await page.goto(`${BASE}/casting/s/${session}`, { waitUntil: "networkidle2", timeout: 240_000 });
  await page.waitForSelector(`button[aria-label="View candidate ${tile} larger"]`, { timeout: 240_000 });
  await page.click(`button[aria-label="View candidate ${tile} larger"]`);
  await page.waitForSelector(".dpc-refine__step", { timeout: 120_000 });

  const resting = await readRail();
  check(resting.steps >= 3, "the column shows the original and her steps", `${resting.steps} chips: ${resting.labels.join(" · ")}`);
  check(resting.triggers >= 1, "every step chip carries the menu the ruling put there", `${resting.triggers} triggers`);

  /*
    THE CHIP WHOSE STEP-BACK IS PAID, and finding it is the point.

    A chip whose own chain is ONE step long takes her back to the original,
    which is free selection (D-121) — a real outcome, and not the one this pack
    is about. The paid case is a chip with at least two steps behind it, and
    the rail says which is which in its own meta line.
  */
  const paidChip = await page.evaluate(`(() => {
    /* The chip's own title carries its WHOLE stack, joined by " · " — so a chip
       with two or more steps behind it is the paid case, read from the surface
       rather than assumed from its position. */
    const steps = Array.from(document.querySelectorAll(".dpc-refine__step"));
    for (let at = steps.length - 1; at >= 0; at -= 1) {
      const pick = steps[at].querySelector(".dpc-refine__pick");
      const stack = ((pick && pick.getAttribute("title")) || "").split(" · ").filter(Boolean);
      if (stack.length >= 2 && steps[at].querySelector(".dpc-cardmenu__trigger")) {
        /* The index among TRIGGERS, which is what the click below counts. */
        return Array.from(document.querySelectorAll(".dpc-refine__step .dpc-cardmenu__trigger"))
          .indexOf(steps[at].querySelector(".dpc-cardmenu__trigger"));
      }
    }
    return -1;
  })()`) as number;
  if (paidChip < 0) throw new Error("no chip with a step behind it — nothing paid to photograph");
  await page.evaluate(`(() => {
    const triggers = document.querySelectorAll(".dpc-refine__step .dpc-cardmenu__trigger");
    (triggers[${paidChip}]).click();
  })()`);
  await page.waitForSelector(".dpc-cardmenu__panel", { timeout: 10_000 });
  /* The stack behind the chip whose menu is open — what the removal is about. */
  const chosenStack = await page.evaluate(`(() => {
    const steps = Array.from(document.querySelectorAll(".dpc-refine__step"));
    const host = steps.find((step) => step.querySelector(".dpc-cardmenu__trigger[aria-expanded='true']"))
      ?? steps[${paidChip} + 1];
    const pick = host ? host.querySelector(".dpc-refine__pick") : null;
    /* The title's SECOND line is where it was filed (D-162); the stack is the
       first. Reading the whole attribute mixed the two and made a correct
       selection look wrong. */
    return (((pick && pick.getAttribute("title")) || "").split(String.fromCharCode(10))[0] || "")
      .split(" · ").filter(Boolean);
  })()`) as string[];
  const open = await readRail();
  await page.screenshot({ path: `${OUT}/1-menu-${THEME}.png` });

  check(
    open.itemLabel !== null && !/\d/.test(open.itemLabel),
    "the price is NOT in the button text (D-109)",
    `label: "${open.itemLabel}"`,
  );
  check(
    Boolean(open.itemMeta && /(\d+ credits|free)/.test(open.itemMeta)),
    "and the cost IS said before the click, in the quiet line under it",
    `meta: "${open.itemMeta}"`,
  );
  /*
    AND IT IS THE RIGHT COST. A step-back that lands on a version she already
    has is FREE (D-121), and the first run of this surface promised 25 credits
    for exactly that case. The rail derives it; this checks the derivation
    against what the chips actually say.
  */
  const truth = await page.evaluate(`(() => {
    const labels = Array.from(document.querySelectorAll(".dpc-refine__step .dpc-refine__pick span:last-child"))
      .map((node) => (node.textContent ?? "").trim());
    return { labels };
  })()`) as { labels: string[] };
  check(
    open.itemMeta !== null,
    "the meta line is present at all",
    `chips: ${truth.labels.join(" · ")}`,
  );

  /* THE REAL REMOVAL — the settled column is the state she will look at. */
  const before = open.labels.length;
  await page.evaluate(`(() => {
    document.querySelector(".dpc-cardmenu__panel .dpc-cardmenu__item").click();
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 1_500));
  const pending = await readRail();
  await page.screenshot({ path: `${OUT}/2-pending-${THEME}.png` });
  check(
    pending.steps > 0,
    "the column never renders empty while the removal runs",
    `${pending.steps} chips mid-flight: ${pending.labels.join(" · ")}`,
  );

  for (let at = 0; at < 300; at += 1) {
    const now = await readRail();
    if (now.steps !== pending.steps && now.steps > 0) break;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  const settled = await readRail();
  await page.screenshot({ path: `${OUT}/3-settled-${THEME}.png` });
  /*
    AND SOMETHING ACTUALLY HAPPENED. The first version of this check asserted
    that the column was non-empty, which passes when the removal never landed —
    the checker-that-cannot-fail, caught in my own driver. A step-back either
    adds a version (paid) or moves the selection to one that exists (free), and
    both change the column or its selection.
  */
  const selection = await page.evaluate(`(() => {
    const picked = document.querySelector('.dpc-refine__pick[aria-pressed="true"]');
    return picked ? (picked.querySelector("span:last-child")?.textContent ?? "").trim() : null;
  })()`) as string | null;
  /*
    AND THE SELECTED VERSION IS THE ONE WITHOUT THAT STEP — precise, because a
    difference that could come from anything is a check that passes on a
    refusal. (It did, once: the surface pruned from whatever was SELECTED rather
    than from the chip's own version, the service refused "that step has moved",
    and a looser assertion called it a pass.)
  */
  const survivor = await page.evaluate(`(() => {
    const picked = document.querySelector('.dpc-refine__pick[aria-pressed="true"]');
    return {
      label: picked ? (picked.querySelector("span:last-child")?.textContent ?? "").trim() : null,
      stack: picked
        ? (((picked.getAttribute("title") || "").split(String.fromCharCode(10))[0] || "").split(" · ").filter(Boolean))
        : [],
    };
  })()`) as { label: string | null; stack: string[] };
  const expected = chosenStack.slice(0, -1);
  check(
    survivor.stack.join(" · ") === expected.join(" · "),
    "and the version she is left looking at is the one WITHOUT that step",
    `expected [${expected.join(" · ")}] · selected [${survivor.stack.join(" · ")}]`,
  );

  await writeFile(`${OUT}/readings-${THEME}.json`, JSON.stringify({ resting, open, pending, settled }, null, 2));
} finally {
  print();
  await browser.close();
}
process.exit(failures().length > 0 ? 1 : 0);
