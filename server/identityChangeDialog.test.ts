/**
 * Batch C final corrections 5 + 7-client + founder ruling 1 (honest minted
 * copy) — the D-11 fork dialog's states, rendered as the real component
 * (react-dom/server static markup, castModelModal.test pattern):
 *
 *  - PENDING: both buttons hold (disabled) while the paid fork is in flight —
 *    the paid action cannot be re-fired mid-request;
 *  - ERROR: a free server refusal renders IN the dialog (the session stays);
 *  - CONTEXT-ONLY: brand/vibe changes are described as casting context,
 *    never mislabeled as a physical identity change.
 */
import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/trpc", () => ({
  trpc: {
    boardOps: {
      applyModelEdit: {
        plan: { useQuery: () => ({ data: { estimatedCreditCost: 350 } }) },
      },
    },
  },
}));

import { IdentityChangeDialog } from "../client/src/features/studio/takeover/IdentityChangeDialog";

function render(props: Partial<Parameters<typeof IdentityChangeDialog>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(IdentityChangeDialog, {
      boardId: 2,
      itemId: 3,
      changedLabels: ["jawline"],
      contextOnly: false,
      pending: false,
      errorMessage: null,
      onCommit: () => {},
      onCancel: () => {},
      ...props,
    }),
  );
}

describe("IdentityChangeDialog states", () => {
  it("idle: fork door armed with the plan-derived cost", () => {
    const html = render();
    expect(html).toContain("Fork as new model");
    expect(html).toContain("~350");
    expect(html).not.toContain('disabled=""'); // the attribute, not the Tailwind class
  });

  it("PENDING: both buttons disabled — the paid fork cannot be re-fired mid-flight (correction 5)", () => {
    const html = render({ pending: true });
    expect(html).toContain("Forking…");
    // both the cancel and commit buttons carry the disabled ATTRIBUTE
    const disabledCount = (html.match(/disabled=""/g) ?? []).length;
    expect(disabledCount).toBe(2);
  });

  it("ERROR: the server's refusal renders in context, with the session preserved behind it", () => {
    const html = render({
      errorMessage: "Casting creates the reusable character identity. Apply this on Canvas for a quick creative result, or continue to Wardrobe for precise garment control.",
    });
    expect(html).toContain("Apply this on Canvas");
    expect(html).toContain("Keep editing"); // the way back into the intact session
  });

  it("identity changes keep the D-43 copy: a new person", () => {
    const html = render({ changedLabels: ["jawline", "hair length"] });
    expect(html).toContain("This is a new person");
    expect(html).toContain("jawline, hair length");
  });

  it("FOUNDER RULING: brand/vibe-only changes are casting CONTEXT — never a physical identity claim", () => {
    const html = render({ contextOnly: true, changedLabels: ["brand", "vibe"] });
    expect(html).toContain("casting context");
    expect(html).not.toContain("This is a new person");
    expect(html).toContain("keeps its context");
  });
});
