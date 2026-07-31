/**
 * The casting vocabularies, shared client and server.
 *
 * These live here rather than in `server/castingV2/castingIntent.ts` because
 * the brief echo's popover offers them to the user and the roll input validates
 * against them, and a hand-copied second list is a control that lies: the first
 * draft of the echo offered "Southeast Asian" and "East African", which the
 * server would have refused, and omitted "Afro-Caribbean", which it accepts.
 * Nobody would have noticed until someone picked one.
 *
 * The compiler is now the thing that keeps them in step. `castingIntent.ts`
 * re-exports these, so a value added on either side is a value both sides have.
 *
 * Only the *closed enums* belong here. The prose that describes them — the
 * energy descriptions, the look theses, the archetype anti-patterns — stays
 * server-side, because that prose is prompt craft and prompt craft never
 * crosses to the client.
 */

export const AGE_BANDS = ["teens", "20s", "30s", "40s", "50s", "60s", "70s+"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export const AGE_PHASES = ["early", "mid", "late"] as const;
export type AgePhase = (typeof AGE_PHASES)[number];

export const SEXES = ["female", "male", "nonbinary"] as const;
export type Sex = (typeof SEXES)[number];

export const HERITAGES = [
  "Slavic",
  "Nordic",
  "British Isles",
  "Western European",
  "Mediterranean",
  "East Asian",
  "South Asian",
  "Afro-Caribbean",
  "West African",
  "Latino",
  "Middle Eastern",
  "Polynesian",
] as const;
export type Heritage = (typeof HERITAGES)[number];

export const BUILDS = ["slight", "slim", "average", "athletic", "broad", "heavy"] as const;
export type Build = (typeof BUILDS)[number];

export const ENERGY_KEYS = [
  "warm",
  "dry",
  "bright",
  "grave",
  "open",
  "guarded",
  "wry",
  "plain",
] as const;
export type EnergyKey = (typeof ENERGY_KEYS)[number];

export const LOOK_KEYS = [
  "commanding glamour",
  "severe minimal",
  "off-kilter charm",
  "angular and unslept",
  "raw street-cast",
  "clean commercial",
  "quiet luxury",
  "authentic creator",
] as const;
export type LookKey = (typeof LOOK_KEYS)[number];

export const VARIATION_AXES = ["look", "disposition"] as const;
export type VariationAxis = (typeof VARIATION_AXES)[number];
