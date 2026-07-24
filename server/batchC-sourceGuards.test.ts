/**
 * Batch C — narrowly scoped PERMANENT literal/source guards (policy §16's
 * guard list). Each guard pins one structural invariant to the exact files
 * that own it — no repository-wide textual bans that would catch unrelated
 * user/wardrobe/board concepts.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (rel: string) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8");
const serverFile = (rel: string) => read(path.join("server", rel));
const clientFile = (rel: string) => read(path.join("client", "src", rel));

describe("no client can submit authorization/provenance fields (M2/M21)", () => {
  // The tRPC input surfaces that touch model assets/identity. Model-asset
  // provenance is server-written ONLY; board-item placement provenance
  // (routes/boardOps.ts createNode — a different ledger, D-12) stays
  // legitimate, so that file is checked for the identity-shaped fields only.
  const MODEL_ROUTE_FILES = [
    "routes/generation/castingRefinement.ts",
    "routes/generation/castingImaging.ts",
    "routes/generation/index.ts",
    "routes/models.ts",
  ];
  const IDENTITY_SHAPED = ["identityRole", "identityRevisionId", "anchorEligible", "stalesSiblings", "identityPatch"];
  const inputBlocksOf = (src: string) => src.match(/\.input\(z\.object\(\{[\s\S]*?\}\)/g) ?? [];

  it.each(MODEL_ROUTE_FILES)("%s carries no provenance-shaped input field", (rel) => {
    const src = serverFile(rel);
    for (const banned of ["provenance:", ...IDENTITY_SHAPED]) {
      for (const block of inputBlocksOf(src)) {
        expect(block, `${rel} input must not accept ${banned}`).not.toContain(banned);
      }
    }
  });

  it("routes/boardOps.ts inputs carry no identity-authority fields", () => {
    const src = serverFile("routes/boardOps.ts");
    for (const banned of IDENTITY_SHAPED) {
      for (const block of inputBlocksOf(src)) {
        expect(block, `boardOps input must not accept ${banned}`).not.toContain(banned);
      }
    }
  });
});

describe("one shared guard — no second identity classifier at another door (M15)", () => {
  it("the legacy fail-open classifier is gone", () => {
    expect(fs.existsSync(path.join(__dirname, "casting", "editClassifier.ts"))).toBe(false);
  });
  it("exactly one classifier prompt exists, inside the shared authority", () => {
    const authority = serverFile("casting/identity/editAuthority.ts");
    expect(authority).toContain("CLASSIFIER_PROMPT_HEADER");
    // No other casting module builds an identity-edit classifier prompt
    const castingDir = path.join(__dirname, "casting");
    for (const f of fs.readdirSync(castingDir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))) {
      if (f === "geminiSuggestions.ts") continue; // suggestions, not authorization
      const src = fs.readFileSync(path.join(castingDir, f), "utf8");
      expect(src, `${f} must not define its own identity classifier`).not.toMatch(/identityLevel\s*:/);
    }
  });
  it("every free-text door consumes the shared authority", () => {
    expect(serverFile("routes/generation/castingRefinement.ts")).toContain("authorizeEditRequest");
  });
});

describe("no automatic reconcile caller survives (M4)", () => {
  it("the client hook no longer calls generation.reconcile", () => {
    const hook = clientFile("features/casting/hooks/useCastingGeneration.ts");
    expect(hook).not.toContain("reconcile.useMutation");
    expect(hook).not.toMatch(/reconcileMutation/);
  });
  it("the server procedure refuses instead of writing", () => {
    const src = serverFile("routes/generation/castingRefinement.ts");
    const reconcileBlock = src.slice(src.indexOf("reconcile:"));
    expect(reconcileBlock.slice(0, 900)).toContain("REFUSAL_COPY.reconcileDisabled");
    expect(reconcileBlock.slice(0, 900)).not.toContain("reconcileSchemaWithImage");
  });
});

describe("image-only branches never write identity documents or stale flags (M17)", () => {
  it("iterate's image-only path has no updateModel / stale / compaction call", () => {
    const src = serverFile("routes/generation/castingRefinement.ts");
    const iterateBlock = src.slice(src.indexOf("iterate:"), src.indexOf("// Proxy endpoint"));
    // Both successful branches cross the R7 atomic snapshot boundary; the
    // route itself owns no direct model/asset/stale writer.
    expect(iterateBlock).toContain("commitIteratedIdentitySnapshot");
    expect(iterateBlock).toContain("commitImageRefineSnapshot");
    expect(iterateBlock).not.toContain("commitIdentityEdit");
    expect(iterateBlock).not.toContain("updateModel(");
    expect(iterateBlock).not.toContain("markModelAssetsStale");
    expect(iterateBlock).not.toContain("compactMasterPrompt");
    expect(iterateBlock).not.toContain("updateSchemaForIteration");
    // Freeze-and-append is dead
    expect(iterateBlock).not.toContain("APPLIED MODIFICATION");
  });
});

describe("Canvas recast has one atomic snapshot writer", () => {
  it("removes the legacy identity commit doors from boardOps", () => {
    const src = serverFile("lib/boardOps.ts");
    expect(src).toContain("commitCanvasRecastSnapshot");
    expect(src).not.toContain("commitAnchorReRoll");
    expect(src).not.toContain("commitIdentityEdit");
  });
});

describe("no stale writer exempts pinned assets (§14)", () => {
  it("the shared stale selection carries no pinned filter", () => {
    const src = serverFile("casting/identity/anchorSelector.ts");
    const fn = src.slice(src.indexOf("export function selectStaleSiblingHeads"));
    expect(fn).not.toMatch(/!\s*h?\.?pinned/);
    expect(fn).not.toMatch(/filter\([^)]*pinned/);
  });
});

describe("no raw newest-headshot selector bypasses the shared anchor selector (M21)", () => {
  it.each(["casting/mintPackage.ts", "casting/refreshSlots.ts"])(
    "%s imports and consumes selectIdentityAnchor",
    (rel) => {
      const src = serverFile(rel);
      expect(src).toContain("selectIdentityAnchor");
    },
  );
  it("refresh no longer feeds slot generation from the newest-filled slot url", () => {
    const src = serverFile("casting/refreshSlots.ts");
    expect(src).not.toMatch(/headshotUrl:\s*headshot\.url/);
    expect(src).toContain('anchorUrl: state.status === "current" ? state.anchor.storageUrl : null');
    expect(src).toMatch(/headshotUrl:\s*anchorUrl/);
  });
  it("mint/Add Views uses snapshot selections, identity documents, and anchor in snapshot mode", () => {
    const src = serverFile("casting/mintPackage.ts");
    expect(src).toContain("snapshotMintExecutionAuthority");
    expect(src).toContain("state.identity.masterPrompt");
    expect(src).toContain("selectedByAngle.set(view.angle, selected)");
    expect(src).toContain("selectedById.get(state.anchor.id) ?? state.anchor");
    expect(src).toContain("model: snapshotAuthority?.generationModel ?? model");
    const route = serverFile("routes/generation/castingExport.ts");
    expect(route).toMatch(/executeMintPackage\(\{[\s\S]*?readMode,/);
  });
});

describe("headshot snapshot reads stay server-owned", () => {
  it("captures one mode, validates the receipt head before money, and uses immutable identity documents", () => {
    const src = serverFile("routes/generation/castingImaging.ts");
    expect(src).toContain("const readMode = captureSnapshotReadMode(ctx.user.id)");
    expect(src).toContain("resolveEffectiveCastStateForRead");
    expect(src).toContain("assertGenerationOperationSnapshotHead");
    expect(src).toContain("state.identity.masterPrompt");
    expect(src).toContain("state.identity.technicalSchema");
    expect(src).toContain("state.identity.preferences");
    expect(src).toMatch(/commitHeadshotSnapshot\(\{[\s\S]*?readMode,/);
    expect(src).toMatch(
      /assertGenerationOperationSnapshotHead\([\s\S]*?deductPoints\(/,
    );
    const input = src.slice(src.indexOf(".input(z.object({"), src.indexOf("}).strict()"));
    expect(input).not.toContain("readMode");
    const transition = serverFile("casting/snapshotTransitions.ts");
    const headshotBlock = transition.slice(
      transition.indexOf("export async function commitHeadshotSnapshot"),
      transition.indexOf("async function selectedIterationTargetIn"),
    );
    expect(headshotBlock).toContain('input.readMode === "snapshot" && context.current');
    expect(headshotBlock).toContain("context.current.identitySnapshot");
  });
});

describe("iteration snapshot reads stay server-owned", () => {
  it("captures one mode, selects only package views, and validates the receipt head before money", () => {
    const src = serverFile("routes/generation/castingRefinement.ts");
    const iterateBlock = src.slice(src.indexOf("iterate:"), src.indexOf("// Proxy endpoint"));
    expect(iterateBlock).toContain("const readMode = captureSnapshotReadMode(ctx.user.id)");
    expect(iterateBlock).toContain("resolveEffectiveCastStateForRead");
    expect(src).toContain("state.selectedViews.find");
    expect(iterateBlock).toContain('if (readMode === "r6")');
    expect(iterateBlock).toContain("assertGenerationOperationSnapshotHead");
    expect(iterateBlock).toContain("generationModel.masterPrompt");
    expect(iterateBlock).toContain("generationModel.technicalSchema");
    expect(iterateBlock).toContain("generationModel.preferences");
    expect(iterateBlock).toMatch(/commitImageRefineSnapshot\(\{[\s\S]*?readMode,/);
    expect(iterateBlock).toMatch(/commitIteratedIdentitySnapshot\(\{[\s\S]*?readMode,/);
    expect(iterateBlock.indexOf("assertGenerationOperationSnapshotHead"))
      .toBeLessThan(iterateBlock.indexOf("withAtomicCredits"));
    const input = serverFile("routes/generation/iterateInput.ts");
    expect(input).not.toContain("readMode");
  });

  it("the atomic writers independently reject unselected snapshot targets and use immutable identity documents", () => {
    const src = serverFile("casting/snapshotTransitions.ts");
    const imageBlock = src.slice(
      src.indexOf("export async function commitImageRefineSnapshot"),
      src.indexOf("export async function commitIteratedIdentitySnapshot"),
    );
    const identityBlock = src.slice(
      src.indexOf("export async function commitIteratedIdentitySnapshot"),
      src.length,
    );
    expect(imageBlock).toContain('input.readMode === "snapshot"');
    expect(imageBlock).toContain("context.current.slots.find");
    expect(imageBlock).toContain('selectedTarget?.compatibility !== "current"');
    expect(imageBlock).toContain("context.current.identitySnapshot");
    expect(identityBlock).toContain('input.readMode === "snapshot"');
    expect(identityBlock).toContain("context.current.slots.find");
    expect(identityBlock).toContain('selectedTarget?.compatibility !== "current"');
    expect(identityBlock).toContain("context.current.identitySnapshot.masterPrompt");
    expect(identityBlock).toContain("computeIdentityCommit(identityModel, input.patch)");
  });
});

describe("Canvas recast snapshot reads stay server-owned", () => {
  it("captures one mode, validates before running, asserts the receipt head before money, and threads mode into the executor", () => {
    const route = serverFile("routes/boardOps.ts");
    const executeBlock = route.slice(
      route.indexOf("applyModelEdit: router"),
      route.indexOf("/** R4", route.indexOf("applyModelEdit: router")),
    );
    expect(executeBlock).toContain("const readMode = captureSnapshotReadMode(ctx.user.id)");
    expect(executeBlock).toContain("prepareCanvasRecastAuthority");
    expect(executeBlock).toContain('if (readMode === "r6")');
    expect(executeBlock).toContain("assertGenerationOperationSnapshotHead");
    expect(executeBlock).toMatch(/executeApplyModelEdit\(\{[\s\S]*?readMode,/);
    expect(route.indexOf("input.verifyAfterRunning"))
      .toBeLessThan(route.indexOf("const result = await input.execute"));
    expect(executeBlock).not.toMatch(/input\.(readMode|snapshotId|packageSnapshotId|identitySnapshotId)/);
  });

  it("the executor resolves immutable documents after the receipt assertion and the writer independently reapplies them", () => {
    const boardOps = serverFile("lib/boardOps.ts");
    const authorityBlock = boardOps.slice(
      boardOps.indexOf("export async function prepareCanvasRecastAuthority"),
      boardOps.indexOf("/**", boardOps.indexOf("export async function prepareCanvasRecastAuthority") + 10),
    );
    expect(authorityBlock).toContain("resolveEffectiveCastStateForRead");
    expect(authorityBlock).toContain("state.identity.masterPrompt");
    expect(authorityBlock).toContain("state.identity.technicalSchema");
    expect(authorityBlock).toContain("state.identity.preferences");
    expect(authorityBlock).toContain("computeIdentityCommit(authorityModel, structured.patch)");
    expect(boardOps).toMatch(/commitCanvasRecastSnapshot\(\{[\s\S]*?readMode:\s*input\.readMode,/);

    const transitions = serverFile("casting/snapshotTransitions.ts");
    const recastBlock = transitions.slice(
      transitions.indexOf("export async function commitCanvasRecastSnapshot"),
      transitions.indexOf("interface IterationCandidate"),
    );
    expect(recastBlock).toContain('input.readMode === "snapshot"');
    expect(recastBlock).toContain("context.current.identitySnapshot");
    expect(recastBlock).toContain("computeIdentityCommit(identityModel, input.patch)");
    expect(recastBlock).toContain("masterPrompt: identityAuthority.masterPrompt");
    expect(recastBlock).toContain("preferences: identityAuthority.preferences");
  });
});

describe("Canvas package-consumption reads stay server-owned", () => {
  it("captures the rollout mode at both free mutation doors and threads it into the service", () => {
    const route = serverFile("routes/boardOps.ts");
    const fillBlock = route.slice(
      route.indexOf("fillFromLibrary: protectedProcedure"),
      route.indexOf("/** R3", route.indexOf("fillFromLibrary: protectedProcedure")),
    );
    const popOutBlock = route.slice(
      route.indexOf("popOutView: router"),
      route.indexOf("/** R5: dematerialize", route.indexOf("popOutView: router")),
    );
    for (const block of [fillBlock, popOutBlock]) {
      expect(block).toContain("const readMode = captureSnapshotReadMode(ctx.user.id)");
      expect(block).toMatch(/execute(?:FillFromLibrary|PopOutView)\(\{[\s\S]*?readMode,/);
      expect(block).not.toMatch(/input\.(readMode|snapshotId|packageSnapshotId|identitySnapshotId)/);
    }
  });

  it("selects explicit package slots in snapshot mode and retains the R6 ledger branch", () => {
    const source = serverFile("lib/boardOps.ts");
    const authority = source.slice(
      source.indexOf("export async function resolveCanvasPackageView"),
      source.indexOf("export async function executeFillFromLibrary"),
    );
    expect(authority).toContain('input.readMode === "snapshot"');
    expect(authority).toContain("resolveEffectiveCastStateForRead");
    expect(authority).toContain("state.selectedViews.find");
    expect(authority).toContain("getModelAssets(input.modelId)");
    expect(source).toMatch(/executeFillFromLibrary[\s\S]*?resolveCanvasPackageView\(\{[\s\S]*?angle:\s*"frontClose"/);
    expect(source).toMatch(/executePopOutView[\s\S]*?resolveCanvasPackageView\(\{[\s\S]*?angle:\s*input\.angle/);
  });
});

describe("B4 account-owned model projections stay snapshot-selected", () => {
  it("captures rollout mode at models.get, picker, lobby, and gallery routes", () => {
    const modelsRoute = serverFile("routes/models.ts");
    const getBlock = modelsRoute.slice(
      modelsRoute.indexOf("get: protectedProcedure"),
      modelsRoute.indexOf("// Update model display name"),
    );
    expect(getBlock).toContain("const readMode = captureSnapshotReadMode(ctx.user.id)");
    expect(getBlock).toContain("projectEffectiveModelForClient");
    expect(getBlock).not.toMatch(/input\.(readMode|snapshotId|packageSnapshotId|identitySnapshotId)/);

    const boardRoute = serverFile("routes/boardOps.ts");
    const picker = boardRoute.slice(
      boardRoute.indexOf("listCastableModels: protectedProcedure"),
      boardRoute.indexOf("/** D-28: fill"),
    );
    expect(picker).toContain("const readMode = captureSnapshotReadMode(ctx.user.id)");
    expect(picker).toMatch(/listCastableModels\([\s\S]*?readMode\)/);

    const lobby = serverFile("routes/lobby.ts");
    expect(lobby).toContain("const readMode = captureSnapshotReadMode(ctx.user.id)");
    expect(lobby).toContain("getUserDraftModelsWithThumbnailForRead");
    expect(lobby).toContain("getUserMintedModelsWithThumbnailForRead");

    const wardrobe = serverFile("routes/wardrobe.ts");
    for (const procedure of ["listMinted", "listDrafts"]) {
      const start = wardrobe.indexOf(`${procedure}: protectedProcedure`);
      const block = wardrobe.slice(start, wardrobe.indexOf("}),", start) + 3);
      expect(block).toContain("const readMode = captureSnapshotReadMode(ctx.user.id)");
      expect(block).toContain("readMode,");
    }
  });

  it("keeps ledger history separate from selected presentation in the server and client hydration", () => {
    const projection = serverFile("casting/modelReadProjections.ts");
    expect(projection).toContain("assets: [...state.ledger.assets]");
    expect(projection).toContain("selectedAssets: selectedAssetsFromEffectiveState(state).map");
    expect(projection).toContain("id: asset.id");
    expect(projection).toContain("viewType: asset.viewType");
    expect(projection).toContain("storageUrl: asset.storageUrl");
    expect(projection).toContain('selectedAssetForAngle(state, "frontFull")');
    expect(projection).toContain('selectedAssetForAngle(state, "frontClose")');
    expect(projection).not.toMatch(/currentPackageSnapshotId:\s*state\./);

    const history = clientFile("features/casting/utils/buildHistoryFromAssets.ts");
    expect(history).toContain("selectedAssets?: AssetWithMeta[]");
    expect(history).toContain("if (selectionDiffers) history.push(selected)");
    for (const rel of [
      "features/studio/hooks/useResumeDraft.ts",
      "features/studio/hooks/useSessionPersistence.ts",
      "features/studio/hooks/useLoadWardrobeModel.ts",
      "features/studio/components/CastingWorkspace.tsx",
    ]) {
      expect(clientFile(rel)).toContain("selectedAssets");
    }
  });
});

describe("package generation preserves exact storage ownership", () => {
  it.each([
    ["generateFullBody", "export async function generateRemainingViews"],
    ["generateRemainingViews", "export interface IterationGenerationOptions"],
  ])("%s returns the persisted image and exact storage key", (functionName, endMarker) => {
    const src = serverFile("casting/aiService.ts");
    const start = src.indexOf(`export async function ${functionName}`);
    const end = src.indexOf(endMarker, start + 1);
    const block = src.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(block).toContain("): Promise<PersistedGenerationResult>");
    expect(block).toContain("uploadRawCandidate(");
    expect(block).toContain("...uploaded");
  });
});

describe("masked editing stays closed (M3)", () => {
  it("the server mask refusal remains before admission, charging, and generation", () => {
    const src = serverFile("routes/generation/castingRefinement.ts");
    const iterateBlock = src.slice(src.indexOf("iterate:"), src.indexOf("// Proxy endpoint"));
    const maskRefusal = iterateBlock.indexOf("if (input.maskBase64)");
    const rateLimit = iterateBlock.indexOf("checkRateLimit");
    const creditBoundary = iterateBlock.indexOf("withAtomicCredits");
    const generationCall = iterateBlock.indexOf("iterateModelRaw");
    expect(maskRefusal).toBeGreaterThan(-1);
    expect(maskRefusal).toBeLessThan(rateLimit);
    expect(maskRefusal).toBeLessThan(creditBoundary);
    expect(maskRefusal).toBeLessThan(generationCall);
    // The receipt records the refused input, but no mask reaches either
    // image-generation call.
    const generationInputs = iterateBlock.slice(
      iterateBlock.indexOf("const commonOptions"),
      iterateBlock.indexOf("if (!iterResult.imageUrl)"),
    );
    expect(generationInputs).not.toContain("maskBase64");
  });
  it("the board masked-edit surface stays deleted (Batch 0 regression)", () => {
    expect(fs.existsSync(path.join(__dirname, "..", "client", "src", "features", "boards", "components", "ModelEditorOverlay.tsx"))).toBe(false);
  });
});

describe("refused presentation/mark suggestions are not advertised (M16/M18/F5)", () => {
  it("the refine bar's rotating examples advertise no marks, makeup, or accessories", () => {
    const src = clientFile("features/casting/components/ImageViewer/RefinePanel.tsx");
    const examples = src.slice(src.indexOf("ROTATING_EXAMPLES"), src.indexOf("EXAMPLE_INTERVAL_MS"));
    expect(examples).not.toMatch(/tattoo|freckle|scar|piercing|makeup|earring|necklace|mascara|lash/i);
  });
  it("loading tips no longer promise mark carry-through or masked tools", () => {
    const src = clientFile("features/casting/components/ImageViewer/LoadingOverlay.tsx");
    expect(src).not.toContain("carry through to all generated views");
    expect(src).not.toContain("preserved through the draping process");
    expect(src).not.toMatch(/Paint a mask|eraser tool/);
  });
  it("the reference panel advertises only supported transfers", () => {
    const src = clientFile("features/casting/MasterPromptPanel.tsx");
    expect(src).not.toContain("apply eye makeup from reference");
    expect(src).not.toContain("hairstyle, tattoo, accessory, or look");
  });
  it("server fallback suggestions carry no mark or makeup edits", () => {
    const src = serverFile("casting/geminiSuggestions.ts");
    const fallback = src.slice(src.indexOf("FALLBACK_SUGGESTIONS"), src.indexOf("];"));
    expect(fallback).not.toMatch(/beauty mark|freckle|scar|tattoo|piercing|makeup/i);
  });
});

describe("forward-only migration shape (schema safety)", () => {
  it("the Batch C migration is a single additive ALTER — no destructive statement", () => {
    const sql = read(path.join("drizzle", "0005_crazy_killmonger.sql"));
    expect(sql).toContain("ALTER TABLE `models` ADD `identityRevisionId` varchar(64)");
    expect(sql).not.toMatch(/\b(DROP|MODIFY|CHANGE|DELETE|TRUNCATE|UPDATE)\b/i);
    // one statement only
    expect(sql.trim().split(";").filter((s) => s.trim()).length).toBe(1);
  });
  it("the schema column is nullable — NULL is the genesis revision, never backfilled", () => {
    const schema = read(path.join("drizzle", "schema.ts"));
    const line = schema.split("\n").find((l) => l.includes('identityRevisionId: varchar("identityRevisionId"'))!;
    expect(line).toBeDefined();
    expect(line).not.toContain("notNull");
    expect(line).not.toContain("default");
  });
});
