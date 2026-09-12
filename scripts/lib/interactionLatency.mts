/**
 * CLICK → FIRST VISIBLE CHANGE, measured on the customer's own hand (#555).
 *
 * The founder, 2026-09-05, verbatim: *"does the machinist measure things like
 * how long a click takes to register? e.g if i click keep on a cast tile it
 * can take around 2 seconds to show up in the prompt box."* It did not. The
 * ledger measured the roll's server-side numbers and nothing the hand feels;
 * the Keep case he found became #554 (fixed — the dock strip now reads the
 * optimistic list), and this is the instrument that would have found it.
 *
 * # What one reading is
 *
 * `performance.now()` at the click, a `MutationObserver` over the document,
 * and a PROBE — a small function of the clicked element that returns the
 * state of the thing the action is supposed to change (is there a ring on
 * this tile; how many faces are in the dock; how many skeletons are in the
 * grid). The reading is the delta to the first mutation batch after which the
 * probe's answer DIFFERS from its answer before the click, and then the next
 * animation frame — the frame that paints it. Two numbers per reading:
 *
 *   mutationMs  the DOM changed (a microtask after the change)
 *   frameMs     the change was painted (the next rAF) — THE customer number
 *
 * The probe is what keeps this honest. A page mutates constantly — a clock, a
 * poll, an image decoding — and an observer that resolved on ANY mutation
 * would read a Keep as instant because something else moved. The controls
 * below prove that: a page with a ticking clock beside the target must still
 * read the slow action as slow.
 *
 * # What one probe cannot see
 *
 * - A change that lands and is reverted between two observer callbacks. The
 *   observer batches per microtask checkpoint, so this is a change that never
 *   painted, and not reading it is correct.
 * - Paint itself. `requestAnimationFrame` fires BEFORE the frame is composited,
 *   so `frameMs` is the frame the change is committed to, not the moment
 *   pixels reach the glass. A few milliseconds under, never over.
 * - A change outside the probe. Keep changes three things (ring, dock, count)
 *   and this reads the two the card names; a third surface moving late is a
 *   separate probe, not a wider one.
 *
 * # The bars
 *
 * The card's own: an OPTIMISTIC action paints under 100 ms (it is a
 * `setState` in the click's own task — React flushes discrete events
 * synchronously, so the honest expectation is one frame); a SERVER-BOUND one
 * under 1 s, or the ledger says why. Which bar an action is judged against is
 * declared on the action, not inferred from the number — a server-bound
 * action reading 40 ms is a finding about the classification, not a pass.
 *
 * # Spending
 *
 * Roll again, Follow and Retry render for real when clicked in the real
 * product, so the walk measures them only under `--spend`; the driver asks the
 * spend door (`spendAuthorized`), which is what puts it in the swept
 * population (#345). Keep and Unkeep are free.
 */
import type { Page } from "puppeteer-core";

/* ───────────────────────────── the vocabulary ───────────────────────────── */

/** Which bar a probe is judged against. Declared, never inferred. */
export type Bar = "optimistic" | "server-bound";

export const BAR_MS: Record<Bar, number> = {
  optimistic: 100,
  "server-bound": 1000,
};

/**
 * A probe: what to read, before and after the click.
 *
 * `source` is the BODY of a function `(target) => any` evaluated in the page;
 * it must return something `JSON.stringify` can compare. Kept as source
 * because puppeteer serialises arguments, not closures.
 *
 * Every source compiled in the page is a CONSTANT of this module. None is
 * built from an argument, an environment variable or anything an operator
 * types — the strict parse never reaches them — so `new Function` here is
 * the same act as `page.evaluate(string)` and carries the same trust: the
 * page is the driver's own, on a server the driver was pointed at.
 */
export type Probe = {
  readonly name: string;
  readonly bar: Bar;
  readonly source: string;
};

/** One click, one or more probes. */
export type Action = {
  readonly name: string;
  /** Body of `() => Element | null` — the thing to click, or null if absent. */
  readonly find: string;
  readonly probes: readonly Probe[];
  /** Renders for real in the product; measured only under `--spend`. */
  readonly spends: boolean;
  /** How long to wait for the probe to move before calling it a timeout. */
  readonly timeoutMs: number;
};

/** What one probe read on one click. */
export type ProbeReading =
  | { kind: "changed"; mutationMs: number; frameMs: number; before: string; after: string }
  | { kind: "timeout"; waitedMs: number; before: string };

export type ClickReading =
  | { kind: "absent"; action: string }
  | { kind: "read"; action: string; probes: Record<string, ProbeReading> };

/* ────────────────────────── the browser-side reader ─────────────────────── */

/**
 * The function that runs INSIDE the page. Written as a string so the
 * TypeScript here is never bundled into the page and the page never sees a
 * transpiler's idea of it — what runs is exactly what is read here.
 *
 * Contract: `find` and every probe body are compiled with `new Function`;
 * the click happens once; each probe resolves at ITS first change, or at the
 * shared timeout. A synchronous change (the optimistic case) still arrives
 * through the observer as a microtask, so nothing special-cases it.
 */
const READER_SOURCE = String.raw`
(findSource, probes, timeoutMs) => {
  const find = new Function(findSource);
  const target = find();
  if (!target) return { kind: "absent" };
  const compiled = probes.map((p) => ({ name: p.name, read: new Function("target", p.source) }));
  const before = {};
  for (const p of compiled) before[p.name] = JSON.stringify(p.read(target));
  return new Promise((resolve) => {
    const out = {};
    let pending = compiled.length;
    let finished = false;
    let observer = null;
    let timer = null;
    let t0 = 0;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (observer) observer.disconnect();
      if (timer !== null) clearTimeout(timer);
      resolve({ kind: "read", probes: out });
    };
    observer = new MutationObserver(() => {
      const at = performance.now() - t0;
      for (const p of compiled) {
        if (out[p.name]) continue;
        let now;
        try { now = JSON.stringify(p.read(target)); } catch (e) { now = "probe threw: " + String(e); }
        if (now === before[p.name]) continue;
        const mutationMs = at;
        out[p.name] = { kind: "changed", mutationMs, frameMs: -1, before: before[p.name], after: now };
        requestAnimationFrame(() => {
          out[p.name].frameMs = performance.now() - t0;
          pending -= 1;
          if (pending === 0) finish();
        });
      }
    });
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
    timer = setTimeout(() => {
      for (const p of compiled) {
        if (!out[p.name]) out[p.name] = { kind: "timeout", waitedMs: timeoutMs, before: before[p.name] };
        /* A change whose frame never came (a throttled tab): the mutation time
           stands in, and it is under, never over. */
        else if (out[p.name].frameMs < 0) out[p.name].frameMs = out[p.name].mutationMs;
      }
      finish();
    }, timeoutMs);
    t0 = performance.now();
    target.click();
  });
}`;

/**
 * Click once, read every probe. The page must already be on the surface.
 */
export async function measureClick(page: Page, action: Action): Promise<ClickReading> {
  /*
    Two frames first, so the reading is of the CLICK and not of a page that
    has not painted its first frame yet. Measured on the controls: a fresh
    headless page's first `requestAnimationFrame` came 165–580 ms after
    `setContent`, which would have read an instant action as a slow one.
  */
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  const result = (await page.evaluate(
    `(${READER_SOURCE})(${JSON.stringify(action.find)}, ${JSON.stringify(
      action.probes.map((p) => ({ name: p.name, source: p.source })),
    )}, ${action.timeoutMs})`,
  )) as { kind: "absent" } | { kind: "read"; probes: Record<string, ProbeReading> };
  if (result.kind === "absent") return { kind: "absent", action: action.name };
  return { kind: "read", action: action.name, probes: result.probes };
}

/* ───────────────────────────── the sheet's actions ──────────────────────── */

/**
 * The deepest button whose visible text matches, inside an optional root.
 * Deepest, because a wrapper div around a button also "contains" the text
 * (the verify skill's own gotcha).
 */
const FIND_BUTTON = (pattern: string, rootSelector = "") => String.raw`
  const root = ${rootSelector ? `document.querySelector(${JSON.stringify(rootSelector)})` : "document"};
  if (!root) return null;
  const re = new RegExp(${JSON.stringify(pattern)}, "i");
  return Array.from(root.querySelectorAll("button")).find((b) => !b.disabled && re.test((b.innerText || "").trim())) || null;
`;

/*
  A tile is `.dpc-tile` — the picture (`.dpc-card`), its caption and the
  Keep / Follow / Discard row are three siblings under it (`CandidateTile.tsx`,
  *"the action row sits under the card"*). The ring lands inside the picture;
  the button is in the row; `closest` from the button therefore walks to the
  TILE, never to the card, which is one level too deep and holds no button.
*/
const TILE_RING = String.raw`
  const tile = target.closest(".dpc-tile");
  return tile ? !!tile.querySelector(".dpc-card__ring") : "no tile";
`;
const DOCK_FACES = String.raw`return document.querySelectorAll(".dpc-keptstack__chip").length;`;
const GRID_SKELETONS = String.raw`return document.querySelectorAll(".dp-skeleton").length;`;
const RAIL_PROVISIONAL = String.raw`return document.querySelectorAll(".dpc-rollrail__item--provisional").length;`;
/*
  The chip's TEXT, not its presence: the chip is derived from the roll on
  screen (`standingFollowId` ← `roll.data.lineage`), so on a sheet whose live
  roll is already a follow it is up BEFORE the click, and a presence probe
  reads only the moment it blinks while the sheet switches rolls. The text
  names the followed face, so a fresh follow reads its appearance and a
  re-follow reads its relabel — both the moment the sheet is on the new roll.
*/
const FOLLOWING_CHIP = String.raw`
  const chip = document.querySelector(".dpc-following__chip");
  return chip ? chip.textContent : null;
`;
const TILE_FACE = String.raw`
  const tile = target.closest(".dpc-tile") || target.closest(".dpc-card");
  if (!tile) return "no tile";
  return { skeleton: !!tile.querySelector(".dp-skeleton"), image: !!tile.querySelector("img"), retry: !!Array.from(tile.querySelectorAll("button")).find((b) => /retry/i.test(b.innerText || "")) };
`;
/*
  A chip edit lands in one of two places by road (`chipEdit.ts`): on the
  author road it rewrites the BOX; on the house road it queues an override
  the SENTENCE draws as "20s → 50s · next roll". One probe reads both, so the
  row is honest on either road rather than reading the house road's answer
  as a timeout.
*/
const BRIEF_BOX_OR_SENTENCE = String.raw`
  const box = document.querySelector("textarea");
  const echo = document.querySelector(".dpc-echo");
  return { box: box ? box.value : "no box", sentence: echo ? echo.textContent : "no sentence" };
`;

/**
 * THE SHEET'S ACTIONS, each named the way the card names them.
 *
 * Keep and Unkeep read the tile's ring and the dock's faces — the two surfaces
 * #554 was about. Roll again reads the first skeleton. Follow reads the rail's
 * provisional pill and the family chip. Retry reads the failed tile's own face
 * (skeleton, image, or still the retry button). A chip edit reads the brief
 * box AND the sentence, because the two roads answer in different places.
 *
 * ⚠ THE CHIP EDIT DOES NOT EXIST ON THE AUTHOR ROAD. Since #535 the reading
 * sentence draws no pickers (`BriefEcho.tsx`: *"the prompt box below is the
 * only editor"*), so on the live road `find` returns null and the row reads
 * ABSENT. That is the honest reading and the walk says so rather than
 * inventing a chip to click. On the house road the picker exists and the
 * action is a two-step (open the picker, choose); only the choosing click is
 * measured, and `find` returns the first option that is not the current one.
 */
export const SHEET_ACTIONS: readonly Action[] = [
  {
    name: "keep",
    find: FIND_BUTTON("^keep$"),
    probes: [
      { name: "keep → tile ring", bar: "optimistic", source: TILE_RING },
      { name: "keep → dock face", bar: "optimistic", source: DOCK_FACES },
    ],
    spends: false,
    timeoutMs: 5000,
  },
  {
    name: "unkeep",
    find: FIND_BUTTON("^kept$"),
    probes: [
      { name: "unkeep → tile ring", bar: "optimistic", source: TILE_RING },
      { name: "unkeep → dock face", bar: "optimistic", source: DOCK_FACES },
    ],
    spends: false,
    timeoutMs: 5000,
  },
  {
    name: "roll again",
    find: FIND_BUTTON("^roll again$"),
    probes: [{ name: "roll again → first skeleton", bar: "optimistic", source: GRID_SKELETONS }],
    spends: true,
    timeoutMs: 60000,
  },
  {
    name: "follow",
    find: FIND_BUTTON("^follow", ".dpc-tile"),
    probes: [
      { name: "follow → rail pill", bar: "optimistic", source: RAIL_PROVISIONAL },
      /*
        The chip is drawn when the NEW roll exists (`standingFollowId`), and
        the roll exists only after the interpreter has run (9 s measured on
        the house road, 1–13 s across the day's readings) and the sheet's next
        poll has seen it. A 10 s window read that as a timeout on the first
        baseline; a minute reads the number, which is the point.
      */
      { name: "follow → family chip", bar: "server-bound", source: FOLLOWING_CHIP },
    ],
    spends: true,
    timeoutMs: 60000,
  },
  {
    name: "retry",
    find: FIND_BUTTON("^retry", ".dpc-tile, .dpc-card"),
    probes: [{ name: "retry → tile face", bar: "server-bound", source: TILE_FACE }],
    spends: true,
    timeoutMs: 60000,
  },
  {
    name: "chip edit",
    find: String.raw`
      const option = Array.from(document.querySelectorAll('.dpc-echo [role="option"], .dpc-echo [role="menuitem"], .dpc-echo [role="menuitemradio"]'))
        .find((o) => o.getAttribute("aria-selected") !== "true" && o.getAttribute("aria-checked") !== "true");
      return option || null;
    `,
    probes: [{ name: "chip edit → the box or the sentence", bar: "optimistic", source: BRIEF_BOX_OR_SENTENCE }],
    spends: false,
    timeoutMs: 5000,
  },
];

/** The picker's opener, for the two-step chip edit. Null on the author road. */
export const CHIP_PICKER_OPENER = String.raw`return document.querySelector(".dpc-echo button") || null;`;

/* ──────────────────────────────── statistics ────────────────────────────── */

/** Nearest-rank percentile over a sample; `null` on an empty one. */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.max(0, Math.min(sorted.length, rank) - 1)] ?? null;
}

export type ProbeSummary = {
  readonly probe: string;
  readonly bar: Bar;
  readonly n: number;
  readonly p50: number | null;
  readonly p95: number | null;
  readonly max: number | null;
  readonly timeouts: number;
  /** null when nothing was read; otherwise whether p95 is under the bar. */
  readonly underBar: boolean | null;
  /** Why there is no number, when there is none. */
  readonly note: string;
};

/**
 * Fold every click's readings into one row per probe.
 *
 * `frameMs` is the number summarised — the customer's — and a timeout counts
 * as a timeout, never as a large number: a Keep that never painted is a
 * different fault from a slow one, and averaging the two hides both.
 */
export function summarise(
  actions: readonly Action[],
  readings: readonly ClickReading[],
  notes: Readonly<Record<string, string>> = {},
): ProbeSummary[] {
  const rows: ProbeSummary[] = [];
  for (const action of actions) {
    const ofAction = readings.filter((r) => r.action === action.name);
    const absent = ofAction.length > 0 && ofAction.every((r) => r.kind === "absent");
    for (const probe of action.probes) {
      const frames: number[] = [];
      let timeouts = 0;
      for (const r of ofAction) {
        if (r.kind !== "read") continue;
        const one = r.probes[probe.name];
        if (!one) continue;
        if (one.kind === "changed") frames.push(one.frameMs);
        else timeouts += 1;
      }
      const p95 = percentile(frames, 95);
      const note =
        notes[action.name] ??
        (ofAction.length === 0
          ? "not measured"
          : absent
            ? "absent — nothing to click on this sheet"
            : frames.length === 0 && timeouts > 0
              ? "never changed within the wait"
              : "");
      rows.push({
        probe: probe.name,
        bar: probe.bar,
        n: frames.length,
        p50: percentile(frames, 50),
        p95,
        max: frames.length ? Math.max(...frames) : null,
        timeouts,
        underBar: p95 === null ? null : p95 <= BAR_MS[probe.bar],
        note,
      });
    }
  }
  return rows;
}

/** The ledger's table, exactly as it is pasted. */
export function renderTable(rows: readonly ProbeSummary[]): string {
  const ms = (v: number | null) => (v === null ? "—" : `${v.toFixed(0)} ms`);
  const lines = [
    "| action → what changes | bar | n | p50 | p95 | max | verdict |",
    "|---|---|---|---|---|---|---|",
  ];
  for (const r of rows) {
    const verdict =
      r.underBar === null
        ? r.note || "—"
        : `${r.underBar ? "under" : "OVER"} ${BAR_MS[r.bar]} ms${r.timeouts ? ` · ${r.timeouts} timeout(s)` : ""}${r.note ? ` · ${r.note}` : ""}`;
    lines.push(`| ${r.probe} | ${r.bar} | ${r.n} | ${ms(r.p50)} | ${ms(r.p95)} | ${ms(r.max)} | ${verdict} |`);
  }
  return lines.join("\n");
}

/* ─────────────────────────────── the controls ───────────────────────────── */

/**
 * THE INSTRUMENT'S OWN PROOF (working law 2), needing no server and no
 * credits, so it runs in the gate on every pull request.
 *
 * A page with four buttons and a clock ticking every 50 ms beside them —
 * the clock is the negative control: an observer that resolved on ANY
 * mutation would read every button as instant.
 *
 *   #instant  writes the target synchronously            → under 100 ms
 *   #slow     writes it after 2000 ms                     → about 2000 ms
 *   #never    writes nothing                              → timeout
 *   (absent)  a find that matches nothing                 → absent
 */
export const CONTROL_PAGE = `<!doctype html>
<html><body>
  <div id="clock">0</div>
  <div id="out">before</div>
  <button id="instant">instant</button>
  <button id="slow">slow</button>
  <button id="never">never</button>
  <script>
    /* An IIFE, because setContent writes into the SAME document and a
       top-level let declared twice throws before the listeners attach —
       which read as two timeouts on this instrument's first run. */
    (() => {
    let ticks = 0;
    setInterval(() => { ticks += 1; document.getElementById("clock").textContent = String(ticks); }, 50);
    document.getElementById("instant").addEventListener("click", () => {
      document.getElementById("out").textContent = "instant";
    });
    document.getElementById("slow").addEventListener("click", () => {
      setTimeout(() => { document.getElementById("out").textContent = "slow"; }, 2000);
    });
    })();
  </script>
</body></html>`;

const OUT_PROBE = String.raw`return document.getElementById("out").textContent;`;

export const CONTROL_ACTIONS: readonly Action[] = [
  {
    name: "instant",
    find: String.raw`return document.getElementById("instant");`,
    probes: [{ name: "instant", bar: "optimistic", source: OUT_PROBE }],
    spends: false,
    timeoutMs: 3000,
  },
  {
    name: "slow",
    find: String.raw`return document.getElementById("slow");`,
    probes: [{ name: "slow", bar: "server-bound", source: OUT_PROBE }],
    spends: false,
    timeoutMs: 4000,
  },
  {
    name: "never",
    find: String.raw`return document.getElementById("never");`,
    probes: [{ name: "never", bar: "optimistic", source: OUT_PROBE }],
    spends: false,
    timeoutMs: 1500,
  },
  {
    name: "absent",
    find: String.raw`return document.getElementById("does-not-exist");`,
    probes: [{ name: "absent", bar: "optimistic", source: OUT_PROBE }],
    spends: false,
    timeoutMs: 1000,
  },
];

export type ControlVerdict = { readonly control: string; readonly ok: boolean; readonly saw: string };

/**
 * Judge the four control readings. Pure, so the judgement itself has arms.
 *
 * The slow bound is wide on the high side (2000 → 2600) because a headless
 * browser under a loaded CI runner can defer a 2 s timer; it is TIGHT on the
 * low side (1900) because reading a 2 s action as anything quicker is the
 * exact failure the clock is there to provoke.
 */
export function judgeControls(readings: readonly ClickReading[]): ControlVerdict[] {
  const byName = new Map(readings.map((r) => [r.action, r] as const));
  const probe = (action: string): ProbeReading | null => {
    const r = byName.get(action);
    return r && r.kind === "read" ? (r.probes[action] ?? null) : null;
  };
  const instant = probe("instant");
  const slow = probe("slow");
  const never = probe("never");
  const absent = byName.get("absent");
  return [
    {
      control: "an instant change reads under 100 ms",
      ok: instant?.kind === "changed" && instant.frameMs < 100 && instant.after === JSON.stringify("instant"),
      saw: describe(instant),
    },
    {
      control: "a change 2 s later reads as 2 s (the ticking clock beside it must not count)",
      ok: slow?.kind === "changed" && slow.mutationMs >= 1900 && slow.mutationMs <= 2600 && slow.after === JSON.stringify("slow"),
      saw: describe(slow),
    },
    {
      control: "a click that changes nothing reads as a timeout, never a number",
      ok: never?.kind === "timeout",
      saw: describe(never),
    },
    {
      control: "a target that is not on the page reads as absent",
      ok: absent?.kind === "absent",
      saw: absent ? absent.kind : "no reading",
    },
  ];
}

function describe(r: ProbeReading | null): string {
  if (!r) return "no reading";
  if (r.kind === "timeout") return `timeout after ${r.waitedMs} ms (before ${r.before})`;
  return `changed at ${r.mutationMs.toFixed(1)} ms, painted at ${r.frameMs.toFixed(1)} ms (${r.before} → ${r.after})`;
}
