import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CandidateTile } from "./components/CandidateTile";
import { FollowingChip } from "./components/FollowingChip";
import { followedFaceThumb } from "./followLineage";

/*
  "FROM 05" ON EVERY TILE AND "FOLLOWING 06" ON THE CHIP (#2622).

  His report, verbatim, 2026-10-17: *"casts say from 05 meaning from sheet 05
  and the following sdays following 06 its kind of confusing dont you think is
  there a better design for this and the UX?"* — and on the proposal, *"sounds
  good"*. Two numbers side by side meaning two different things (a sheet and a
  face). The chip now shows the followed face's picture beside the word
  "Following", and the per-tile pill is gone.

  Both halves are driven through React's own renderer, so a number smuggled
  back in through a prop, a constant or a ternary is read the way the browser
  would read it. The readers below have their own controls: each is shown to
  catch the old markup before its clean verdict on the new markup counts.
*/

const SHEET = new URL("../../pages/CastingSheet.tsx", import.meta.url);
const TILE = new URL("./components/CandidateTile.tsx", import.meta.url);

/** The text a person sees: tags removed, entities for the × left as-is. */
function visibleText(markup: string): string {
  return markup.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

/** A face or sheet number in the chip ("06", "FOLLOWING 06", "Following 6"). */
const NUMBER = /\d/;
/** The per-tile lineage pill, by its words or its class. */
const FROM_PILL = /\bFROM\s*\d|dpc-card__lineage/i;

const readyCandidate = {
  candidateId: "cand-04",
  position: 3,
  indexLabel: "04",
  status: "ready" as const,
  imageUrl: "https://example.test/face-04.webp",
  kept: false,
  castId: null,
};

function renderTile(extra: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(
    createElement(CandidateTile, {
      candidate: readyCandidate,
      onOpenViewer: () => undefined,
      onKeep: () => undefined,
      onDiscard: () => undefined,
      onFollow: () => undefined,
      ...extra,
    } as Parameters<typeof CandidateTile>[0]),
  );
}

describe("the readers can see the old design (controls)", () => {
  it("the number reader catches the old chip, and the pill reader the old pill", () => {
    expect(visibleText('<span class="dpc-following__chip">FOLLOWING 06<button>×</button></span>')).toMatch(NUMBER);
    expect('<span class="dpc-card__lineage">FROM 05</span>').toMatch(FROM_PILL);
    expect("FROM 05").toMatch(FROM_PILL);
    /* And neither fires on a plain tile's own index, which is not a lineage pill. */
    expect('<span class="dp-metadata">04</span>').not.toMatch(FROM_PILL);
  });
});

describe("the FOLLOWING chip shows the face, never a number (card 2622)", () => {
  it("says Following beside the face's picture, with nothing numeric in it", () => {
    const markup = renderToStaticMarkup(
      createElement(FollowingChip, {
        faceId: "cand-06",
        thumbUrl: "https://example.test/face-06.webp",
        onClear: () => undefined,
      }),
    );
    expect(visibleText(markup)).toContain("Following");
    expect(markup).toContain('src="https://example.test/face-06.webp"');
    expect(markup).toContain('class="dpc-following__clear"');
    /* The face id rides as data for the latency probe — never as visible text. */
    expect(markup).toContain('data-face="cand-06"');
    expect(visibleText(markup)).not.toMatch(NUMBER);
  });

  it("while the face's roll has not answered it holds an empty frame, still with no number", () => {
    const markup = renderToStaticMarkup(
      createElement(FollowingChip, { faceId: "cand-06", thumbUrl: null, onClear: () => undefined }),
    );
    expect(markup).toContain('class="dpc-following__face"');
    expect(markup).not.toContain("<img");
    expect(visibleText(markup)).not.toMatch(NUMBER);
  });

  it("the sheet draws this chip and nothing else for it", async () => {
    const source = await readFile(SHEET, "utf8");
    expect(source).toContain("<FollowingChip");
    expect(source).not.toMatch(/FOLLOWING \{/);
    expect(source).not.toMatch(/Following \{/);
  });
});

describe("no tile carries a FROM pill (card 2622)", () => {
  it("a ready tile renders its own face and index, and no lineage pill even if one is passed", () => {
    /* Positive control: the render is real — the tile's own index and picture are there. */
    const markup = renderTile({ lineageLabel: "FROM 05" });
    expect(markup).toContain(">04<");
    expect(markup).toContain("face-04.webp");
    expect(markup).not.toMatch(FROM_PILL);
  });

  it("neither the sheet nor the tile composes a FROM label any more", async () => {
    const [sheet, tile] = await Promise.all([readFile(SHEET, "utf8"), readFile(TILE, "utf8")]);
    for (const source of [sheet, tile]) {
      expect(source).not.toMatch(/`FROM \$\{/);
      expect(source).not.toContain("lineageLabel");
      expect(source).not.toContain("dpc-card__lineage");
    }
  });
});

describe("the chip's picture is read off the followed face's own roll", () => {
  const candidates = [
    { candidateId: "cand-03", thumbUrl: "t3", imageUrl: "i3" },
    { candidateId: "cand-06", thumbUrl: null, imageUrl: "i6" },
  ];
  it("finds the face, preferring the thumbnail", () => {
    expect(followedFaceThumb({ face: { candidateId: "cand-03", rollId: "r" }, candidates })).toBe("t3");
    expect(followedFaceThumb({ face: { candidateId: "cand-06", rollId: "r" }, candidates })).toBe("i6");
  });
  it("is null with no face, a roll not yet loaded, or a face no longer on it", () => {
    expect(followedFaceThumb({ face: null, candidates })).toBeNull();
    expect(followedFaceThumb({ face: { candidateId: "cand-03", rollId: "r" }, candidates: undefined })).toBeNull();
    expect(followedFaceThumb({ face: { candidateId: "cand-99", rollId: "r" }, candidates })).toBeNull();
  });
});
