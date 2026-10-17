import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/*
  ONE LOADER, FROM THE PRESS TO THE FINISHED PICTURE — card 2613.

  His report, 2026-10-17: *"when making an edit and submitting it, it first
  default to the old loading screen before showing me the new loading screen
  with the particles. i think also the new loading screen we have with the
  particles is too busy we need a cleaner design"*. His pick: *"go with B"* —
  B · One light.

  The flip was a branch on the wait: no shape map yet drew the dot field
  ("sending"), a shape map drew the particle dust ("painting"). So this suite
  renders the REAL viewer through React's own renderer at both of those
  moments, with and without a map on the row, and holds that:

  - exactly one light is drawn, and no dot field, no dust, no canvas;
  - the "sending" and "painting" plates are the same markup except for the
    two facts that really move — the bar's width and the stage word.

  A second loader coming back, under any condition the row can carry, reddens
  the first arm; a loader that differs between the two moments reddens the
  second. The negative controls: no wait draws no light, and a settling row
  (nothing is rendering) draws no light either.
*/
vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return { ...actual, createPortal: (children: unknown) => children };
});
vi.stubGlobal("window", { location: { origin: "https://klieg.test" } });
vi.stubGlobal("document", { body: {} });

const { CandidateViewer } = await import("./components/CandidateViewer");

const FRAMES = Array.from({ length: 2 }, (_, at) => ({
  url: `https://example.test/${at}.png`,
  label: `0${at + 1}`,
  downloadName: `candidate-0${at + 1}`,
  candidateId: `c${at}`,
}));

/* The shape map the server still sends on a row. Passed through on purpose:
   the viewer must draw the same loader whether it is there or not. */
const MAP = { w: 2, h: 1, cells: "90" };

function plate(wait: Record<string, unknown> | null): string {
  const html = renderToStaticMarkup(createElement(CandidateViewer, {
    frames: FRAMES,
    index: 0,
    onIndexChange: () => undefined,
    onClose: () => undefined,
    wait,
  } as never));
  const start = html.indexOf('class="dpc-viewer__plate"');
  expect(start, "the viewer must draw its plate").toBeGreaterThan(0);
  return html.slice(start, html.indexOf("</figure>", start));
}

const said = "their teeth — vampire fangs";
const sending = { instruction: said, stage: "dispatched", step: "preparing", extra: 0 };
const painting = { instruction: said, stage: "dispatched", step: "rendering", extra: 0 };

function count(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

describe("the refine wait is one loader (card 2613)", () => {
  const moments = {
    "sending, before the server has a map": sending,
    "sending, with a map": { ...sending, figure: MAP },
    "painting, without a map": painting,
    "painting, with a map": { ...painting, figure: MAP },
    "queued, the local head of the wait": { instruction: said, stage: "queued", step: null, extra: 0 },
  };

  for (const [name, wait] of Object.entries(moments)) {
    it(`draws the one light and no second loader — ${name}`, () => {
      const html = plate(wait);
      expect(count(html, "dpc-viewer__light"), "exactly one light").toBe(1);
      expect(html, "the old dot field").not.toContain("dpc-viewer__dots");
      expect(html, "the particle dust").not.toContain("dpc-viewer__dust");
      expect(html, "the particle dust").not.toContain("data-dust");
      expect(html, "no canvas loader of any kind").not.toContain("<canvas");
      /* The rest of the loader is there too: the words, the scrim, the status. */
      expect(html).toContain(said);
      expect(html).toContain("dpc-viewer__falloff");
    });
  }

  it("draws the same loader at sending and at painting — only the bar and the word move", () => {
    const normal = (html: string) => html
      .replace(/style="width:[^"]*"/g, 'style="width:X"')
      .replace(/<span class="dpc-viewer__step">[^<]*<\/span>/g, '<span class="dpc-viewer__step">W</span>');
    const atSending = plate(sending);
    const atPainting = plate({ ...painting, figure: MAP });
    expect(atSending).toContain(">sending<");
    expect(atPainting).toContain(">painting<");
    expect(atSending, "the two moments really differ before normalising").not.toBe(atPainting);
    expect(normal(atPainting)).toBe(normal(atSending));
  });

  it("draws no light when there is no wait", () => {
    expect(plate(null)).not.toContain("dpc-viewer__light");
  });

  it("draws no light over a settling row — nothing is rendering it", () => {
    const html = plate({ instruction: said, stage: "settling", step: "reading", extra: 0 });
    expect(html).not.toContain("dpc-viewer__light");
    expect(html).not.toContain("dpc-viewer__dots");
    /* The wait itself still narrates the row. */
    expect(html).toContain(said);
  });
});
