import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  clarificationForCastingRefusal,
  parseCastingClarification,
} from "../shared/castingClarification";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("R7-3B server-backed casting clarification", () => {
  it("offers the canonical five hair-length choices with precise instructions", () => {
    const clarification = clarificationForCastingRefusal("hair_length_vague");
    expect(clarification).toEqual({
      kind: "hair_length",
      question: "How long should the hair be?",
      detail: "Choose one final length. Nothing was charged.",
      choices: [
        { label: "Very Short", instruction: "Set the final hair length to very short." },
        { label: "Short", instruction: "Set the final hair length to short." },
        { label: "Medium", instruction: "Set the final hair length to medium." },
        { label: "Long", instruction: "Set the final hair length to long." },
        { label: "Very Long", instruction: "Set the final hair length to very long." },
      ],
    });
    expect(clarificationForCastingRefusal("unknown")).toBeNull();
  });

  it("parses only the exact server-owned payload", () => {
    const clarification = clarificationForCastingRefusal("hair_length_vague");
    expect(parseCastingClarification(clarification)).toEqual(clarification);
    expect(parseCastingClarification({ ...clarification, question: "Pick anything" })).toBeNull();
    expect(parseCastingClarification({ ...clarification, choices: [] })).toBeNull();
  });

  it("renders the follow-up beside the priced composer without auto-submitting", () => {
    const card = read("client/src/features/casting/components/ImageViewer/RefinementClarification.tsx");
    const viewer = read("client/src/features/casting/ImageViewerPanel.tsx");

    expect(card).toContain("data-casting-clarification");
    expect(card).toContain("{clarification.detail}");
    expect(card).toContain("Review it, then apply when ready");
    expect(card).not.toContain("handleRefineSubmit");
    expect(viewer).toContain("setRefineInput(instruction)");
    expect(viewer).toContain("clarification: null");
  });

  it("keeps clarification and failures in context while clearing text only after completion", () => {
    const hook = read("client/src/features/casting/hooks/useCastingGeneration.ts");
    const clarificationBranch = hook.slice(
      hook.indexOf('const clarification = "clarification" in result'),
      hook.indexOf("if (!result.success || !result.imageUrl)"),
    );

    expect(clarificationBranch).toContain("parseCastingClarification");
    expect(clarificationBranch).toContain("castingOperation.succeed");
    expect(clarificationBranch).toContain('return "clarification"');
    expect(clarificationBranch).not.toContain("toast.");
    expect(hook).toContain('if (outcome === "completed")');
  });

  it("lets the free classifier answer before the server decides whether a payable edit can run", () => {
    const hook = read("client/src/features/casting/hooks/useCastingGeneration.ts");
    const iteration = hook.slice(
      hook.indexOf("const performIteration"),
      hook.indexOf("const handleRefineSubmit"),
    );

    expect(iteration).not.toContain("creditsData.balance < CREDIT_COSTS.iteration");
    expect(iteration).toContain("iterateMutation.mutateAsync");
    expect(iteration).toContain("/insufficient credits/i.test(message)");
    expect(iteration).toContain("setIsTopupOpen(true)");
  });

  it("does not let durable spinner settlement erase a returned clarification", () => {
    const workspace = read("client/src/features/studio/components/CastingWorkspace.tsx");
    const settlement = workspace.slice(
      workspace.indexOf("if (durableDisplayRef.current)"),
      workspace.indexOf("}, [applyModelTruth"),
    );

    expect(settlement).toContain("clarification: store.genState.clarification ?? null");
  });
});
