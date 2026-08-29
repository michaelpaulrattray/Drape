import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { SHOWCASE_DECK, deckOffsets, entryAt } from "./heroDeck";

/**
 * The casting hero's deck (#234, corrected by #240).
 *
 * The arms here are the section's load-bearing promises, and each one is a
 * promise that would fail SILENTLY — a deck full of the right faces beside the
 * wrong words looks perfectly fine, which is why it gets a test rather than a
 * review.
 *
 * ⚠ **RE-POINTED BY #240.** The arms that used to prove the ROSTER road (the
 * account's own signed casts, newest first, with a curated fallback and a
 * second eyebrow) are gone, because the road is gone: the founder ruled the
 * deck a showcase — the same six frames for every account, none of them
 * anybody's property. What replaced them is the negative shape of that ruling,
 * driven at the SOURCE, because "it quietly started reading the roster again"
 * and "a card navigates again" are exactly the regressions a screenshot passes.
 */

const COMPONENT = new URL("./components/HeroDeck.tsx", import.meta.url);
const PAGE = new URL("../../pages/CastingV2.tsx", import.meta.url);

describe("the showcase deck", () => {
  /* Every entry is a real render with a real brief. */
  it("keeps every card honest", () => {
    expect(SHOWCASE_DECK.length).toBeGreaterThanOrEqual(5);
    for (const entry of SHOWCASE_DECK) {
      expect(entry.meta).toBe("Example");
      expect(entry.brief.length).toBeGreaterThan(20);
      expect(entry.imageUrl.startsWith("/casting-hero/deck/")).toBe(true);
      expect(entry.name.trim().length).toBeGreaterThan(0);
    }
  });

  /*
    THE PAIRING LAW (spec §4), and since #240 it is also the CLICK's law: the
    brief a click puts in the box is the one under the face that was clicked.
    A deck that read its briefs from a second list would pass every other arm
    here and still teach a customer a sentence that did not produce that
    picture.
  */
  it("gives every face its own words, and no two the same", () => {
    const briefs = SHOWCASE_DECK.map((entry) => entry.brief);
    expect(new Set(briefs).size).toBe(briefs.length);
    expect(new Set(SHOWCASE_DECK.map((entry) => entry.key)).size).toBe(SHOWCASE_DECK.length);
  });

  /*
    NO CARD IS ANYBODY'S PROPERTY (#240). The field is gone rather than nulled,
    so this arm is about the TYPE as much as the data: a `castId` back on an
    entry is the roster road returning by the back door.
  */
  it("carries no room to open", () => {
    for (const entry of SHOWCASE_DECK) {
      expect(Object.keys(entry).sort()).toEqual(["brief", "imageUrl", "key", "meta", "name"]);
    }
  });
});

/* His correction, #240 — the issue number lives in a comment because the
   token guard reads a bare `#240` in a string as a hex literal. */
describe("the deck does not vary by account", () => {
  /*
    THE SCAN IS OVER CODE, NEVER OVER THE FILE. A ban list run across a source
    file whose own comments explain the ban catches its own prose — this repo's
    `cropped` / bare `framing` class, four times now — so the comments come out
    first and the arm below proves the stripper left the code behind.
  */
  async function codeOf(url: URL): Promise<string> {
    const source = await readFile(url, "utf8");
    return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  }

  it("strips comments and keeps code (the instrument's own control)", async () => {
    const code = await codeOf(COMPONENT);
    expect(code, "the stripper must leave the component behind").toContain(
      "export function HeroDeck",
    );
    expect(code, "the stripper must actually strip").not.toContain("A PEEK DOES BOTH");
  });

  /*
    The founder's own reason, verbatim: *"otherwise when a fresh user comes to
    the casting page they wouldnt see any images?"*. The component may not take
    the roster at all — not as a prop it ignores, not as a hook it calls.
  */
  it("never reads the roster", async () => {
    const code = await codeOf(COMPONENT);
    for (const forbidden of [/\bRosterCast\b/, /\bcasts\b/, /\broster\b/i, /\bheroDeck\(/]) {
      expect(code, `HeroDeck must not use ${forbidden}`).not.toMatch(forbidden);
    }
  });

  it("never navigates", async () => {
    const code = await codeOf(COMPONENT);
    for (const forbidden of [/\bcastId\b/, /\bonOpenCast\b/, /\bnavigate\b/, /<a[\s>]/]) {
      expect(code, `HeroDeck must not use ${forbidden}`).not.toMatch(forbidden);
    }
    /* Positive control: the one control it DOES have is still a button. */
    expect(code).toContain('type="button"');
  });

  /*
    AND THE PAGE HANDS IT THE ONE THING IT TAKES. An arm on the component alone
    would stay green while the call site passed the roster into a prop that no
    longer exists — the deck would go blank and this file would say nothing.
  */
  it("is called with a brief handler and nothing else", async () => {
    const code = await codeOf(PAGE);
    const start = code.indexOf("<HeroDeck");
    expect(start, "the page must render the deck").toBeGreaterThan(0);
    const call = code.slice(start, code.indexOf("/>", start));
    expect(call).toContain("onUseBrief");
    expect(call).not.toContain("casts=");
    expect(call).not.toContain("onOpenCast");
    /* It fills the box and puts the caret there; it does not roll. */
    expect(call).toContain("setBrief");
    expect(call).toContain("focusBrief()");
    expect(call, "a card click must never start a roll").not.toContain("startCasting");
  });

  /*
    THE PAGE IS ONE CONTAINER, AT HIS NUMBERS (#240, verbatim: *"make the
    content width of the entire casting page 1240px, centred, with 32px
    horizontal padding — max-width: 1240px; margin: 0 auto; padding: 34px 32px
    44px"*). The width and the gutter are read here; that the hero and the
    roster actually SHARE that box is measured in the browser, because his §8
    failure is a second container and no source arm can see one.
  */
  it("sits on the 1240 column with the tight gutter", async () => {
    const code = await codeOf(PAGE);
    const shell = code.slice(code.indexOf("<AppShell"), code.indexOf(">", code.indexOf("<AppShell")));
    expect(shell).toContain('width="working"');
    expect(shell).toContain('gutter="tight"');
  });
});

describe("deck geometry", () => {
  /*
    A short deck draws fewer cards rather than repeating a face — the peeks
    have to be other people or the fan is an effect rather than a shelf.
  */
  it("never puts one face in two slots", () => {
    expect(deckOffsets(1)).toEqual([0]);
    expect(deckOffsets(2)).toEqual([0, 1]);
    expect(deckOffsets(3)).toEqual([-1, 0, 1]);
    expect(deckOffsets(7)).toEqual([-1, 0, 1]);
  });

  it("wraps in both directions", () => {
    const entries = SHOWCASE_DECK.slice(0, 3);
    expect(entryAt(entries, 0, -1).key).toBe(entries[2]!.key);
    expect(entryAt(entries, 2, 1).key).toBe(entries[0]!.key);
    expect(entryAt(entries, 1, 0).key).toBe(entries[1]!.key);
  });
});
