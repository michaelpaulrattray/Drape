import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { RETENTION_EMPTY_STATE } from "@/features/castingV2/retentionCopy";
import {
  CASTING_SESSION_IDLE_DAYS,
  CASTING_SESSION_IDLE_MS,
  CASTING_SESSION_IDLE_PHRASE,
} from "@shared/castingRetention";

import { withoutComments } from "../testing/withoutComments";

/**
 * HOW LONG A SHEET IS KEPT — his number, and the places that state it.
 *
 * **His word, 2026-09-27 (terminal), verbatim and entire:**
 *
 * > *"id like to keep casting sheets for 30 days also not 7 days"*
 *
 * Two questions, and the second is the one that would have shipped wrong.
 *
 * 1. Is the window thirty idle days — a sheet quiet for 29 days survives, one
 *    quiet for 31 is swept?
 * 2. Does everything that STATES the window read the same declaration? #1464
 *    said no customer copy named it; three surfaces did, each with its own
 *    literal `7`. Moving the server constant alone would have left the product
 *    enforcing thirty days while telling the customer seven — and reddened the
 *    design law that reads the sentence off the page.
 *
 * The second is the arm worth keeping: the number can be re-typed into any of
 * them at any time, and nothing else in the tree would notice.
 */

const DAY = 24 * 60 * 60 * 1000;
const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

/**
 * Source with its prose removed, through the one shared walk (#1636).
 *
 * The number is allowed to appear in a COMMENT — the design law's own docblock
 * quotes the `/7 quiet days/i` it used to carry, which is the record of why it
 * stopped carrying it. What must never come back is the number in a string, a
 * regex or an attribute, and `withoutComments` keeps all three while dropping
 * every comment.
 *
 * ⚠ **The private reader this file carried was blind to string literals, and it
 * was blind on one of its own six inputs**: measured at #1636,
 * `scripts/lib/designLawControls.mts` read **184 non-whitespace characters
 * SHORT** — a quoted comment-opener swallowing real code. For a suite whose
 * arms are `not.toMatch(/\d+ quiet days/)`, unseen text is an arm that passes
 * because it was shown nothing, which is the one failure mode an absence
 * assertion has.
 *
 * Its line half was also looser than a comment reader in one direction and
 * tighter in another: it dropped any line BEGINNING `*` or `//` — so a
 * docblock's continuation lines went even outside a block comment — and kept a
 * TRAILING `// …` after code. The shared walk drops exactly the comments.
 */
function withoutProse(source: string): string {
  return withoutComments(source);
}

describe("the window is thirty idle days", () => {
  it("is his number, not a re-derivation of the old one", () => {
    expect(CASTING_SESSION_IDLE_DAYS).toBe(30);
    expect(CASTING_SESSION_IDLE_MS).toBe(30 * DAY);
  });

  it("keeps a sheet quiet for 29 days and sweeps one quiet for 31", () => {
    /*
      The sweep's predicate is `expiresAt < now` (`listExpiredSessions`), and
      `expiresAt` is whatever the last touch stamped — `now + the window`. So
      the boundary is arithmetic on the stamp, asserted here at both sides of
      it rather than only at the constant.
    */
    const touchedAt = Date.parse("2026-09-01T00:00:00Z");
    const stamped = touchedAt + CASTING_SESSION_IDLE_MS;

    expect(stamped).toBeGreaterThan(touchedAt + 29 * DAY); // still open
    expect(stamped).toBeLessThan(touchedAt + 31 * DAY); // swept
  });

  it("is what the writers actually stamp, in every place a session is touched", async () => {
    /*
      A constant named for the window and not used as the window is the failure
      this arm exists for. Read at the four stamping sites: session create, the
      explicit touch, the roll commit that pushes the clock out beside
      `activeRollId`, and the Sign ceremony's own re-stamp.
    */
    const rollDomain = await read("../db/castingV2.ts");
    const sign = await read("../db/castingV2Sign.ts");

    const stamp = /new Date\(now\.getTime\(\) \+ CASTING_SESSION_IDLE_MS\)/g;
    expect(rollDomain.match(stamp) ?? []).toHaveLength(3);
    expect(sign.match(stamp) ?? []).toHaveLength(1);
    expect(rollDomain).toContain(
      ".set({ expiresAt: new Date(now.getTime() + CASTING_SESSION_IDLE_MS) })",
    );

    // And it is the shared declaration, not a second copy of the number.
    expect(rollDomain).toContain('from "../../shared/castingRetention"');
    expect(rollDomain).not.toMatch(/CASTING_SESSION_IDLE_MS\s*=\s*\d/);
  });
});

describe("everything that states the window reads the one declaration", () => {
  it("the empty state names his number", () => {
    expect(RETENTION_EMPTY_STATE).toContain(CASTING_SESSION_IDLE_PHRASE);
    expect(RETENTION_EMPTY_STATE).toContain("30 quiet days");
    // "quiet" is load-bearing: it is an idle clock, never an age.
    expect(RETENTION_EMPTY_STATE).toMatch(/quiet/);
  });

  it("the lobby's unsigned-sheets aside is built from it, not typed", async () => {
    const lobby = await read("../../client/src/pages/CastingV2.tsx");
    expect(lobby).toContain('from "@shared/castingRetention"');
    expect(lobby).toContain("${CASTING_SESSION_IDLE_PHRASE}");
    expect(withoutProse(lobby)).not.toMatch(/\d+ quiet days/);
  });

  it("the design law that reads the sentence off the page derives it too", async () => {
    /*
      This is the one that fails LOUDLY and for the wrong reason: a law holding
      its own `/7 quiet days/i` reddens the moment the product tells the truth
      about thirty, and the frame it reports is a page that is correct.
    */
    const laws = await read("../../scripts/lib/designLaws.mts");
    const controls = await read("../../scripts/lib/designLawControls.mts");

    for (const source of [laws, controls]) {
      expect(source).toContain('from "../../shared/castingRetention.js"');
      expect(withoutProse(source)).not.toMatch(/\d+ quiet days/);
    }
  });

  it("no source file re-types the window as a number of quiet days", async () => {
    /*
      The copy module is the last one, and it is checked by reading rather than
      by importing: `RETENTION_EMPTY_STATE` above proves the STRING is right,
      and this proves nobody put the number back into the file beside it.
    */
    const copy = await read("../../client/src/features/castingV2/retentionCopy.ts");
    expect(copy).toContain('from "@shared/castingRetention"');
    expect(withoutProse(copy)).not.toMatch(/\d+ quiet days/);
  });
});

/**
 * ⚠ **THE READER'S OWN CONTROLS, AND THEY ARE HERE BECAUSE THIS SUITE WAS
 * INSENSITIVE TO ITS OWN READER (#1636's `server/castingV2/` slice).**
 *
 * All three source arms above are `not.toMatch(…)`, and an absence assertion
 * over NOTHING passes. Driven rather than reasoned: with the shared reader
 * stubbed to return an empty string, **five of the slice's six suites reddened
 * and this one stayed GREEN on all seven arms**. That is the same shape slice 5
 * found in `server/crewMarkdownLead.test.ts`, one suite along.
 *
 * Both arms below fail under that stub, and the second one fails under the
 * PREDECESSOR reader this file carried — so neither the reader going blind nor
 * the string-blind pair coming back can happen quietly.
 */
describe("the reader this suite's absence arms depend on", () => {
  it("CONTROL: the strip leaves the declaration it is asked about", async () => {
    for (const relative of [
      "../../client/src/pages/CastingV2.tsx",
      "../../scripts/lib/designLaws.mts",
      "../../scripts/lib/designLawControls.mts",
      "../../client/src/features/castingV2/retentionCopy.ts",
    ]) {
      const stripped = withoutProse(await read(relative));
      expect(stripped.length, `${relative} read as nothing`).toBeGreaterThan(200);
      expect(stripped, `${relative} lost the declaration`).toContain("CASTING_SESSION_IDLE_PHRASE");
    }
  });

  it("CONTROL: a re-typed window inside a STRING is still found", () => {
    // The swap's whole purpose, as a fixture rather than as a claim. A quoted
    // comment-opener is not a comment opener; the predecessor pair read it as
    // one and deleted everything down to the next real closer, taking the
    // re-typed number with it and leaving the arms above green.
    const fixture = [
      'const opener = "a /' + '* inside a string literal";',
      'const copy = "kept for 7 quiet days";',
      '/' + '* an ordinary comment, whose closer the pair above scans to *' + '/',
    ].join("\n");

    expect(withoutProse(fixture)).toMatch(/\d+ quiet days/);

    const predecessor = fixture
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((line) => !/^\s*(\*|\/\/)/.test(line))
      .join("\n");
    expect(
      predecessor,
      "the pair this file carried is blind to exactly this, which is why it went",
    ).not.toMatch(/\d+ quiet days/);
  });
});
