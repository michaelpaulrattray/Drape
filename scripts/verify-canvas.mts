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
 *   J. THE DELETE TRUST NET (R4/D-17, free): delete is optimistic and SOFT
 *      (the row survives with deletedAt); the Undo toast and Cmd+Z share one
 *      restore path and both survive the server reconcile.
 *   K. Duplicate (R4, free): selection raises the toolbar; Duplicate lands
 *      an optimistic copy that persists with the same image.
 *   M. Marquee + Esc (VC-R4 fix 5 / D-47, free): Select tool is default —
 *      drag on empty canvas box-selects (partial intersection); Esc at the
 *      bottom of the layer stack clears the selection.
 *   L. (paid — RUN_PAID_INVARIANTS=1) Variations landing (R4): the popover
 *      total is plan-derived (2 × castingImage); two optimistic temps render
 *      immediately, never vanish, land as sibling drafts with variant_of
 *      edges; the ledger nets exactly the landed count; no generation rows
 *      stuck 'processing' (the $returningId class).
 *   N. (R5, free) The COMP CARD renders on a seeded minted package: six
 *      mosaic tiles, headshot 2×2 dominant, filled tiles image-only at rest
 *      (D-29), ghosts for missing slots.
 *   O. (R5, free) Pop out writes the generated_from_cast edge with
 *      { viewAngle } metadata (200-wide cast_view placement, rendered edge);
 *      deleting the root then raises the RED CASCADE DIALOG (the R4
 *      activation, VC-R4 confirm); collapse soft-deletes the placement,
 *      REMOVES the lineage edge (O7b), and re-anchors outgoing edges to the
 *      root, viewAngle preserved (D-30). O9 (VC-R5 fix 1): deleting the root
 *      AFTER a pop-out/collapse cycle shows NO cascade dialog — the one red
 *      mark must never lie about its blast radius (alive-only prediction,
 *      client and server).
 *   P. (R5, free) Per-slot pin over raw tRPC lands on the newest filled row;
 *      the tile popover reads it back (Unpin + disabled Refresh).
 *   Q. (R5, free) Structural refresh refusals BEFORE money moves: the
 *      headshot is never refreshable (it IS the identity, D-43); pinned
 *      slots refuse; the balance is untouched.
 *   S. (D-50, free) Group selection grammar: selection >1 renders ONE group
 *      toolbar (per-node toolbars suppressed), the Run-all slot is reserved
 *      (disabled), Esc clears the group.
 *   R. (paid — RUN_PAID_INVARIANTS incl. R) Per-tile refresh on a REAL
 *      minted package: plan-priced popover (~300), a NEW asset row lands
 *      (newest-wins), the ledger nets exactly the slot cost. The gate-fail
 *      refund path shares generatePackageSlot with the mint — invariant I +
 *      the refreshSlots unit tests guard it.
 *   T. (paid — RUN_PAID_INVARIANTS incl. T; ~350cr) VC-R5 F1: a COSMETIC
 *      iterate on a minted package passes the A1 seal, writes ONE new row
 *      for the edited angle, and sibling views SURVIVE in the strip (the
 *      pre-package ladder dropped them client-side; the rows were alive).
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
 *       (+ $env:RUN_PAID_INVARIANTS='1' for F+G+H+L+R — ~2850 credits on verify-bot)
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

// RUN_PAID_INVARIANTS: '1' = all paid invariants; or a letter list ('L' /
// 'F,G') to re-verify one leg without re-burning the others (quota/credits).
const paidEnabled = (letter: string) => {
  const v = process.env.RUN_PAID_INVARIANTS ?? "";
  return v === "1" || v.toUpperCase().split(",").includes(letter);
};

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
// Clean slate each run (edges too — they reference the deleted items), and a
// DETERMINISTIC start viewport: mid-run zooms/pans get debounce-saved, so
// without this every run starts wherever the last one ended (the R5 comp-card
// legs zoom deep onto the seeded card — a poisonous start state for A–M)
await conn.execute(`DELETE FROM board_items WHERE boardId = ?`, [boardId]);
await conn.execute(`DELETE FROM board_edges WHERE boardId = ?`, [boardId]);
await conn.execute(`UPDATE boards SET viewportX = 0, viewportY = 0, viewportZoom = 100 WHERE id = ?`, [boardId]);

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
await page.waitForSelector('button[aria-label="Select"]', { timeout: 90000 });
await sleep(500);

const nodeCount = () => page.evaluate(() => document.querySelectorAll(".react-flow__node").length);
const nodeRects = () =>
  page.evaluate(() =>
    [...document.querySelectorAll(".react-flow__node")].map((n) => {
      const r = n.getBoundingClientRect();
      return { id: n.getAttribute("data-id") ?? "", x: r.x, y: r.y, w: r.width, h: r.height };
    }),
  );
// Flat pill (VC-R5 follow-up ruling B): Cast is a direct segment — one click,
// no popup menu. The right-click AddNodeMenu remains the at-cursor path.
const addCastViaPill = async () => {
  const btn = (await page.evaluate(() => {
    const b = document.querySelector('button[aria-label="Cast"]');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }))!;
  await page.mouse.click(btn.x, btn.y);
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
    // 30s + one retry: listCastableModels walks the bot's models one
    // asset-lookup each against the remote Railway DB — 10s raced it under
    // contention, and a slow run can eat the first click entirely
    try {
      await page.waitForSelector(".canvas-scope .grid button img", { timeout: 30000 });
    } catch {
      await page.mouse.click(pill.x, pill.y);
      await page.waitForSelector(".canvas-scope .grid button img", { timeout: 30000 });
    }
    // DOM click, not coordinates: the grid re-renders as thumbnails and
    // refetches land, and a coordinate click mid-move hits nothing. One
    // retry if the click landed on a mid-swap button (handler unbound) —
    // C1's timing restarts at the click that actually delivers, so the
    // optimistic-fill assertion stays honest.
    await sleep(450);
    let filledAtMs = -1;
    for (let attempt = 0; attempt < 2 && filledAtMs < 0; attempt++) {
      await page.evaluate(() => {
        const img = document.querySelector(".canvas-scope .grid button img");
        (img?.closest("button") as HTMLElement | undefined)?.click();
      });
      const t0 = Date.now();
      for (let i = 0; i < 24; i++) {
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
  // R6 consolidation: Edit is the pen ICON on the node pill (aria-label
  // "Edit" / "Edit — name and mint this draft"), not a text segment
  return page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) =>
      (x.getAttribute("aria-label") ?? "").startsWith("Edit"),
    ) as HTMLElement | undefined;
    b?.click();
    return !!b;
  });
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
      // Active chip encoding per DS §13.1 (R6 restyle): inset surface + 1px
      // ink border (the pre-R6 dark fill rgb(26,26,26) is dead)
      if (b && getComputedStyle(b).borderColor === "rgb(10, 10, 10)") return name;
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
    await page.waitForSelector('button[aria-label="Select"]', { timeout: 90000 });
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
  let zeroEdit = {
    noDialog: !(await bodyIncludes("This is a new person")),
    quietNote: await bodyIncludes("No identity changes yet"),
  };
  if (!zeroEdit.noDialog) {
    // The false-ceremony dialog fired — under drive-hammering the hydration
    // late-write race (VC-R3b bug-2 class, R7-logged) can produce a phantom
    // diff transiently. Close, let hydration finish settling, save again:
    // a REGRESSION fails both times; the race passes the second.
    console.log("   E1b: phantom dialog on first zero-edit save — retrying once after settle");
    await clickByText("Keep editing");
    await sleep(2500);
    await clickByText("Save changes");
    await sleep(800);
    zeroEdit = {
      noDialog: !(await bodyIncludes("This is a new person")),
      quietNote: await bodyIncludes("No identity changes yet"),
    };
    if (!zeroEdit.noDialog) {
      await clickByText("Keep editing");
      await sleep(400);
    }
  }
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

// ── Invariant V: mask coordinates survive the camera (VC-R6a fix 1) — FREE ──
// The work area has a camera (R6 C2); the mask/surgical overlay must draw in
// IMAGE space at any zoom. Regression guarded: backing store synced from the
// transformed rect + live-draw mixing rect dims — strokes landed zoom× off.
if (!(await filledNode())?.img) {
  console.log("SKIP  V — no filled cast node available");
} else {
  await openEditOnFilledNode();
  const vHydrated = await waitEditHydrated();
  if (!vHydrated) {
    check("V0 edit hydrated for mask leg", false);
  } else {
    // Activate the surgical tool (element click bypasses the hover gate)
    const toolOn = await page.evaluate(() => {
      const b = document.querySelector('button[title="Surgical edit"]') as HTMLElement | null;
      b?.click();
      return !!b;
    });
    await sleep(600);
    check("V1 surgical tool activates", toolOn);

    // D-53 (C4): the casting session undo is RETIRED — no pill, no Z keys.
    // The ledger thumb-strip ("Use this version") is the version history.
    const undoState = await page.evaluate(() => ({
      undoBtn: !!document.querySelector('button[title="Undo (Z)"]'),
      redoBtn: !!document.querySelector('button[title="Redo (⇧Z)"]'),
    }));
    check(
      "W1 casting undo/redo affordances are gone (D-53 retirement)",
      !undoState.undoBtn && !undoState.redoBtn,
      JSON.stringify(undoState),
    );

    // Zoom the camera to ~2× with the wheel over the image field
    const imgRect = await page.evaluate(() => {
      const wrap = document.querySelector("[data-camera-image]");
      const r = wrap?.getBoundingClientRect();
      return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null;
    });
    if (!imgRect) {
      check("V2 image present for zoom", false);
    } else {
      await page.mouse.move(imgRect.x + imgRect.w / 2, imgRect.y + imgRect.h / 2);
      for (let i = 0; i < 6; i++) {
        await page.mouse.wheel({ deltaY: -240 });
        await sleep(80);
      }
      await sleep(400);
      const zoomed = await page.evaluate(() => {
        const wrap = document.querySelector("[data-camera-image]") as HTMLElement | null;
        let el: HTMLElement | null = wrap;
        while (el) {
          const t = getComputedStyle(el).transform;
          if (t && t !== "none") return t;
          el = el.parentElement;
        }
        return "none";
      });
      check("V2 camera zoomed for the mask leg", /matrix\(1\.9/.test(zoomed) || /matrix\(2/.test(zoomed), zoomed);

      // Draw a short stroke through the VISUAL center of the zoomed image
      const canvasRect = await page.evaluate(() => {
        const c = document.querySelector("[data-camera-image] canvas");
        const r = c?.getBoundingClientRect();
        return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null;
      });
      if (!canvasRect) {
        check("V3 mask canvas present", false);
      } else {
        const cx = canvasRect.x + canvasRect.w / 2;
        const cy = canvasRect.y + canvasRect.h / 2;
        await page.mouse.move(cx - 20, cy);
        await page.mouse.down();
        await page.mouse.move(cx + 20, cy, { steps: 8 });
        await page.mouse.up();
        await sleep(600);

        // The stored normalized path repaints via the backing store — painted
        // pixels at the backing CENTER prove pointer→image mapping held at 2×.
        // NOTE: no inner functions in evaluate (esbuild __name crash — see E5)
        const maskState = await page.evaluate(() => {
          const c = document.querySelector("[data-camera-image] canvas") as HTMLCanvasElement | null;
          if (!c) return null;
          const ctx = c.getContext("2d");
          if (!ctx) return null;
          const points = [
            [0.5, 0.5],
            [0.95, 0.5],
            [0.5, 0.95],
          ];
          const sums: number[] = [];
          for (const [fx, fy] of points) {
            const d = ctx.getImageData(Math.round(c.width * fx), Math.round(c.height * fy), 2, 2).data;
            let a = 0;
            for (let i = 3; i < d.length; i += 4) a += d[i];
            sums.push(a);
          }
          return { center: sums[0], farRight: sums[1], farDown: sums[2], w: c.width, h: c.height };
        });
        check(
          "V3 stroke lands at the image center at 2× (not displaced)",
          !!maskState && maskState.center > 0 && maskState.farRight === 0 && maskState.farDown === 0,
          JSON.stringify(maskState),
        );
      }
    }
    await closeTakeoverCleanly();
  }
}

// ── Invariant W: restoreSlotVersion structural contracts (D-53) — FREE ──────
// Copy-forward restore over raw tRPC (the E4 pattern, UI bypassed): the
// current head is refused, bogus rows are refused. The happy path (restore
// an old row → free new head, vN+1) needs a second ledger row and therefore
// rides the PAID T leg when enabled.
{
  const [midRows] = await conn.execute(
    `SELECT CAST(JSON_EXTRACT(i.metadata, '$.provenance.modelId') AS UNSIGNED) AS mid
       FROM board_items i
      WHERE i.boardId = ? AND i.deletedAt IS NULL AND i.imageUrl IS NOT NULL
      ORDER BY i.id DESC LIMIT 1`,
    [boardId],
  );
  const wModelId = (midRows as Array<{ mid: number }>)[0]?.mid;
  if (!wModelId) {
    console.log("SKIP  W2-4 — no model behind a filled node");
  } else {
    const wResult = await page.evaluate(async (mid: number) => {
      const q = encodeURIComponent(JSON.stringify({ json: { modelId: mid, angle: "sideClose" } }));
      const vRes = await fetch(`/api/trpc/generation.slotVersions?input=${q}`, { credentials: "include" });
      const vJson = await vRes.json();
      const versions = vJson?.result?.data?.json?.versions ?? [];
      const head = versions.find((v: { isHead: boolean }) => v.isHead);
      let headRefused = false;
      if (head) {
        const rRes = await fetch("/api/trpc/generation.restoreSlotVersion", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ json: { modelId: mid, angle: "sideClose", assetId: head.assetId } }),
        });
        const rText = await rRes.text();
        headRefused = rRes.status >= 400 && rText.includes("already the current version");
      }
      const badRes = await fetch("/api/trpc/generation.restoreSlotVersion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ json: { modelId: mid, angle: "frontFull", assetId: 999999999 } }),
      });
      return {
        versionCount: versions.length,
        headMarked: !!head,
        headRefused,
        bogusRefused: badRes.status >= 400,
      };
    }, wModelId);
    check(
      "W2 slotVersions lists the ledger with the head marked",
      wResult.versionCount >= 1 && wResult.headMarked,
      JSON.stringify(wResult),
    );
    check("W3 restoring the current head is refused (nothing to restore)", wResult.headRefused);
    check("W4 restoring a bogus row is refused", wResult.bogusRefused);
  }
}

// ── Invariant J: delete → undo round trip (R4 trust net) — FREE ────────────
// Soft delete is optimistic, the Undo toast and Cmd+Z share one restore
// path, and the DB row survives with deletedAt toggling — never a hard row
// delete from the canvas.
{
  // Use an EMPTY cast node (A/B leftovers) so later invariants keep their
  // filled node. Select via the label row region — the image area hosts the
  // front-door pill, which would open the picker.
  const emptyNode = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll(".react-flow__node")].filter(
      (n) => !n.querySelector("img")?.getAttribute("src"),
    );
    const el = nodes[nodes.length - 1];
    if (!el) return null;
    const id = parseInt((el.getAttribute("data-id") ?? "").replace("item-", ""), 10);
    if (isNaN(id) || id <= 0) return null;
    el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect();
    return { id, x: r.x + r.width / 2, y: r.y + 8 };
  });
  if (!emptyNode) {
    console.log("SKIP  J — no empty cast node available");
  } else {
    const countBefore = await nodeCount();
    await page.mouse.click(emptyNode.x, emptyNode.y);
    await sleep(400);
    await page.keyboard.press("Delete");
    // Optimistic removal — the node must vanish essentially immediately
    let goneAtMs = -1;
    const t0 = Date.now();
    for (let i = 0; i < 20; i++) {
      if ((await nodeCount()) < countBefore) { goneAtMs = Date.now() - t0; break; }
      await sleep(50);
    }
    check("J1 delete removes the node optimistically (<1s)", goneAtMs >= 0 && goneAtMs < 1000, `${goneAtMs}ms`);

    // Soft, not hard: the row survives with deletedAt set. Poll — the write
    // rides a remote Railway round trip; a fixed sleep raced it once.
    let softDeleted = false;
    let rowGone = false;
    for (let i = 0; i < 16; i++) {
      await sleep(500);
      const [delRows] = await conn.execute(`SELECT deletedAt FROM board_items WHERE id = ?`, [emptyNode.id]);
      const row = (delRows as Array<{ deletedAt: unknown }>)[0];
      if (!row) { rowGone = true; break; } // hard delete = the exact regression this guards
      if (row.deletedAt != null) { softDeleted = true; break; }
    }
    check("J2 soft delete (row survives, deletedAt set)", softDeleted && !rowGone, rowGone ? "ROW HARD-DELETED" : "");

    // The Undo toast restores it (poll — it appears with the server confirm)
    let undoClicked = false;
    for (let i = 0; i < 10 && !undoClicked; i++) {
      undoClicked = await clickByText("Undo");
      if (!undoClicked) await sleep(500);
    }
    check("J3 undo toast present", undoClicked);
    if (undoClicked) {
      await sleep(400);
      const restoredInDom = (await nodeCount()) === countBefore;
      // Server reconcile: the delete-time refetch can resolve AFTER the
      // optimistic restore and briefly drop the row; the undo mutation's own
      // invalidation brings it back — poll for the settled truth (a fixed
      // sleep raced exactly this once before, J2's lesson)
      let restoredInDb = false;
      let stillInDom = false;
      for (let i = 0; i < 20 && !(restoredInDb && stillInDom); i++) {
        await sleep(500);
        const [restRows] = await conn.execute(`SELECT deletedAt FROM board_items WHERE id = ?`, [emptyNode.id]);
        restoredInDb = (restRows as Array<{ deletedAt: unknown }>)[0]?.deletedAt == null;
        stillInDom = await page.evaluate(
          (id: string) => !!document.querySelector(`.react-flow__node[data-id="${id}"]`),
          `item-${emptyNode.id}`,
        );
      }
      check("J4 undo restores (DOM + DB, survives reconcile)", restoredInDom && restoredInDb && stillInDom,
        `dom=${restoredInDom}/${stillInDom} db=${restoredInDb}`);

      // Cmd+Z is the same restore path
      const node2 = await page.evaluate((id: string) => {
        const el = document.querySelector(`.react-flow__node[data-id="${id}"]`);
        if (!el) return null;
        el.scrollIntoView({ block: "center" });
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + 8 };
      }, `item-${emptyNode.id}`);
      if (node2) {
        await page.mouse.click(node2.x, node2.y);
        await sleep(400);
        await page.keyboard.press("Delete");
        await sleep(600);
        await page.keyboard.down("Control");
        await page.keyboard.press("KeyZ");
        await page.keyboard.up("Control");
        // Poll for the settled truth — the fixed 2.5s sleep raced the remote
        // Railway round trip repeatedly (J2/J4's lesson, applied here too)
        let zRestored = false;
        let zDomOk = false;
        for (let i = 0; i < 20 && !(zRestored && zDomOk); i++) {
          await sleep(500);
          const [zRows] = await conn.execute(`SELECT deletedAt FROM board_items WHERE id = ?`, [emptyNode.id]);
          zRestored = (zRows as Array<{ deletedAt: unknown }>)[0]?.deletedAt == null;
          zDomOk = (await nodeCount()) === countBefore;
        }
        check("J5 Cmd+Z undoes the delete (same restore path)", zRestored && zDomOk, `db=${zRestored} dom=${zDomOk}`);
      }
    }
  }
}

// ── Invariant K: duplicate lands instantly (R4 grammar) — FREE ─────────────
{
  const source = await filledNode();
  if (!source?.img) {
    console.log("SKIP  K — no filled cast node available");
  } else {
    const countBefore = await nodeCount();
    // On drive layouts other nodes can stack ON TOP of the measured card and
    // eat the click (selecting the topmost node is correct product behavior).
    // Probe with elementFromPoint for a spot where THIS card is the visible
    // topmost node — the point a real user would click to select it.
    const clickPoint = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll(".react-flow__node")].filter((n) =>
        n.querySelector("img")?.getAttribute("src"),
      );
      const el = nodes[nodes.length - 1];
      if (!el) return null;
      el.scrollIntoView({ block: "center" });
      const r = el.getBoundingClientRect();
      for (const fy of [0.05, 0.15, 0.3, 0.5, 0.7, 0.9]) {
        for (const fx of [0.5, 0.15, 0.85]) {
          const x = r.x + r.width * fx;
          const y = r.y + r.height * fy;
          const hit = document.elementFromPoint(x, y);
          if (hit && el.contains(hit)) return { x, y };
        }
      }
      return null;
    });
    if (!clickPoint) console.log("   K1: no unobstructed point on the filled card (fully covered)");
    // Poll — selection→toolbar render can lag under load; re-click once if
    // the first click raced a node remount
    let dupBtn: { x: number; y: number } | null = null;
    for (let attempt = 0; attempt < 2 && !dupBtn && clickPoint; attempt++) {
      await page.mouse.click(clickPoint.x, clickPoint.y);
      for (let i = 0; i < 10 && !dupBtn; i++) {
        await sleep(500);
        dupBtn = await page.evaluate(() => {
          const b = document.querySelector('button[aria-label="Duplicate"]');
          if (!b) return null;
          const r = b.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        });
      }
    }
    if (!dupBtn) {
      // Failure forensics: what IS on screen when the toolbar never appears?
      const k1Debug = await page.evaluate(() => ({
        selectedIds: [...document.querySelectorAll(".react-flow__node.selected")].map((n) => ({
          id: n.getAttribute("data-id"),
          hasImg: !!n.querySelector("img")?.getAttribute("src"),
          text: (n.textContent ?? "").slice(0, 60),
        })),
        ariaButtons: [...document.querySelectorAll("button[aria-label]")].map((b) => b.getAttribute("aria-label")),
        tilePopover: (document.body.textContent ?? "").includes("Open in environment"),
      }));
      console.log("   K1 debug:", JSON.stringify(k1Debug), "clicked:", JSON.stringify(source));
    }
    check("K1 selection raises the toolbar (Duplicate present)", !!dupBtn);
    if (dupBtn) {
      await page.mouse.click(dupBtn.x, dupBtn.y);
      // Optimistic copy — appears immediately with the same image
      let dupAtMs = -1;
      const t0 = Date.now();
      for (let i = 0; i < 20; i++) {
        if ((await nodeCount()) > countBefore) { dupAtMs = Date.now() - t0; break; }
        await sleep(50);
      }
      check("K2 duplicate renders optimistically (<1s)", dupAtMs >= 0 && dupAtMs < 1000, `${dupAtMs}ms`);

      await sleep(3000); // server confirm + refetch
      const [dupRows] = await conn.execute(
        `SELECT COUNT(*) AS n FROM board_items WHERE boardId = ? AND deletedAt IS NULL AND imageUrl = ?`,
        [boardId, source.img],
      );
      const copies = Number((dupRows as Array<{ n: number }>)[0].n);
      check("K3 duplicate persisted (server row with the same image)", copies >= 2 && (await nodeCount()) > countBefore, `copies=${copies}`);
    }
  }
}

// ── Invariant M: marquee select + Esc clears (VC-R4 fix 5 / D-47) — FREE ───
// Select tool is default: drag on empty canvas draws a selection box
// (partial intersection); Esc at the bottom of the layer stack clears it.
{
  // Start from an empty corner, sweep across the board region
  await page.mouse.move(60, 180);
  await page.mouse.down();
  await page.mouse.move(1500, 900, { steps: 10 });
  await page.mouse.up();
  await sleep(400);
  const selectedCount = () =>
    page.evaluate(() => document.querySelectorAll(".react-flow__node.selected").length);
  const afterMarquee = await selectedCount();
  check("M1 marquee drag selects nodes (Select tool default)", afterMarquee >= 2, `${afterMarquee} selected`);
  await page.keyboard.press("Escape");
  await sleep(300);
  const afterEsc = await selectedCount();
  check("M2 Esc clears the selection (bottom of the layer stack)", afterEsc === 0, `${afterEsc} selected`);
}

// ── Invariants N/O/P/Q (R5 comp card) — FREE, on a SEEDED minted package ───
// A synthetic minted model (4 filled slots, same-origin placeholder images)
// is seeded straight into the dev DB, placed on the board, and the saved
// viewport is cleared so fitView frames everything after reload. Money never
// moves: pop-out/collapse are free ops; Q's refusals fire BEFORE any deduct.
let seededModelId = 0;
let seededItemId = 0;
{
  // Idempotent: previous runs' seed model dies first (items were cleaned at setup)
  await conn.execute(
    `DELETE FROM model_assets WHERE modelId IN (SELECT id FROM models WHERE userId = ? AND agencyId = 'MOD-26-DRIVE1')`,
    [userId],
  );
  await conn.execute(`DELETE FROM models WHERE userId = ? AND agencyId = 'MOD-26-DRIVE1'`, [userId]);
  // Tile images must actually LOAD (SafeImage swaps broken URLs for the
  // fallback and the tile then reads as unfilled) — borrow a real asset URL
  // from the bot's prior paid runs; a 1px data URI is the cold-DB fallback
  const [realAssets] = await conn.execute(
    `SELECT ma.storageUrl FROM model_assets ma JOIN models m ON m.id = ma.modelId
     WHERE m.userId = ? AND ma.storageUrl LIKE 'http%' LIMIT 1`,
    [userId],
  );
  const FAKE_URL =
    (realAssets as Array<{ storageUrl: string }>)[0]?.storageUrl ??
    "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
  const [mRes] = await conn.execute(
    `INSERT INTO models (userId, name, status, agencyId, masterPrompt, technicalSchema, preferences)
     VALUES (?, 'Drive Comp Card', 'active', 'MOD-26-DRIVE1', 'drive seed — comp card invariants', '{}', '{}')`,
    [userId],
  );
  seededModelId = (mRes as { insertId: number }).insertId;
  for (const angle of ["frontClose", "sideClose", "threeQuarter", "frontFull"]) {
    await conn.execute(
      `INSERT INTO model_assets (modelId, viewType, resolution, storageUrl, pointsCost)
       VALUES (?, ?, '1K', ?, 0)`,
      [seededModelId, angle, FAKE_URL],
    );
  }
  const [iRes] = await conn.execute(
    // CAST(? AS JSON): a raw string param lands as a JSON *string* value, not
    // an object — provenance would read undefined and the card never renders
    `INSERT INTO board_items (boardId, type, kind, label, imageUrl, positionX, positionY, width, height, zIndex, metadata, sourceModelId)
     VALUES (?, 'model', 'image', 'Drive Comp Card', ?, 1400, 120, 280, 420, 0, CAST(? AS JSON), ?)`,
    [
      boardId,
      FAKE_URL,
      JSON.stringify({
        provenance: { type: "library_cast", modelId: seededModelId, viewAngle: "frontClose" },
        version: 1,
      }),
      seededModelId,
    ],
  );
  seededItemId = (iRes as { insertId: number }).insertId;
  await conn.execute(`UPDATE boards SET viewportX = NULL, viewportY = NULL, viewportZoom = NULL WHERE id = ?`, [boardId]);
  await page.goto(`${BASE}/app/board/${boardId}`, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForSelector('button[aria-label="Select"]', { timeout: 90000 });

  const sheetNodeSel = `.react-flow__node[data-id="item-${seededItemId}"]`;
  // The card paints once the packageState prefetch lands — poll, don't race
  // the remote-DB waterfall (getItems → prefetch → render); then zoom toward
  // the card until tiles are genuinely clickable (React Flow zooms toward
  // the cursor; recompute the rect every notch — the node moves as the
  // viewport scales)
  const settleSheet = async () => {
    await page
      .waitForFunction(
        (sel: string) => {
          const node = document.querySelector(sel);
          return !!node && [...node.querySelectorAll("button")].some((b) => (b as HTMLElement).style.gridArea);
        },
        { timeout: 20000, polling: 250 },
        sheetNodeSel,
      )
      .catch(() => {});
    for (let i = 0; i < 14; i++) {
      const rect = await page.evaluate((sel: string) => {
        const n = document.querySelector(sel);
        if (!n) return null;
        const r = n.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width };
      }, sheetNodeSel);
      if (!rect) break;
      // Land in a clickable band: big enough for tile precision, small
      // enough that the whole card (label row included) can fit on screen
      if (rect.w >= 240 && rect.w <= 420) break;
      await page.mouse.move(rect.x, rect.y);
      await page.mouse.wheel({ deltaY: rect.w < 240 ? -240 : 240 });
      await sleep(350);
    }
    // Clamp: middle-drag pan until the card sits fully on screen — a label
    // click at negative y selects nothing and every downstream leg lies
    const rect = await page.evaluate((sel: string) => {
      const n = document.querySelector(sel);
      if (!n) return null;
      const r = n.getBoundingClientRect();
      return { top: r.y, bottom: r.bottom, left: r.x, right: r.right };
    }, sheetNodeSel);
    if (rect) {
      const dx = rect.left < 100 ? 100 - rect.left : rect.right > 1500 ? 1500 - rect.right : 0;
      const dy = rect.top < 90 ? 90 - rect.top : rect.bottom > 940 ? Math.max(90 - rect.top, 940 - rect.bottom) : 0;
      if (dx !== 0 || dy !== 0) {
        await page.mouse.move(800, 500);
        await page.mouse.down({ button: "middle" });
        await page.mouse.move(800 + dx, 500 + dy, { steps: 8 });
        await page.mouse.up({ button: "middle" });
        await sleep(400);
      }
    }
  };
  await settleSheet();
  const tileInfo = () =>
    page.evaluate((sel: string) => {
      const node = document.querySelector(sel);
      if (!node) return null;
      const tiles = [...node.querySelectorAll("button")].filter(
        (b) => (b as HTMLElement).style.gridArea,
      ) as HTMLElement[];
      return tiles.map((t) => {
        const r = t.getBoundingClientRect();
        return {
          area: t.style.gridArea,
          x: r.x + r.width / 2,
          y: r.y + r.height / 2,
          w: r.width,
          filled: !!t.querySelector("img"),
          text: (t.textContent ?? "").trim(),
        };
      });
    }, sheetNodeSel);

  // N — the comp card renders: six mosaic tiles, headshot dominant,
  // filled tiles image-only at rest, ghosts for the missing slots
  {
    const tiles = await tileInfo();
    check("N1 comp card renders six mosaic tiles", tiles?.length === 6, `${tiles?.length ?? 0} tiles`);
    if (tiles) {
      const head = tiles.find((t) => t.area === "head");
      const small = tiles.find((t) => t.area !== "head" && t.filled);
      check(
        "N2 headshot spans 2×2 (dominant)",
        !!head && !!small && head.w > small.w * 1.7,
        `head=${head?.w.toFixed(0)}px small=${small?.w.toFixed(0)}px`,
      );
      const filled = tiles.filter((t) => t.filled);
      const ghosts = tiles.filter((t) => !t.filled);
      check("N3 four filled + two ghost slots", filled.length === 4 && ghosts.length === 2, `${filled.length}f/${ghosts.length}g`);
      check(
        "N4 filled tiles are image-only at rest (no text, D-29)",
        filled.every((t) => t.text === ""),
      );

      // N5 (VC-R5 F2): the out-pin must be genuinely VISIBLE — it once
      // rendered as a white sliver clipped by the shell's overflow-hidden
      // and the founder couldn't find it after being told where it was
      const pin = await page.evaluate((sel: string) => {
        const p = document.querySelector(`${sel} .spawn-dot`) as HTMLElement | null;
        if (!p) return null;
        const r = p.getBoundingClientRect();
        const node = document.querySelector(sel)!.getBoundingClientRect();
        const cs = getComputedStyle(p);
        return {
          w: r.width,
          visible: cs.opacity !== "0" && cs.display !== "none" && r.width >= 8,
          // fully rendered: the pin's box is not clipped to a sliver — its
          // center sits at the node's right edge with both halves drawable
          atEdge: Math.abs(r.x + r.width / 2 - node.right) < r.width,
          bordered: cs.borderTopWidth !== "0px",
        };
      }, sheetNodeSel);
      check(
        "N5 out-pin renders visible at the card edge (F2 — never a clipped sliver)",
        !!pin && pin.visible && pin.atEdge && pin.bordered,
        JSON.stringify(pin),
      );
    }
  }

  // N6/N7 — D-54 routing: a comp-card TILE double-click opens the
  // ENVIRONMENT focused on that view (tiles are working objects); the D-52
  // viewer stays reserved for image-class cards (popped views, image nodes).
  {
    const tiles = await tileInfo();
    const side = tiles?.find((t) => t.area === "side"); // sideClose
    if (!side) {
      console.log("SKIP  N6/N7 — sideClose tile missing");
    } else {
      // count: 2 is the real double-click (clickCount is an internal event
      // field and performs no extra clicks — puppeteer 25 API)
      await page.mouse.click(side.x, side.y, { count: 2 });
      // The takeover hydrates the edit session (same budget as D2)
      let envOpen = false;
      for (let i = 0; i < 30 && !envOpen; i++) {
        await sleep(1000);
        envOpen = await page.evaluate(() => {
          const body = document.body.textContent ?? "";
          const anchor = [...document.querySelectorAll("button")].some((b) => {
            const t = b.textContent?.trim();
            return t === "Save changes" || t === "Cast this model";
          });
          return anchor && !body.includes("Loading this cast") && !body.includes("Loading your draft");
        });
      }
      // The D-52 viewer marks itself — the node pill also carries a Download
      // aria-label, so button hunting false-positives on the board
      const viewerOpen = await page.evaluate(() => !!document.querySelector("[data-canvas-viewer]"));
      check(
        "N6 tile dblclick opens the environment, not the viewer (D-54)",
        envOpen && !viewerOpen,
        JSON.stringify({ envOpen, viewerOpen }),
      );
      // The session STARTS on the clicked view: the Side thumbnail wears the
      // active ink border (activeView === sideClose)
      let activeSide = false;
      for (let i = 0; i < 10 && !activeSide; i++) {
        await sleep(500);
        activeSide = await page.evaluate(() => {
          const img = document.querySelector('img[alt="Side"]');
          const btn = img?.closest("button");
          return !!btn && getComputedStyle(btn).borderColor === "rgb(10, 10, 10)";
        });
      }
      check("N7 environment opens focused on the clicked view (D-54 initialAngle)", activeSide);
      await closeTakeoverCleanly();
      await settleSheet();
    }
  }

  // O — pop out writes the cascade-bearing edge; the red dialog activates;
  // collapse re-anchors outgoing edges to the root with viewAngle intact
  {
    const tiles = await tileInfo();
    const side = tiles?.find((t) => t.area === "side"); // sideClose
    check("O0 sideClose tile present", !!side);
    if (side) {
      const before = await nodeCount();
      await page.mouse.click(side.x, side.y);
      await sleep(600);
      const popped = await page.evaluate(() => {
        const b = [...document.querySelectorAll("button")].find((el) => el.textContent?.trim().startsWith("Pop out"));
        if (!b) return false;
        const r = b.getBoundingClientRect();
        (b as HTMLElement).click();
        return r.width > 0;
      });
      check("O1 tile popover offers Pop out", popped);
      await page
        .waitForFunction(
          (n: number) => document.querySelectorAll(".react-flow__node").length > n,
          { timeout: 8000, polling: 100 },
          before,
        )
        .catch(() => {});
      // The edge row (server truth): generated_from_cast + viewAngle metadata
      let edgeRow: { id: number; targetItemId: number } | null = null;
      for (let i = 0; i < 20 && !edgeRow; i++) {
        await sleep(500);
        const [rows] = await conn.execute(
          `SELECT id, targetItemId FROM board_edges
           WHERE boardId = ? AND sourceItemId = ? AND relation = 'generated_from_cast'
             AND JSON_EXTRACT(metadata, '$.viewAngle') = 'sideClose'`,
          [boardId, seededItemId],
        );
        edgeRow = (rows as Array<{ id: number; targetItemId: number }>)[0] ?? null;
      }
      check("O2 pop-out wrote generated_from_cast with viewAngle metadata", !!edgeRow);
      const [popItem] = await conn.execute(
        `SELECT width, JSON_EXTRACT(metadata, '$.provenance.type') AS ptype FROM board_items WHERE id = ?`,
        [edgeRow?.targetItemId ?? 0],
      );
      const pop = (popItem as Array<{ width: number; ptype: string }>)[0];
      check("O3 placement is a 200-wide cast_view", pop?.width === 200 && String(pop?.ptype).includes("cast_view"), JSON.stringify(pop));
      const renderedEdges = await page.evaluate(() => document.querySelectorAll(".react-flow__edge").length);
      check("O4 lineage edge renders on the canvas (DS §8)", renderedEdges >= 1, `${renderedEdges} edges`);

      // R4 activation: deleting the root now raises the ONE red cascade dialog
      await page.keyboard.press("Escape");
      await sleep(200);
      const label = await page.evaluate((sel: string) => {
        const node = document.querySelector(sel);
        if (!node) return null;
        const r = node.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + 8 }; // label row — never a tile
      }, sheetNodeSel);
      await page.mouse.click(label!.x, label!.y);
      await sleep(400);
      await page.keyboard.press("Delete");
      await sleep(500);
      const cascadeDialog = await page.evaluate(() =>
        [...document.querySelectorAll("p")].some((p) => p.textContent?.trim() === "Delete this cast?"),
      );
      check("O5 deleting the root raises the red cascade dialog (R4 activation)", cascadeDialog);
      if (cascadeDialog) {
        await page.evaluate(() => {
          const b = [...document.querySelectorAll("button")].find((el) => el.textContent?.trim() === "Cancel");
          (b as HTMLElement | undefined)?.click();
        });
        await sleep(300);
      }

      // Collapse: seed an outgoing edge from the popped view, collapse via the
      // tile popover, assert re-anchor to the root with viewAngle preserved
      if (edgeRow) {
        const [seedEdge] = await conn.execute(
          `INSERT INTO board_edges (boardId, sourceItemId, targetItemId, relation, metadata)
           SELECT ?, ?, id, 'reference_for', '{"weight":1}' FROM board_items
           WHERE boardId = ? AND id != ? AND id != ? AND deletedAt IS NULL LIMIT 1`,
          [boardId, edgeRow.targetItemId, boardId, edgeRow.targetItemId, seededItemId],
        );
        const outgoingSeeded = (seedEdge as { affectedRows: number }).affectedRows === 1;
        // The tile learns it's popped once the getItems refetch lands — a
        // remote-DB roundtrip that takes seconds; poll-click rather than race
        let returned = false;
        for (let attempt = 0; attempt < 10 && !returned; attempt++) {
          await page.keyboard.press("Escape");
          await sleep(1500);
          const tiles2 = await tileInfo();
          const side2 = tiles2?.find((t) => t.area === "side");
          if (!side2) continue;
          await page.mouse.click(side2.x, side2.y);
          await sleep(700);
          returned = await page.evaluate(() => {
            const b = [...document.querySelectorAll("button")].find((el) => el.textContent?.trim() === "Return to sheet");
            if (!b) return false;
            (b as HTMLElement).click();
            return true;
          });
        }
        check("O6 popped tile offers Return to sheet", returned);
        let collapsed = false;
        let reanchored = !outgoingSeeded; // only asserted when the seed landed
        for (let i = 0; i < 20 && (!collapsed || !reanchored); i++) {
          await sleep(500);
          const [gone] = await conn.execute(`SELECT deletedAt FROM board_items WHERE id = ?`, [edgeRow.targetItemId]);
          collapsed = !!(gone as Array<{ deletedAt: unknown }>)[0]?.deletedAt;
          if (outgoingSeeded) {
            const [re] = await conn.execute(
              `SELECT COUNT(*) AS n FROM board_edges
               WHERE boardId = ? AND sourceItemId = ? AND relation = 'reference_for'
                 AND JSON_EXTRACT(metadata, '$.viewAngle') = 'sideClose'`,
              [boardId, seededItemId],
            );
            reanchored = (re as Array<{ n: number }>)[0].n === 1;
          }
        }
        check("O7 collapse soft-deletes the placement", collapsed);
        check("O8 outgoing edge re-anchored to root, viewAngle preserved (D-30)", reanchored);

        // O7b (VC-R5 fix 1): collapse must REMOVE the lineage edge server-side
        const [remaining] = await conn.execute(
          `SELECT COUNT(*) AS n FROM board_edges
           WHERE boardId = ? AND sourceItemId = ? AND relation = 'generated_from_cast'`,
          [boardId, seededItemId],
        );
        const lineageGone = (remaining as Array<{ n: number }>)[0].n === 0;
        check("O7b collapse removed the generated_from_cast edge", lineageGone);

        // O9 (VC-R5 fix 1, the trust assertion): after pop-out → collapse,
        // deleting the root must NOT raise the cascade dialog — the one red
        // mark in the app must never lie about its blast radius. Plain soft
        // delete + Undo toast instead; Cmd+Z restores (cleanup).
        {
          await page.keyboard.press("Escape");
          await sleep(400);
          const label9 = await page.evaluate((sel: string) => {
            const n = document.querySelector(sel);
            if (!n) return null;
            const r = n.getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + 8 };
          }, sheetNodeSel);
          await page.mouse.click(label9!.x, label9!.y);
          await sleep(400);
          await page.keyboard.press("Delete");
          // Poll: the dialog must NEVER appear; the soft delete lands on the
          // remote DB in its own time (SQL is the authority, not the toast)
          let dialogSeen = false;
          let softDeleted = false;
          for (let i = 0; i < 12 && !softDeleted; i++) {
            await sleep(500);
            dialogSeen =
              dialogSeen ||
              (await page.evaluate(() =>
                [...document.querySelectorAll("p")].some((p) => p.textContent?.trim() === "Delete this cast?"),
              ));
            if (dialogSeen) break;
            const [delRow] = await conn.execute(`SELECT deletedAt FROM board_items WHERE id = ?`, [seededItemId]);
            softDeleted = (delRow as Array<{ deletedAt: unknown }>)[0]?.deletedAt != null;
          }
          check(
            "O9 delete after collapse: NO phantom cascade dialog, plain soft delete",
            !dialogSeen && softDeleted,
            JSON.stringify({ dialogSeen, softDeleted }),
          );
          if (dialogSeen) {
            await page.evaluate(() => {
              const b = [...document.querySelectorAll("button")].find((el) => el.textContent?.trim() === "Cancel");
              (b as HTMLElement | undefined)?.click();
            });
          } else if (softDeleted) {
            // Deterministic restore for the legs that follow (P reloads anyway)
            await conn.execute(`UPDATE board_items SET deletedAt = NULL WHERE id = ?`, [seededItemId]);
          }
        }
      }
    }
  }

  // P — per-slot pin: raw tRPC toggles the NEWEST filled row; the tile
  // popover reads it back (Unpin + disabled Refresh)
  {
    const pinRes = await page.evaluate(async (mid: number) => {
      const res = await fetch("/api/trpc/generation.setSlotPinned", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ json: { modelId: mid, angle: "threeQuarter", pinned: true } }),
      });
      return res.status;
    }, seededModelId);
    await sleep(300);
    const [pinRows] = await conn.execute(
      `SELECT pinned FROM model_assets WHERE modelId = ? AND viewType = 'threeQuarter' AND storageUrl != ''
       ORDER BY createdAt DESC, id DESC LIMIT 1`,
      [seededModelId],
    );
    const pinnedInDb = (pinRows as Array<{ pinned: number }>)[0]?.pinned === 1;
    check("P1 setSlotPinned pins the newest filled row", pinRes === 200 && pinnedInDb, `status=${pinRes}`);

    // The raw pin bypassed the client cache (packageState staleTime) — a
    // reload is the honest way to assert the UI reads the server truth
    await page.goto(`${BASE}/app/board/${boardId}`, { waitUntil: "networkidle2", timeout: 60000 });
    await page.waitForSelector('button[aria-label="Select"]', { timeout: 90000 });
    await settleSheet();
    const tiles = await tileInfo();
    const tq = tiles?.find((t) => t.area === "tq");
    await page.mouse.click(tq!.x, tq!.y);
    await sleep(700);
    const popoverState = await page.evaluate(() => {
      const unpin = [...document.querySelectorAll("button")].some((b) => b.textContent?.trim() === "Unpin");
      const refresh = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim().startsWith("Refresh"));
      const all = [...document.querySelectorAll('[data-slot="popover-content"] *')]
        .map((el) => el.textContent?.trim())
        .filter((t, i, a) => t && t.length < 60 && a.indexOf(t) === i)
        .slice(0, 12);
      return { unpin, refreshDisabled: !!refresh && (refresh as HTMLButtonElement).disabled, all };
    });
    check("P2 popover shows Unpin + disabled Refresh on a pinned slot", popoverState.unpin && popoverState.refreshDisabled, JSON.stringify(popoverState));
    await page.keyboard.press("Escape");
    await sleep(200);
  }

  // Q — structural refresh refusals, BEFORE any money moves (D-43/D-15)
  {
    const [balRows] = await conn.execute(`SELECT balance FROM points WHERE userId = ?`, [userId]);
    const balanceBefore = (balRows as Array<{ balance: number }>)[0]?.balance ?? 0;
    // NOTE: no named inner functions inside page.evaluate (the __name crash —
    // see invariant E's note); both fetches inlined.
    const refusals = await page.evaluate(async (mid: number) => {
      const headRes = await fetch("/api/trpc/generation.refreshSlots", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ json: { modelId: mid, angles: ["frontClose"] } }),
      });
      const headText = await headRes.text();
      const pinRes = await fetch("/api/trpc/generation.refreshSlots", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ json: { modelId: mid, angles: ["threeQuarter"] } }),
      });
      const pinText = await pinRes.text();
      return {
        headshot: { status: headRes.status, text: headText },
        pinned: { status: pinRes.status, text: pinText },
      };
    }, seededModelId);
    check(
      "Q1 refreshing the headshot is structurally refused (it IS the identity, D-43)",
      refusals.headshot.status !== 200 && /headshot is this identity/i.test(refusals.headshot.text),
      `status=${refusals.headshot.status}`,
    );
    check(
      "Q2 refreshing a pinned slot is refused (accepted-final)",
      refusals.pinned.status !== 200 && /pinned/i.test(refusals.pinned.text),
      `status=${refusals.pinned.status}`,
    );
    const [balAfter] = await conn.execute(`SELECT balance FROM points WHERE userId = ?`, [userId]);
    const balanceAfter = (balAfter as Array<{ balance: number }>)[0]?.balance ?? 0;
    check("Q3 refusals moved no money", balanceAfter === balanceBefore, `Δ=${balanceBefore - balanceAfter}`);
    // Cleanup: unpin for any later paid runs against this model
    await page.evaluate(async (mid: number) => {
      await fetch("/api/trpc/generation.setSlotPinned", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ json: { modelId: mid, angle: "threeQuarter", pinned: false } }),
      });
    }, seededModelId);
  }
}

// ── Invariant U: pop-out placement stays NEAR the root — FREE ──────────────
// VC-R5 close-out bug 0: the old placement stacked one unbounded column —
// a fifth view landed half a screen down. Placement is now the nearest free
// slot (2 rows per column, wrap right, collision-aware). Pops every filled
// view of the seeded package over raw tRPC (the server formula under test)
// and asserts each placement lands within 1.5 view-heights of its
// predecessor and within a sane radius of the root.
{
  const [rootRows] = await conn.execute(
    `SELECT positionX, positionY FROM board_items WHERE id = ?`,
    [seededItemId],
  );
  const rootPos = (rootRows as Array<{ positionX: number; positionY: number }>)[0];
  const angles = ["sideClose", "threeQuarter", "frontFull", "frontClose"];
  const placements: Array<{ x: number; y: number }> = [];
  const popped: Array<{ itemId: number; edgeId: number }> = [];
  for (const angle of angles) {
    const res = await page.evaluate(
      async (bId: number, iId: number, a: string) => {
        const r = await fetch("/api/trpc/boardOps.popOutView.execute", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ json: { boardId: bId, itemId: iId, angle: a } }),
        });
        const data = await r.json();
        return data?.result?.data?.json ?? null;
      },
      boardId,
      seededItemId,
      angle,
    );
    if (res?.position) {
      placements.push(res.position);
      popped.push({ itemId: res.itemId, edgeId: res.edgeId });
    }
  }
  check("U1 all filled views popped out", placements.length === 4, `${placements.length}/4`);
  const VIEW_H = 360;
  let hops = true;
  for (let i = 1; i < placements.length; i++) {
    const d = Math.hypot(placements[i].x - placements[i - 1].x, placements[i].y - placements[i - 1].y);
    if (d > 1.5 * VIEW_H) hops = false;
  }
  check("U2 every placement within 1.5 view-heights of its predecessor", hops, JSON.stringify(placements));
  const nearRoot = placements.every(
    (p) => Math.abs(p.y - rootPos.positionY) <= 2 * VIEW_H && p.x - rootPos.positionX <= 1400 && p.x > rootPos.positionX,
  );
  check("U3 every placement within a sane radius of the root", nearRoot);
  // Cleanup — the placements were the test, not board furniture
  if (popped.length > 0) {
    await conn.execute(
      `UPDATE board_items SET deletedAt = NOW() WHERE id IN (${popped.map(() => "?").join(",")})`,
      popped.map((p) => p.itemId),
    );
    await conn.execute(
      `DELETE FROM board_edges WHERE id IN (${popped.map(() => "?").join(",")})`,
      popped.map((p) => p.edgeId),
    );
  }
}

// ── Invariant S: group selection grammar (D-50 rider) — FREE ───────────────
// Selection >1: ONE group toolbar (Duplicate/Download all/Focus/reserved Run
// all/Delete), per-node toolbars suppressed; Esc clears the group.
{
  await page.keyboard.press("Escape");
  await sleep(200);
  // Ctrl+A: deterministic multi-selection (M already covers the marquee —
  // after the N-block reload/fitView a marquee start point can land on a node)
  await page.keyboard.down("Control");
  await page.keyboard.press("a");
  await page.keyboard.up("Control");
  await sleep(500);
  const state = await page.evaluate(() => {
    const selected = document.querySelectorAll(".react-flow__node.selected").length;
    const groupToolbars = [...document.querySelectorAll('button[aria-label="Focus"]')].length;
    const perNodeToolbars = [...document.querySelectorAll('button[aria-label="Rerun"], button[aria-label^="Rerun —"]')].length;
    const runAll = [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label")?.startsWith("Run all"));
    return { selected, groupToolbars, perNodeToolbars, runAllReserved: !!runAll && (runAll as HTMLButtonElement).disabled };
  });
  check("S1 multi-select renders ONE group toolbar", state.selected >= 2 && state.groupToolbars === 1, JSON.stringify(state));
  check("S2 per-node toolbars suppressed in a group", state.perNodeToolbars === 0, `${state.perNodeToolbars} leaked`);
  check("S3 Run all slot reserved (disabled, D-50.4)", state.runAllReserved);
  await page.keyboard.press("Escape");
  await sleep(300);
  const cleared = await page.evaluate(() => ({
    selected: document.querySelectorAll(".react-flow__node.selected").length,
    groupToolbars: [...document.querySelectorAll('button[aria-label="Focus"]')].length,
  }));
  check("S4 Esc clears the group (container + toolbar gone)", cleared.selected === 0 && cleared.groupToolbars === 0, JSON.stringify(cleared));
}

// ── Invariant X: set-duplication carries lineage (VC-R6b bug 2) — FREE ──────
// Duplicating a SET re-creates every edge whose BOTH endpoints were copied,
// between the copies, with metadata carried — a duplicated parent+view pair
// must not arrive lineage-less.
{
  // Seed one popped view THROUGH THE CLIENT (the node's own pop-out event →
  // BoardPage mutation → optimistic append + invalidation). A raw tRPC seed
  // never reached the client cache, so Ctrl+A couldn't select the popped
  // view and its edge endpoints never entered the id map (X2 flake).
  const [beforeMaxRows] = await conn.execute(
    `SELECT MAX(id) AS m FROM board_items WHERE boardId = ?`,
    [boardId],
  );
  const beforeMaxItemId = (beforeMaxRows as Array<{ m: number }>)[0].m;
  await page.evaluate((iId: number) => {
    window.dispatchEvent(
      new CustomEvent("board-pop-out-view", { detail: { itemId: iId, angle: "sideClose" } }),
    );
  }, seededItemId);
  let xPop: { itemId: number; edgeId: number } | null = null;
  for (let i = 0; i < 20 && !xPop; i++) {
    await sleep(700);
    const [popRows] = await conn.execute(
      `SELECT i.id AS itemId, e.id AS edgeId FROM board_items i
         JOIN board_edges e ON e.targetItemId = i.id AND e.relation = 'generated_from_cast'
        WHERE i.boardId = ? AND i.id > ? AND i.deletedAt IS NULL LIMIT 1`,
      [boardId, beforeMaxItemId],
    );
    const row = (popRows as Array<{ itemId: number; edgeId: number }>)[0];
    if (row) {
      // The client created it — wait until it RENDERS too (selection needs DOM)
      const rendered = await page.evaluate(
        (id: number) => !!document.querySelector(`.react-flow__node[data-id="item-${id}"]`),
        row.itemId,
      );
      if (rendered) xPop = row;
    }
  }
  if (!xPop) {
    console.log("SKIP  X — pop-out seed failed (client path never landed)");
  } else {
    const [maxRows] = await conn.execute(`SELECT MAX(id) AS m FROM board_items WHERE boardId = ?`, [boardId]);
    const maxItemId = (maxRows as Array<{ m: number }>)[0].m;

    // Select all, duplicate the set from the group toolbar
    await page.keyboard.press("Escape");
    await sleep(200);
    await page.keyboard.down("Control");
    await page.keyboard.press("a");
    await page.keyboard.up("Control");
    await sleep(600);
    const dupClicked = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) =>
        (x.getAttribute("aria-label") ?? "").startsWith("Duplicate"),
      ) as HTMLElement | undefined;
      b?.click();
      return !!b;
    });
    check("X1 group Duplicate reachable", dupClicked);

    // Poll: copies land AND a lineage edge exists between two NEW ids
    let xState = { copies: 0, mappedEdges: 0, withMeta: 0 };
    for (let i = 0; i < 24 && xState.mappedEdges === 0; i++) {
      await sleep(500);
      const [copyRows] = await conn.execute(
        `SELECT COUNT(*) AS c FROM board_items WHERE boardId = ? AND id > ? AND deletedAt IS NULL`,
        [boardId, maxItemId],
      );
      const [edgeRows] = await conn.execute(
        `SELECT COUNT(*) AS c,
                SUM(CASE WHEN metadata IS NOT NULL THEN 1 ELSE 0 END) AS m
           FROM board_edges
          WHERE boardId = ? AND relation = 'generated_from_cast'
            AND sourceItemId > ? AND targetItemId > ?`,
        [boardId, maxItemId, maxItemId],
      );
      xState = {
        copies: (copyRows as Array<{ c: number }>)[0].c,
        mappedEdges: Number((edgeRows as Array<{ c: number }>)[0].c),
        withMeta: Number((edgeRows as Array<{ m: number | null }>)[0].m ?? 0),
      };
    }
    check(
      "X2 set duplicate lands copies WITH a mapped lineage edge (+ metadata)",
      xState.copies >= 2 && xState.mappedEdges >= 1 && xState.withMeta >= 1,
      JSON.stringify(xState),
    );

    // Cleanup: everything this leg created (copies + their edges + the seed)
    await conn.execute(
      `UPDATE board_items SET deletedAt = NOW() WHERE boardId = ? AND id > ?`,
      [boardId, maxItemId],
    );
    await conn.execute(
      `DELETE FROM board_edges WHERE boardId = ? AND (sourceItemId > ? OR targetItemId > ?)`,
      [boardId, maxItemId, maxItemId],
    );
    await conn.execute(`UPDATE board_items SET deletedAt = NOW() WHERE id = ?`, [xPop.itemId]);
    await conn.execute(`DELETE FROM board_edges WHERE id = ?`, [xPop.edgeId]);
    await page.keyboard.press("Escape");
    await sleep(200);
  }
}

// ── Invariant Z: Tidy up (D-50.3) — FREE ────────────────────────────────────
// Row-major pack over measured dims, y-then-x reading order, 60px gutters,
// row height = tallest in row — and ONE Cmd+Z reverses the WHOLE tidy
// (ratified requirement, not an implementation detail).
{
  // Start from board truth: earlier legs clean up via direct DB writes,
  // which leaves client-cache ghost nodes — tidying a ghost makes its
  // moveNodes error → refetch → the ghost vanishes mid-leg and the
  // before/after comparison lies (first Z run, item ghosted by X cleanup)
  await conn.execute(`UPDATE boards SET viewportX = NULL, viewportY = NULL, viewportZoom = NULL WHERE id = ?`, [boardId]);
  await page.goto(`${BASE}/app/board/${boardId}`, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForSelector('button[aria-label="Select"]', { timeout: 90000 });
  await sleep(1000);
  await page.keyboard.press("Escape");
  await sleep(200);
  await page.keyboard.down("Control");
  await page.keyboard.press("a");
  await page.keyboard.up("Control");
  await sleep(500);

  const readGeometry = () =>
    page.evaluate(() => {
      const out: Array<{ itemId: number; x: number; y: number; w: number; h: number }> = [];
      for (const el of document.querySelectorAll<HTMLElement>(".react-flow__node.selected")) {
        const id = parseInt((el.getAttribute("data-id") ?? "").replace("item-", ""), 10);
        const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(el.style.transform ?? "");
        if (isNaN(id) || !m) continue;
        out.push({ itemId: id, x: parseFloat(m[1]), y: parseFloat(m[2]), w: el.offsetWidth, h: el.offsetHeight });
      }
      return out;
    });

  const before = await readGeometry();
  const tidyClicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(
      (x) => x.getAttribute("aria-label") === "Tidy up",
    ) as HTMLElement | undefined;
    b?.click();
    return !!b;
  });
  check("Z1 Tidy up reachable on the group toolbar", tidyClicked);

  if (tidyClicked && before.length >= 2) {
    await sleep(600);
    const after = await readGeometry();
    const byId = new Map(after.map((g) => [g.itemId, g]));
    // The pack contract: rows share a y; within a row consecutive nodes sit
    // exactly 60px apart; every row starts at the same left edge; row tops
    // step by tallest-in-previous-row + 60.
    const GUTTER = 60;
    const rows = new Map<number, Array<{ x: number; w: number; h: number }>>();
    for (const g of after) {
      const row = rows.get(g.y) ?? [];
      row.push(g);
      rows.set(g.y, row);
    }
    const rowYs = [...rows.keys()].sort((a, b) => a - b);
    const leftEdge = Math.min(...after.map((g) => g.x));
    let packed = true;
    let expectY = rowYs[0];
    for (const y of rowYs) {
      if (Math.abs(y - expectY) > 1) packed = false;
      const row = rows.get(y)!.sort((a, b) => a.x - b.x);
      if (Math.abs(row[0].x - leftEdge) > 1) packed = false;
      for (let i = 1; i < row.length; i++) {
        if (Math.abs(row[i].x - (row[i - 1].x + row[i - 1].w + GUTTER)) > 1) packed = false;
      }
      expectY = y + Math.max(...row.map((g) => g.h)) + GUTTER;
    }
    check("Z2 tidy packs row-major with 60px gutters", packed, JSON.stringify(after));

    // Persistence: the batched moveNodes must reach the DB
    let persisted = false;
    const sample = after.find((g) => g.itemId > 0);
    for (let i = 0; i < 16 && !persisted && sample; i++) {
      await sleep(500);
      const [rows2] = await conn.execute(
        `SELECT positionX, positionY FROM board_items WHERE id = ?`,
        [sample.itemId],
      );
      const r = (rows2 as Array<{ positionX: number; positionY: number }>)[0];
      if (r && Math.abs(r.positionX - sample.x) <= 1 && Math.abs(r.positionY - sample.y) <= 1) persisted = true;
    }
    check("Z3 tidy positions persisted (one batched moveNodes)", persisted);

    // ONE Cmd+Z reverses the WHOLE tidy
    await page.keyboard.down("Control");
    await page.keyboard.press("z");
    await page.keyboard.up("Control");
    await sleep(600);
    const restored = await page.evaluate(() => {
      const out: Array<{ itemId: number; x: number; y: number }> = [];
      for (const el of document.querySelectorAll<HTMLElement>(".react-flow__node")) {
        const id = parseInt((el.getAttribute("data-id") ?? "").replace("item-", ""), 10);
        const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(el.style.transform ?? "");
        if (isNaN(id) || !m) continue;
        out.push({ itemId: id, x: parseFloat(m[1]), y: parseFloat(m[2]) });
      }
      return out;
    });
    const restoredById = new Map(restored.map((g) => [g.itemId, g]));
    const allBack = before.every((b) => {
      const r = restoredById.get(b.itemId);
      return r && Math.abs(r.x - b.x) <= 1 && Math.abs(r.y - b.y) <= 1;
    });
    check("Z4 ONE Cmd+Z reverses the whole tidy", allBack, JSON.stringify({ before, restored: [...restoredById.values()] }));
    // The move-undo already persisted the restore through the same path;
    // nothing to clean up — the board is back where this leg found it.
  }
  await page.keyboard.press("Escape");
  await sleep(200);
}

// ── Invariant I: the note contract (R-6 notes pass) — FREE ──────────────────
// A fresh note opens ready to write (auto-edit on the CONFIRMED id — never
// the optimistic row, whose temp→real remount would eat mid-typing text);
// Ctrl+Enter commits; double-click re-edits; Esc cancels.
{
  await page.keyboard.press("Escape");
  await sleep(200);
  // Place a note via the pill on an empty patch of pane
  const noteToolClicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(
      (x) => x.getAttribute("aria-label") === "Note",
    ) as HTMLElement | undefined;
    b?.click();
    return !!b;
  });
  let emptySpot: { x: number; y: number } | null = null;
  if (noteToolClicked) {
    await sleep(300);
    emptySpot = await page.evaluate(() => {
      // Probe a grid of screen points for one where the PANE is on top
      for (let x = 200; x < 1500; x += 160) {
        for (let y = 150; y < 850; y += 140) {
          const el = document.elementFromPoint(x, y);
          if (el?.classList.contains("react-flow__pane")) return { x, y };
        }
      }
      return null;
    });
  }
  if (!noteToolClicked || !emptySpot) {
    console.log("SKIP  I — note tool or empty pane spot unavailable");
  } else {
    await page.mouse.click(emptySpot.x, emptySpot.y);
    // I1 — the confirmed note opens ready to write (focused textarea)
    let writable = false;
    for (let i = 0; i < 16 && !writable; i++) {
      await sleep(500);
      writable = await page.evaluate(() => {
        const a = document.activeElement;
        return a?.tagName === "TEXTAREA" && !!a.closest(".react-flow__node");
      });
    }
    check("I1 fresh note opens ready to write (post-confirm auto-edit)", writable);
    if (writable) {
      await page.keyboard.type("Drive note");
      await page.keyboard.down("Control");
      await page.keyboard.press("Enter");
      await page.keyboard.up("Control");
      // I2 — the commit reaches the server
      let noteRow: { id: number; label: string } | null = null;
      for (let i = 0; i < 16 && !noteRow; i++) {
        await sleep(500);
        const [rows] = await conn.execute(
          `SELECT id, label FROM board_items WHERE boardId = ? AND type = 'note' AND label = 'Drive note' AND deletedAt IS NULL LIMIT 1`,
          [boardId],
        );
        noteRow = (rows as Array<{ id: number; label: string }>)[0] ?? null;
      }
      check("I2 Ctrl+Enter commits the note text", !!noteRow);
      // I3 — double-click re-edits; Esc cancels without persisting
      if (noteRow) {
        const noteSel = `.react-flow__node[data-id="item-${noteRow.id}"]`;
        const rect = await page.evaluate((s: string) => {
          const n = document.querySelector(s);
          if (!n) return null;
          const r = n.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }, noteSel);
        let reEdits = false;
        if (rect) {
          await page.mouse.click(rect.x, rect.y, { count: 2 });
          for (let i = 0; i < 8 && !reEdits; i++) {
            await sleep(300);
            reEdits = await page.evaluate(
              (s: string) => !!document.querySelector(`${s} textarea`),
              noteSel,
            );
          }
          await page.keyboard.press("Escape");
        }
        check("I3 double-click re-opens the note for editing", reEdits);
        // Cleanup
        await conn.execute(`UPDATE board_items SET deletedAt = NOW() WHERE id = ?`, [noteRow.id]);
      }
    }
    await page.keyboard.press("Escape");
    await sleep(200);
  }
}

// ── Invariant Y: the walkable loop (trap ruling (a)) — PAID (~1600cr) ───────
// fork → views as DRAFT (mint:false — stays draft, gates still fire) →
// identity iterate (free on drafts) → siblings STALE → bulk refresh offer →
// mint → the seal closes. The F6 story on flows a user can actually walk.
if (!paidEnabled("Y")) {
  console.log("SKIP  Y — paid invariant (walkable loop; ~1600 credits)");
} else {
  const yFork = await page.evaluate(
    async (bId: number) => {
      const nodes = [...document.querySelectorAll(".react-flow__node")].filter((n) =>
        n.querySelector("img")?.getAttribute("src"),
      );
      const id = parseInt((nodes[nodes.length - 1]?.getAttribute("data-id") ?? "").replace("item-", ""), 10);
      const r = await fetch("/api/trpc/boardOps.applyModelEdit.execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ json: { boardId: bId, itemId: id, decision: "fork", changes: { hairColor: "Jet Black" } } }),
      });
      const data = await r.json();
      return data?.result?.data?.json ?? null;
    },
    boardId,
  );
  if (!yFork?.modelId) {
    check("Y1 fork lands (draft, headshot-only)", false, JSON.stringify(yFork));
  } else {
    const [f1] = await conn.execute(`SELECT status FROM models WHERE id = ?`, [yFork.modelId]);
    check("Y1 fork lands as a DRAFT", (f1 as Array<{ status: string }>)[0]?.status === "draft");

    // Views WITHOUT minting (the (a) decoupling)
    const yViews = await page.evaluate(async (mid: number) => {
      const r = await fetch("/api/trpc/generation.mintPackage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ json: { modelId: mid, tier: "core", mint: false } }),
      });
      const data = await r.json();
      return data?.result?.data?.json ?? null;
    }, yFork.modelId);
    const [f2] = await conn.execute(`SELECT status FROM models WHERE id = ?`, [yFork.modelId]);
    check(
      "Y2 views generate with mint:false and the model STAYS a draft",
      !!yViews && yViews.minted === false && (yViews.generated?.length ?? 0) >= 2 &&
        (f2 as Array<{ status: string }>)[0]?.status === "draft",
      JSON.stringify({ minted: yViews?.minted, generated: yViews?.generated?.length, failed: yViews?.failed?.length }),
    );

    // Identity iterate on ONE draft view → the stale-writer marks siblings
    const [assetRows] = await conn.execute(
      `SELECT id, viewType FROM model_assets WHERE modelId = ? AND storageUrl != '' ORDER BY id DESC`,
      [yFork.modelId],
    );
    const yAssets = assetRows as Array<{ id: number; viewType: string }>;
    const target = yAssets.find((a) => a.viewType === "frontFull");
    if (!target) {
      check("Y3 identity iterate stales the siblings", false, "no frontFull to iterate");
    } else {
      await page.evaluate(async (args: { mid: number; aid: number }) => {
        await fetch("/api/trpc/generation.iterate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ json: { modelId: args.mid, assetId: args.aid, feedback: "add a large dragon tattoo across the chest and both arms" } }),
        });
      }, { mid: yFork.modelId, aid: target.id });
      let staleCount = 0;
      for (let i = 0; i < 10 && staleCount === 0; i++) {
        await sleep(1000);
        const [staleRows] = await conn.execute(
          `SELECT COUNT(*) AS c FROM model_assets WHERE modelId = ? AND JSON_EXTRACT(status, '$.state') = 'stale'`,
          [yFork.modelId],
        );
        staleCount = Number((staleRows as Array<{ c: number }>)[0].c);
      }
      check("Y3 identity iterate on a draft view STALES the siblings (F6 writer)", staleCount >= 2, `${staleCount} stale`);

      // The bulk-refresh offer exists (plan flags the stale slots refreshable)
      const yPlan = await page.evaluate(async (mid: number) => {
        const q = encodeURIComponent(JSON.stringify({ json: { modelId: mid } }));
        const r = await fetch(`/api/trpc/generation.refreshSlotsPlan?input=${q}`, { credentials: "include" });
        const data = await r.json();
        return data?.result?.data?.json ?? null;
      }, yFork.modelId);
      const refreshableStale = (yPlan?.slots ?? []).filter((s: { stale: boolean; refusal: string | null }) => s.stale && s.refusal === null).length;
      check("Y4 bulk refresh OFFERS the stale slots (plan-priced)", refreshableStale >= 2, `${refreshableStale} offered`);

      // Mint → the seal closes: the same identity edit is now REFUSED
      await page.evaluate(async (mid: number) => {
        await fetch("/api/trpc/generation.mintPackage", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ json: { modelId: mid, tier: "draft", characterName: "Loop Test" } }),
        });
      }, yFork.modelId);
      const [f3] = await conn.execute(`SELECT status FROM models WHERE id = ?`, [yFork.modelId]);
      const sealAfter = await page.evaluate(async (args: { mid: number; aid: number }) => {
        const r = await fetch("/api/trpc/generation.iterate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ json: { modelId: args.mid, assetId: args.aid, feedback: "add a large dragon tattoo across the chest and both arms" } }),
        });
        const text = await r.text();
        return { status: r.status, refused: text.includes("identity is minted") };
      }, { mid: yFork.modelId, aid: target.id });
      check(
        "Y5 after mint the SAME edit is refused — the loop closes",
        (f3 as Array<{ status: string }>)[0]?.status !== "draft" && sealAfter.status >= 400 && sealAfter.refused,
        JSON.stringify(sealAfter),
      );
    }
  }
}

// ── Invariant F: fork landing stability — RUN_PAID_INVARIANTS=1 ────────────
if (!paidEnabled("F")) {
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
if (!paidEnabled("G")) {
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

// ── Invariant L: variations landing (R4) — RUN_PAID_INVARIANTS=1 ───────────
// Plan-priced confirm → N optimistic temps that never vanish → sibling
// drafts land with variant_of edges; ledger agrees with the landing count.
if (!paidEnabled("L")) {
  console.log("SKIP  L — paid invariant (2 variations; ~700 credits)");
} else {
  const source = await filledNode();
  if (!source?.img) {
    console.log("SKIP  L — no filled cast node available");
  } else {
    const [lBal0] = await conn.execute(`SELECT balance FROM points WHERE userId = ?`, [userId]);
    const lBalanceStart = (lBal0 as Array<{ balance: number }>)[0].balance;

    await page.mouse.click(source.x, source.y);
    await sleep(500);
    // The click hits whichever node is on TOP where cards overlap (K's
    // duplicate sits +40/+40 over its source), so the node that fires the
    // variations is the SELECTED one — never trust DOM order for the id
    const sourceItemId = await page.evaluate(() => {
      const sel = document.querySelector(".react-flow__node.selected");
      const id = parseInt((sel?.getAttribute("data-id") ?? "").replace("item-", ""), 10);
      return isNaN(id) ? -1 : id; // -1 keeps the later SQL harmless
    });
    check("L0 click selected a filled node", sourceItemId > 0, `item=${sourceItemId}`);
    const varBtn = await page.evaluate(() => {
      const b = document.querySelector('button[aria-label="Variations"]');
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    check("L1 Variations toolbar action present", !!varBtn);
    if (varBtn) {
      await page.mouse.click(varBtn.x, varBtn.y);
      // The popover's total is plan-derived: 2 candidates × castingImage(350)
      let costShown = false;
      for (let i = 0; i < 12; i++) {
        await sleep(400);
        if (await bodyIncludes("~700 credits")) { costShown = true; break; }
      }
      check("L2 popover shows the plan-derived total (~700 credits at 2)", costShown);

      const countBefore = await nodeCount();
      await clickByText("Generate");
      // Two optimistic temps, essentially immediately
      let tempsAtMs = -1;
      const t0 = Date.now();
      for (let i = 0; i < 30; i++) {
        if ((await nodeCount()) >= countBefore + 2) { tempsAtMs = Date.now() - t0; break; }
        await sleep(50);
      }
      check("L3 two candidate temps render immediately (<1.5s)", tempsAtMs >= 0 && tempsAtMs < 1500, `${tempsAtMs}ms`);

      console.log("   L: generating 2 variations (real, ~700 credits)...");
      const countDuring = await nodeCount();
      let vanished = false;
      let landed = 0;
      for (let i = 0; i < 120; i++) {
        await sleep(1000);
        if ((await nodeCount()) < countDuring) vanished = true;
        const [rows] = await conn.execute(
          `SELECT COUNT(*) AS n FROM board_edges e JOIN board_items i ON i.id = e.targetItemId
           WHERE e.boardId = ? AND e.sourceItemId = ? AND e.relation = 'variant_of'
             AND i.deletedAt IS NULL AND i.imageUrl IS NOT NULL`,
          [boardId, sourceItemId],
        );
        landed = Number((rows as Array<{ n: number }>)[0].n);
        if (landed >= 2) break;
      }
      check("L4 temps never vanished during generation", !vanished);
      check("L5 two siblings landed with variant_of edges", landed === 2, `landed=${landed}`);

      // DOM reveal trails the DB rows by a refetch — poll briefly
      let domLanded = false;
      for (let i = 0; i < 10; i++) {
        domLanded = await page.evaluate((n: number) => {
          const withImg = [...document.querySelectorAll(".react-flow__node")].filter(
            (el) => el.querySelector("img")?.getAttribute("src"),
          );
          return withImg.length >= n;
        }, 3); // source + 2 candidates (+K's duplicate also counts, so ≥3 is safe)
        if (domLanded) break;
        await sleep(1000);
      }
      check("L6 candidates visible on the board", domLanded);

      // Ledger: exactly the landed count was kept (700 for 2; failures refund)
      await sleep(2000);
      const [lBal1] = await conn.execute(`SELECT balance FROM points WHERE userId = ?`, [userId]);
      const lNet = lBalanceStart - (lBal1 as Array<{ balance: number }>)[0].balance;
      check("L7 ledger net = 700 (2 × castingImage, no silent charges)", lNet === 700, `net=${lNet}`);

      // The $returningId class: no generation rows stuck processing
      const [stuck] = await conn.execute(
        `SELECT COUNT(*) AS n FROM generations
         WHERE userId = ? AND status = 'processing' AND createdAt > NOW() - INTERVAL 10 MINUTE`,
        [userId],
      );
      check("L8 no generations stuck 'processing'", Number((stuck as Array<{ n: number }>)[0].n) === 0);
    }
  }
}

// ── Invariant R: per-tile refresh, paid leg — RUN_PAID_INVARIANTS incl. R ──
// Rides on a REAL minted package (G's mint, or any prior paid run): the tile
// popover's Refresh is plan-priced, execute writes a NEW asset row
// (newest-wins), and the ledger nets exactly the slot cost. The gate-fail
// refund path shares generatePackageSlot with the mint — invariant I plus the
// refreshSlots unit tests are its always-on guards.
if (!paidEnabled("R")) {
  console.log("SKIP  R — paid invariant (one slot refresh; ~300 credits)");
} else {
  const [mRows] = await conn.execute(
    `SELECT m.id FROM models m
     WHERE m.userId = ? AND m.agencyId IS NOT NULL AND m.status IN ('active','locked')
       AND EXISTS (SELECT 1 FROM model_assets a WHERE a.modelId = m.id AND a.viewType = 'frontClose' AND a.storageUrl LIKE 'http%')
       AND EXISTS (SELECT 1 FROM model_assets a WHERE a.modelId = m.id AND a.viewType = 'sideClose' AND a.storageUrl LIKE 'http%')
       AND m.agencyId != 'MOD-26-DRIVE1'
     ORDER BY m.id DESC LIMIT 1`,
    [userId],
  );
  const realModelId = (mRows as Array<{ id: number }>)[0]?.id;
  if (!realModelId) {
    console.log("SKIP  R — no real minted package on the verify-bot (run G first)");
  } else {
    const [urlRows] = await conn.execute(
      `SELECT storageUrl FROM model_assets WHERE modelId = ? AND viewType = 'frontClose' AND storageUrl != '' ORDER BY createdAt DESC, id DESC LIMIT 1`,
      [realModelId],
    );
    const headUrl = (urlRows as Array<{ storageUrl: string }>)[0].storageUrl;
    const [riRes] = await conn.execute(
      `INSERT INTO board_items (boardId, type, kind, label, imageUrl, positionX, positionY, width, height, zIndex, metadata, sourceModelId)
       VALUES (?, 'model', 'image', 'Drive Refresh', ?, 2000, 120, 280, 420, 0, ?, ?)`,
      [
        boardId,
        headUrl,
        JSON.stringify({ provenance: { type: "library_cast", modelId: realModelId, viewAngle: "frontClose" }, version: 1 }),
        realModelId,
      ],
    );
    const rItemId = (riRes as { insertId: number }).insertId;
    await conn.execute(`UPDATE boards SET viewportX = NULL, viewportY = NULL, viewportZoom = NULL WHERE id = ?`, [boardId]);
    await page.goto(`${BASE}/app/board/${boardId}`, { waitUntil: "networkidle2", timeout: 60000 });
    await page.waitForSelector('button[aria-label="Select"]', { timeout: 90000 });
    await sleep(1500);

    const [cntRows] = await conn.execute(
      `SELECT COUNT(*) AS n FROM model_assets WHERE modelId = ? AND viewType = 'sideClose' AND storageUrl != ''`,
      [realModelId],
    );
    const rowsBefore = (cntRows as Array<{ n: number }>)[0].n;
    const [balRows] = await conn.execute(`SELECT balance FROM points WHERE userId = ?`, [userId]);
    const balBefore = (balRows as Array<{ balance: number }>)[0].balance;

    const tile = await page.evaluate((sel: string) => {
      const node = document.querySelector(sel);
      if (!node) return null;
      const t = [...node.querySelectorAll("button")].find(
        (b) => (b as HTMLElement).style.gridArea === "side",
      ) as HTMLElement | undefined;
      if (!t) return null;
      const r = t.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, `.react-flow__node[data-id="item-${rItemId}"]`);
    check("R1 real package renders its comp card", !!tile);
    if (tile) {
      await page.mouse.click(tile.x, tile.y);
      await sleep(800);
      const refreshBtn = await page.evaluate(() => {
        const b = [...document.querySelectorAll("button")].find((el) => el.textContent?.trim().startsWith("Refresh"));
        if (!b) return null;
        return { priced: /~\s?300\s.*credits|~300/.test(b.textContent ?? ""), disabled: (b as HTMLButtonElement).disabled };
      });
      check("R2 Refresh is plan-priced in the popover (~300, D-15)", !!refreshBtn && refreshBtn.priced && !refreshBtn.disabled, JSON.stringify(refreshBtn));
      await page.evaluate(() => {
        const b = [...document.querySelectorAll("button")].find((el) => el.textContent?.trim().startsWith("Refresh"));
        (b as HTMLElement | undefined)?.click();
      });
      console.log("   R: refreshing sideClose (real, ~300 credits)...");
      let newRow = false;
      for (let i = 0; i < 120 && !newRow; i++) {
        await sleep(1000);
        const [after] = await conn.execute(
          `SELECT COUNT(*) AS n FROM model_assets WHERE modelId = ? AND viewType = 'sideClose' AND storageUrl != ''`,
          [realModelId],
        );
        newRow = (after as Array<{ n: number }>)[0].n === rowsBefore + 1;
      }
      check("R3 refresh wrote a NEW asset row (newest-wins read model)", newRow);
      const [balAfter] = await conn.execute(`SELECT balance FROM points WHERE userId = ?`, [userId]);
      const net = balBefore - (balAfter as Array<{ balance: number }>)[0].balance;
      check("R4 ledger nets exactly the slot cost (300)", net === 300, `net=${net}`);
    }
  }
}

// ── Invariant T: cosmetic iterate keeps every package slot — VC-R5 F1 ──────
// The pre-package ladder dropped sibling views from the CLIENT session on
// iterate success (rows were always alive — the strip lied against the
// ledger). Paid (~350cr): open the seeded minted package's environment,
// iterate the active view cosmetically, assert the strip keeps its slots
// and the ledger grew by exactly one row for the edited angle.
if (!paidEnabled("T")) {
  console.log("SKIP  T — paid invariant (one cosmetic iterate; ~350 credits)");
} else if (!seededItemId || !seededModelId) {
  console.log("SKIP  T — no seeded package this run");
} else {
  await page.goto(`${BASE}/app/board/${boardId}`, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForSelector('button[aria-label="Select"]', { timeout: 90000 });
  await sleep(2000);
  const tSel = `.react-flow__node[data-id="item-${seededItemId}"]`;
  for (let i = 0; i < 12; i++) {
    const rect = await page.evaluate((sel: string) => {
      const n = document.querySelector(sel);
      if (!n) return null;
      const r = n.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width };
    }, tSel);
    if (!rect || (rect.w >= 240 && rect.w <= 420)) break;
    await page.mouse.move(rect.x, rect.y);
    await page.mouse.wheel({ deltaY: rect.w < 240 ? -240 : 240 });
    await sleep(350);
  }
  const tLabel = await page.evaluate((sel: string) => {
    const n = document.querySelector(sel);
    if (!n) return null;
    const r = n.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + 8 };
  }, tSel);
  await page.mouse.click(tLabel!.x, tLabel!.y);
  await sleep(500);
  const tEditOpened = await clickByText("Edit");
  const tHydrated = tEditOpened && (await waitEditHydrated());
  check("T0 environment opened + hydrated on the seeded package", tHydrated);
  if (tHydrated) {
    // Small-thumb census: the view strip's thumbnails (the F1 casualty)
    const countThumbs = () =>
      page.evaluate(
        () =>
          [...document.querySelectorAll("img")].filter((img) => {
            const r = img.getBoundingClientRect();
            return r.width > 8 && r.width < 100 && r.height > 8;
          }).length,
      );
    const thumbsBefore = await countThumbs();
    const [rowsB] = await conn.execute(
      `SELECT COUNT(*) AS n FROM model_assets WHERE modelId = ? AND viewType = 'frontClose' AND storageUrl != ''`,
      [seededModelId],
    );
    const frontRowsBefore = (rowsB as Array<{ n: number }>)[0].n;
    const [balB] = await conn.execute(`SELECT balance FROM points WHERE userId = ?`, [userId]);
    const tBalBefore = (balB as Array<{ balance: number }>)[0].balance;

    // "/" focuses the refine bar; a cosmetic edit passes the A1 seal
    await page.keyboard.press("/");
    await sleep(300);
    await page.keyboard.type("brighten the lighting slightly", { delay: 15 });
    await page.keyboard.press("Enter");
    console.log("   T: iterating (real, ~350 credits)...");
    let newRow = false;
    for (let i = 0; i < 90 && !newRow; i++) {
      await sleep(1000);
      const [rowsA] = await conn.execute(
        `SELECT COUNT(*) AS n FROM model_assets WHERE modelId = ? AND viewType = 'frontClose' AND storageUrl != ''`,
        [seededModelId],
      );
      newRow = (rowsA as Array<{ n: number }>)[0].n === frontRowsBefore + 1;
    }
    check("T1 cosmetic iterate allowed on minted + wrote ONE new row (D-53)", newRow);
    await sleep(1500);
    const thumbsAfter = await countThumbs();
    check(
      "T2 sibling views SURVIVE the iterate (the strip never lies against the ledger)",
      thumbsAfter >= thumbsBefore,
      `thumbs ${thumbsBefore} → ${thumbsAfter}`,
    );
    const tPkg = await page.evaluate(async (mid: number) => {
      const res = await fetch(
        `/api/trpc/generation.packageState?input=${encodeURIComponent(JSON.stringify({ json: { modelId: mid } }))}`,
        { credentials: "include" },
      );
      const data = await res.json();
      const slots = data?.result?.data?.json?.slots ?? [];
      return slots.filter((s: { filled: boolean }) => s.filled).length;
    }, seededModelId);
    check("T3 packageState still reports every slot filled", tPkg === 4, `${tPkg} filled`);
    const [balA] = await conn.execute(`SELECT balance FROM points WHERE userId = ?`, [userId]);
    const tNet = tBalBefore - (balA as Array<{ balance: number }>)[0].balance;
    check("T4 ledger nets exactly the iterate cost (350)", tNet === 350, `net=${tNet}`);
    await closeTakeoverCleanly();
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
