import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * THE REPORTER MUST NEVER RIDE A PRODUCTION BUILD (#35).
 *
 * `pnpm build` is what the deploy rite runs. `rollup-plugin-visualizer` writes
 * two files, walks every module and gzips each one; putting it on that path
 * would mean a measuring instrument sitting inside the deploy, where a fault
 * in it is a fault in the ship. So it is added only when `BUNDLE_REPORT=1`.
 *
 * # Why this reads the CONFIG and not a constant beside it
 *
 * Invariant 5 — assert at the wire. The claim is about the plugin list vite is
 * handed, so the arm imports `vite.config.ts` itself with the variable set and
 * unset and reads that list. A test of a helper called `wantsBundleReport()`
 * would keep passing after somebody appended the plugin unconditionally two
 * lines below, which is the whole failure worth catching.
 */

const PLUGIN_NAME = /visualizer/i;

/** vite's plugin option nests — `react()` alone returns an array of plugins. */
function pluginNames(plugins: unknown): string[] {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    if (node && typeof node === "object" && "name" in node) {
      out.push(String((node as { name: unknown }).name));
    }
  };
  walk(plugins);
  return out;
}

async function loadConfigPlugins(bundleReport: string | undefined): Promise<string[]> {
  vi.resetModules();
  const previous = process.env.BUNDLE_REPORT;
  if (bundleReport === undefined) delete process.env.BUNDLE_REPORT;
  else process.env.BUNDLE_REPORT = bundleReport;
  try {
    const mod = (await import("../vite.config")) as { default: { plugins?: unknown } };
    return pluginNames(mod.default.plugins);
  } finally {
    if (previous === undefined) delete process.env.BUNDLE_REPORT;
    else process.env.BUNDLE_REPORT = previous;
  }
}

afterEach(() => {
  vi.resetModules();
});

describe("vite.config — the bundle reporter is opt-in", () => {
  it("is ABSENT from a plain build", async () => {
    const names = await loadConfigPlugins(undefined);
    expect(names.length).toBeGreaterThan(0); // the config really loaded
    expect(names.filter((n) => PLUGIN_NAME.test(n))).toEqual([]);
  });

  it("is PRESENT when BUNDLE_REPORT=1", async () => {
    const names = await loadConfigPlugins("1");
    expect(names.filter((n) => PLUGIN_NAME.test(n)).length).toBeGreaterThan(0);
  });

  it("is absent for any other value — only the exact opt-in turns it on", async () => {
    // `BUNDLE_REPORT=0` and `BUNDLE_REPORT=false` are the two a person would
    // type meaning off, and a truthiness check would turn the reporter ON for
    // the second one.
    for (const value of ["0", "false", "", "true"]) {
      const names = await loadConfigPlugins(value);
      expect(names.filter((n) => PLUGIN_NAME.test(n)), `BUNDLE_REPORT=${value}`).toEqual([]);
    }
  });

  it("keeps react and tailwind in place either way", async () => {
    const off = await loadConfigPlugins(undefined);
    const on = await loadConfigPlugins("1");
    for (const names of [off, on]) {
      expect(names.some((n) => /react/i.test(n))).toBe(true);
      expect(names.some((n) => /tailwind/i.test(n))).toBe(true);
    }
    // …and turning it on only ADDS.
    expect(on.length).toBeGreaterThan(off.length);
  });
});
