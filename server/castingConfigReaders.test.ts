import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * EVERY FIELD `castingV2.config` SENDS IS READ BY THE CLIENT IT IS SENT TO.
 *
 * # The class this is here to catch, and the two instances that named it
 *
 * `castingV2.config` is the one response whose whole purpose is telling the
 * client what to DRAW. A field on it therefore dies in a way nothing notices:
 * the reader is a JSX condition somewhere else entirely, and when the surface it
 * fed is removed the field keeps being computed, keeps being sent, and keeps
 * reading — to the next person who opens the file — as a live capability switch.
 * No test fails, no error is logged, and the paragraph arguing for it survives
 * the thing it was arguing about. That is working law 7's **path-three death**.
 *
 * Two were found on 2026-09-24 (#1153), one line apart, both dead for weeks:
 *
 *   - `stepBackEnabled` gated the version chip's three-dot menu. The founder
 *     killed the menu by name and `e6d17fe9` (2026-08-15) took its only reader.
 *   - `packageViewCount` fed the Sign modal's view count, and `3b974796`
 *     (2026-08-03) — *a commit about deleting a Cast* — dropped the one line
 *     that read it.
 *
 * The first was found by a sweep at a neighbouring commit. The second was found
 * only because the card asked for the COUNT rather than the fix, which is why
 * this guard counts rather than naming names.
 *
 * # What it can and cannot tell you — stated, because a floor called a ceiling
 * is worse than no guard
 *
 * It reads the projection's keys out of the route source and looks for each as
 * an identifier anywhere under `client/src`. So:
 *
 *   - **It is a FLOOR.** A key that appears in a comment or in an unrelated
 *     object counts as read. `enabled` is the worst case and is an ordinary
 *     English word — this guard says almost nothing about that one.
 *   - ⚠ **Client SUITES are excluded, and that was measured rather than
 *     assumed.** The first shape of this guard read every `.ts`/`.tsx` under
 *     `client/src` and, driven against the tree that still carried both dead
 *     fields, it reported only ONE of them: `stepBackEnabled` read as alive off
 *     **a sentence in a comment inside a client test**, written by the shift
 *     that carded it. A guard whose population includes the prose written
 *     ABOUT a death cannot see that death. A field whose only reader is a
 *     suite is not drawn for anybody either, so the exclusion costs nothing
 *     real: every live field on this response has a reader in app code.
 *   - **It cannot be fooled in the direction that matters.** A field whose last
 *     reader is deleted goes to zero hits and reddens, which is the whole
 *     event; nothing in the client writes these names except a reader.
 *   - **The population is DERIVED from the route**, never listed here. A second
 *     list shadowing this one would drift from it (working law 4), and a guard
 *     that had to be edited to add a field is a guard that gets edited to
 *     remove one.
 */

const ROUTE = join(import.meta.dirname, "routes", "castingV2.ts");
const CLIENT = join(import.meta.dirname, "..", "client", "src");

/** The `config` query's own object literal, read out of the route. */
function configProjectionSource(): string {
  const source = readFileSync(ROUTE, "utf8");
  const start = source.indexOf("\n  config: protectedProcedure");
  expect(start, "the config procedure is not where this guard looks").toBeGreaterThan(-1);
  const end = source.indexOf("\n  })),", start);
  expect(end, "the config procedure's closing brace was not found").toBeGreaterThan(start);
  return source.slice(start, end);
}

/** Its top-level keys — the fields the client is actually sent. */
function configKeys(): string[] {
  const keys: string[] = [];
  for (const line of configProjectionSource().split("\n")) {
    const match = /^ {4}([a-zA-Z][a-zA-Z0-9]*):/.exec(line);
    if (match) keys.push(match[1]!);
  }
  return keys;
}

function clientFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) clientFiles(path, found);
    /* App code only — see the docblock: a suite that MENTIONS a dead field
       makes it read as alive, and that is exactly what happened here. */
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) found.push(path);
  }
  return found;
}

describe("castingV2.config sends nothing the client has stopped reading", () => {
  const keys = configKeys();

  it("CONTROL — the projection was really read, and it holds the fields it should", () => {
    /*
      An empty or tiny key list would make every arm below vacuously green: the
      route could be renamed, the slice could land on the wrong lines, the regex
      could stop matching, and this file would go on passing. So the reading is
      proven before it is used.
    */
    expect(keys.length).toBeGreaterThan(8);
    expect(keys).toContain("enabled");
    expect(keys).toContain("rollPriceCredits");
    expect(keys).toContain("authorRoadEnabled");
    /* And the two that died: they must not come back unread. */
    expect(keys).not.toContain("stepBackEnabled");
    expect(keys).not.toContain("packageViewCount");
  });

  it("⚠ every field has at least one reader under client/src", () => {
    const sources = clientFiles(CLIENT).map((path) => readFileSync(path, "utf8"));
    const unread = keys.filter((key) => {
      const identifier = new RegExp(`\\b${key}\\b`);
      return !sources.some((text) => identifier.test(text));
    });
    expect(
      unread,
      "a field the client is sent and nobody reads — either a surface was removed and the gate "
      + "was left behind (#1153's class), or a reader is being planned and has not landed. "
      + "Delete it, or say at the site why it is sent to nothing.",
    ).toEqual([]);
  });
});
