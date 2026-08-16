/**
 * A SERVER OR TRANSPORT MESSAGE NEVER GOES STRAIGHT INTO A TOAST.
 *
 * # Why this exists as a scan and not as a memory
 *
 * The class — *never show the error's sentence, show ours* — was named in
 * `client/src/lib/failureSentence.ts`, fixed for roll dispatch, found again in
 * the refine panel, fixed again, and its own header said the fix had landed on
 * one consumer. It had landed on two. There were **fifty**.
 *
 * A list of fifty burned down by hand regrows exactly the way the world-guard
 * debt went from eleven scripts to thirty-four while a roadmap line watched. So
 * the sweep ships with the thing that keeps it swept.
 *
 * # What counts as a violation
 *
 * `toast.error(err.message)` and its spellings — a toast whose argument is a
 * bare `.message` off an error. The fix is `readableFailure(error, "…")` from
 * `@/lib/failureSentence`, which passes our own server's authored sentences
 * through and replaces anything a gateway or a parser wrote.
 *
 * # The exemptions are enumerated, and each says why
 *
 * Staff surfaces keep the raw text on purpose (fable-677 §3): a toast that
 * hides the real error from an admin doing support work is a regression, not an
 * improvement. Billing is listed separately because it is pending review, not
 * because it is exempt — it is the one group expected to shrink.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const clientSrc = path.resolve(import.meta.dirname, "..");

/**
 * Kept as paths with reasons rather than a bare list, so an exemption cannot be
 * added without writing down why — and so the reason is read in the diff.
 */
const EXEMPT: Record<string, string> = {
  // Staff surfaces: the raw text IS the useful text when you are investigating.
  "pages/AdminUserManagement.tsx": "admin support — raw error is the diagnostic (fable-677 §3)",
  "pages/AdminInviteCodes.tsx": "admin support — raw error is the diagnostic (fable-677 §3)",
  "features/admin/overview/BannerManagement.tsx": "admin support — raw error is the diagnostic",
  "features/moderator/UserInvestigationWidgets.tsx": "moderator support — raw error is the diagnostic",
  "features/moderator/ReconciliationSubTab.tsx": "moderator support — raw error is the diagnostic",
  /*
    Billing sat here for one commit as PENDING REVIEW — a customer money
    surface whose copy Fable read before it shipped — and is now swept
    (fable-679 §3). Nothing about money state is claimed: the three checkout
    sites say only that checkout could not be opened, and changePlan and
    cancelSubscription say contact was lost and to go and look, because a
    transport failure genuinely does not know which way it went.
  */
};

/**
 * A toast whose argument is a bare `.message` off something error-shaped.
 *
 * `toast.error(err.message)`, `toast(error.message)`, `toast.error(e?.message)`
 * — and NOT `toast.error(readableFailure(err, "…"))`, whose argument is a call.
 */
const RAW_TOAST = /toast(?:\.error|\.warning|\.info)?\(\s*[A-Za-z_$][\w$]*\??\.message\b/;

/** Prose about the rule is not a violation of it. */
function isComment(line: string): boolean {
  const t = line.trim();
  return t.startsWith("*") || t.startsWith("//") || t.startsWith("/*");
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

export function findRawErrorToasts(root: string): { file: string; line: number; text: string }[] {
  const hits: { file: string; line: number; text: string }[] = [];
  for (const file of walk(root)) {
    const relative = path.relative(root, file).split(path.sep).join("/");
    if (relative in EXEMPT) continue;
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      if (isComment(line)) return;
      if (RAW_TOAST.test(line)) hits.push({ file: relative, line: index + 1, text: line.trim() });
    });
  }
  return hits;
}

describe("no server or transport message goes straight into a toast", () => {
  it("every customer surface routes failures through readableFailure", () => {
    const hits = findRawErrorToasts(clientSrc);
    expect(
      hits,
      `Use readableFailure(error, "your sentence") from @/lib/failureSentence — `
        + `a gateway's 502 or a parser's error is not copy:\n`
        + hits.map((h) => `  ${h.file}:${h.line}  ${h.text}`).join("\n"),
    ).toEqual([]);
  });

  /*
    The control above proves the REGEX fires; this proves the WALK reaches the
    tree. They are separate failures: a walk that returned nothing would report
    an empty violation list through a perfectly good matcher, and read as a
    clean codebase. The floor is deliberately far below the real count (~500)
    so it never needs editing, and far above zero so it cannot be met by a
    broken traversal.
  */
  it("the scan actually reads the client tree", () => {
    expect(walk(clientSrc).length).toBeGreaterThan(100);
  });

  /*
    POSITIVE CONTROL. Without it, a scanner whose regex silently stopped
    matching would report an empty array — indistinguishable from a clean
    codebase, and green forever. Driven through the real matcher, over the
    spellings the sweep actually found.
  */
  it("POSITIVE CONTROL — the matcher fires on every spelling the sweep found", () => {
    const violations = [
      "      toast.error(err.message);",
      "    onError: (error) => toast.error(error.message),",
      "      toast.error(err.message || 'Failed to delete');",
      "      toast.error(e?.message);",
      "      toast(error.message);",
    ];
    for (const line of violations) {
      expect(RAW_TOAST.test(line), `should have matched: ${line}`).toBe(true);
    }
  });

  it("NEGATIVE CONTROL — silent on the fixed shape and on prose about it", () => {
    expect(RAW_TOAST.test(`toast.error(readableFailure(err, "That could not be saved."));`)).toBe(false);
    expect(RAW_TOAST.test(`toast.success("Saved");`)).toBe(false);
    // The two modules that DOCUMENT this rule quote the bad shape in prose.
    expect(isComment(" * doing `toast.error(err.message)`. A rule that lives")).toBe(true);
    expect(isComment("// toast.error(err.message)")).toBe(true);
  });

  /*
    The exemption list is a claim about files that exist. A stale entry silently
    widens the scan's blind spot — and reads, to anyone skimming, as coverage.
  */
  it("every exemption names a file that still exists", () => {
    for (const [relative, reason] of Object.entries(EXEMPT)) {
      expect(fs.existsSync(path.join(clientSrc, relative)), `stale exemption: ${relative}`).toBe(true);
      expect(reason.length, `exemption without a reason: ${relative}`).toBeGreaterThan(10);
    }
  });
});
