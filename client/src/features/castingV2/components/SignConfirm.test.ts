import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/*
  THE SIGN DIALOG'S NAME BOX ASKS FOR A NAME — #2120.

  His word, 2026-10-09, on a screenshot of this dialog: *"when i go to sign
  someone the default text says e.g grounded thats stupid"*. The placeholder had
  come over with the prototype modal (`3b9747961`) and was never re-derived:
  "Grounded" is a mood word, not a name. It is an instruction now, not an
  example, because any example name would pick a gender, era or culture for the
  face the customer is looking at.

  This drives the REAL component through React's own renderer rather than
  reading the source for a string, so a placeholder moved into a constant, a
  prop or a ternary is still read the way the browser reads it. The shell is
  replaced with a plain wrapper only because it portals to `document.body`,
  which the server renderer has no use for; its own anatomy is pinned in
  `modalAnatomy.test.ts`.
*/
vi.mock("@/foundation/CastingModal", () => ({
  CastingModal: ({ children }: { children: ReactNode }) =>
    createElement("div", { "data-shell": "casting-modal" }, children),
}));

const { SignConfirm } = await import("./SignConfirm");

function renderSign(): string {
  return renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      createElement(SignConfirm, {
        indexLabel: "03",
        imageUrl: null,
        signsVersion: null,
        priceCredits: 450,
        busy: false,
        onConfirm: () => undefined,
        onCancel: () => undefined,
      }),
    ),
  );
}

/** Every placeholder the rendered dialog carries, in document order. */
function placeholders(html: string): string[] {
  return [...html.matchAll(/placeholder="([^"]*)"/g)].map((match) => match[1]);
}

// Card #2120 — the reference lives in this comment, where the hex guard does not read it.
describe("the Sign dialog's name box", () => {
  it("asks for a name in plain words", () => {
    const html = renderSign();
    // Positive control: the dialog rendered at all, with its one text field.
    expect(html).toContain('id="dpc-modal-name"');
    expect(placeholders(html)).toEqual(["Give them a name"]);
  });

  it("offers no example name — not the prototype's, not any other", () => {
    const html = renderSign();
    // Negative arms: the prototype's word, and the shape of any example.
    expect(html).not.toContain("Grounded");
    for (const text of placeholders(html)) {
      expect(text).not.toMatch(/\be\.g\./i);
    }
  });
});
