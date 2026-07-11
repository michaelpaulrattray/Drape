/**
 * Canvas interaction invariants — permanent headless regression drive.
 *
 * Guards the trust invariants that broke silently once already:
 *   A. Create → immediately drag: the user's position ALWAYS wins over the
 *      in-flight server confirm (no snap-back to spawn position).
 *   B. Right-click add at a panned+zoomed viewport: the node lands at the
 *      cursor's flow position (screen→flow conversion, not raw coords).
 *   C. Library pick fills the node optimistically (D-38): the picked model's
 *      thumbnail lands on the node immediately, server reconcile behind.
 *      (Skips with a note when the verify-bot has no castable models.)
 *   D. THE BLEED CONTRACT (bug-1, founder-ordered — must never regress
 *      silently): leaving a minted edit discards the session. (i) re-entering
 *      Edit hydrates the model's true baseline, never leftovers; (iii) plain
 *      /studio?tool=casting after leaving opens a FRESH session — no ghost,
 *      no D-11 bypass. Leg (ii) — a surviving session arrives in minted-edit
 *      mode — holds by construction: the mode flag and the session stores are
 *      reset TOGETHER in the takeover cleanup; the flag cannot be cleared
 *      while the session lives.
 *   E. IMMUTABLE MINTED IDENTITY (D-43, free): the Save dialog on a minted
 *      edit is fork-or-keep — no update option, no red; and the server
 *      structurally refuses decision:'update' on any non-draft model
 *      (checked over raw tRPC HTTP, bypassing the UI entirely).
 *   F. (paid — RUN_PAID_INVARIANTS=1) Fork landing stability: the pending
 *      node appears immediately and never vanishes during the ~25s
 *      generation (the optimistic-reconcile race), then lands as an
 *      unnamed draft.
 *   G. (paid — RUN_PAID_INVARIANTS=1, rides on F's draft) Tiered mint
 *      package (R3b/D-39): the promotion session's mint modal shows
 *      plan-derived tier costs; a Core mint generates the three core slots
 *      with provenance, mints the identity, relabels the node, and the
 *      ledger agrees with the balance (bug-4 lesson); packageState over
 *      raw HTTP reports minted + 4 filled slots.
 *   H. (paid, rides on G's mint) The VC-R3b fixes: zero-edit save after a
 *      fresh mint is a quiet no-op (the false "new person" ceremony);
 *      the strip shows the six-slot package with upgrade ghosts; a ghost
 *      opens the tier dialog priced at the remaining slots; executing it
 *      completes the package (or names-and-refunds a gated slot); no
 *      generation rows stuck in processing (createGeneration insertId).
 *   I. (paid, SEPARATE mode) Forced gate failure surfaces named + refunded
 *      (D-40). Needs a server booted with BACK_VIEW_GATE_FORCE_FAIL=1 and
 *      the drive with RUN_GATE_FAIL=1 (the fail flag is server-side, out of
 *      the drive's reach). Forks + Production-mints; the back view fails
 *      twice; asserts the toast names it, the ledger refunds it, and the
 *      slot renders a Retry affordance. Runs standalone (A–H assume a
 *      passing gate). The always-on guard for the surfacing DATA is the
 *      computePackageSlots unit test.
 *
 * Run:  pnpm dev (running) → npx tsx scripts/verify-canvas.mts
 *       (+ $env:RUN_PAID_INVARIANTS='1' for F+G+H — ~1850 credits on verify-bot)
 *       (gate-fail mode: boot server with BACK_VIEW_GATE_FORCE_FAIL=1, then
 *        $env:RUN_GATE_FAIL='1' — ~1550 credits; do NOT combine with the F–H run)
 * Uses the dev DB verify-bot user (see .claude/skills/verify) and system Edge.
 * Exits non-zero on any invariant failure.
 */
import "dotenv/config";
import { SignJWT } from "jose";
import mysql from "mysql2/promise";
import puppeteer from "puppeteer-core";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const failures: string[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(name);
};

// ── Setup: verify-bot session + a dedicated reusable board ─────────────────
const conn = await mysql.createConnection(process.env.DATABASE_URL!);
await conn.execute(
  `INSERT INTO users (openId, name, email, approved, emailVerified, role)
   VALUES ('verify-bot-local', 'Verify Bot', 'verify-bot@local.test', 1, 1, 'user')
   ON DUPLICATE KEY UPDATE approved = 1, emailVerified = 1`,
);
const [users] = await conn.execute(`SELECT id FROM users WHERE openId = 'verify-bot-local'`);
const userId = (users as Array<{ id: number }>)[0].id;

let [boards] = await conn.execute(
  `SELECT id FROM boards WHERE userId = ? AND name = 'canvas-invariants' LIMIT 1`,
  [userId],
);
let boardId = (boards as Array<{ id: number }>)[0]?.id;
if (!boardId) {
  const [res] = await conn.execute(
    `INSERT INTO boards (userId, name, startedWith) VALUES (?, 'canvas-invariants', 'blank')`,
    [userId],
  );
  boardId = (res as { insertId: number }).insertId;
}
// Clean slate each run
await conn.execute(`DELETE FROM board_items WHERE boardId = ?`, [boardId]);

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
const page = await browser.newPage();
await page.setCookie({ name: "app_session_id", value: token, domain: "localhost", path: "/" });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

await page.goto(`${BASE}/app/board/${boardId}`, { waitUntil: "networkidle2", timeout: 60000 });
await page.waitForSelector('button[aria-label="Add"]', { timeout: 90000 });
await sleep(500);

const nodeCount = () => page.evaluate(() => document.querySelectorAll(".react-flow__node").length);
const nodeRects = () =>
  page.evaluate(() =>
    [...document.querySelectorAll(".react-flow__node")].map((n) => {
      const r = n.getBoundingClientRect();
      return { id: n.getAttribute("data-id") ?? "", x: r.x, y: r.y, w: r.width, h: r.height };
    }),
  );
const addCastViaPill = async () => {
  const btn = (await page.evaluate(() => {
    const b = document.querySelector('button[aria-label="Add"]');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }))!;
  await page.mouse.click(btn.x, btn.y);
  await sleep(400);
  const item = (await page.evaluate(() => {
    const els = [...document.querySelectorAll("button, [role=menuitem], div")].filter(
      (el) => el.textContent?.trim() === "Cast Model",
    );
    const el = els[els.length - 1];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }))!;
  await page.mouse.click(item.x, item.y);
};

// ── Invariant A: create → immediately drag → position sticks ───────────────
{
  const before = await nodeCount();
  await addCastViaPill();
  // Optimistic render: the node must exist essentially immediately
  await page.waitForFunction(
    (n: number) => document.querySelectorAll(".react-flow__node").length > n,
    { timeout: 2000, polling: 100 },
    before,
  );
  check("A1 optimistic render (<2s)", true);

  // Drag it NOW — before the server confirm can land
  const rects = await nodeRects();
  const node = rects[rects.length - 1];
  const from = { x: node.x + node.w / 2, y: node.y + 30 };
  const to = { x: from.x + 340, y: from.y + 180 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
  await sleep(300);
  const dragged = (await nodeRects()).find((r) => r.id === node.id)!;
  const movedImmediately = Math.abs(dragged.x - node.x - 340) < 30 && Math.abs(dragged.y - node.y - 180) < 30;
  check("A2 drag applied", movedImmediately, `d=(${(dragged.x - node.x).toFixed(0)},${(dragged.y - node.y).toFixed(0)})`);

  // Wait out the create-confirm + move-persist + any refetches, then re-assert
  await sleep(5000);
  const settled = (await nodeRects()).find((r) => Math.abs(r.x - dragged.x) < 30 && Math.abs(r.y - dragged.y) < 30);
  check("A3 position survives server confirm (no snap-back)", !!settled);
}

// ── Invariant B: right-click add at panned+zoomed viewport → at cursor ─────
{
  // Zoom out two notches and pan, so screen and flow coordinates diverge hard
  await page.mouse.move(800, 500);
  await page.mouse.wheel({ deltaY: 240 });
  await sleep(300);
  // Pan: drag on empty pane (avoid the node we made — use top-left region)
  await page.mouse.move(250, 200);
  await page.mouse.down();
  await page.mouse.move(520, 380, { steps: 8 });
  await page.mouse.up();
  await sleep(400);

  const target = { x: 1100, y: 300 };
  const before = await nodeCount();
  await page.mouse.click(target.x, target.y, { button: "right" });
  await sleep(500);
  const item = await page.evaluate(() => {
    const els = [...document.querySelectorAll("button, [role=menuitem], div")].filter(
      (el) => el.textContent?.trim() === "Cast Model",
    );
    const el = els[els.length - 1];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  check("B1 context menu opened", !!item);
  if (item) {
    await page.mouse.click(item.x, item.y);
    await page.waitForFunction(
      (n: number) => document.querySelectorAll(".react-flow__node").length > n,
      { timeout: 3000, polling: 100 },
      before,
    );
    await sleep(300);
    const rects = await nodeRects();
    const newest = rects[rects.length - 1];
    const center = { x: newest.x + newest.w / 2, y: newest.y + newest.h / 2 };
    const dist = Math.hypot(center.x - target.x, center.y - target.y);
    // Node center should land near the cursor (within ~1.5 card widths on screen)
    check("B2 node lands at cursor after pan+zoom", dist < 220, `distance=${dist.toFixed(0)}px`);
  }
}

// ── Invariant C: library pick fills the node optimistically (D-38) ─────────
{
  const [models] = await conn.execute(
    `SELECT COUNT(*) AS n FROM models m WHERE m.userId = ? AND m.id IN
       (SELECT modelId FROM model_assets WHERE viewType = 'frontClose' AND storageUrl != '')`,
    [userId],
  );
  const castable = (models as Array<{ n: number }>)[0].n;
  if (castable === 0) {
    console.log("SKIP  C — verify-bot has no castable models (mint one via the takeover drive first)");
  } else {
    const before = await nodeCount();
    await addCastViaPill();
    await page.waitForFunction(
      (n: number) => document.querySelectorAll(".react-flow__node").length > n,
      { timeout: 3000, polling: 100 },
      before,
    );
    await sleep(2500); // create confirm (picker actions need the real id)

    // Open the picker via the newest node's front-door pill (earlier
    // invariants left empty cast nodes behind — take the last pill)
    const pill = (await page.evaluate(() => {
      const els = [...document.querySelectorAll("button")].filter(
        (b) => b.textContent?.trim() === "Choose or cast a model",
      );
      const el = els[els.length - 1];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }))!;
    await page.mouse.click(pill.x, pill.y);
    await page.waitForSelector(".canvas-scope .grid button img", { timeout: 10000 });
    const card = (await page.evaluate(() => {
      const img = document.querySelector(".canvas-scope .grid button img")!;
      const r = img.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }))!;
    await page.mouse.click(card.x, card.y);

    // The node must show the image essentially immediately (optimistic fill)
    let filledAtMs = -1;
    const t0 = Date.now();
    for (let i = 0; i < 20; i++) {
      const filled = await page.evaluate(() => {
        const nodes = [...document.querySelectorAll(".react-flow__node")];
        return nodes.some((n) => !!n.querySelector("img")?.getAttribute("src"));
      });
      if (filled) {
        filledAtMs = Date.now() - t0;
        break;
      }
      await sleep(50);
    }
    check("C1 library pick fills node optimistically (<800ms)", filledAtMs >= 0 && filledAtMs < 800, `${filledAtMs}ms`);

    // Server reconcile: the row is stamped library_cast
    await sleep(5000);
    const [rows] = await conn.execute(
      `SELECT JSON_EXTRACT(metadata, '$.provenance.type') AS prov FROM board_items
       WHERE boardId = ? AND deletedAt IS NULL AND imageUrl IS NOT NULL`,
      [boardId],
    );
    const provs = (rows as Array<{ prov: string | null }>).map((r) => String(r.prov ?? ""));
    check("C2 server confirm reconciled (library_cast stamped)", provs.some((p) => p.includes("library_cast")));
  }
}

// ── Shared helpers for the takeover invariants ─────────────────────────────
// Scroll targets into view first: panel controls can sit below the scroll
// fold (the takeover's inset frame shortened the panel; a mouse click at an
// occluded rect hits whatever is on top — that raced D3/E2 once already).
const clickByText = async (text: string, tag = "button") => {
  const found = await page.evaluate(
    (t: string, tg: string) => {
      const els = [...document.querySelectorAll(tg)].filter((el) => el.textContent?.trim() === t);
      const el = els[els.length - 1];
      if (!el) return false;
      el.scrollIntoView({ block: "center" });
      return true;
    },
    text,
    tag,
  );
  if (!found) return false;
  await sleep(250); // scroll settle
  const pos = await page.evaluate(
    (t: string, tg: string) => {
      const els = [...document.querySelectorAll(tg)].filter((el) => el.textContent?.trim() === t);
      const el = els[els.length - 1];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    },
    text,
    tag,
  );
  if (!pos) return false;
  await page.mouse.click(pos.x, pos.y);
  return true;
};
const bodyIncludes = (text: string) =>
  page.evaluate((t: string) => (document.body.textContent ?? "").includes(t), text);
// DOM order does not track creation order (React Flow reorders on selection)
// — target the node that actually has an image
const filledNode = () =>
  page.evaluate(() => {
    const nodes = [...document.querySelectorAll(".react-flow__node")].filter((n) =>
      n.querySelector("img")?.getAttribute("src"),
    );
    const last = nodes[nodes.length - 1];
    if (!last) return null;
    const r = last.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, text: last.textContent ?? "", img: last.querySelector("img")?.getAttribute("src") ?? "" };
  });
const openEditOnFilledNode = async () => {
  const n = await filledNode();
  if (!n) return false;
  await page.mouse.click(n.x, n.y);
  await sleep(500);
  return clickByText("Edit");
};
const waitEditHydrated = async () => {
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const ready = await page.evaluate(() => {
      const body = document.body.textContent ?? "";
      const save = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Save changes") as HTMLButtonElement | undefined;
      const genderVisible = [...document.querySelectorAll("button")].some((b) => b.textContent?.trim() === "Female");
      const loaderGone = !body.includes("Loading this cast") && !body.includes("Loading your draft");
      return !!save && !save.disabled && genderVisible && loaderGone;
    });
    if (ready) {
      await sleep(400); // settle: prefs render in the same commit as assets, plus margin
      return true;
    }
  }
  return false;
};
const selectedGender = () =>
  page.evaluate(() => {
    const buttons = [...document.querySelectorAll("button")];
    for (const name of ["Female", "Male", "Non-Binary"]) {
      const b = buttons.find((el) => el.textContent?.trim() === name);
      if (b && getComputedStyle(b).backgroundColor === "rgb(26, 26, 26)") return name;
    }
    return null;
  });
const modelGenderFromDb = async () => {
  const [rows] = await conn.execute(
    `SELECT JSON_EXTRACT(m.preferences, '$.gender') AS g FROM models m JOIN board_items i
       ON m.id = CAST(JSON_EXTRACT(i.metadata, '$.provenance.modelId') AS UNSIGNED)
     WHERE i.boardId = ? AND i.deletedAt IS NULL AND i.imageUrl IS NOT NULL
     ORDER BY i.id DESC LIMIT 1`,
    [boardId],
  );
  const raw = (rows as Array<{ g: unknown }>)[0]?.g;
  return String(raw ?? "").replace(/"/g, "");
};
const closeTakeoverCleanly = async () => {
  // Esc; if the leave confirm appears, Leave; else it closed clean
  await page.keyboard.press("Escape");
  await sleep(500);
  if (await bodyIncludes("Leave editing?")) {
    await clickByText("Leave");
  }
  await sleep(600);
};

// ── Invariant D: the bleed contract (bug-1) — FREE ──────────────────────────
{
  const filledExists = (await filledNode())?.img;
  if (!filledExists) {
    const debug = await page.evaluate(() =>
      [...document.querySelectorAll(".react-flow__node")].map((n) => ({
        id: n.getAttribute("data-id"),
        imgs: n.querySelectorAll("img").length,
        src: n.querySelector("img")?.getAttribute("src")?.slice(0, 40) ?? null,
        text: (n.textContent ?? "").slice(0, 40),
      })),
    );
    console.log("SKIP  D — no filled cast node available (C skipped?)", JSON.stringify(debug));
  } else {
    const truthBefore = await modelGenderFromDb();

    // Open Edit, dirty the session, LEAVE
    check("D1 edit opens on the placed cast", await openEditOnFilledNode());
    check("D2 hydrated", await waitEditHydrated());
    const current = await selectedGender();
    const other = current === "Male" ? "Female" : "Male";
    await clickByText(other);
    await sleep(400);
    await page.keyboard.press("Escape");
    await sleep(500);
    check("D3 leave-confirm fired for dirty session", await bodyIncludes("Leave editing?"));
    await clickByText("Leave");
    await sleep(800);

    // Leg (i): re-entering hydrates the TRUE baseline, not the ghost.
    // (gender may legitimately be Open — normalize null/"" before comparing)
    check("D4 re-edit opens", await openEditOnFilledNode());
    check("D5 re-hydrated", await waitEditHydrated());
    const reopened = (await selectedGender()) ?? "";
    const truth = truthBefore ?? "";
    check(
      "D6 leg(i): baseline restored — discarded edits are gone",
      reopened === truth && reopened !== other,
      `ui=${reopened || "(open)"} truth=${truth || "(open)"} ghost=${other}`,
    );
    await closeTakeoverCleanly();

    // Leg (iii): plain /studio opens FRESH — no ghost, no D-11 bypass
    await page.goto(`${BASE}/studio?tool=casting`, { waitUntil: "networkidle2", timeout: 60000 });
    await sleep(2500);
    const studioState = await page.evaluate(() => {
      const body = document.body.textContent ?? "";
      const gen = document.querySelector("[data-debug-generate]") as HTMLButtonElement | null;
      return {
        freshForm: !!gen && gen.disabled, // fresh required fields — nothing armed
        noSave: !body.includes("Save changes"),
        // Empty-viewer copy varies ("Ready to Cast" / "New Model — Configure…")
        emptyViewer: body.includes("Ready to") || body.includes("Configure parameters"),
        notLocked: !body.includes("Identity locked"),
      };
    });
    check(
      "D7 leg(iii): /studio after leave is a fresh session",
      studioState.freshForm && studioState.noSave && studioState.emptyViewer && studioState.notLocked,
      JSON.stringify(studioState),
    );
    // Leg (ii) holds by construction: the mode flag and the session stores
    // reset together in the takeover cleanup (see CastingTakeover).

    await page.goto(`${BASE}/app/board/${boardId}`, { waitUntil: "networkidle2", timeout: 60000 });
    await page.waitForSelector('button[aria-label="Add"]', { timeout: 90000 });
    await sleep(800);
  }
}

// ── Invariant E: immutable minted identity (D-43) — FREE ───────────────────
if (!(await filledNode())?.img) {
  console.log("SKIP  E — no filled cast node available");
} else {
  await openEditOnFilledNode();
  check("E1 edit hydrated", await waitEditHydrated());

  // E1b (VC-R3b bug 2): a zero-edit save is a quiet no-op — the fork
  // ceremony must NEVER fire on nothing (baseline = the hydration payload)
  await clickByText("Save changes");
  await sleep(800);
  const zeroEdit = {
    noDialog: !(await bodyIncludes("This is a new person")),
    quietNote: await bodyIncludes("No identity changes yet"),
  };
  check(
    "E1b zero-edit save is a no-op (no dialog, quiet note)",
    zeroEdit.noDialog && zeroEdit.quietNote,
    JSON.stringify(zeroEdit),
  );

  const before = await selectedGender();
  const target = before === "Male" ? "Female" : "Male";
  await clickByText(target);
  await sleep(400);
  await clickByText("Save changes");
  await sleep(1200);
  check("E2 dialog is fork-or-keep", await bodyIncludes("This is a new person"));
  // The fork cost is plan-derived — poll for the server round trip
  let dialogButtons = { noUpdate: false, hasFork: false, forkHasCost: false, noRed: false };
  for (let i = 0; i < 12; i++) {
    dialogButtons = await page.evaluate(() => {
      const labels = [...document.querySelectorAll("button")].map((b) => b.textContent?.trim() ?? "");
      return {
        noUpdate: !labels.some((l) => l.startsWith("Update this cast")),
        hasFork: labels.some((l) => l.startsWith("Fork as new model")),
        forkHasCost: labels.some((l) => l.startsWith("Fork as new model") && /credits/.test(l)),
        noRed: ![...document.querySelectorAll("button")].some(
          (b) => getComputedStyle(b).backgroundColor === "rgb(179, 38, 30)",
        ),
      };
    });
    if (dialogButtons.forkHasCost) break;
    await sleep(500);
  }
  check(
    "E3 no update option, no red; fork carries plan cost",
    dialogButtons.noUpdate && dialogButtons.hasFork && dialogButtons.forkHasCost && dialogButtons.noRed,
    JSON.stringify(dialogButtons),
  );

  // Structural guard: decision:'update' refused server-side even when the UI
  // is bypassed entirely (raw tRPC HTTP with the session cookie)
  const editedItemId = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll(".react-flow__node")].filter((n) =>
      n.querySelector("img")?.getAttribute("src"),
    );
    const id = nodes[nodes.length - 1]?.getAttribute("data-id") ?? "";
    return parseInt(id.replace("item-", ""), 10);
  });
  const guardResult = await page.evaluate(
    async (bId: number, iId: number) => {
      const res = await fetch("/api/trpc/boardOps.applyModelEdit.execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ json: { boardId: bId, itemId: iId, decision: "update", changes: { gender: "Male" } } }),
      });
      const text = await res.text();
      return { status: res.status, immutable: text.includes("immutable") };
    },
    boardId,
    editedItemId,
  );
  check(
    "E4 server refuses update on minted identity (UI bypassed)",
    guardResult.status >= 400 && guardResult.immutable,
    JSON.stringify(guardResult),
  );

  // E5 (D-46): the ungated view-generation endpoints are GONE. A raw tRPC
  // caller must not be able to add an unverified view — the same bypass class
  // E4 closes for identity. Both procedures must 404 (not merely error).
  // NOTE: no named inner functions inside page.evaluate — esbuild's keepNames
  // helper injects __name and crashes in the page context. Inline both fetches.
  const legacyEndpoints = await page.evaluate(async () => {
    const mvRes = await fetch("/api/trpc/generation.multiView", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ json: { modelId: 1, viewType: "back" } }),
    });
    const mvText = await mvRes.text();
    const fbRes = await fetch("/api/trpc/generation.fullBody", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ json: { modelId: 1 } }),
    });
    const fbText = await fbRes.text();
    return {
      multiView: { status: mvRes.status, notFound: mvText.includes("NOT_FOUND") || mvRes.status === 404 },
      fullBody: { status: fbRes.status, notFound: fbText.includes("NOT_FOUND") || fbRes.status === 404 },
    };
  });
  check(
    "E5 ungated view endpoints (fullBody/multiView) are removed — raw path closed",
    legacyEndpoints.multiView.notFound && legacyEndpoints.fullBody.notFound,
    JSON.stringify(legacyEndpoints),
  );
  await clickByText("Keep editing");
  await sleep(400);
  await closeTakeoverCleanly();
}

// ── Invariant F: fork landing stability — RUN_PAID_INVARIANTS=1 ────────────
if (process.env.RUN_PAID_INVARIANTS !== "1") {
  console.log("SKIP  F — paid invariant (set RUN_PAID_INVARIANTS=1; ~350 credits)");
} else if (!(await filledNode())?.img) {
  console.log("SKIP  F — no filled cast node available");
} else {
  await openEditOnFilledNode();
  check("F0 edit hydrated", await waitEditHydrated());
  const g = await selectedGender();
  await clickByText(g === "Male" ? "Female" : "Male");
  await sleep(400);
  await clickByText("Save changes");
  await sleep(1200);
  const forkPos = (await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((el) => el.textContent?.trim().startsWith("Fork as new model"));
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }))!;
  await page.mouse.click(forkPos.x, forkPos.y);
  await sleep(1000);
  const countAfterFork = await nodeCount();
  check("F1 pending fork node appears immediately", countAfterFork >= 4, `${countAfterFork} nodes`);
  console.log("   F: forking (real, ~350 credits)...");
  // Landing truth comes from the DB (a filled item whose model is a DRAFT) —
  // node-text /Draft/ matching is ambiguous: a minted model can be NAMED
  // "…Draft…" (that spurious match burned a run once already).
  let vanished = false;
  let forkedItemId: number | null = null;
  for (let i = 0; i < 90; i++) {
    await sleep(1000);
    const c = await nodeCount();
    if (c < countAfterFork) vanished = true;
    const [rows] = await conn.execute(
      `SELECT i.id FROM board_items i JOIN models m
         ON m.id = CAST(JSON_EXTRACT(i.metadata, '$.provenance.modelId') AS UNSIGNED)
       WHERE i.boardId = ? AND i.deletedAt IS NULL AND i.imageUrl IS NOT NULL AND m.status = 'draft'
       ORDER BY i.id DESC LIMIT 1`,
      [boardId],
    );
    forkedItemId = (rows as Array<{ id: number }>)[0]?.id ?? null;
    if (forkedItemId) break;
  }
  check("F2 pending node never vanished during generation", !vanished);
  // The DOM reveal (id swap + image) trails the DB row by the mutation
  // round-trip — poll briefly rather than checking the instant the row lands
  let forkNodeInDom = false;
  if (forkedItemId) {
    for (let i = 0; i < 10; i++) {
      forkNodeInDom = await page.evaluate((id: string) => {
        const n = document.querySelector(`.react-flow__node[data-id="${id}"]`);
        return !!n?.querySelector("img")?.getAttribute("src");
      }, `item-${forkedItemId}`);
      if (forkNodeInDom) break;
      await sleep(1000);
    }
  }
  check("F3 fork landed as a draft on its node", !!forkedItemId && forkNodeInDom, `item=${forkedItemId}`);
}

// ── Invariant G: tiered mint package (R3b/D-39) — RUN_PAID_INVARIANTS=1 ────
if (process.env.RUN_PAID_INVARIANTS !== "1") {
  console.log("SKIP  G — paid invariant (tiered Core mint; ~900 credits on top of F)");
} else {
  // The draft node comes from DB truth (model status = 'draft'), never from
  // node-text matching — see the F3 note.
  const [dRows] = await conn.execute(
    `SELECT i.id AS itemId, m.id AS modelId FROM board_items i JOIN models m
       ON m.id = CAST(JSON_EXTRACT(i.metadata, '$.provenance.modelId') AS UNSIGNED)
     WHERE i.boardId = ? AND i.deletedAt IS NULL AND i.imageUrl IS NOT NULL AND m.status = 'draft'
     ORDER BY i.id DESC LIMIT 1`,
    [boardId],
  );
  const draftRow = (dRows as Array<{ itemId: number; modelId: number }>)[0];
  const draft = draftRow
    ? await page.evaluate((id: string) => {
        const n = document.querySelector(`.react-flow__node[data-id="${id}"]`);
        if (!n) return null;
        n.scrollIntoView({ block: "center" });
        const r = n.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }, `item-${draftRow.itemId}`)
    : null;
  if (!draftRow || !draft) {
    console.log("SKIP  G — no draft node on the board (needs F's fork to land first)");
  } else {
    const modelId = draftRow.modelId;
    const [balRows] = await conn.execute(`SELECT balance FROM points WHERE userId = ?`, [userId]);
    const balanceBefore = (balRows as Array<{ balance: number }>)[0].balance;

    // Open the promotion session on the draft. The Edit affordance only
    // renders once the node carries a real modelId (the -1 placeholder
    // guard) — retry the select+Edit until the session opens.
    let promoted = false;
    for (let attempt = 0; attempt < 8 && !promoted; attempt++) {
      await page.mouse.click(draft.x, draft.y);
      await sleep(600);
      if (!(await clickByText("Edit"))) continue;
      for (let i = 0; i < 10; i++) {
        await sleep(500);
        if (await bodyIncludes("Finish this cast")) { promoted = true; break; }
      }
    }
    check("G1 promotion session opens ('Finish this cast')", promoted);

    // Promotion hydration: the mint button arms once the headshot loads
    let armed = false;
    for (let i = 0; i < 30; i++) {
      await sleep(1000);
      armed = await page.evaluate(() => {
        const b = [...document.querySelectorAll("button")].find(
          (el) => el.textContent?.trim() === "Cast this model",
        ) as HTMLButtonElement | undefined;
        const body = document.body.textContent ?? "";
        return !!b && !b.disabled && !body.includes("Loading this cast") && !body.includes("Loading your draft");
      });
      if (armed) break;
    }
    check("G2 draft hydrated (mint button armed)", armed);

    await clickByText("Cast this model");
    await sleep(800);
    // Tier modal: three tiers, plan-derived costs (fresh fork = headshot only,
    // so Core = 3 slots = 900, Production = 5 slots = 1,500). Poll: the plan
    // query resolves async behind the modal.
    let tierState = { draft: false, core: false, production: false, coreCost: false, prodCost: false };
    for (let i = 0; i < 12; i++) {
      tierState = await page.evaluate(() => {
        const body = document.body.textContent ?? "";
        return {
          draft: body.includes("Name them and keep exploring"),
          core: body.includes("Core identity"),
          production: body.includes("Production sheet"),
          coreCost: body.includes("900 credits"),
          prodCost: body.includes("1,500 credits"),
        };
      });
      if (tierState.coreCost && tierState.prodCost) break;
      await sleep(500);
    }
    check(
      "G3 tier modal shows plan-derived costs (Core 900 / Production 1,500)",
      tierState.draft && tierState.core && tierState.production && tierState.coreCost && tierState.prodCost,
      JSON.stringify(tierState),
    );

    // Name + Core mint (core is the default; click the row for explicitness)
    const nameInput = await page.$('input[placeholder="Enter name..."]');
    check("G3b mint modal name input present", !!nameInput);
    if (nameInput) {
      await nameInput.click();
      await nameInput.type("Verify Core");
      await clickByText("Core identity", "span"); // bubbles to the tier row button
      await sleep(300);
      await clickByText("Cast & Continue");
      console.log("   G: minting Core package (real, ~900 credits, 3 views in parallel)...");

    // Completion: the modal closes and the node relabels with the name
    let mintedOnNode = false;
    for (let i = 0; i < 180; i++) {
      await sleep(1000);
      const state = await page.evaluate(() => {
        const body = document.body.textContent ?? "";
        return {
          modalGone: !body.includes("CAST THIS MODEL"),
          named: [...document.querySelectorAll(".react-flow__node")].some((n) =>
            (n.textContent ?? "").includes("Verify Core"),
          ),
        };
      });
      if (state.modalGone && state.named) { mintedOnNode = true; break; }
    }
    check("G4 mint lands: modal closed, node carries the name", mintedOnNode);

    // DB truth: minted identity + the three Core assets with provenance
    const [mRows] = await conn.execute(`SELECT name, agencyId FROM models WHERE id = ?`, [modelId]);
    const m = (mRows as Array<{ name: string; agencyId: string | null }>)[0];
    check("G5 model minted (name + agencyId)", m?.name === "Verify Core" && !!m?.agencyId, JSON.stringify(m));
    const [aRows] = await conn.execute(
      `SELECT viewType, storageUrl != '' AS filled, provenance IS NOT NULL AS prov
       FROM model_assets WHERE modelId = ? AND viewType IN ('sideClose','threeQuarter','frontFull')`,
      [modelId],
    );
    const assets = aRows as Array<{ viewType: string; filled: number; prov: number }>;
    const allThree = ["sideClose", "threeQuarter", "frontFull"].every((v) =>
      assets.some((a) => a.viewType === v && a.filled && a.prov),
    );
    check("G6 core slots created with provenance", allThree, assets.map((a) => a.viewType).join(",") || "(none)");

    // Billing truth (bug-4 lesson: the ledger must agree with the balance)
    const [balAfterRows] = await conn.execute(`SELECT balance FROM points WHERE userId = ?`, [userId]);
    const balanceAfter = (balAfterRows as Array<{ balance: number }>)[0].balance;
    const [txRows] = await conn.execute(
      `SELECT amount, description FROM point_transactions
       WHERE userId = ? AND description LIKE 'Mint package%' ORDER BY id DESC LIMIT 6`,
      [userId],
    );
    const txs = txRows as Array<{ amount: number; description: string }>;
    const deducted = txs.find((t) => t.amount === -900 && t.description.includes("core"));
    // Core's slots (sideClose, threeQuarter, frontFull) are NONE of them gated
    // — a Core mint can never refund, so the net is exactly 900. (Refund
    // netting is exercised by H/I, where gated slots can fail.)
    check(
      "G7 ledger + balance agree (Core = clean 900 deduct, no refunds)",
      !!deducted && balanceBefore - balanceAfter === 900,
      `delta=${balanceBefore - balanceAfter} deducted=${!!deducted}`,
    );

    // The new packageState route over raw HTTP: minted, 4 slots filled
    const pkg = await page.evaluate(async (mid: number) => {
      const res = await fetch(
        `/api/trpc/generation.packageState?input=${encodeURIComponent(JSON.stringify({ json: { modelId: mid } }))}`,
        { credentials: "include" },
      );
      const data = await res.json();
      const result = data?.result?.data?.json;
      return {
        status: res.status,
        minted: result?.minted,
        filled: (result?.slots ?? []).filter((s: { filled: boolean }) => s.filled).length,
      };
    }, modelId);
    check(
      "G8 packageState: minted with 4 filled slots",
      pkg.status === 200 && pkg.minted === true && pkg.filled === 4,
      JSON.stringify(pkg),
    );

    // ── Invariant H: post-mint edit + package upgrade (VC-R3b fixes) ──────
    // Michael's exact bug-2/bug-3 sequence: mint through the takeover, then
    // immediately Edit the placed cast. Zero-edit save must be a quiet
    // no-op; the strip must show the package with upgrade ghosts; a ghost
    // opens the tier dialog priced at the REMAINING slots (600 after Core);
    // executing it completes the package.
    await sleep(4000); // the refetch must land minted provenance on the node
    const [hBal] = await conn.execute(`SELECT balance FROM points WHERE userId = ?`, [userId]);
    const hBalanceBefore = (hBal as Array<{ balance: number }>)[0].balance;

    const hNode = await page.evaluate((id: string) => {
      const n = document.querySelector(`.react-flow__node[data-id="${id}"]`);
      if (!n) return null;
      const r = n.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, `item-${draftRow.itemId}`);
    if (!hNode) {
      console.log("SKIP  H — the minted node is gone from the DOM");
    } else {
      let hOpened = false;
      for (let attempt = 0; attempt < 6 && !hOpened; attempt++) {
        await page.mouse.click(hNode.x, hNode.y);
        await sleep(600);
        if (!(await clickByText("Edit"))) continue;
        for (let i = 0; i < 8; i++) {
          await sleep(500);
          if (await bodyIncludes("Save changes")) { hOpened = true; break; }
        }
      }
      check("H1 minted edit opens on the fresh mint", hOpened);
      check("H2 hydrated", await waitEditHydrated());

      // Zero-edit save — the exact false-ceremony repro
      await clickByText("Save changes");
      await sleep(800);
      const hZero = {
        noDialog: !(await bodyIncludes("This is a new person")),
        quietNote: await bodyIncludes("No identity changes yet"),
      };
      check("H3 zero-edit save after mint is a no-op", hZero.noDialog && hZero.quietNote, JSON.stringify(hZero));

      // The package strip: 4 filled thumbnails + 2 upgrade ghosts
      const strip = await page.evaluate(() => {
        const ghosts = [...document.querySelectorAll('button[title="Add this view — complete the package"]')];
        return { ghosts: ghosts.length };
      });
      check("H4 strip shows upgrade ghosts for the empty slots", strip.ghosts === 2, `ghosts=${strip.ghosts}`);

      // Ghost → upgrade dialog, priced at the remaining slots only
      await page.evaluate(() => {
        const g = document.querySelector('button[title="Add this view — complete the package"]') as HTMLButtonElement | null;
        g?.click();
      });
      await sleep(800);
      let upgradeState = { header: false, remainderCost: false, noNameInput: false };
      for (let i = 0; i < 12; i++) {
        upgradeState = await page.evaluate(() => {
          const body = document.body.textContent ?? "";
          return {
            header: body.includes("COMPLETE THE PACKAGE"),
            remainderCost: body.includes("600 credits"),
            noNameInput: !document.querySelector('input[placeholder="Enter name..."]'),
          };
        });
        if (upgradeState.remainderCost) break;
        await sleep(500);
      }
      check(
        "H5 upgrade dialog: remaining-slots pricing (600), no name input",
        upgradeState.header && upgradeState.remainderCost && upgradeState.noNameInput,
        JSON.stringify(upgradeState),
      );

      // Execute the upgrade (real, ~600 credits: sideFull + gated backFull).
      // D-46 rider 3 removed the "N views added" toast — the strip filling IS
      // the feedback — so completion is read from packageState (filled grows
      // past Core's 4), and the modal closing, not a toast.
      await clickByText("Add views");
      console.log("   H: upgrading to Production (real, ~600 credits, 2 views)...");
      let upgraded = false;
      for (let i = 0; i < 180; i++) {
        await sleep(1000);
        const state = await page.evaluate(async (mid: number) => {
          const res = await fetch(
            `/api/trpc/generation.packageState?input=${encodeURIComponent(JSON.stringify({ json: { modelId: mid } }))}`,
            { credentials: "include" },
          );
          const data = await res.json();
          const slots = data?.result?.data?.json?.slots ?? [];
          const modalGone = !(document.body.textContent ?? "").includes("COMPLETE THE PACKAGE");
          return { filled: slots.filter((s: { filled: boolean }) => s.filled).length, modalGone };
        }, modelId);
        if (state.filled > 4 && state.modalGone) { upgraded = true; break; }
      }
      check("H6 upgrade lands (package grew past Core, modal closed)", upgraded);

      const hPkg = await page.evaluate(async (mid: number) => {
        const res = await fetch(
          `/api/trpc/generation.packageState?input=${encodeURIComponent(JSON.stringify({ json: { modelId: mid } }))}`,
          { credentials: "include" },
        );
        const data = await res.json();
        const result = data?.result?.data?.json;
        return { filled: (result?.slots ?? []).filter((s: { filled: boolean }) => s.filled).length };
      }, modelId);
      const [hBalAfter] = await conn.execute(`SELECT balance FROM points WHERE userId = ?`, [userId]);
      const hBalanceAfter = (hBalAfter as Array<{ balance: number }>)[0].balance;
      const [hTx] = await conn.execute(
        `SELECT amount FROM point_transactions WHERE userId = ? AND description LIKE 'Mint package%refund%' AND createdAt > NOW() - INTERVAL 10 MINUTE`,
        [userId],
      );
      const hRefunds = (hTx as Array<{ amount: number }>).reduce((s, t) => s + Math.max(0, t.amount), 0);
      // A gate-failed back view is named-and-refunded BY DESIGN — the
      // invariant is filled + refunded always accounts for both slots
      const refundedSlots = hRefunds / 300;
      check(
        "H7 package accounts for both slots (filled or refunded), ledger agrees",
        hPkg.filled === 6 - refundedSlots && hBalanceBefore - hBalanceAfter === 600 - hRefunds,
        `filled=${hPkg.filled} delta=${hBalanceBefore - hBalanceAfter} refunds=${hRefunds}`,
      );

      // No stuck audit rows: every generation for this model reached a
      // terminal status (the createGeneration insertId fix — bug-1 forensics)
      const [hGens] = await conn.execute(
        `SELECT COUNT(*) AS stuck FROM generations WHERE modelId = ? AND status = 'processing'`,
        [modelId],
      );
      const stuck = (hGens as Array<{ stuck: number }>)[0].stuck;
      check("H8 no generation rows stuck in processing", stuck === 0, `stuck=${stuck}`);

      await closeTakeoverCleanly();
    }
    }
  }
}

// ── Invariant I: forced gate failure surfaces named + refunded (D-40) ──────
// The gate can't be failed on demand from the drive process (the fail flag is
// server-side). Run this mode with a server booted with
// BACK_VIEW_GATE_FORCE_FAIL=1 AND the drive with RUN_GATE_FAIL=1 — it forks a
// fresh draft and mints Production; the back view fails its gate twice, and
// the invariant asserts BOTH halves of the contract: the failure is NAMED
// (toast + a Retry slot in the strip + packageState.failed) and REFUNDED
// (ledger). Standalone from A–H (those assume a passing gate).
if (process.env.RUN_GATE_FAIL === "1") {
  if (!(await filledNode())?.img) {
    console.log("SKIP  I — no filled cast node to fork from");
  } else {
    const [iBal0] = await conn.execute(`SELECT balance FROM points WHERE userId = ?`, [userId]);
    const iBalanceStart = (iBal0 as Array<{ balance: number }>)[0].balance;

    // Fork a fresh draft, then promote + Production mint (back will fail)
    await openEditOnFilledNode();
    check("I0 edit hydrated", await waitEditHydrated());
    const g = await selectedGender();
    await clickByText(g === "Male" ? "Female" : "Male");
    await sleep(400);
    await clickByText("Save changes");
    await sleep(1200);
    const forkPos = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((el) => el.textContent?.trim().startsWith("Fork as new model"));
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (!forkPos) {
      console.log("SKIP  I — fork button not found");
    } else {
      await page.mouse.click(forkPos.x, forkPos.y);
      console.log("   I: forking then Production-minting under forced gate failure...");
      // Wait for the fork draft to land (DB truth)
      let iDraft: { itemId: number; modelId: number } | null = null;
      for (let i = 0; i < 90; i++) {
        await sleep(1000);
        const [rows] = await conn.execute(
          `SELECT i.id AS itemId, m.id AS modelId FROM board_items i JOIN models m
             ON m.id = CAST(JSON_EXTRACT(i.metadata, '$.provenance.modelId') AS UNSIGNED)
           WHERE i.boardId = ? AND i.deletedAt IS NULL AND i.imageUrl IS NOT NULL AND m.status = 'draft'
           ORDER BY i.id DESC LIMIT 1`,
          [boardId],
        );
        iDraft = (rows as Array<{ itemId: number; modelId: number }>)[0] ?? null;
        if (iDraft) break;
      }
      check("I1 fork draft landed", !!iDraft);
      if (iDraft) {
        const node = await page.evaluate((id: string) => {
          const n = document.querySelector(`.react-flow__node[data-id="${id}"]`);
          if (!n) return null;
          n.scrollIntoView({ block: "center" });
          const r = n.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }, `item-${iDraft.itemId}`);
        // Promote → mint Production
        let promoted = false;
        for (let attempt = 0; attempt < 8 && !promoted && node; attempt++) {
          await page.mouse.click(node.x, node.y);
          await sleep(600);
          if (!(await clickByText("Edit"))) continue;
          for (let i = 0; i < 10; i++) { await sleep(500); if (await bodyIncludes("Finish this cast")) { promoted = true; break; } }
        }
        check("I2 promotion opened", promoted);
        // arm + mint Production
        for (let i = 0; i < 30; i++) {
          await sleep(1000);
          const armed = await page.evaluate(() => {
            const b = [...document.querySelectorAll("button")].find((el) => el.textContent?.trim() === "Cast this model") as HTMLButtonElement | undefined;
            return !!b && !b.disabled;
          });
          if (armed) break;
        }
        await clickByText("Cast this model");
        await sleep(800);
        await page.type('input[placeholder="Enter name..."]', "Gate Fail");
        await clickByText("Production sheet", "span");
        await sleep(300);
        await clickByText("Cast & Continue");

        // Assert the NAMED notice (toast) appears — the "silent" half of the bug
        let namedToast = false;
        for (let i = 0; i < 180; i++) {
          await sleep(1000);
          if (await bodyIncludes("couldn't match this identity")) { namedToast = true; }
          if (await bodyIncludes("Gate Fail") && !(await bodyIncludes("CAST THIS MODEL"))) break;
        }
        check("I3 failure is NAMED at mint time (toast surfaced)", namedToast);

        // Ledger: the back slot (300) refunded
        const [iRef] = await conn.execute(
          `SELECT COALESCE(SUM(amount),0) AS refunded FROM point_transactions
           WHERE userId = ? AND description LIKE 'Mint package%failed%' AND createdAt > NOW() - INTERVAL 10 MINUTE`,
          [userId],
        );
        const iRefunded = Number((iRef as Array<{ refunded: number }>)[0].refunded);
        check("I4 the failed back slot was REFUNDED (300)", iRefunded === 300, `refunded=${iRefunded}`);

        // packageState: backFull failed, five slots filled
        const iPkg = await page.evaluate(async (mid: number) => {
          const res = await fetch(
            `/api/trpc/generation.packageState?input=${encodeURIComponent(JSON.stringify({ json: { modelId: mid } }))}`,
            { credentials: "include" },
          );
          const data = await res.json();
          const slots = data?.result?.data?.json?.slots ?? [];
          const back = slots.find((s: { angle: string }) => s.angle === "backFull");
          return { filled: slots.filter((s: { filled: boolean }) => s.filled).length, backFailed: !!back?.failed };
        }, iDraft.modelId);
        check("I5 packageState reports backFull failed, 5 filled", iPkg.filled === 5 && iPkg.backFailed, JSON.stringify(iPkg));

        // The strip shows a Retry slot on re-edit (durable, visible)
        await sleep(3000);
        let retryVisible = false;
        for (let attempt = 0; attempt < 6 && !retryVisible; attempt++) {
          const rn = await page.evaluate((id: string) => {
            const n = document.querySelector(`.react-flow__node[data-id="${id}"]`);
            if (!n) return null;
            const r = n.getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
          }, `item-${iDraft.itemId}`);
          if (!rn) break;
          await page.mouse.click(rn.x, rn.y);
          await sleep(600);
          if (!(await clickByText("Edit"))) continue;
          if (!(await waitEditHydrated())) continue;
          for (let i = 0; i < 8; i++) {
            await sleep(500);
            retryVisible = await page.evaluate(() =>
              [...document.querySelectorAll("button")].some((b) => /·\s*Retry/.test(b.textContent ?? "")),
            );
            if (retryVisible) break;
          }
        }
        check("I6 failed slot renders a Retry affordance in the strip", retryVisible);
        const [iBalEnd] = await conn.execute(`SELECT balance FROM points WHERE userId = ?`, [userId]);
        const iNet = iBalanceStart - (iBalEnd as Array<{ balance: number }>)[0].balance;
        // fork 350 + Production 1500 − back refund 300 = 1550
        check("I7 ledger net = fork + Production − back refund (1550)", iNet === 1550, `net=${iNet}`);
        await closeTakeoverCleanly();
      }
    }
  }
}

await browser.close();
await conn.end();

if (failures.length) {
  console.error(`\n${failures.length} invariant(s) FAILED: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nAll canvas invariants hold.");
