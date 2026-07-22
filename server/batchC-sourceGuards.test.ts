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
    expect(src).toMatch(/headshotUrl:\s*anchor\.storageUrl/);
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
