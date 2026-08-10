/**
 * D-246's BAR, PINNED — detectors gate disasters only.
 *
 * The founder's ruling (2026-08-10): *people understand that AI image generation
 * cannot guarantee outcomes; detectors must not block real generations because
 * the detectors are flawed; refund only on complete or catastrophic failure.*
 *
 * The failure of that ruling would not look like a bug. It would look like one
 * more reasonable-sounding check, added six weeks from now by somebody who did
 * not know, that refuses a render because a shade was not quite right. So the
 * catastrophic classes are ENUMERATED here and the enumeration is mechanically
 * checked against the source: a new failure class that can refuse a paid render
 * fails this suite until somebody classifies it against D-246.
 *
 * This is the same idiom as the public-endpoint allowlist. A rule nothing
 * enforces is a rule that survives exactly as long as the person who wrote it
 * remembers it.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Every failure class a paid render may be refused and refunded over, with the
 * D-246 class it belongs to. Adding a row is a deliberate decision.
 */
const MAY_REFUSE_A_PAID_RENDER: Record<string, string> = {
  /* (a) a damaged frame — tear, duplication, integrity. */
  render_fault: "a — the frame came back damaged",
  composite_fault: "a — our own composite tore the frame",
  /* (d) process death or charge-without-delivery. */
  segment_store: "d — her kept edits could not be read, so nothing is delivered",
  provider_account: "d — our account with the provider is unusable",
  /* Not verdicts about a picture at all: the request could not be made or the
     provider never answered. These are the refund path working, not a detector
     judging quality. */
  transport: "d — the request never got a verdict",
  timeout: "d — our deadline expired",
  rate_limit: "d — the provider said slow down",
  capability: "d — the request asked for something this provider cannot do",
  content_policy: "d — the provider refused the content",
  not_one_person: "b — the provider succeeded and it is not a photograph of one person",
};

/** Source files whose `new ProviderError(...)` sites are on the render path. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    if (!full.endsWith(".ts") || full.includes(".test.")) return [];
    return [full];
  });
}

const ROOTS = ["server/castingV2", "server/casting", "server/routes/generation"];

describe("D-246 — only the catastrophic classes may refuse a paid render", () => {
  it("every failure class thrown on the render path is classified", () => {
    const thrown = new Map<string, string[]>();
    for (const root of ROOTS) {
      for (const file of sourceFiles(path.resolve(root))) {
        const source = readFileSync(file, "utf8");
        for (const match of source.matchAll(/new ProviderError\(\s*"([a-z_]+)"/g)) {
          const at = thrown.get(match[1]!) ?? [];
          at.push(path.relative(process.cwd(), file));
          thrown.set(match[1]!, at);
        }
      }
    }

    /* The instrument's own control: if this found nothing, the assertion below
       would pass by vacuity and the pin would be theatre. */
    expect(thrown.size).toBeGreaterThan(2);

    const unclassified = Array.from(thrown.entries())
      .filter(([failureClass]) => MAY_REFUSE_A_PAID_RENDER[failureClass] === undefined)
      .map(([failureClass, files]) => `${failureClass} (${files.join(", ")})`);

    expect(
      unclassified,
      "a new failure class can refuse a paid render. Classify it against D-246's four "
      + "catastrophic classes — damaged frame, identity loss, the asked thing completely "
      + "absent, process death — or make it advisory. Subtle quality is delivered, never gated.",
    ).toEqual([]);
  });

  it("the three clauses D-246 named as targets were never armed", () => {
    /*
      Working law 7 asked for the sweep and this is its result, driven rather
      than remembered. Each of these would be a subtle reading with the power to
      refuse; none of them has it, and this is what keeps that true.
    */
    const amplitude = readFileSync("server/castingV2/refineDelta.ts", "utf8");
    /* `changeAmplitude` classifies surfaces. It must not become a gate. */
    expect(amplitude).toContain("isSurfaceFacet");
    expect(amplitude).not.toMatch(/amplitude[\s\S]{0,80}throw/i);

    const masked = readFileSync("server/castingV2/maskedRefine.ts", "utf8");
    /* The seam's `coherence` statistic is recorded and acted on by nothing. */
    expect(masked).toContain("coherence");
    expect(masked).not.toMatch(/coherence[\s\S]{0,200}throw new ProviderError/);

    /* fable-166 §2's neon-iris refusal was never built, and D-246 supersedes it
       before it could be: neon green is subtle, so it ships and the user
       judges. Taste is answered by routing, not by gating. */
    for (const root of ROOTS) {
      for (const file of sourceFiles(path.resolve(root))) {
        expect(readFileSync(file, "utf8").toLowerCase(), file).not.toContain("neon");
      }
    }
  });
});
