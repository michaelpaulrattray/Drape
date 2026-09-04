/**
 * Find a Chromium the drivers can use, without downloading one.
 *
 * Every browser driver in this tree hard-codes the Windows Edge path, which is
 * correct for the founder's machine and for a shift running on it. The design-law
 * CONTROLS are the first thing here that must also run somewhere else: they
 * assert that each law can still fail, they need no server, no session and no
 * database, so they belong in the gate — and the gate is Linux.
 *
 * `DRAPE_BROWSER` wins over everything, so a machine with a browser in an
 * unusual place needs no code change. Absent, the known locations are tried in
 * order and the first that exists is returned. It returns null rather than
 * throwing: a caller in the gate decides whether an absent browser is a skip
 * (with a console message, the repo's pattern for env-dependent suites) or a
 * refusal, and that judgement is not this function's to make.
 */
import fs from "node:fs";

/** Checked in order. First hit wins. */
export const BROWSER_CANDIDATES = [
  // Windows — the founder's machine and every shift on it.
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  // Linux — GitHub Actions runners ship Chrome and Chromium preinstalled.
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/usr/bin/microsoft-edge",
  // macOS.
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
];

/** The executable to launch, or null when this machine has none of them. */
export function resolveBrowser(env: NodeJS.ProcessEnv = process.env): string | null {
  const override = env.DRAPE_BROWSER?.trim();
  if (override) {
    if (!fs.existsSync(override)) {
      throw new Error(
        `DRAPE_BROWSER points at ${override}, which does not exist. An override that ` +
          `silently fell back to a different browser would measure a different renderer ` +
          `than the one asked for.`,
      );
    }
    return override;
  }
  return BROWSER_CANDIDATES.find((candidate) => fs.existsSync(candidate)) ?? null;
}
