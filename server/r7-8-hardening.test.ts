import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const repoFile = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("R7-8 application hardening", () => {
  it("presents truthful sign-in authority without inert account controls", () => {
    const security = repoFile(
      "client/src/features/profile/SecurityTab.tsx",
    );
    const authRoute = repoFile("server/routes/auth.ts");

    expect(authRoute).toContain("authProvider: ctx.user.authProvider");
    expect(security).toContain("Sign-in method");
    expect(security).toContain('user?.authProvider === "google"');
    expect(security).not.toContain("Connected Accounts");
    expect(security).not.toMatch(/>\s*(?:Connect|Disconnect)\s*</);
  });

  it("gives the Settings modal explicit dialog and close-button semantics", () => {
    const modal = repoFile(
      "client/src/components/ProfileSettingsModal.tsx",
    );

    expect(modal).toContain('role="dialog"');
    expect(modal).toContain('aria-modal="true"');
    expect(modal).toContain('aria-labelledby="profile-settings-title"');
    expect(modal).toContain('aria-label="Close settings"');
  });

  it("does not retain the retired local-only UI implementations", () => {
    const retiredPaths = [
      "client/src/components/BugReportButton.tsx",
      "client/src/components/hero3d/FlowLines.tsx",
      "client/src/components/hero3d/HeroScene.tsx",
      "client/src/components/hero3d/depthRevealShader.ts",
      "client/src/features/boards/components/CanvasToolbar.tsx",
      "client/src/features/casting/components/CompactPromptButton.tsx",
      "client/src/features/studio/components/FeedbackPopout.tsx",
      "client/src/lib/lazyWithRetry.test.ts",
      "client/src/lib/lazyWithRetry.ts",
    ];

    for (const path of retiredPaths) {
      expect(existsSync(new URL(`../${path}`, import.meta.url))).toBe(false);
    }
  });

  it("does not ship the retired three-dimensional hero dependencies", () => {
    const packageJson = JSON.parse(repoFile("package.json")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const declared = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    expect(declared).not.toHaveProperty("@react-three/drei");
    expect(declared).not.toHaveProperty("@react-three/fiber");
    expect(declared).not.toHaveProperty("three");
    expect(declared).not.toHaveProperty("@types/three");
  });
});
