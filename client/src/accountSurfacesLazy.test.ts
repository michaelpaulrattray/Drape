/**
 * accountSurfacesLazy — the account cluster is lazy, and its STATE is not
 * (#2608).
 *
 * The first download was 2.8 kB under the line that blocks every merge, after
 * climbing ~2 kB a day for five days of ordinary feature work. The cheapest
 * honest byte in it was the account cluster: Settings, Change plan, Add credits
 * and `features/billing` behind them, reachable from every signed-in page,
 * opened on almost none of them, and rendering `null` until somebody did.
 * Measured on this card's branch:
 *
 *   first-paint JS    285.9 kB -> 268.3 kB   (-17.6 kB; headroom 4.1 -> 21.7)
 *   after first paint 174.5 kB -> 194.0 kB   (+19.5 kB against 280.0)
 *
 * The bytes MOVED rather than vanished. That is the honest shape of a split and
 * it is why both numbers are here rather than only the flattering one.
 *
 * ⚠ **THERE ARE THREE ONE-LINE WAYS TO UNDO THIS SILENTLY, AND THE COMPILER
 * CANNOT SEE ANY OF THEM** — each is a working import that builds, typechecks
 * and ships, and the only thing that changes is which chunk the bytes land in.
 * An arm each:
 *
 *   1. `AppChrome` importing the component, or the barrel that exports it.
 *      The barrel is the subtle one: `@/features/settings` re-exports the hook
 *      AND `AccountSurfaces`, so reaching the state through it puts the whole
 *      cluster back with the route lines untouched. This is #1042's shape one
 *      file over, and that incident is why the hook has its own module.
 *   2. The hook's module taking a VALUE import of the cluster. It may import
 *      React and the section TYPE and nothing else — a `SettingsModal` or
 *      `features/billing` value import there is the same regression wearing a
 *      different file's name, and a type-only import is fine because it emits
 *      nothing.
 *   3. The mount losing its `anyOpen` condition or its `Suspense`. Without the
 *      condition the chunk is fetched on every signed-in page view, which is
 *      the weight moved after paint rather than removed; without the boundary
 *      a lazy component throws on first render.
 *
 * Every read is of `AppChrome`'s and the hook module's own source with comments
 * stripped, because this file's own prose quotes the imports it forbids.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { withoutComments } from "../../server/testing/withoutComments";

const ROOT = resolve(import.meta.dirname, "..", "..");
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8").replace(/\r\n/g, "\n");

const CHROME = "client/src/components/AppChrome.tsx";
const HOOK = "client/src/features/settings/useAccountSurfaces.ts";
const BARREL = "client/src/features/settings/index.ts";

/** An `import … from "<spec>"` that is not type-only — the kind that emits. */
function valueImportsOf(source: string): string[] {
  const specs: string[] = [];
  const re = /import\s+(?!type\b)([^;]*?)\s*from\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    /* `import { type X }` alone emits nothing either, but a clause mixing a
       type and a value does — so a clause whose every named member carries
       `type` is skipped and anything else counts. */
    const clause = m[1].trim();
    const named = /^\{([\s\S]*)\}$/.exec(clause);
    if (named) {
      const members = named[1].split(",").map((one) => one.trim()).filter((one) => one.length > 0);
      if (members.length > 0 && members.every((one) => one.startsWith("type "))) continue;
    }
    specs.push(m[2]);
  }
  return specs;
}

describe("the account cluster stays out of the first download", () => {
  it("AppChrome imports the HOOK's own module, never the component or the barrel", () => {
    const code = withoutComments(read(CHROME));
    const specs = valueImportsOf(code);

    expect(specs, "the hook, from the module that imports nothing heavy")
      .toContain("@/features/settings/useAccountSurfaces");
    expect(specs, "the barrel re-exports the cluster — #1042's ring, one file over")
      .not.toContain("@/features/settings");
    expect(specs, "a static import of the component is the whole regression")
      .not.toContain("@/features/settings/AccountSurfaces");
    /* And the component is reached the one way that keeps it in its own chunk.
       Asserted on the DYNAMIC specifier rather than on the word `lazy`, which a
       rename would walk past. */
    expect(code).toContain('import("@/features/settings/AccountSurfaces")');
  });

  it("CONTROL — the reader sees a value import and ignores a type-only one", () => {
    /* Working law 2 on the instrument, in the arm that depends on it: a reader
       that returned nothing would pass every `not.toContain` above, and a
       reader that counted type imports would indict the hook module below. */
    const specs = valueImportsOf([
      'import type { AccountSurfacesState } from "./useAccountSurfaces";',
      'import { type SettingsSection } from "./SettingsModal";',
      'import { SettingsModal } from "./SettingsModal";',
      'import { SettingsModal, type SettingsSection } from "./mixed";',
    ].join("\n"));
    expect(specs).toEqual(["./SettingsModal", "./mixed"]);
  });

  it("the hook's module imports nothing that drags the cluster with it", () => {
    const code = withoutComments(read(HOOK));
    const specs = valueImportsOf(code);

    /* React, and that is the whole list. Anything else is a candidate for
       pulling the cluster in, so the assertion is on the POPULATION rather
       than on a blocklist of today's known-heavy names — a blocklist cannot
       see the module somebody adds next month. */
    expect(specs).toEqual(["react"]);
  });

  it("the mount is conditional on the hook's own `anyOpen`, inside a boundary", () => {
    const code = withoutComments(read(CHROME));
    expect(code, "fetched only when a surface is actually open").toContain("account.anyOpen ?");
    expect(code, "a lazy component without a boundary throws on first render").toContain("<Suspense");
    /* ONE derivation of that fact, in the hook. A second one computed at the
       mount is working law 4, and it fails quietly: the mount fetches a chunk
       to render nothing, or renders a surface the state thinks is shut. */
    expect(code, "the mount must not re-derive what the hook already answers")
      .not.toMatch(/account\.settings\s*!==\s*null\s*\|\|/);
  });

  it("the barrel still re-exports the hook, so callers already in a lazy chunk are unbroken", () => {
    /* The split must not become a reason to rewrite every call site: a staff
       page or a board chunk may reach the hook through the barrel, because its
       bytes are already outside the first download. */
    const code = withoutComments(read(BARREL));
    expect(code).toContain('export { useAccountSurfaces } from "./useAccountSurfaces";');
  });
});
