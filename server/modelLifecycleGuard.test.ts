/**
 * THE model-lifecycle literal guard (Batch B, floorParity pattern): ONE
 * shared read model — shared/modelLifecycle — consumed identically by every
 * model/cast lifecycle READ surface. Source-level assertions so an ad-hoc
 * derivation can never creep back in silently:
 *
 *   - `status === "active"` as the complete minted test (misreads legacy
 *     `locked`, the FR-4 minted alias)
 *   - agencyId presence as minted-state inference (a stray ID on a draft
 *     read minted; a missing ID on a minted row read draft)
 *   - `!isDraft` / "not minted" as a draft shortcut (degrades archived and
 *     unknown statuses into editable fallbacks)
 *   - the gallery `isMinted: true` assumption (every gallery load read minted)
 *   - requested-action / stayDraft inference (gate state from what the
 *     client asked for instead of what the server did)
 *
 * SCOPE: exactly the files listed below — the model lifecycle read/UI
 * surfaces. User-account `locked`, board status, garment/job status, and
 * every other domain that happens to use these words are deliberately NOT
 * scanned; this guard must never flag correct unrelated status code.
 *
 * ALLOWLIST (pinned by exact count): authoritative server MUTATION guards
 * and operation-specific integrity checks may inspect status/agencyId
 * directly — the mint ceremony's clean-draft check, its refusal copy and
 * nickname draft-affordance, applyModelEdit's D-43 seal, the export
 * dossier's agencyId requirement, and telemetry fields. Growing any pinned
 * count means a NEW direct derivation was added — route it through
 * shared/modelLifecycle instead, or (for a genuine new mutation guard)
 * update the pin deliberately in review.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const read = (rel: string) => readFileSync(join(__dirname, "..", rel), "utf-8");

/** The model-lifecycle READ surfaces (client). */
const CLIENT_READ_SCOPE = [
  "client/src/features/studio/stores/useStudioStore.ts",
  "client/src/features/studio/hooks/useCastGate.ts",
  "client/src/features/studio/hooks/useResumeDraft.ts",
  "client/src/features/studio/hooks/useSessionPersistence.ts",
  "client/src/features/studio/hooks/useSessionReset.ts",
  "client/src/features/studio/hooks/useLoadWardrobeModel.ts",
  "client/src/features/export/useExportPack.ts",
  "client/src/features/casting/hooks/useCastingExport.ts",
  "client/src/features/boards/canvas/nodes/useSheetController.ts",
  "client/src/features/boards/components/NodeInfoPanel.tsx",
];

/** The model-lifecycle READ surfaces (server) — these files also hold the
 *  pinned mutation/integrity allowlist. */
const SERVER_READ_SCOPE = [
  "server/casting/mintPackage.ts",
  "server/lib/boardOps.ts",
  "server/routes/registry.ts",
  "server/routes/generation/castingExport.ts",
  "server/db/models.ts",
  "server/db/wardrobe.ts",
];

const SCOPE = [...CLIENT_READ_SCOPE, ...SERVER_READ_SCOPE];

const count = (src: string, re: RegExp) => (src.match(re) ?? []).length;

describe("model lifecycle literal guard (Batch B)", () => {
  it("no scoped file compares model status to 'active' or 'locked' — the shared predicates own minted", () => {
    for (const rel of SCOPE) {
      const src = read(rel);
      expect(
        count(src, /\bstatus\s*[!=]==?\s*["'](active|locked)["']/g),
        `${rel} must not hand-roll a minted test — use isModelMintedStatus`,
      ).toBe(0);
    }
  });

  it("no scoped file compares model status to 'archived' — availability flows through the shared predicates", () => {
    // The one sanctioned direct archived comparison lives in
    // server/casting/modelGuards.ts (assertNotArchived, Batch 0's single
    // authority guard) — deliberately outside this read scope.
    for (const rel of SCOPE) {
      const src = read(rel);
      expect(
        count(src, /\bstatus\s*[!=]==?\s*["']archived["']/g),
        `${rel} must not hand-roll an archived test — use isModelArchivedStatus/isModelAvailableStatus`,
      ).toBe(0);
    }
  });

  it("draft-literal comparisons exist ONLY as the pinned mutation guards", () => {
    // server/casting/mintPackage.ts — the mint ceremony's own transition
    // rules (clean-draft check, refusal copy branch, nickname draft
    // affordance). server/lib/boardOps.ts — applyModelEdit's D-43 seal.
    const pins: Record<string, number> = {
      "server/casting/mintPackage.ts": 3,
      "server/lib/boardOps.ts": 1,
    };
    for (const rel of SCOPE) {
      const src = read(rel);
      expect(
        count(src, /\bmodel\.status\s*[!=]==?\s*["']draft["']/g),
        `${rel}: direct draft comparisons are pinned to the audited mutation guards`,
      ).toBe(pins[rel] ?? 0);
    }
  });

  it("agencyId never rides a minted derivation — every minted+agencyId line carries the status predicate", () => {
    // Pinned exceptions: the mint ceremony's own post-transition result
    // (`minted: true` immediately after mintModel succeeds) and telemetry
    // fields (hasAgencyId) are not read models.
    for (const rel of SCOPE) {
      const src = read(rel);
      for (const [i, line] of src.split("\n").entries()) {
        if (!/agencyId/i.test(line) || !/minted/i.test(line)) continue;
        const sanctioned =
          /isModelMintedStatus/.test(line) || // status truth drives, ID is detail
          /hasAgencyId/.test(line) || // telemetry
          /cleanDraft/.test(line) || // the mint ceremony's pinned TRANSITION guard (mutation allowlist)
          /await mintModel\(/.test(line) || // the transition CALL itself, not a read
          /minted: true\b/.test(line) || // post-transition result — count-pinned separately below
          /^\s*(\/\/|\*)/.test(line) || // commentary
          /^\s*\}?,?\s*\[.*\]\s*\)?;?\s*$/.test(line); // React dependency arrays
        expect(
          sanctioned,
          `${rel}:${i + 1} pairs minted state with agencyId without the shared predicate: ${line.trim()}`,
        ).toBe(true);
      }
      // The bare inference forms, wherever they hide on a line:
      expect(
        count(src, /(isMinted|minted)\s*[:=]\s*!!\s*\w*\??\.?agencyId/g),
        `${rel} must not derive minted from agencyId presence`,
      ).toBe(0);
    }
  });

  it("literal minted:true exists only where proven — the mint ceremony's result and verify's guarded branch", () => {
    // mintPackage: the post-transition return (mintModel just succeeded).
    // registry: verify's minted branch is only reachable AFTER the
    // !isModelMintedStatus guard returned the public-absence shape.
    const pins: Record<string, number> = {
      "server/casting/mintPackage.ts": 1,
      "server/routes/registry.ts": 1,
    };
    for (const rel of SERVER_READ_SCOPE) {
      const src = read(rel);
      expect(
        count(src, /minted:\s*true\b/g),
        `${rel}: minted:true may exist only where the mint state is proven`,
      ).toBe(pins[rel] ?? 0);
    }
    // The registry pin stays honest only while the guard clause precedes it
    const registry = read("server/routes/registry.ts");
    expect(registry.indexOf("!isModelMintedStatus(model.status)")).toBeGreaterThan(-1);
    expect(registry.indexOf("!isModelMintedStatus(model.status)")).toBeLessThan(registry.indexOf("minted: true"));
  });

  it("the gallery hardcode stays dead: no isMinted:true literal in the studio store or the gate", () => {
    for (const rel of [
      "client/src/features/studio/stores/useStudioStore.ts",
      "client/src/features/studio/hooks/useCastGate.ts",
    ]) {
      const src = read(rel);
      expect(count(src, /isMinted:\s*true\b/g), `${rel} must not assume minted`).toBe(0);
    }
  });

  it("the gate consumes the SERVER result, never the requested action", () => {
    const src = read("client/src/features/studio/hooks/useCastGate.ts");
    expect(src).toContain("isMinted: result.minted");
    // stayDraft may choose the REQUEST shape, never the resulting state
    for (const [i, line] of src.split("\n").entries()) {
      if (/stayDraft/.test(line) && /isMinted/.test(line) && !/^\s*(\/\/|\*)/.test(line)) {
        throw new Error(
          `useCastGate.ts:${i + 1} infers minted state from the requested action: ${line.trim()}`,
        );
      }
    }
  });

  it("loadModelFromCast requires caller-supplied status truth (no zero-arg minted default)", () => {
    const src = read("client/src/features/studio/stores/useStudioStore.ts");
    expect(src).toMatch(/loadModelFromCast:\s*\(\s*modelId: number, fullBodyUrl: string, masterPrompt: string, minted: boolean\s*\)/);
  });

  it("every read surface that derives lifecycle state imports the shared module", () => {
    const mustImport = [
      "client/src/features/studio/hooks/useResumeDraft.ts",
      "client/src/features/studio/hooks/useSessionPersistence.ts",
      "client/src/features/studio/hooks/useSessionReset.ts",
      "client/src/features/studio/hooks/useLoadWardrobeModel.ts",
      "client/src/features/export/useExportPack.ts",
      "client/src/features/boards/components/NodeInfoPanel.tsx",
      "server/casting/mintPackage.ts",
      "server/lib/boardOps.ts",
      "server/routes/registry.ts",
      "server/db/models.ts",
    ];
    for (const rel of mustImport) {
      const src = read(rel);
      expect(
        /from ["'](@shared\/modelLifecycle|\.\.\/(\.\.\/)*shared\/modelLifecycle)["']/.test(src),
        `${rel} must consume shared/modelLifecycle`,
      ).toBe(true);
    }
    // EVERY export surface — the two client hooks AND the authoritative
    // server PDF route — consumes the ONE shared eligibility gate (which
    // wraps the lifecycle predicate): review correction 1 + final round A.
    for (const rel of [
      "client/src/features/export/useExportPack.ts",
      "client/src/features/casting/hooks/useCastingExport.ts",
      "server/routes/generation/castingExport.ts",
    ]) {
      expect(
        /from ["'](@shared\/exportEligibility|\.\.\/(\.\.\/)*shared\/exportEligibility)["']/.test(read(rel)),
        `${rel} must consume shared/exportEligibility`,
      ).toBe(true);
    }
  });

  it("the minted-gallery DB source filters by the shared minted-status list, never a bare 'active'", () => {
    const src = read("server/db/models.ts");
    expect(src).toContain("inArray(models.status, [...MODEL_MINTED_STATUSES])");
    expect(count(src, /eq\(models\.status,\s*["'](active|locked)["']\)/g)).toBe(0);
    // Pinned survivors: the drafts-source filter, Batch 0's archived helper,
    // and getUserModels' archived exclusion.
    expect(count(src, /eq\(models\.status,\s*["']draft["']\)/g)).toBe(1);
    expect(count(src, /eq\(models\.status,\s*["']archived["']\)/g)).toBe(1);
    expect(count(src, /ne\(models\.status,\s*["']archived["']\)/g)).toBe(1);
  });

  it("the sheet controller's minted state comes only from packageState (server truth)", () => {
    const src = read("client/src/features/boards/canvas/nodes/useSheetController.ts");
    expect(src).toContain("packageQuery.data?.minted === true");
  });

  it("the shared module owns the exhaustive switch — assertNever stays wired", () => {
    const src = read("shared/modelLifecycle.ts");
    expect(src).toContain("assertNeverModelStatus");
    expect(count(src, /assertNeverModelStatus\(status\)/g)).toBe(4); // one per predicate
  });

  // ── Review correction 1: export eligibility precedes ALL paid/mutating work ──

  it("every export action resolves eligibility BEFORE its first mutation call, and never prints a DRAFT placeholder", () => {
    const slice = (src: string, from: string, to?: string) => {
      const start = src.indexOf(from);
      expect(start, `marker ${from} must exist`).toBeGreaterThan(-1);
      const end = to ? src.indexOf(to, start) : src.length;
      return src.slice(start, end === -1 ? src.length : end);
    };

    // Final round C: every export action's body lives INSIDE the shared
    // withExportEligibility boundary (behavior-tested with spied mutations in
    // exportEligibility.test.ts). Within each action: the boundary call comes
    // before any mutation reference, and mutations are only PASSED to the
    // boundary (`.mutateAsync` as a reference), never invoked directly —
    // `.mutateAsync(` calls inside an export action would bypass the boundary.
    const actionSlices: Array<[string, string, string | undefined]> = [
      ["client/src/features/export/useExportPack.ts", "const downloadPdf", "const downloadZip"],
      ["client/src/features/export/useExportPack.ts", "const downloadZip", "return {"],
      ["client/src/features/casting/hooks/useCastingExport.ts", "const handleExport", undefined],
    ];
    for (const [rel, from, to] of actionSlices) {
      const body = slice(read(rel), from, to);
      const gateAt = body.indexOf("withExportEligibility(");
      expect(gateAt, `${rel} ${from} must run inside the eligibility boundary`).toBeGreaterThan(-1);
      const firstMutationRef = body.indexOf(".mutateAsync");
      expect(firstMutationRef, `${rel} ${from} passes mutations to the boundary`).toBeGreaterThan(-1);
      expect(gateAt, `${rel} ${from}: the boundary must precede any mutation reference`).toBeLessThan(firstMutationRef);
      expect(
        count(body, /\.mutateAsync\(/g),
        `${rel} ${from}: no direct mutation call may bypass the boundary`,
      ).toBe(0);
    }

    // Identity artifacts never carry a fake ID — client hooks AND the server
    // route (final round A: the server once fabricated `MOD-YY-DRAFT`)
    for (const rel of [
      "client/src/features/export/useExportPack.ts",
      "client/src/features/casting/hooks/useCastingExport.ts",
      "server/routes/generation/castingExport.ts",
    ]) {
      // The two fallback shapes that existed: `|| "DRAFT"` style defaults and
      // the fabricated `MOD-YY-DRAFT` template (commentary may say the word)
      expect(
        count(read(rel), /(\|\||\?\?)[^;\n]*DRAFT|-DRAFT/g),
        `${rel}: no DRAFT identity-ID fallback`,
      ).toBe(0);
    }

    // The server route resolves eligibility BEFORE preparing/generating the PDF
    const server = read("server/routes/generation/castingExport.ts");
    const serverGate = server.indexOf("resolveExportEligibility(");
    expect(serverGate).toBeGreaterThan(-1);
    expect(serverGate).toBeLessThan(server.indexOf("PdfModelData = {"));
    expect(serverGate).toBeLessThan(server.indexOf("generatePremiumIdentityPdf("));
    // ...and prints ONLY the resolver's verified ID
    expect(server).toContain("agencyId: exportId");
    expect(server).toContain("filename: `LEGAL_IDENTITY_${exportId}.pdf`");
  });

  // ── Review correction 5: availability required before load/restore ──

  it("load/restore surfaces require availability, never treating unknown status as an editable draft", () => {
    for (const rel of [
      "client/src/features/studio/hooks/useLoadWardrobeModel.ts",
      "client/src/features/studio/hooks/useResumeDraft.ts",
      "client/src/features/studio/hooks/useSessionPersistence.ts",
      "client/src/features/studio/hooks/useSessionReset.ts",
    ]) {
      expect(read(rel), `${rel} must gate on isModelAvailableStatus`).toContain("isModelAvailableStatus");
    }
    // useLoadWardrobeModel guards BOTH entry points
    expect(count(read("client/src/features/studio/hooks/useLoadWardrobeModel.ts"), /isModelAvailableStatus\(/g)).toBe(2);
  });

  it("the info panel derives 'Not minted' from status, never from a missing agencyId", () => {
    const src = read("client/src/features/boards/components/NodeInfoPanel.tsx");
    expect(src).toContain("isModelMintedStatus(data.model.status)");
    expect(src).not.toMatch(/agencyId\s*\?\?\s*['"]Not minted['"]/);
  });

  // ── Review correction 3: dead persisted links are actively cleared ──

  it("the degraded wardrobe resume clears the persisted cast link; startup restore clears only CONFIRMED-dead links", () => {
    const reset = read("client/src/features/studio/hooks/useSessionReset.ts");
    expect(reset).toContain("clearPersistedSession()");
    const persistence = read("client/src/features/studio/hooks/useSessionPersistence.ts");
    expect(persistence).toContain("isDeadSessionErrorCode");
    // NOT_FOUND/FORBIDDEN only — a transient network failure must never clear
    expect(persistence).toMatch(/code === "NOT_FOUND" \|\| code === "FORBIDDEN"/);
  });

  // ── Documented-intentional board provenance boundary (NOT redesigned in Batch B) ──

  it("CastNode reads the server-stamped provenance snapshot — pinned intentional, not an ad-hoc derivation", () => {
    // The draft flag on a placed node is stamped by fillFromLibrary from the
    // shared read model at fill time and reconciled at the established
    // fill/mint boundaries; live package truth comes from packageState via
    // useSheetController. CastNode itself must keep reading the stamp — a
    // direct status literal appearing here would be a new derivation.
    const src = read("client/src/features/boards/canvas/nodes/CastNode.tsx");
    expect(src).toContain('prov?.type === "library_cast" && prov.draft === true');
    expect(count(src, /\bstatus\s*[!=]==?\s*["'](draft|active|locked|archived)["']/g)).toBe(0);
  });

  it("boards.getItemModelInfo keeps EXACTLY the Batch 0 archived-source boundary", () => {
    // The one sanctioned archived comparison outside modelGuards: the D-12
    // "Source unavailable" degradation (Batch 0, review fix 7). Pinned so a
    // second direct status read cannot creep into the boards router.
    const src = read("server/routes/boards.ts");
    expect(count(src, /\bstatus\s*[!=]==?\s*["']archived["']/g)).toBe(1);
    expect(count(src, /\bstatus\s*[!=]==?\s*["'](draft|active|locked)["']/g)).toBe(0);
    expect(src).toContain("sourceArchived");
  });
});
