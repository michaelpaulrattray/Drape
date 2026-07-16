/**
 * creationIntake — creation-time identity intake validation
 * (IDENTITY_EDIT_INTERIM_POLICY §10, Batch C; M22 — hardened per review
 * finding 5).
 *
 * Before any model save or image charge, the server validates the COMPLETE
 * normalized creation intent — every string channel the request carries
 * (brief, features, every attribute/override/prose field, and any arbitrary
 * Canvas attribute), not a fixed shortlist. The wire boundary is open
 * `z.string()` fields, so "closed by construction" is only true here, at the
 * shared validator every creation path runs. Presentation language never
 * enters `preferences`, `masterPrompt`, `technicalSchema`, identity
 * notes/amendments, or generated neutral casting imagery. NO SILENT
 * STRIPPING — refuse honestly and route styling downstream.
 *
 * Still valid input (the ratified creation-time reality):
 *  - initial identity traits, including brief-time ink marks (R6: tattoo/ink
 *    is the one advertised mark family) and other mark families (tolerated,
 *    not advertised) — creation is where marks legitimately enter;
 *  - validated NATURAL eyelash anatomy (§5.2 — creation-only);
 *  - fork/recast preference sets carrying PROSE descriptors written by
 *    earlier authorized identity edits (enum membership is deliberately NOT
 *    enforced on descriptor channels here — forks of edited or legacy models
 *    must stay castable; forbidden CONTENT is what refuses).
 *
 * Refused before save or charge:
 *  - presentation/styling and cosmetic-lash language in ANY channel;
 *  - relational-reference wording ("like the reference/image") — creation
 *    has no reference to relate to (§10.3) and relational text is never a
 *    durable identity value (§8.6);
 *  - creation reference images (schema-rejected at routers; failed closed
 *    here for any helper that forgot);
 *  - off-list values for the stable closed scalars (gender) and a non-numeric
 *    age; malformed ethnicity blends.
 *
 * Applies to every creation path: standalone Casting, Canvas runGeneration
 * (including arbitrary locked attributes), direct models.create, parsed
 * briefs, raw features, recast, fork (including fork-from-refusal text),
 * variations, and any creation helper.
 */
import {
  COSMETIC_LASH_PATTERN,
  LOOK_NOUN_PATTERN,
  PRESENTATION_PATTERN,
  RELATIONAL_VALUE_PATTERN,
} from "./editAuthority";
import { isValidAgeValue, isValidEthnicityBlend, isValidGender } from "./identityFieldHandlers";
import { REFUSAL_COPY } from "./refusalCopy";

export interface CreationIntakeRefusal {
  ok: false;
  code: "presentation" | "cosmetic_lash" | "creation_reference" | "relational_reference" | "invalid_value";
  /** Which input channel tripped — for honest, correctable copy. */
  channel: string;
  message: string;
}
export type CreationIntakeResult = { ok: true } | CreationIntakeRefusal;

/** Brand-direction channels are aesthetic DIRECTION for the engine, not the
 *  subject's wardrobe — house archetypes legitimately reference garment
 *  language ("deconstructed tailoring"). Everything else is scanned. */
const EXCLUDED_CHANNELS = new Set(["castingBrand", "castingBrandOverride"]);

export function validateCreationIntent(prefs: Record<string, unknown>): CreationIntakeResult {
  // §10.3 — belt and suspenders: routers schema-reject creation references;
  // a helper path that forgot must still refuse here, never silently persist.
  if (typeof prefs.referenceImage === "string" && prefs.referenceImage.length > 0) {
    return {
      ok: false,
      code: "creation_reference",
      channel: "referenceImage",
      message: REFUSAL_COPY.creationReference,
    };
  }

  // Stable closed scalars at the shared boundary (finding 5). Gender's two
  // values have been stable across every writer; age is the numeric band.
  // (bodyType/skinTone tolerate legacy label drift on fork/recast — their
  // smuggling vector is closed by the content scan below.)
  if (typeof prefs.gender === "string" && prefs.gender.trim() !== "" && !isValidGender(prefs.gender.trim())) {
    return { ok: false, code: "invalid_value", channel: "gender", message: "That gender value isn't one casting supports." };
  }
  if (prefs.age !== undefined && prefs.age !== "" && prefs.age !== null) {
    if ((typeof prefs.age !== "string" && typeof prefs.age !== "number") || !isValidAgeValue(prefs.age)) {
      return { ok: false, code: "invalid_value", channel: "age", message: "Age needs to be a whole number between 16 and 80." };
    }
  }
  if (prefs.ethnicityBlend !== undefined && prefs.ethnicityBlend !== null) {
    // Final correction 3: a malformed CONTAINER type (object, string, …)
    // must not bypass the shape check by failing Array.isArray silently
    if (!Array.isArray(prefs.ethnicityBlend)) {
      return { ok: false, code: "invalid_value", channel: "ethnicityBlend", message: "That ethnicity blend isn't valid — pick up to two heritages totalling 100%." };
    }
    if (prefs.ethnicityBlend.length > 0 && !isValidEthnicityBlend({ blend: prefs.ethnicityBlend as Array<{ name: string; pct: number }> })) {
      return { ok: false, code: "invalid_value", channel: "ethnicityBlend", message: "That ethnicity blend isn't valid — pick up to two heritages totalling 100%." };
    }
  }
  if (prefs.castingVibe !== undefined && prefs.castingVibe !== null) {
    const vibe = prefs.castingVibe as Record<string, unknown>;
    const vibeOk =
      typeof vibe === "object" &&
      !Array.isArray(vibe) &&
      ["editorial", "commercial", "runway"].every((k) => typeof vibe[k] === "number" && Number.isFinite(vibe[k] as number)) &&
      Object.keys(vibe).every((k) => ["editorial", "commercial", "runway"].includes(k));
    if (!vibeOk) {
      return { ok: false, code: "invalid_value", channel: "castingVibe", message: "That vibe value isn't valid." };
    }
  }

  // EVERY string channel — brief, features, descriptors, overrides, and any
  // arbitrary Canvas attribute — takes the same deterministic boundary.
  // Final correction 3: NON-STRING CONTAINERS on any other key refuse — an
  // array or nested object could carry forbidden text past the string scan
  // (e.g. jawline: ["sharp", "red dress"]). Only the shapes validated above
  // (castingVibe, ethnicityBlend) and the numeric age are legitimate
  // non-strings.
  for (const [channel, raw] of Object.entries(prefs)) {
    if (EXCLUDED_CHANNELS.has(channel)) continue;
    if (channel === "castingVibe" || channel === "ethnicityBlend" || channel === "age") continue;
    if (raw === null || raw === undefined) continue;
    if (typeof raw !== "string") {
      return {
        ok: false,
        code: "invalid_value",
        channel,
        message: `That ${channel} value has an unexpected shape and can't be cast.`,
      };
    }
    if (raw.trim() === "") continue;

    // Cosmetic lash language refuses as presentation BEFORE save/charge
    // (§5.2). Natural lash anatomy ("naturally long, dense lashes") passes —
    // it may persist through the validated initial features path.
    if (COSMETIC_LASH_PATTERN.test(raw)) {
      return {
        ok: false,
        code: "cosmetic_lash",
        channel,
        message: REFUSAL_COPY.creationCosmeticLash,
      };
    }
    if (PRESENTATION_PATTERN.test(raw) || LOOK_NOUN_PATTERN.test(raw)) {
      return {
        ok: false,
        code: "presentation",
        channel,
        message: REFUSAL_COPY.creationPresentation,
      };
    }
    // Relational-reference wording can't become a durable identity value —
    // and creation has no reference to relate to (§10.3/§8.6)
    if (RELATIONAL_VALUE_PATTERN.test(raw)) {
      return {
        ok: false,
        code: "relational_reference",
        channel,
        message: REFUSAL_COPY.creationReference,
      };
    }
  }
  return { ok: true };
}
