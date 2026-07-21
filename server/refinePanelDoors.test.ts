/**
 * V1+V14 (R6 Batch A-coupled) — the client half of the six typed-iteration
 * doors, plus narrowly-scoped source guards against the allowlist returning.
 *
 * Component half (real component, react-dom/server static markup — the
 * castModelModal.test.ts pattern): RefinePanel renders the live refine bar
 * on every canonical view — no view yields the old refusal card, and no
 * masked tool affordance renders in the default tool state. The full
 * hover/typing flow is browser territory; the structural contract is pinned
 * here.
 *
 * Source guards (scoped to the exact files that carried the residue — not a
 * repo-wide ban): the per-view allowlist identifier and array literal are
 * gone from the four client files; the server iterate route derives its
 * frame from the exhaustive canonical map, not a binary ternary; and no
 * client code can arm the surgical/eraser tools (Batch 0 closure).
 */
import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CANONICAL_VIEW_ANGLES } from "../shared/boardTypes";
import { RefinePanel } from "../client/src/features/casting/components/ImageViewer/RefinePanel";
import { useCastingUIStore } from "../client/src/features/casting/stores/useCastingUIStore";

const read = (rel: string) => readFileSync(join(__dirname, "..", rel), "utf-8");

function renderPanel() {
  return renderToStaticMarkup(
    createElement(RefinePanel, {
      maskPathsCount: 0,
      isMasking: false,
      iterationCost: 350,
      isGenerating: false,
      textAreaRef: { current: null },
      handleGenerate: () => {},
      handleEnhance: () => {},
      handleRefineSubmit: () => {},
    }),
  );
}

describe("RefinePanel — the refine bar renders on every canonical view", () => {
  it.each([...CANONICAL_VIEW_ANGLES])("%s gets a live refine input, not a refusal card", (angle) => {
    useCastingUIStore.setState({ activeView: angle, activeTool: "none", refineInput: "" });
    const html = renderPanel();
    expect(html).toContain("data-refine-input");
    expect(html).toContain("Apply");
    // The stabilization refusal copy is dead on every view
    expect(html).not.toContain("cannot be edited");
    // No masked-tool affordance in the default tool state (Batch 0 stays closed)
    expect(html).not.toContain("Erase");
    expect(html).not.toContain("masked area");
  });
});

describe("source guards — the obsolete allowlist and binary framing cannot return (scoped)", () => {
  const CLIENT_RESIDUE_FILES = [
    "client/src/features/casting/hooks/useCastingGeneration.ts",
    "client/src/features/casting/components/ImageViewer/RefinePanel.tsx",
    "client/src/features/casting/ImageViewerPanel.tsx",
    "client/src/features/studio/components/CastingWorkspace.tsx",
  ];
  // The exact era-0/stabilization shape: a three-element allowlist array
  const THREE_VIEW_ALLOWLIST =
    /\[\s*['"]frontClose['"]\s*,\s*['"]frontFull['"]\s*,\s*['"]backFull['"]\s*\]/;

  it("no client residue file carries isIterationAllowed or the three-view allowlist", () => {
    for (const rel of CLIENT_RESIDUE_FILES) {
      const src = read(rel);
      expect(src, `${rel} must not resurrect isIterationAllowed`).not.toContain("isIterationAllowed");
      expect(src, `${rel} must not resurrect the three-view allowlist`).not.toMatch(
        THREE_VIEW_ALLOWLIST,
      );
    }
  });

  it("the iterate route frames from the exhaustive canonical map, never a frontClose ternary", () => {
    const src = read("server/routes/generation/castingRefinement.ts");
    expect(src).toContain("iterationFramingForView");
    // The complete typed framing travels — crop AND canonical angle
    expect(src).toMatch(/viewAngle:\s*framing\.viewAngle/);
    expect(src).not.toMatch(/viewType\s*===\s*['"]frontClose['"]\s*\?\s*['"]HEADSHOT['"]/);
  });

  it("no client feature code can arm the surgical or eraser tool (Batch 0 closure)", () => {
    const featuresRoot = join(__dirname, "..", "client", "src", "features");
    const files = readdirSync(featuresRoot, { recursive: true })
      .map(String)
      .filter((f) => /\.(ts|tsx)$/.test(f));
    expect(files.length).toBeGreaterThan(50); // the walk actually walked
    const armPattern = /setActiveTool\(\s*['"](surgical|eraser)['"]/;
    for (const f of files) {
      const src = readFileSync(join(featuresRoot, f), "utf-8");
      expect(src, `${f} must not arm a masked tool`).not.toMatch(armPattern);
    }
  });
});
