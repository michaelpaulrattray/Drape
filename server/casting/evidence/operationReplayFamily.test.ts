import { describe, expect, it } from "vitest";
import {
  OPERATION_REPLAY_FAMILY_BY_KIND,
  resolveOperationKindForReplay,
} from "./operationReplayFamily";
import { GENERATION_OPERATION_KINDS } from "../operationContract";

describe("evidence-aware operation replay families", () => {
  it("classifies every durable operation kind", () => {
    expect(Object.keys(OPERATION_REPLAY_FAMILY_BY_KIND).sort())
      .toEqual([...GENERATION_OPERATION_KINDS].sort());
  });

  it("derives a kind only when no receipt exists", () => {
    expect(resolveOperationKindForReplay({
      family: "refresh",
      derivedKind: "evidence_package_sync",
    })).toEqual({
      type: "resolved",
      kind: "evidence_package_sync",
      source: "derived",
    });
  });

  it("preserves an ordinary stored kind after evidence state changes", () => {
    expect(resolveOperationKindForReplay({
      family: "refresh",
      derivedKind: "evidence_package_sync",
      storedKind: "casting.refresh",
    })).toEqual({
      type: "resolved",
      kind: "casting.refresh",
      source: "stored",
    });
  });

  it("preserves an evidence-aware stored kind after state changes", () => {
    expect(resolveOperationKindForReplay({
      family: "mint",
      derivedKind: "casting.mint",
      storedKind: "evidence_mint",
    })).toEqual({
      type: "resolved",
      kind: "evidence_mint",
      source: "stored",
    });
  });

  it("refuses stored or derived kinds outside the endpoint family", () => {
    expect(resolveOperationKindForReplay({
      family: "refresh",
      derivedKind: "casting.refresh",
      storedKind: "casting.iterate",
    })).toEqual({ type: "family_conflict" });
    expect(() => resolveOperationKindForReplay({
      family: "refresh",
      derivedKind: "evidence_mint",
    })).toThrow("outside the replay family");
  });
});
