import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/*
  THE DELETE DIALOG NAMES THE WHOLE CHARACTER — #2432.

  For a character called "Leave Test" the dialog read "Delete Leave?",
  "TYPE LEAVE" and "Keep Leave": the first word of the name, which is a
  character the customer never made. It now says the whole name, and asks for
  the whole name; past `CONFIRM_NAME_MAX` characters the word to type is
  DELETE, because typing a long name adds a chore and no safety.

  Driven through React's own renderer, so what is asserted is what the browser
  draws. The modal shell portals into `document.body`, which the server
  renderer has no copy of, so here it passes its label and children through.
*/
vi.mock("./CastingModal", () => ({
  CastingModal: ({ label, children }: { label: string; children: unknown }) =>
    createElement("div", { "data-label": label }, children as never),
}));

const { DestructiveConfirm, deleteConfirmWord, keepLabel, confirmMatches, CONFIRM_NAME_MAX } =
  await import("./DestructiveConfirm");

function draw(name: string): string {
  return renderToStaticMarkup(
    createElement(DestructiveConfirm, {
      name,
      imageUrl: null,
      signed: true,
      busy: false,
      onCancel: () => undefined,
      onConfirm: () => undefined,
    }),
  );
}

describe("the delete dialog names the whole character (card 2432)", () => {
  it("a two-word name is said and asked for in full", () => {
    const html = draw("Leave Test");
    expect(html).toContain('data-label="Delete Leave Test?"');
    expect(html).toContain("Delete Leave Test?</h2>");
    expect(html).toContain("TYPE LEAVE TEST");
    expect(html).toContain('placeholder="Leave Test"');
    expect(html).toContain('aria-label="Type Leave Test to confirm deletion"');
    expect(html).toContain("Keep Leave Test</button>");
  });

  it("NEGATIVE CONTROL — the first word alone is nowhere on the dialog", () => {
    const html = draw("Leave Test");
    expect(html).not.toContain("Delete Leave?");
    expect(html).not.toMatch(/TYPE LEAVE</);
    expect(html).not.toContain("Keep Leave<");
  });

  it("a one-word name reads as it always did", () => {
    const html = draw("Nine");
    expect(html).toContain("Delete Nine?</h2>");
    expect(html).toContain("TYPE NINE");
    expect(html).toContain("Keep Nine</button>");
  });

  it("a long name is said in full but the word to type is DELETE", () => {
    const long = "Captain Alexandria Montgomery-Whitfield";
    expect(long.length).toBeGreaterThan(CONFIRM_NAME_MAX);
    const html = draw(long);
    expect(html).toContain(`Delete ${long}?</h2>`);
    expect(html).toContain("TYPE DELETE");
    expect(html).toContain('placeholder="DELETE"');
    expect(html).toContain("Keep this character</button>");
    expect(deleteConfirmWord(long)).toBe("DELETE");
    expect(keepLabel(long)).toBe("Keep this character");
  });

  it("the boundary sits exactly at the limit", () => {
    const atLimit = "A".repeat(CONFIRM_NAME_MAX);
    expect(deleteConfirmWord(atLimit)).toBe(atLimit);
    expect(deleteConfirmWord(`${atLimit}B`)).toBe("DELETE");
  });

  it("arms on the whole name, whatever the case or spacing, and never on the first word", () => {
    const word = deleteConfirmWord("Leave Test");
    expect(confirmMatches("leave test", word)).toBe(true);
    expect(confirmMatches("  LEAVE   Test ", word)).toBe(true);
    expect(confirmMatches("Leave", word)).toBe(false);
    expect(confirmMatches("", word)).toBe(false);
    expect(confirmMatches("delete", deleteConfirmWord("x".repeat(40)))).toBe(true);
  });

  it("the dialog's own copy no longer reaches for the first name", () => {
    const source = readFileSync(new URL("./DestructiveConfirm.tsx", import.meta.url), "utf8");
    expect(source).not.toContain("firstNameOf");
  });
});
