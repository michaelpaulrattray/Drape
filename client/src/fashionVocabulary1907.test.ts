/**
 * #1907 — the fashion leftovers, on the three lines that actually SHIP.
 *
 * His word, 2026-10-07 (terminal), verbatim: *"1,2,3 seeing as these are small
 * make cards for these"*, on Yuna's Founder Desk item *"In-app wording: remove
 * fashion leftovers (Wardrobe, AI models, dress it): 7 lines"*. Klieg is an AI
 * studio for short films, ads and creator content; these sentences still talked
 * about dressing AI models in a wardrobe.
 *
 * # ⚠ THE CARD NAMED SEVEN LINES AND FOUR OF THEM REACH NO CUSTOMER
 *
 * Measured at the EMITTED BUNDLE rather than at the tree, which is the only
 * reading that answers *does a customer see this* — `dist/public` after a real
 * `vite build`, grepped for each sentence:
 *
 * ```
 *   0 files   LibraryView.tsx:47        "AI models you've cast — minted and still in progress."
 *   0 files   HomeView.tsx:79           "…then dress it in Wardrobe."
 *   0 files   ToolsIndex.tsx:112        "Cast and refine AI models from a brief"
 *   0 files   DeleteCastDialog.tsx:98   "…linked Canvas/Wardrobe placements…"
 *   1 file    SecuritySection.tsx:151   "Your casts, boards and wardrobe go with it."
 *   1 file    SecuritySection.tsx:210   "Your casts, boards and wardrobe are deleted…"
 *   1 file    CanvasChatToggle.tsx:108  "…cast people, style outfits, arrange your board…"
 * ```
 *
 * ⚠ **The zeroes are driven, not inferred**: the three strings the MOUNTED
 * lobby stub draws (*"The old library is retired"*, *"Canvases themselves are
 * untouched"*, *"Nothing has been removed"*) are each found in exactly 1 file by
 * the same grep, so the reader can see lobby copy — those four sentences simply
 * are not in the bundle.
 *
 * The cause is #302: `AppLobby` renders `LobbyStub`, and `HomeView`,
 * `LibraryView` and `BoardsView` are UNMOUNTED. `ToolsIndex` is imported only by
 * `HomeView`; `DeleteCastDialog` only by `LibraryView` and `RecentWorkSection`,
 * which is itself imported only by `HomeView`. `castVocabulary.test.ts` had
 * already made this exact call for the same files and the same class of word —
 * *"twelve such strings and **not one of them ships**"* — and left them.
 *
 * ⚠ **AND THE CARD'S OWN DONE-WHEN SETTLES IT RATHER THAN MY JUDGEMENT**: it
 * asks for *"frames of each surface … in both themes"*, and there is no frame to
 * take of an unmounted view. The four are reported on the card, not swept here.
 * **`lobbyStub.test.ts` is what wakes this up** — the day those views are
 * remounted it reddens, and whoever answers it inherits the four lines. A second
 * arm here asserting the same unmountedness would be the parallel copy working
 * law 4 bans.
 *
 * # ⚠ "BOARD" STAYS, AND THAT IS THE CARD'S OWN RULE APPLIED TO A MEASUREMENT
 *
 * The card proposed board → canvas on all three live lines, under the condition
 * *"match whatever the canvas surface calls itself in the UI today (#1583). If it
 * still says 'board' on screen, keep 'board' here rather than renaming half a
 * surface."* Read at the bundle, the canvas surface still ships **Back to
 * board**, **Back to boards**, **Board not found**, **Start with a blank
 * board**, **Already on the board**, **Boards**, and *"Your draft will be placed
 * on this board before Casting closes."*
 *
 * So the condition is met and the noun stays. What these three lines lose is the
 * FASHION word and nothing else — `wardrobe` as a thing the customer owns, and
 * `style outfits` as something to ask for. Renaming the noun is one pass over
 * one surface, on his word, and it is not this card.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SECURITY = "client/src/features/settings/sections/SecuritySection.tsx";
const CANVAS_CHAT = "client/src/features/boards/components/CanvasChatToggle.tsx";

const source = (path: string): string => readFileSync(resolve(process.cwd(), path), "utf8");

describe("the three lines a customer can actually read", () => {
  it("the account-deletion note names what she made, not a wardrobe", () => {
    const text = source(SECURITY);
    expect(text).toContain("Permanent. Your casts, boards and everything you made go with it.");
    expect(text).toContain(
      "Your casts, boards and everything you made are deleted with the account.",
    );
  });

  it("the canvas assistant no longer offers to style outfits", () => {
    const text = source(CANVAS_CHAT);
    expect(text).toContain(
      "Ask the assistant to cast people, arrange your board, or answer creative questions.",
    );
  });

  it("⚠ and the fashion word is pinned ABSENT on both, which is the arm that can fail", () => {
    /*
      A `toContain` on new copy passes the moment somebody writes the sentence
      and says nothing about the old one surviving beside it — a second
      paragraph, a tooltip, a sibling branch. These two are the arms that redden
      if the leftover comes back anywhere in either file.
    */
    expect(source(SECURITY)).not.toMatch(/wardrobe/i);
    expect(source(CANVAS_CHAT)).not.toMatch(/style outfits/i);
  });
});

describe("what was deliberately NOT swept, so the next reader inherits the reasoning", () => {
  it("the canvas surface still says 'board' on screen, which is why these three do", () => {
    /*
      The card's condition, read at the live canvas rather than taken from the
      card. If this ever goes to zero the rename has happened elsewhere and these
      three sentences are the stragglers — which is the moment to change them,
      and this arm is what says so.
    */
    const stillSaysBoard: ReadonlyArray<readonly [string, string]> = [
      ["client/src/features/boards/BoardPage.tsx", "Back to board"],
      ["client/src/features/boards/BoardPage.tsx", "Board not found"],
      ["client/src/features/boards/components/FirstRunIntro.tsx", "Start with a blank board"],
      ["client/src/features/boards/canvas/SpawnMenu.tsx", "Already on the board"],
    ];
    const present = stillSaysBoard.filter(([file, word]) => source(file).includes(word));
    expect(
      present,
      "The canvas surface has been renamed. #1907 kept 'board' on three sentences "
      + "ONLY because the surface around them still said it — re-read them now.",
    ).toEqual(stillSaysBoard);
  });

  it("⚠ the canvas assistant is a PLACEHOLDER, and the sentence is read beside its Soon chip", () => {
    /*
      NAMED RATHER THAN FIXED, because the sentence only reads honestly while the
      panel says it is coming. `CanvasChatToggle`'s header is *"Placeholder for
      future AI assistant integration"* and its input carries `disabled` — so the
      body is a list of things the assistant WILL do, and what keeps that from
      being a capability a customer is offered and cannot use is the **Soon**
      chip in the panel's own header, read at the rendered frame rather than at
      the source. His standing rule is that a placeholder *"names a place, never
      a capability"* (quoted in `lobbyStub.test.ts`); this one dates its promise,
      which is the honest half.

      ⚠ So the arm pins the three together: lose the chip while the input stays
      disabled and the sentence becomes a promise with no date on it.
    */
    const text = source(CANVAS_CHAT);
    expect(text).toContain("Placeholder for future AI assistant integration");
    expect(text).toMatch(/placeholder="Ask anything\.\.\."[\s\S]{0,80}disabled/);
    expect(text).toContain("Soon");
  });
});
