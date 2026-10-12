import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
  NO CUSTOMER SCREEN SHOWS AN ERROR'S OWN MESSAGE — the leftovers of #2431 (#2432).

  `error instanceof Error ? error.message : "…"` puts whatever the transport
  said on screen: a tRPC error is always an `Error`, so a gateway's HTML page or
  a dropped connection reaches the customer and the written fallback never
  shows. #2431 fixed seven of these in casting and listed the rest. This card
  routes the ones a customer can still reach — the canvas's casting takeover
  (`useCastGate`, `useCastingGeneration`, `CastProfilePanel`) — through
  `readableFailure`, and this arm keeps the shape from coming back anywhere a
  customer can reach.

  What it does not cover is said rather than assumed: staff pages are outside
  it (they are read by staff, his "keep it with you" line), and two modules
  that only an UNMOUNTED lobby view reaches are excused — but only while the
  arm below proves nothing mounted imports them.
*/

const CLIENT = fileURLToPath(new URL("..", import.meta.url));

function sourceFiles(dir = CLIENT): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });
}

const rel = (full: string) => relative(CLIENT, full).split(sep).join("/");

/** The shape: an error's message with a non-empty fallback beside it — i.e. meant to be SHOWN. */
const RAW_SHOWN = /instanceof Error \? \w+\.message : (['"`])(?:(?!\1).)+\1/;

const STAFF = /^(features\/(admin|moderator)\/|pages\/(Admin|Moderator))/;

/** Reached only through the lobby's unmounted Home/Library views (`pages/AppLobby.tsx`). */
const UNMOUNTED_ONLY = new Set(["features/export/useExportPack.ts", "features/lobby/DeleteCastDialog.tsx"]);
const UNMOUNTED_VIEWS = ["HomeView", "LibraryView", "RecentWorkSection", "ModelCardChooser"];

describe("no customer screen shows an error's own message (#2432)", () => {
  const files = sourceFiles();

  it("THE WALK SAW THE CLIENT — an empty walk must never read as clean", () => {
    const names = files.map(rel);
    expect(names.length).toBeGreaterThan(200);
    for (const subject of [
      "features/studio/hooks/useCastGate.ts",
      "features/casting/hooks/useCastingGeneration.ts",
      "features/casting/components/CastProfilePanel.tsx",
    ]) {
      expect(names).toContain(subject);
    }
  });

  it("NEGATIVE CONTROL — the reader catches the lines this card replaced", () => {
    for (const old of [
      `toast.error(error instanceof Error ? error.message : "Couldn't save the name");`,
      `      const message = error instanceof Error ? error.message : "Generation failed";`,
      `          error instanceof Error ? error.message : 'Casting failed';`,
    ]) {
      expect(RAW_SHOWN.test(old), old).toBe(true);
    }
    // …and not the one that only chooses a branch and is never shown.
    expect(RAW_SHOWN.test(`const raw = error instanceof Error ? error.message : "";`)).toBe(false);
  });

  it("no customer-reachable module carries the shape", () => {
    const offenders = files
      .map((full) => ({ name: rel(full), text: readFileSync(full, "utf8") }))
      .filter(({ name }) => !STAFF.test(name) && !UNMOUNTED_ONLY.has(name))
      .flatMap(({ name, text }) =>
        text.split("\n").flatMap((line, i) => (RAW_SHOWN.test(line) ? [`${name}:${i + 1}: ${line.trim()}`] : [])),
      );
    expect(offenders).toEqual([]);
  });

  it("the excused modules are still reachable ONLY through unmounted views", () => {
    /* If any of these views is imported by something outside the set, the
       excuse above has expired and the two modules must be routed too. */
    const importers = files
      .map((full) => ({ name: rel(full), text: readFileSync(full, "utf8") }))
      .filter(({ text }) =>
        UNMOUNTED_VIEWS.some((view) => new RegExp(`^\\s*import[^;]*\\b${view}\\b`, "m").test(text)),
      )
      .map(({ name }) => name)
      .sort();
    expect(importers).toEqual([
      "features/lobby/HomeView.tsx",
      "features/lobby/LibraryView.tsx",
    ]);
  });

  it("POSITIVE CONTROL — the three reachable sites read through readableFailure", () => {
    const read = (path: string) => readFileSync(join(CLIENT, path), "utf8");
    expect(read("features/studio/hooks/useCastGate.ts")).toContain(
      `readableFailure(error, "The casting didn't finish. Try again.")`,
    );
    const generation = read("features/casting/hooks/useCastingGeneration.ts");
    expect(generation).toContain(`readableFailure(error, "The casting didn't finish. Try again.")`);
    expect(generation).toContain(`readableFailure(error, "That edit didn't finish. Try again.")`);
    expect(read("features/casting/components/CastProfilePanel.tsx")).toContain(
      `readableFailure(error, "That name could not be saved.")`,
    );
  });
});
