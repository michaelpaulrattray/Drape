import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("R7-7F live restore projection handoff", () => {
  it("wakes the durable-operation bridge after a successful whole-Cast restore", () => {
    const history = source(
      "client/src/features/casting/components/CastStateHistory.tsx",
    );
    const bridge = source(
      "client/src/features/operations/GenerationOperationBridge.tsx",
    );
    const workspace = source(
      "client/src/features/studio/components/CastingWorkspace.tsx",
    );

    expect(history).toContain(
      "utils.generation.activeOperations.invalidate()",
    );
    expect(history).toContain(
      "publishCastProjectionChanged(result.modelId)",
    );
    expect(bridge).toContain(
      "trpc.generation.activeOperations.useQuery",
    );
    expect(workspace).toContain(
      "utils.models.get.fetch({ modelId: currentModelId })",
    );
    expect(workspace).toContain(
      "applyModelTruth(model as LoadedCastingModel)",
    );
  });
});
