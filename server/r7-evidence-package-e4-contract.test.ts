import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(path, "utf8");
}

describe("R7-7E4 progressive evidence package UX contract", () => {
  it("exposes the complete read-only plan only behind all server-owned scopes", () => {
    const route = source("server/routes/generation/castingExport.ts");
    const authority = source(
      "server/casting/evidence/evidencePackageAuthority.ts",
    );
    const routeStart = route.indexOf("refreshSlotsPlan: protectedProcedure");
    const routeEnd = route.indexOf("/** R5 refresh execute", routeStart);
    const planRoute = route.slice(routeStart, routeEnd);

    expect(planRoute).toContain('readMode !== "snapshot"');
    expect(planRoute).toContain("captureEvidenceComposerEnabled(ctx.user.id)");
    expect(planRoute).toContain("captureEvidencePackageEnabled(ctx.user.id)");
    expect(planRoute).toContain("inspectEvidencePackageRoutePlan");
    expect(planRoute).toContain("{ ...ordinary, evidencePackage: evidence.plan }");
    expect(authority).toContain(
      "export async function inspectEvidencePackageRoutePlan",
    );
    expect(authority).toContain(
      "return withTransaction((tx) => inspectEvidencePackageRoutePlanIn(tx, input))",
    );
    expect(authority).toContain("computeEvidencePackageSyncPlan");
  });

  it("keeps accepted-feature coverage behind an explicit priced click", () => {
    const panel = source(
      "client/src/features/casting/evidence/InkAddPanel.tsx",
    );
    const start = panel.indexOf("export function InkFeatureAcceptedPanel");
    const end = panel.indexOf("export function InkAddComposer", start);
    const accepted = panel.slice(start, end);

    expect(accepted).toContain('{ modelId }');
    expect(accepted).toContain('onClick={() => refreshAngles(["sideFull"])}');
    expect(accepted).toContain("Update Walk");
    expect(accepted).toContain("credits");
    expect(accepted).not.toContain("useEffect(");
    expect(accepted).not.toContain(".mutate(");
  });

  it("uses one evidence plan across Walk, details, and mint without exposing tiers", () => {
    const tabs = source(
      "client/src/features/casting/components/ImageViewer/ViewTabs.tsx",
    );
    const details = source(
      "client/src/features/casting/components/PackageHealthDialog.tsx",
    );
    const modal = source(
      "client/src/features/studio/components/CastModelModal.tsx",
    );

    expect(tabs).toContain("'evidencePackage' in refreshPlanQuery.data");
    expect(tabs).toContain("refreshVerb={evidenceAware ? 'Update' : 'Refresh'}");
    expect(tabs).toContain("Update coverage");
    expect(details).toContain("'evidencePackage' in planQuery.data");
    expect(details).toContain("Coverage & versions");
    expect(details).toContain("Add only the views that make this Cast more useful.");
    expect(modal).toContain("recommendedEvidenceMintTier");
    expect(modal).toContain("['production', 'core', 'draft']");
    expect(modal).toContain("!evidenceMode && !packageComplete");
    expect(modal).toContain("Ready to use");
    expect(modal).toContain("No views will be generated and no credits will be used.");
    expect(modal).toContain("Add coverage");
  });

  it("refresh and mint completion invalidate every affected read surface", () => {
    const refresh = source(
      "client/src/features/casting/hooks/useCastingPackageRefresh.ts",
    );
    const mint = source(
      "client/src/features/studio/hooks/useCastGate.ts",
    );
    for (const target of [
      "generation.packageState.invalidate",
      "generation.refreshSlotsPlan.invalidate",
      "generation.mintPackagePlan.invalidate",
    ]) {
      expect(refresh).toContain(target);
      expect(mint).toContain(target);
    }
  });
});
