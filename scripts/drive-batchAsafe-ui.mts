/**
 * Batch A-safe UI drive — browser-level proofs (R6 execution plan):
 *
 *   SD13 a placed DRAFT opened through Edit reaches a working name-and-mint
 *        door: the modal has a name field (audit V9's missing input), the
 *        mint door is disabled while nameless, typing a name enables it,
 *        and the add-views/stays-draft door is present alongside.
 *   V8a  the board strip's `{N} stale` count equals the rows the bulk
 *        refresh dialog offers (stale headshot + pinned stale excluded).
 *   V8b  the stale HEADSHOT surfaces as its own labeled state with the
 *        ruled exits, STATUS-AWARE (F6): a draft's copy routes to the
 *        environment and never says fork; a minted model's copy says the
 *        identity changes only by forking; the restore exit is advertised
 *        exactly when a previous version exists.
 *
 * FREE: no generation is triggered (the mint door is proven reachable and
 * enabled, never clicked); seeded rows are cleaned up. LOCAL dev server
 * only (VERIFY_BASE_URL, default http://localhost:3000).
 *
 * Usage: pnpm dev (separate terminal), then: npx tsx scripts/drive-batchAsafe-ui.mts
 */
import "dotenv/config";
import { SignJWT } from "jose";
import mysql from "mysql2/promise";
import puppeteer from "puppeteer-core";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const R2 = process.env.R2_PUBLIC_URL ?? "https://pub-test.r2.dev";

const failures: string[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(name);
};

// ── Session + seeds ────────────────────────────────────────────────────────
const conn = await mysql.createConnection(process.env.DATABASE_URL!);
await conn.execute(
  `INSERT INTO users (openId, name, email, approved, emailVerified, role)
   VALUES ('verify-bot-local', 'Verify Bot', 'verify-bot@local.test', 1, 1, 'user')
   ON DUPLICATE KEY UPDATE approved = 1, emailVerified = 1`,
);
const [users] = await conn.execute(`SELECT id FROM users WHERE openId = 'verify-bot-local'`);
const userId = (users as Array<{ id: number }>)[0].id;

let [boards] = await conn.execute(
  `SELECT id FROM boards WHERE userId = ? AND name = 'batchAsafe-ui-drive' LIMIT 1`,
  [userId],
);
let boardId = (boards as Array<{ id: number }>)[0]?.id;
if (!boardId) {
  const [res] = await conn.execute(
    `INSERT INTO boards (userId, name, startedWith) VALUES (?, 'batchAsafe-ui-drive', 'blank')`,
    [userId],
  );
  boardId = (res as { insertId: number }).insertId;
}
await conn.execute(`DELETE FROM board_items WHERE boardId = ?`, [boardId]);
await conn.execute(`DELETE FROM board_edges WHERE boardId = ?`, [boardId]);
await conn.execute(`UPDATE boards SET viewportX = 0, viewportY = 0, viewportZoom = 100 WHERE id = ?`, [boardId]);

async function insertModel(name: string | null, status: string, agencyId: string | null = null) {
  const [res] = await conn.execute(
    `INSERT INTO models (userId, name, status, agencyId, mintedAt, masterPrompt, technicalSchema, preferences)
     VALUES (?, ?, ?, ?, ?, 'drive batchAsafe temp', '{}', '{}')`,
    [userId, name, status, agencyId, agencyId ? new Date() : null],
  );
  return (res as { insertId: number }).insertId;
}
async function insertAsset(
  modelId: number,
  viewType: string,
  opts: { stale?: boolean; pinned?: boolean } = {},
) {
  await conn.execute(
    `INSERT INTO model_assets (modelId, viewType, resolution, storageUrl, pointsCost, pinned, status)
     VALUES (?, ?, '1K', ?, 0, ?, ${opts.stale ? "CAST(? AS JSON)" : "NULL"})`,
    [
      modelId,
      viewType,
      `${R2}/drive-batchAsafe/${modelId}-${viewType}.png`,
      opts.pinned ? 1 : 0,
      ...(opts.stale ? [JSON.stringify({ state: "stale" })] : []),
    ],
  );
}
async function insertItem(label: string, modelId: number, x: number, draft: boolean) {
  const [res] = await conn.execute(
    `INSERT INTO board_items (boardId, type, kind, label, imageUrl, positionX, positionY, width, height, zIndex, metadata, sourceModelId)
     VALUES (?, 'model', 'image', ?, ?, ?, 120, 280, 420, 0, CAST(? AS JSON), ?)`,
    [
      boardId,
      label,
      `${R2}/drive-batchAsafe/${modelId}-frontClose.png`,
      x,
      JSON.stringify({
        provenance: { type: "library_cast", modelId, viewAngle: "frontClose", ...(draft ? { draft: true } : {}) },
        version: 1,
      }),
      modelId,
    ],
  );
  return (res as { insertId: number }).insertId;
}

// SD13 subject: a placed DRAFT with just a headshot
const draftId = await insertModel(null, "draft");
await insertAsset(draftId, "frontClose");
const draftItemId = await insertItem("ASafe Draft", draftId, 200, true);

// V8 subject: a draft comp card, all six filled; stale on the headshot +
// two views; one MORE stale view pinned (must join neither count nor dialog)
const sheetId = await insertModel("ASafe Sheet", "draft");
await insertAsset(sheetId, "frontClose", { stale: true });
await insertAsset(sheetId, "threeQuarter", { stale: true });
await insertAsset(sheetId, "sideClose", { stale: true });
await insertAsset(sheetId, "frontFull");
await insertAsset(sheetId, "sideFull", { stale: true, pinned: true });
await insertAsset(sheetId, "backFull");
const sheetItemId = await insertItem("ASafe Sheet", sheetId, 760, true);

// F6 minted subject: stale headshot with TWO filled headshot rows (v2 → the
// restore exit must be advertised) on a minted identity
const mintedId = await insertModel("ASafe Minted", "active", "MOD-26-DRASF1");
await insertAsset(mintedId, "frontClose"); // older version (v1)
await insertAsset(mintedId, "frontClose", { stale: true }); // newest head, stale
await insertAsset(mintedId, "sideClose");
await insertAsset(mintedId, "threeQuarter");
const mintedItemId = await insertItem("ASafe Minted", mintedId, 1120, false);

const token = await new SignJWT({
  openId: "verify-bot-local",
  appId: process.env.VITE_APP_ID,
  name: "Verify Bot",
})
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("1h")
  .sign(new TextEncoder().encode(process.env.JWT_SECRET));

// ── Browser ────────────────────────────────────────────────────────────────
const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: "new" as never,
  args: ["--window-size=1600,1000"],
  defaultViewport: { width: 1600, height: 1000 },
});

try {
  const page = await browser.newPage();
  await page.setCookie({ name: "app_session_id", value: token, domain: "localhost", path: "/" });
  await page.goto(`${BASE}/app/board/${boardId}`, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForSelector(`.react-flow__node[data-id="item-${sheetItemId}"]`, { timeout: 60000 });

  // ── V8a: strip count equals the dialog's actionable rows ───────────────
  await page.click(`.react-flow__node[data-id="item-${sheetItemId}"]`);
  await page.waitForFunction(
    () => [...document.querySelectorAll("button")].some((b) => b.textContent?.trim() === "2 stale"),
    { timeout: 30000 },
  );
  const v8aStrip = await page.evaluate(() => {
    const texts = [...document.querySelectorAll("button")].map((b) => b.textContent?.trim() ?? "");
    return {
      // Honest count: 2 actionable (threeQuarter + sideClose) — NOT 4
      // (stale headshot and stale-pinned walk are structurally refused)
      countSegment: texts.find((t) => /^\d+ stale$/.test(t)) ?? null,
      headshotSegment: texts.includes("Headshot out of sync"),
    };
  });
  check(
    "V8a strip counts only the actionable set (2 stale, not 4)",
    v8aStrip.countSegment === "2 stale",
    JSON.stringify(v8aStrip),
  );

  const staleButtons = await page.$$("button");
  for (const b of staleButtons) {
    const t = await b.evaluate((el) => el.textContent?.trim());
    if (t === "2 stale") {
      await b.click();
      break;
    }
  }
  await page.waitForFunction(
    () => document.body.innerText.includes("Refresh out-of-sync views?"),
    { timeout: 30000 },
  );
  // Rows arrive with the plan query; wait for the resolved dialog (the
  // confirm stays disabled until totalCost lands, so this is the real state)
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("button")].some(
        (b) => /^Refresh [1-9]\d* views?$/.test(b.textContent?.trim() ?? "") && !(b as HTMLButtonElement).disabled,
      ),
    { timeout: 30000 },
  );
  const v8aDialog = await page.evaluate(() => {
    const confirm = [...document.querySelectorAll("button")].find((b) =>
      /^Refresh \d+ views?$/.test(b.textContent?.trim() ?? ""),
    );
    const text = document.body.innerText;
    return {
      confirmLabel: confirm?.textContent?.trim() ?? null,
      hasThreeQuarter: text.includes("Three-quarter"),
      hasSideProfile: text.includes("Side profile"),
      offersHeadshot: /Refresh out-of-sync[\s\S]*Headshot/.test(text),
      offersWalk: /Refresh out-of-sync[\s\S]*Walk\b/.test(text),
    };
  });
  check(
    "V8a dialog offers exactly the 2 counted rows (¾ + side profile; no headshot, no pinned walk)",
    v8aDialog.confirmLabel === "Refresh 2 views" &&
      v8aDialog.hasThreeQuarter &&
      v8aDialog.hasSideProfile &&
      !v8aDialog.offersHeadshot &&
      !v8aDialog.offersWalk,
    JSON.stringify(v8aDialog),
  );
  const cancelBtns = await page.$$("button");
  for (const b of cancelBtns) {
    const t = await b.evaluate((el) => el.textContent?.trim());
    if (t === "Cancel") {
      await b.click();
      break;
    }
  }

  // ── V8b: stale-headshot state is labeled AND status-aware (F6) ─────────
  // Opens the "Headshot out of sync" chip's popover and reads ONLY the
  // popover's text (scoped — fork copy elsewhere on the page must not pass)
  const openHeadshotPopover = async () => {
    const btns = await page.$$("button");
    for (const b of btns) {
      const t = await b.evaluate((el) => el.textContent?.trim());
      if (t === "Headshot out of sync") {
        await b.click();
        break;
      }
    }
    await page.waitForFunction(
      () =>
        (document.querySelector("[data-radix-popper-content-wrapper]")?.textContent ?? "").includes(
          "Headshot out of sync — it never refreshes",
        ),
      { timeout: 30000 },
    );
    return page.evaluate(() => {
      const pop = document.querySelector("[data-radix-popper-content-wrapper]");
      const text = pop?.textContent ?? "";
      const buttons = [...(pop?.querySelectorAll("button") ?? [])].map((b) => b.textContent?.trim() ?? "");
      return {
        labeledState: text.includes("Headshot out of sync — it never refreshes"),
        saysEnvironment: text.includes("Edit it in the environment"),
        saysFork: text.toLowerCase().includes("fork"),
        advertisesRestore: text.includes("restore a previous version"),
        iterateExit: buttons.includes("Open in environment"),
      };
    });
  };

  // DRAFT (v1 headshot): environment exit, NO fork instruction anywhere in
  // the popover, no restore clause (no earlier version exists)
  const v8bDraft = await openHeadshotPopover();
  check(
    "V8b DRAFT stale headshot: labeled, routes to the environment, never says fork",
    v8bDraft.labeledState && v8bDraft.saysEnvironment && v8bDraft.iterateExit && !v8bDraft.saysFork,
    JSON.stringify(v8bDraft),
  );
  check(
    "V8b DRAFT with no earlier version does not advertise restore",
    !v8bDraft.advertisesRestore,
    JSON.stringify(v8bDraft),
  );
  await page.keyboard.press("Escape");

  // MINTED (v2 headshot): fork instruction present, no environment-iterate
  // claim, restore advertised (an earlier version exists)
  await page.click(`.react-flow__node[data-id="item-${mintedItemId}"]`);
  await page.waitForFunction(
    () => [...document.querySelectorAll("button")].some((b) => b.textContent?.trim() === "Headshot out of sync"),
    { timeout: 30000 },
  );
  const v8bMinted = await openHeadshotPopover();
  check(
    "V8b MINTED stale headshot: labeled, says the identity forks, not the draft copy",
    v8bMinted.labeledState && v8bMinted.saysFork && !v8bMinted.saysEnvironment,
    JSON.stringify(v8bMinted),
  );
  check(
    "V8b MINTED with an earlier version advertises the restore exit",
    v8bMinted.advertisesRestore,
    JSON.stringify(v8bMinted),
  );
  await page.keyboard.press("Escape");

  // ── SD13: placed draft → Edit → name field → mint door enables ─────────
  await page.evaluate(
    (itemId: number, modelId: number) => {
      window.dispatchEvent(
        new CustomEvent("board-edit-cast", { detail: { itemId, modelId, draft: true } }),
      );
    },
    draftItemId,
    draftId,
  );
  // The takeover opens; summon the mint gate (the ghost tile's door)
  await page.waitForFunction(() => !!document.querySelector("textarea"), { timeout: 60000 });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("casting-open-mint")));
  await page.waitForFunction(
    () => [...document.querySelectorAll("button")].some((b) => (b.textContent ?? "").includes("Name & mint")),
    { timeout: 30000 },
  );

  const sd13Before = await page.evaluate(() => {
    const modalInput = document.querySelector<HTMLInputElement>('input[placeholder*="mint"]');
    const mintBtn = [...document.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").includes("Name & mint"),
    ) as HTMLButtonElement | undefined;
    const addViewsBtn = [...document.querySelectorAll("button")].find(
      (b) => (b.textContent ?? "").trim().startsWith("Add views"),
    );
    return {
      hasNameField: !!modalInput,
      mintDisabledWhileNameless: mintBtn ? mintBtn.disabled : null,
      hasAddViewsDoor: !!addViewsBtn,
      header: document.body.innerText.includes("Add views"),
    };
  });
  check(
    "SD13 the placed-draft Edit dialog HAS a name field + both doors (V9 structural fix)",
    sd13Before.hasNameField && sd13Before.hasAddViewsDoor,
    JSON.stringify(sd13Before),
  );
  check(
    "SD13 the mint door is honestly disabled while nameless",
    sd13Before.mintDisabledWhileNameless === true,
    JSON.stringify(sd13Before),
  );

  await page.type('input[placeholder*="mint"]', "Vera Drive");
  await page.waitForFunction(
    () => {
      const mintBtn = [...document.querySelectorAll("button")].find((b) =>
        (b.textContent ?? "").includes("Name & mint"),
      ) as HTMLButtonElement | undefined;
      return mintBtn ? !mintBtn.disabled : false;
    },
    { timeout: 15000 },
  );
  check("SD13 typing a name ENABLES the deliberate mint door (not clicked — free drive)", true);
} catch (e) {
  check("drive completed without exception", false, e instanceof Error ? e.message : String(e));
} finally {
  await browser.close();
  await conn.execute(`DELETE FROM board_items WHERE boardId = ?`, [boardId]);
  await conn.execute(`DELETE FROM model_assets WHERE modelId IN (?, ?, ?)`, [draftId, sheetId, mintedId]);
  await conn.execute(`DELETE FROM models WHERE id IN (?, ?, ?)`, [draftId, sheetId, mintedId]);
  await conn.end();
}

if (failures.length > 0) {
  console.error(`\n${failures.length} Batch A-safe UI invariant(s) FAILED: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nAll Batch A-safe UI invariants hold (SD13 + V8 count/exit honesty).");
