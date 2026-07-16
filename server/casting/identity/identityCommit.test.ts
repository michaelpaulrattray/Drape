/**
 * Batch C — the pure §8.6 commit computation: handler-built preference
 * patches, schema writes (null mirrors), deterministic master-description
 * fragments that replace ONLY the same field's earlier fragment, and
 * byte-for-byte preservation of protected mark/amendment language (M5/M6).
 */
import { describe, it, expect } from "vitest";
import { computeIdentityCommit, identityFragmentLine } from "./identityCommit";
import type { AuthorizedIdentityPatch } from "./identityTypes";

const MODEL = {
  masterPrompt:
    "Ultra realistic casting headshot of a 24-year-old woman. She has a rose tattoo on her left shoulder. Soft oval face.",
  technicalSchema: {
    subject: { sex: "Female", hair_color: "Dark Brown" },
    facial_features: { jawline: "soft" },
  },
  preferences: { jawline: "Soft / Rounded", hairColor: "Dark Brown", hairColorOverride: "espresso with warm ends" },
};

const jawlinePatch: AuthorizedIdentityPatch = {
  edits: [{ kind: "leaf", leaf: "person.face.jawline", operation: "modify", value: "broad angular jaw, squared" }],
  source: "text",
};

describe("computeIdentityCommit — pure §8.6 document computation", () => {
  it("preference patch + schema write + fragment, everything else untouched", () => {
    const out = computeIdentityCommit(MODEL, jawlinePatch);
    expect(out.preferences.jawline).toBe("broad angular jaw, squared");
    expect(out.preferences.hairColor).toBe("Dark Brown"); // unrequested fields untouched
    expect((out.technicalSchema.facial_features as Record<string, string>).jawline).toBe("broad angular jaw, squared");
    expect((out.technicalSchema.subject as Record<string, string>).sex).toBe("Female");
    expect(out.masterPrompt).toContain(identityFragmentLine("person.face.jawline", "jawline: broad angular jaw, squared"));
  });

  it.each(["Long", "Very Long"] as const)(
    "a %s hair-length band edit propagates through the master identity pathway (D-56.1 final)",
    (band) => {
      const patch: AuthorizedIdentityPatch = {
        edits: [{ kind: "leaf", leaf: "person.hair.length", operation: "modify", value: band }],
        source: "text",
      };
      const out = computeIdentityCommit(MODEL, patch);
      expect(out.preferences.hairLength).toBe(band);
      expect(out.masterPrompt).toContain(identityFragmentLine("person.hair.length", `hair length: ${band}`));
    },
  );

  it("PROTECTED LANGUAGE: existing mark/body-art prose survives byte-for-byte (M5)", () => {
    const out = computeIdentityCommit(MODEL, jawlinePatch);
    expect(out.masterPrompt).toContain("She has a rose tattoo on her left shoulder.");
    // the original prose is intact as a prefix — the commit only APPENDS fragments
    expect(out.masterPrompt.startsWith(MODEL.masterPrompt)).toBe(true);
  });

  it("re-editing the SAME field replaces only that field's earlier fragment", () => {
    const once = computeIdentityCommit(MODEL, jawlinePatch);
    const twicePatch: AuthorizedIdentityPatch = {
      edits: [{ kind: "leaf", leaf: "person.face.jawline", operation: "modify", value: "tapered soft jawline" }],
      source: "text",
    };
    const twice = computeIdentityCommit({ ...MODEL, masterPrompt: once.masterPrompt }, twicePatch);
    expect(twice.masterPrompt).toContain("tapered soft jawline");
    expect(twice.masterPrompt).not.toContain("broad angular jaw, squared");
    expect(twice.masterPrompt).toContain("rose tattoo"); // marks still intact
    // exactly ONE jawline fragment line survives
    expect(twice.masterPrompt.match(/IDENTITY UPDATE — person\.face\.jawline/g)).toHaveLength(1);
  });

  it("a DIFFERENT field's fragment never touches an earlier field's fragment", () => {
    const once = computeIdentityCommit(MODEL, jawlinePatch);
    const nosePatch: AuthorizedIdentityPatch = {
      edits: [{ kind: "leaf", leaf: "person.face.noseShape", operation: "modify", value: "thin straight bridge" }],
      source: "text",
    };
    const then = computeIdentityCommit({ ...MODEL, masterPrompt: once.masterPrompt }, nosePatch);
    expect(then.masterPrompt).toContain("broad angular jaw, squared");
    expect(then.masterPrompt).toContain("thin straight bridge");
  });

  it("base/override pair commits write BOTH members (a stale override cannot survive)", () => {
    const patch: AuthorizedIdentityPatch = {
      edits: [{ kind: "leaf", leaf: "person.hair.color", operation: "modify", value: { base: "Auburn", override: "" } }],
      source: "text",
    };
    const out = computeIdentityCommit(MODEL, patch);
    expect(out.preferences.hairColor).toBe("Auburn");
    expect(out.preferences.hairColorOverride).toBe(""); // the old espresso override is cleared
    expect((out.technicalSchema.subject as Record<string, string>).hair_color).toBe("Auburn");
  });

  it("no-mirror fields write preferences + fragment only — the schema is untouched", () => {
    const patch: AuthorizedIdentityPatch = {
      edits: [{ kind: "leaf", leaf: "person.hair.fringe", operation: "modify", value: "wispy curtain bangs" }],
      source: "text",
    };
    const out = computeIdentityCommit(MODEL, patch);
    expect(out.preferences.hairFringe).toBe("wispy curtain bangs");
    expect(JSON.stringify(out.technicalSchema)).toBe(
      JSON.stringify({ subject: { sex: "Female", hair_color: "Dark Brown" }, facial_features: { jawline: "soft" } }),
    );
  });

  it("structured edits ride the same commit: gender resets + schema mirror + fragment", () => {
    const patch: AuthorizedIdentityPatch = {
      edits: [{ kind: "structured", edit: { field: "person.gender", value: "Male" } }],
      source: "structured",
    };
    const out = computeIdentityCommit(
      { ...MODEL, preferences: { ...MODEL.preferences, gender: "Female", hairStyle: "Bob" } },
      patch,
    );
    expect(out.preferences.gender).toBe("Male");
    expect(out.preferences.hairStyle).toBe(""); // rule-1 reset, handler-owned
    expect((out.technicalSchema.subject as Record<string, string>).sex).toBe("Male");
  });

  it("multi-edit patches apply in order with each field's own typed write", () => {
    const patch: AuthorizedIdentityPatch = {
      edits: [
        { kind: "leaf", leaf: "person.face.jawline", operation: "modify", value: "squared" },
        { kind: "leaf", leaf: "person.hair.color", operation: "modify", value: { base: "Copper", override: "" } },
      ],
      source: "reference",
    };
    const out = computeIdentityCommit(MODEL, patch);
    expect(out.preferences.jawline).toBe("squared");
    expect(out.preferences.hairColor).toBe("Copper");
    expect(out.fragments).toHaveLength(2);
  });
});
