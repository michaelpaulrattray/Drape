/** R7-3 Act-1 progressive-disclosure contracts. */
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CastingDescribeStart,
  shouldShowCastingDescribeStart,
} from "../client/src/features/casting/components/CastingDescribeStart";
import { WarmEmptyState } from "../client/src/features/casting/components/ImageViewer/WarmEmptyState";

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

describe("R7-3 Casting Act 1 — one obvious first action", () => {
  it("renders the brief as the room's subject with two quiet disclosure doors", () => {
    const html = renderToStaticMarkup(
      createElement(CastingDescribeStart, {
        briefField: createElement("input", { "aria-label": "Describe your model" }),
        onSurprise: vi.fn(),
        onOpenDetails: vi.fn(),
      }),
    );

    expect(html).toContain("Cast a model");
    expect(html).toContain("Describe them, and the studio sets everything up.");
    expect(html).toContain('aria-label="Describe your model"');
    expect(html).toContain("Surprise me");
    expect(html).toContain("Set details myself");
    expect(html).not.toContain("credits");
  });

  it("appears only for a truly new editable session", () => {
    const base = {
      hasAssets: false,
      hasExistingModel: false,
      isReadOnly: false,
      mintedEdit: false,
      detailsOpen: false,
    };

    expect(shouldShowCastingDescribeStart(base)).toBe(true);
    expect(shouldShowCastingDescribeStart({ ...base, detailsOpen: true })).toBe(false);
    expect(shouldShowCastingDescribeStart({ ...base, hasAssets: true })).toBe(false);
    expect(shouldShowCastingDescribeStart({ ...base, hasExistingModel: true })).toBe(false);
    expect(shouldShowCastingDescribeStart({ ...base, isReadOnly: true })).toBe(false);
    expect(shouldShowCastingDescribeStart({ ...base, mintedEdit: true })).toBe(false);
  });

  it("keeps translation and Surprise me free of generation calls", () => {
    const workspace = read("client/src/features/studio/components/CastingWorkspace.tsx");
    const surpriseBlock = workspace.slice(
      workspace.indexOf("const handleSurprise"),
      workspace.indexOf("const handleNewModel"),
    );
    const startBlock = workspace.slice(
      workspace.indexOf("if (showDescribeStart)"),
      workspace.indexOf("return (", workspace.indexOf("if (showDescribeStart)") + 30),
    );

    expect(surpriseBlock).toContain("updatePrefs(generateRandomPreferences())");
    expect(surpriseBlock).toContain("setDetailsOpen(true)");
    expect(surpriseBlock).not.toContain("handleGenerate");
    expect(startBlock).not.toContain("handleGenerate");
  });

  it("hands the translated brief to the existing ControlPanel choreography", () => {
    const workspace = read("client/src/features/studio/components/CastingWorkspace.tsx");
    const controlPanel = read("client/src/features/casting/ControlPanel.tsx");
    const promptField = read("client/src/features/casting/components/FromPromptField.tsx");

    expect(workspace).toContain('<FromPromptField variant="hero" onParsed={handleStartParsed} />');
    expect(workspace).toContain("initialParseResult={pendingParseResult}");
    expect(controlPanel).toContain("handleParsed(initialParseResult)");
    expect(controlPanel).toContain("Brief translated");
    expect(promptField).toContain("Enter to translate — nothing generates yet");
  });

  it("makes the details-stage portrait passive so the footer stays the one paid door", () => {
    const emptySource = read(
      "client/src/features/casting/components/ImageViewer/WarmEmptyState.tsx",
    );
    const html = renderToStaticMarkup(createElement(WarmEmptyState, { canGenerate: true }));

    expect(emptySource).not.toContain("onGenerate");
    expect(emptySource).not.toContain("onClick");
    expect(html).toContain("Ready for your headshot");
    expect(html).toContain("Use Cast model when the details look right.");
  });
});
