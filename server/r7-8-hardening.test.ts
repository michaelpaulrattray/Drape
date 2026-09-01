import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const repoFile = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("R7-8 application hardening", () => {
  it("presents truthful sign-in authority without inert account controls", () => {
    /* SECTION 03 (2026-09-01): the security surface moved out of the retired
       `ProfileSettingsModal` into the one Settings modal's own section. Same
       duty, same two claims, new address. */
    const security = repoFile(
      "client/src/features/settings/sections/SecuritySection.tsx",
    );
    const authRoute = repoFile("server/routes/auth.ts");

    expect(authRoute).toContain("authProvider: ctx.user.authProvider");
    expect(security).toContain("Sign-in method");
    expect(security).toContain('user?.authProvider === "google"');
    expect(security).not.toContain("Connected Accounts");
    expect(security).not.toMatch(/>\s*(?:Connect|Disconnect)\s*</);
  });

  it("gives the Settings modal explicit dialog and close-button semantics", () => {
    /*
      SECTION 03 — the modal is `features/settings/SettingsModal.tsx` now, and
      the dialog semantics moved with it in a way worth stating: `role`,
      `aria-modal` and the accessible NAME are the shared `ModalScrim`'s, one
      owner for every promoted dialog, so this arm reads both files. That is
      stricter than before rather than looser — the old modal hand-rolled all
      four attributes and a second modal could have shipped without them.
    */
    const shell = repoFile("client/src/foundation/CastingModal.tsx");
    const modal = repoFile("client/src/features/settings/SettingsModal.tsx");

    expect(shell).toContain('role="dialog"');
    expect(shell).toContain('aria-modal="true"');
    expect(shell).toContain("aria-label={label}");
    expect(modal).toContain('label="Settings"');
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
