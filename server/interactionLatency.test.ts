/**
 * THE INTERACTION-LATENCY INSTRUMENT'S PURE HALF (#555).
 *
 * The browser half — the reader that clicks and watches — is proved by
 * `scripts/drive-interaction-latency.mts --controls`, which runs in the gate
 * against a synthetic page (an instant action, a 2 s one, one that never
 * changes anything, one that is not there, and a clock ticking beside them).
 * What that run cannot cheaply prove is the JUDGEMENT laid over the readings:
 * that a timeout is never folded into a percentile as a large number, that an
 * absent action says so rather than reading as fast, that the control judge
 * itself can fail, and that the probe sources the page will compile are
 * functions and not typos. Those arms are here, with no browser.
 */
import { describe, expect, it } from "vitest";

import {
  BAR_MS,
  CONTROL_ACTIONS,
  CONTROL_PAGE,
  judgeControls,
  percentile,
  renderTable,
  SHEET_ACTIONS,
  summarise,
  type Action,
  type ClickReading,
} from "../scripts/lib/interactionLatency.mts";

const changed = (frameMs: number, before = "0", after = "1") =>
  ({ kind: "changed", mutationMs: frameMs - 1, frameMs, before, after }) as const;
const timeout = (waitedMs = 5000) => ({ kind: "timeout", waitedMs, before: "0" }) as const;

const ONE: Action = {
  name: "one",
  find: "return null;",
  probes: [
    { name: "one → a", bar: "optimistic", source: "return 1;" },
    { name: "one → b", bar: "server-bound", source: "return 1;" },
  ],
  spends: false,
  timeoutMs: 1000,
};

describe("percentile (nearest rank)", () => {
  it("is null on an empty sample and exact on a small one", () => {
    expect(percentile([], 50)).toBeNull();
    expect(percentile([7], 50)).toBe(7);
    expect(percentile([7], 95)).toBe(7);
    expect(percentile([3, 1, 2], 50)).toBe(2);
    expect(percentile([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 95)).toBe(100);
    expect(percentile([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 50)).toBe(50);
  });
});

describe("summarise — one row per probe, judged against its declared bar", () => {
  it("folds frame times, judges p95 against the bar, and counts timeouts apart from the numbers", () => {
    const readings: ClickReading[] = [
      { kind: "read", action: "one", probes: { "one → a": changed(20), "one → b": changed(400) } },
      { kind: "read", action: "one", probes: { "one → a": changed(30), "one → b": timeout() } },
      { kind: "read", action: "one", probes: { "one → a": changed(150), "one → b": changed(900) } },
    ];
    const [a, b] = summarise([ONE], readings);
    expect(a).toMatchObject({ probe: "one → a", bar: "optimistic", n: 3, p50: 30, p95: 150, max: 150, timeouts: 0, underBar: false });
    /*
      The timeout is NOT a 5000 in the sample: n is 2, p95 is 900 and under the
      1000 ms bar, and the timeout is its own count. A Keep that never painted
      is a different fault from a slow one, and averaging the two hides both.
    */
    expect(b).toMatchObject({ probe: "one → b", bar: "server-bound", n: 2, p50: 400, p95: 900, timeouts: 1, underBar: true });
  });

  it("an action that was absent every time reads as absent, never as fast", () => {
    const [a] = summarise([ONE], [{ kind: "absent", action: "one" }]);
    expect(a).toMatchObject({ n: 0, p50: null, p95: null, underBar: null, timeouts: 0 });
    expect(a!.note).toMatch(/absent/);
  });

  it("an action never attempted reads 'not measured', and a caller's note wins over the derived one", () => {
    const [plain] = summarise([ONE], []);
    expect(plain!.note).toBe("not measured");
    const [noted] = summarise([ONE], [], { one: "not measured — renders for real; pass --spend" });
    expect(noted!.note).toBe("not measured — renders for real; pass --spend");
  });

  it("a probe that only ever timed out says so instead of showing a dash with no reason", () => {
    const readings: ClickReading[] = [{ kind: "read", action: "one", probes: { "one → a": timeout(), "one → b": timeout() } }];
    const [a] = summarise([ONE], readings);
    expect(a).toMatchObject({ n: 0, timeouts: 1, underBar: null });
    expect(a!.note).toMatch(/never changed/);
  });
});

describe("renderTable — the ledger's own shape", () => {
  it("prints a header, one row per probe, and the verdict with the bar's number in it", () => {
    const rows = summarise([ONE], [{ kind: "read", action: "one", probes: { "one → a": changed(24), "one → b": changed(1800) } }]);
    const table = renderTable(rows);
    const lines = table.split("\n");
    expect(lines[0]).toBe("| action → what changes | bar | n | p50 | p95 | max | verdict |");
    expect(lines[1]).toBe("|---|---|---|---|---|---|---|");
    expect(lines[2]).toBe(`| one → a | optimistic | 1 | 24 ms | 24 ms | 24 ms | under ${BAR_MS.optimistic} ms |`);
    expect(lines[3]).toBe(`| one → b | server-bound | 1 | 1800 ms | 1800 ms | 1800 ms | OVER ${BAR_MS["server-bound"]} ms |`);
  });

  it("an unread row carries its reason in the verdict column", () => {
    const table = renderTable(summarise([ONE], [], { one: "skipped by --only" }));
    expect(table).toContain("| one → a | optimistic | 0 | — | — | — | skipped by --only |");
  });
});

describe("judgeControls — the instrument's proof can itself fail", () => {
  const good: ClickReading[] = [
    { kind: "read", action: "instant", probes: { instant: changed(6, '"before"', '"instant"') } },
    { kind: "read", action: "slow", probes: { slow: { kind: "changed", mutationMs: 2012, frameMs: 2015, before: '"before"', after: '"slow"' } } },
    { kind: "read", action: "never", probes: { never: timeout(1500) } },
    { kind: "absent", action: "absent" },
  ];

  it("passes the four readings the real controls produce", () => {
    expect(judgeControls(good).map((v) => v.ok)).toEqual([true, true, true, true]);
  });

  it("⚠ fails the slow control when a clock beside the target is read as the change", () => {
    /*
      This is the sabotage the real controls were driven under: with the
      `now === before` comparison removed, the ticking clock resolved every
      probe at ~13 ms and the "slow" control read `"before" → "before"`.
    */
    const fooled = good.map((r) =>
      r.kind === "read" && r.action === "slow"
        ? { ...r, probes: { slow: changed(13, '"before"', '"before"') } }
        : r,
    );
    const [instant, slow] = judgeControls(fooled);
    expect(instant!.ok).toBe(true);
    expect(slow!.ok).toBe(false);
    expect(slow!.saw).toContain("13.0 ms");
  });

  it("fails the slow control when it reads too fast OR too slow, and the instant one over 100 ms", () => {
    const early = good.map((r) => (r.kind === "read" && r.action === "slow" ? { ...r, probes: { slow: changed(1500, '"before"', '"slow"') } } : r));
    expect(judgeControls(early)[1]!.ok).toBe(false);
    const late = good.map((r) => (r.kind === "read" && r.action === "slow" ? { ...r, probes: { slow: changed(2700, '"before"', '"slow"') } } : r));
    expect(judgeControls(late)[1]!.ok).toBe(false);
    const laggy = good.map((r) => (r.kind === "read" && r.action === "instant" ? { ...r, probes: { instant: changed(120, '"before"', '"instant"') } } : r));
    expect(judgeControls(laggy)[0]!.ok).toBe(false);
  });

  it("fails 'never' when it produced a number, and 'absent' when something was found", () => {
    const numbered = good.map((r) => (r.kind === "read" && r.action === "never" ? { ...r, probes: { never: changed(9) } } : r));
    expect(judgeControls(numbered)[2]!.ok).toBe(false);
    const found = good.map((r): ClickReading => (r.action === "absent" ? { kind: "read", action: "absent", probes: { absent: timeout(1000) } } : r));
    expect(judgeControls(found)[3]!.ok).toBe(false);
  });

  it("reports every control as missed when nothing was read at all", () => {
    expect(judgeControls([]).every((v) => !v.ok && v.saw === "no reading")).toBe(true);
  });
});

describe("the sources the page will compile", () => {
  /*
    Each `find` and probe body is handed to `new Function` inside the browser.
    A typo there is a runtime error in a headless page, reported as an absent
    action — the exact shape that reads as "nothing to click" rather than
    "the instrument is broken". So every body is compiled here first.
  */
  it.each([...SHEET_ACTIONS, ...CONTROL_ACTIONS].map((a) => [a.name, a] as const))("%s — find and every probe compile", (_name, action) => {
    expect(() => new Function(action.find)).not.toThrow();
    for (const probe of action.probes) expect(() => new Function("target", probe.source)).not.toThrow();
  });

  it("the rendering actions are the ones that spend, and only those", () => {
    const spenders = SHEET_ACTIONS.filter((a) => a.spends).map((a) => a.name).sort();
    expect(spenders).toEqual(["follow", "retry", "roll again"]);
  });

  it("every probe declares a bar the table knows", () => {
    for (const action of SHEET_ACTIONS) for (const probe of action.probes) expect(BAR_MS[probe.bar]).toBeGreaterThan(0);
  });

  it("the control page's script is an IIFE, so setContent cannot redeclare its top-level state", () => {
    /* The first controls run read two timeouts because `let ticks` was
       declared twice into one document. The shape is pinned. */
    expect(CONTROL_PAGE).toMatch(/\(\(\) => \{[\s\S]*let ticks = 0;[\s\S]*\}\)\(\);/);
    expect(CONTROL_PAGE).not.toContain("`");
  });
});
