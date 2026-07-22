import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { summarizeFinalCastDeletion } from "./casting/finalCastDeletion";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("R7-5E permanent Cast deletion product contract", () => {
  it("projects only the five non-sensitive founder-facing counts", () => {
    expect(summarizeFinalCastDeletion({
      deleted: true,
      counts: {
        assets: 6,
        canvasItems: 2,
        canvasVersions: 8,
        affectedBoards: 1,
        wardrobeSessions: 3,
        wardrobeLooks: 4,
        generationAttempts: 9,
        priorOperations: 12,
        bugReportsScrubbed: 1,
        cleanupObjects: 20,
      },
    })).toEqual({
      castViews: 6,
      canvasPlacements: 2,
      affectedBoards: 1,
      wardrobeSessions: 3,
      wardrobeLooks: 4,
    });
  });

  it("refuses malformed replay evidence instead of inventing success counts", () => {
    expect(summarizeFinalCastDeletion({ deleted: true, counts: {} })).toBeNull();
    expect(summarizeFinalCastDeletion({
      deleted: true,
      counts: {
        assets: 1,
        canvasItems: -1,
        affectedBoards: 0,
        wardrobeSessions: 0,
        wardrobeLooks: 0,
      },
    })).toBeNull();
  });

  it("keeps one plain confirmation and never offers archive or recovery", () => {
    const dialog = source("client/src/features/lobby/DeleteCastDialog.tsx");
    expect(dialog).toContain("Delete this Cast permanently?");
    expect(dialog).toContain("Other images and videos you created stay.");
    expect(dialog).toContain("Delete Cast");
    expect(dialog).not.toMatch(/archive|recover|type to confirm/i);
  });

  it("uses the same dialog for Model Library and Recent Work, including minted Casts", () => {
    const library = source("client/src/features/lobby/LibraryView.tsx");
    const recent = source("client/src/features/lobby/RecentWorkSection.tsx");
    const card = source("client/src/features/lobby/RecentWorkCard.tsx");
    expect(library).toContain("<DeleteCastDialog");
    expect(recent).toContain("<DeleteCastDialog");
    expect(card).not.toContain("Minted identities can't be deleted");
  });

  it("propagates final truth to other tabs without auto-deleting anything", () => {
    const sync = source("client/src/features/operations/castDeletionSync.ts");
    const bridge = source("client/src/features/operations/GenerationOperationBridge.tsx");
    expect(sync).toContain("BroadcastChannel");
    expect(sync).toContain("localStorage.setItem");
    expect(bridge).toContain("subscribeCastDeleted");
    expect(sync).not.toContain("models.delete");
  });
});
