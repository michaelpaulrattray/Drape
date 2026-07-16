/**
 * Batch C — the closed type contract and handler registry
 * (IDENTITY_EDIT_INTERIM_POLICY §5.4/§5.5; M18's closure proofs).
 *
 * Compile-time halves live as type-level assertions (a broken map fails
 * `pnpm check`, in identityTypes.ts itself and the @ts-expect-error probes
 * below). Runtime halves prove handler behavior: typed destinations,
 * base/override coherence, cross-field resets, dual-writes, null schema
 * writes, and the ledger-exact availability registry.
 */
import { describe, it, expect } from "vitest";
import type {
  AuthorizableIdentityField,
  AuthorizedLeafEdit,
  SupportedIdentityLeaf,
} from "./identityTypes";
import {
  AUTHORIZABLE_FIELDS,
  BASE_OPTION_SETS,
  FIELD_AVAILABILITY,
  IDENTITY_FIELD_HANDLERS,
  handlerFor,
  isValidAgeValue,
  isValidBodyType,
  isValidEthnicityBlend,
  isValidGender,
  isValidOverridePairValue,
  isValidSkinTone,
} from "./identityFieldHandlers";

// ── M18 proof 1: refused leaves cannot inhabit the authorization type ───────
// @ts-expect-error — person.face.chin is R9-refused and not constructible
const _chinEdit: AuthorizedLeafEdit = { kind: "leaf", leaf: "person.face.chin", operation: "modify", value: "x" };
// @ts-expect-error — person.face.browColor is R9-refused and not constructible
const _browColorEdit: AuthorizedLeafEdit = { kind: "leaf", leaf: "person.face.browColor", operation: "modify", value: "x" };
// @ts-expect-error — mark categories have no authorizable form
const _markField: AuthorizableIdentityField = "mark.ink";
// @ts-expect-error — classifier parents never authorize anything
const _parentField: AuthorizableIdentityField = "person.face";
void _chinEdit; void _browColorEdit; void _markField; void _parentField;

// ── M18 proof 9: exact leaf↔value pairing (a mismatched pair fails compile) ──
// @ts-expect-error — hair.style requires the base/override pair, not prose
const _mismatched: AuthorizedLeafEdit = { kind: "leaf", leaf: "person.hair.style", operation: "modify", value: "wolf cut" };
// @ts-expect-error — jawline is a descriptor, not a pair
const _mismatched2: AuthorizedLeafEdit = { kind: "leaf", leaf: "person.face.jawline", operation: "modify", value: { base: "", override: "x" } };
void _mismatched; void _mismatched2;

describe("registry completeness (M18 proofs 3/9)", () => {
  it("every authorizable field has exactly one handler, and no orphan handlers exist", () => {
    const expected: AuthorizableIdentityField[] = [
      "person.face.faceShape", "person.face.jawline", "person.face.cheekbones",
      "person.face.cheeks", "person.face.eyeShape", "person.face.eyeColor",
      "person.face.noseShape", "person.face.lipShape", "person.face.browShape",
      "person.face.facialHair",
      "person.hair.style", "person.hair.color", "person.hair.length",
      "person.hair.texture", "person.hair.fringe", "person.hair.parting",
      "person.hair.volume", "person.hair.fade", "person.hair.hairline",
      "person.hair.tuck", "person.hair.flyaways",
      "person.skin.texture", "person.skin.finish",
      "person.build", "person.age", "person.gender", "person.skinTone", "person.ethnicity",
    ];
    expect(Object.keys(IDENTITY_FIELD_HANDLERS).sort()).toEqual([...expected].sort());
    expect(AUTHORIZABLE_FIELDS.length).toBe(28);
    for (const field of AUTHORIZABLE_FIELDS) {
      const h = handlerFor(field);
      expect(typeof h.buildPreferencePatch).toBe("function");
      expect(typeof h.buildSchemaWrite).toBe("function");
      expect(typeof h.buildPromptFragment).toBe("function");
      expect(typeof h.promptDirectives).toBe("function");
      expect(h.stalesSiblings).toBe(true);
    }
  });

  it("the availability registry covers every field, and refused leaves are absent", () => {
    expect(Object.keys(FIELD_AVAILABILITY).sort()).toEqual([...AUTHORIZABLE_FIELDS].sort());
    expect((FIELD_AVAILABILITY as Record<string, unknown>)["person.face.chin"]).toBeUndefined();
    expect((FIELD_AVAILABILITY as Record<string, unknown>)["person.face.browColor"]).toBeUndefined();
  });
});

describe("availability registry matches the §8.5 ledger exactly (M18 proof 2)", () => {
  it("R1c: natural skin texture is text-only", () => {
    expect(FIELD_AVAILABILITY["person.skin.texture"]).toEqual({ text: true, reference: false, structured: true });
  });
  it("facial hair: not in the transfer prompt's allowed list ⇒ reference refuses", () => {
    expect(FIELD_AVAILABILITY["person.face.facialHair"].reference).toBe(false);
    expect(FIELD_AVAILABILITY["person.face.facialHair"].text).toBe(true);
  });
  it("skin finish: structured-editor field; a free-text one-off is image.retouch", () => {
    expect(FIELD_AVAILABILITY["person.skin.finish"]).toEqual({ text: false, reference: false, structured: true });
  });
  it("§8.2: person-level structured attributes refuse at every free-text door", () => {
    for (const f of ["person.build", "person.age", "person.gender", "person.skinTone", "person.ethnicity"] as const) {
      expect(FIELD_AVAILABILITY[f]).toEqual({ text: false, reference: false, structured: true });
    }
  });
  it("ratified R1 face/hair leaves are text-eligible", () => {
    for (const f of ["person.face.jawline", "person.face.faceShape", "person.hair.style", "person.hair.length"] as const) {
      expect(FIELD_AVAILABILITY[f].text).toBe(true);
    }
  });
});

describe("§5.5 base/override pairs — both members always written (M18 proof 7)", () => {
  const pairs = [
    ["person.hair.style", "hairStyle", "hairStyleOverride"],
    ["person.hair.color", "hairColor", "hairColorOverride"],
    ["person.face.eyeColor", "eyeColor", "eyeColorOverride"],
    ["person.face.facialHair", "facialHair", "facialHairOverride"],
    ["person.skin.texture", "skinTexture", "skinTextureOverride"],
  ] as const;

  it.each(pairs)("%s writes base AND override; enum-representable values CLEAR the override", (field, baseKey, overrideKey) => {
    const base = (BASE_OPTION_SETS[field] as readonly string[])[0];
    const handler = handlerFor(field);
    const patch = (handler.buildPreferencePatch as (v: unknown, c: Record<string, unknown>) => Record<string, unknown>)(
      { base, override: "" },
      { [overrideKey]: "stale old override" },
    );
    expect(patch[baseKey]).toBe(base);
    expect(patch[overrideKey]).toBe(""); // the stale override cannot survive
  });

  it("a value exceeding the enum lands detailed prose in the override with the nearest base", () => {
    const handler = handlerFor("person.hair.style");
    const patch = handler.buildPreferencePatch(
      { base: "Shag / Wolf", override: "chin-length layered wolf cut with wispy curtain fringe" },
      {},
    );
    expect(patch.hairStyle).toBe("Shag / Wolf");
    expect(patch.hairStyleOverride).toBe("chin-length layered wolf cut with wispy curtain fringe");
  });

  it("isValidOverridePairValue: off-list base refuses; empty base with prose passes; empty pair refuses", () => {
    expect(isValidOverridePairValue("person.hair.color", { base: "Chartreuse-Neon", override: "" })).toBe(false);
    expect(isValidOverridePairValue("person.hair.color", { base: "", override: "deep copper with auburn ends" })).toBe(true);
    expect(isValidOverridePairValue("person.hair.color", { base: "", override: "" })).toBe(false);
  });

  it("rule-2: a hairstyle CHANGE resets the sub-selectors; an unchanged style keeps them", () => {
    const handler = handlerFor("person.hair.style");
    const changed = handler.buildPreferencePatch(
      { base: "Pixie", override: "" },
      { hairStyle: "Bob", hairLength: "Long", hairTexture: "Wavy" },
    ) as Record<string, string>;
    expect(changed.hairLength).toBe("");
    expect(changed.hairTexture).toBe("");
    const unchanged = handler.buildPreferencePatch(
      { base: "Bob", override: "" },
      { hairStyle: "Bob", hairLength: "Long" },
    ) as Record<string, string>;
    expect(unchanged.hairLength).toBe("Long");
  });
});

describe("structured fields keep their REAL value types (M18 proofs 5/6)", () => {
  it("gender change applies the rule-1 resets; same gender keeps styling", () => {
    const handler = handlerFor("person.gender");
    const changed = handler.buildPreferencePatch("Male", { gender: "Female", hairStyle: "Bob", hairFade: "None", facialHair: "" });
    expect(changed).toEqual({ gender: "Male", hairStyle: "", hairFade: "", facialHair: "" });
    const same = handler.buildPreferencePatch("Female", { gender: "Female", hairStyle: "Bob", hairFade: "None", facialHair: "" });
    expect(same.hairStyle).toBe("Bob");
  });

  it("ethnicity blends stay structured {name,pct} arrays end-to-end with the dual-write", () => {
    const handler = handlerFor("person.ethnicity");
    const value = { blend: [{ name: "Nordic", pct: 60 }, { name: "East Asian", pct: 40 }] };
    const patch = handler.buildPreferencePatch(value, {});
    expect(patch.ethnicityBlend).toEqual(value.blend); // never prose
    expect(patch.ethnicity).toBe("Nordic, East Asian"); // the derived legacy string
    expect(handler.buildSchemaWrite(value, {})).toEqual({ path: "subject.ethnicity", value: "Nordic, East Asian" });
  });

  it("scalar validators enforce the closed option sets and the age band", () => {
    expect(isValidBodyType("Slim")).toBe(true);
    expect(isValidBodyType("Bodybuilder")).toBe(false);
    expect(isValidGender("Female")).toBe(true);
    expect(isValidGender("Robot")).toBe(false);
    expect(isValidSkinTone("Tan / Bronze")).toBe(true);
    expect(isValidSkinTone("Green")).toBe(false);
    expect(isValidAgeValue("23")).toBe(true);
    expect(isValidAgeValue(23)).toBe(true);
    expect(isValidAgeValue("7")).toBe(false);
    expect(isValidAgeValue("ancient")).toBe(false);
    expect(isValidEthnicityBlend({ blend: [{ name: "Nordic", pct: 100 }] })).toBe(true);
    expect(isValidEthnicityBlend({ blend: [{ name: "Klingon", pct: 100 }] })).toBe(false);
    expect(isValidEthnicityBlend({ blend: [{ name: "Nordic", pct: 60 }, { name: "Latino", pct: 60 }] })).toBe(false);
  });
});

describe("schema writes — closed paths, null where no mirror exists (M18 proofs 4/9)", () => {
  it("mirrored leaves write their exact schema path", () => {
    expect(handlerFor("person.face.jawline").buildSchemaWrite("broad angular jaw", {})).toEqual({
      path: "facial_features.jawline",
      value: "broad angular jaw",
    });
    expect(handlerFor("person.hair.color").buildSchemaWrite({ base: "Auburn", override: "" }, {})).toEqual({
      path: "subject.hair_color",
      value: "Auburn",
    });
    expect(handlerFor("person.gender").buildSchemaWrite("Female", {})).toEqual({ path: "subject.sex", value: "Female" });
  });

  it("no-mirror fields return null — never {}", () => {
    const noMirror: SupportedIdentityLeaf[] = [
      "person.hair.length", "person.hair.texture", "person.hair.fringe",
      "person.hair.parting", "person.hair.volume", "person.hair.fade",
      "person.hair.hairline", "person.hair.tuck", "person.hair.flyaways",
      "person.skin.finish",
    ];
    for (const leaf of noMirror) {
      const w = (handlerFor(leaf).buildSchemaWrite as (v: unknown, c: unknown) => unknown)("some value", {});
      expect(w).toBeNull();
    }
    expect(handlerFor("person.face.facialHair").buildSchemaWrite({ base: "Stubble", override: "" }, {})).toBeNull();
    expect(handlerFor("person.skin.texture").buildSchemaWrite({ base: "Freckled", override: "" }, {})).toBeNull();
    expect(handlerFor("person.build").buildSchemaWrite("Slim", {})).toBeNull(); // subject.* has no build field
  });
});

describe("§8.4 prompt directives — single-leaf unlock, everything else locked", () => {
  it("directives name the authorized field and lock every unrequested feature", () => {
    const directives = handlerFor("person.face.jawline").promptDirectives("broad angular jaw, squared");
    expect(directives.join(" ")).toContain("jawline only");
    expect(directives.join(" ")).toContain("broad angular jaw, squared");
    expect(directives.join(" ")).toMatch(/Preserve every unrequested feature/i);
  });
});
