/**
 * R7-3 composer rail contract.
 *
 * The primary refinement door used to exist only as a hover overlay. These
 * tests pin the user-visible contract on the real component and retain one
 * small source tripwire for the host placement that server rendering cannot
 * observe without mounting the full tRPC workspace.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  RefinePanel,
  refineActionState,
} from "../client/src/features/casting/components/ImageViewer/RefinePanel";
import { useCastingUIStore } from "../client/src/features/casting/stores/useCastingUIStore";

function renderComposer(isGenerating = false) {
  return renderToStaticMarkup(
    createElement(RefinePanel, {
      maskPathsCount: 0,
      isMasking: false,
      iterationCost: 350,
      isGenerating,
      textAreaRef: createRef<HTMLTextAreaElement>(),
      handleGenerate: vi.fn(),
      handleEnhance: vi.fn(),
      handleRefineSubmit: vi.fn(),
    }),
  );
}

describe("R7-3 persistent Casting refinement composer", () => {
  beforeEach(() => useCastingUIStore.getState().resetUI());

  it("explains the safe action and shows its exact price before spending", () => {
    const html = renderComposer();

    expect(html).toContain("Refine this person");
    expect(html).toContain("Keeps their identity");
    expect(html).toContain("Apply · 350 credits");
    expect(html).not.toContain("credits per edit");
  });

  it("enables the priced Apply door only when an instruction exists", () => {
    expect(refineActionState("", false, 350)).toEqual({
      canSubmit: false,
      ariaLabel: "Apply refinement for 350 credits",
      label: "Apply · 350 credits",
    });
    expect(refineActionState("make the lighting softer", false, 350).canSubmit).toBe(true);
  });

  it("locks the composer while an edit is already generating", () => {
    useCastingUIStore.getState().setRefineInput("make the lighting softer");
    const html = renderComposer(true);

    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Applying refinement"/);
    expect(html).toContain("Applying…");
  });

  it("hosts the composer in the persistent dock rather than a hover overlay", () => {
    const panelSource = readFileSync(
      join(process.cwd(), "client/src/features/casting/ImageViewerPanel.tsx"),
      "utf8",
    );
    const canvasSource = readFileSync(
      join(process.cwd(), "client/src/features/studio/components/StudioCanvas.tsx"),
      "utf8",
    );

    expect(panelSource).toContain("bottomDock={bottomDock}");
    expect(panelSource).not.toContain("bottomOverlay={bottomOverlay}");
    expect(panelSource).not.toContain("CASTING_TIP_DISMISSED_KEY");
    expect(canvasSource).toContain("{bottomDock && (");
    expect(canvasSource.indexOf("{bottomDock && (")).toBeGreaterThan(
      canvasSource.indexOf("{/* Persistent dock slot"),
    );
  });
});
