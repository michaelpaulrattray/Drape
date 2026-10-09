/**
 * The two sentences on a signed cast's Siblings card (#2141, the founder's
 * word 2026-10-09: "on the two things that need my call go with your
 * reccomendations" — Yuna's two Siblings lines from the Voice card review).
 *
 * Both name the cast, the way the master-look line does. A cast with no name
 * reads "them" / "they were", never a guessed pronoun.
 */
function castName(name: string | null | undefined): string {
  return name?.trim() ?? "";
}

export function siblingsIntroLine(name: string | null | undefined): string {
  const who = castName(name) || "them";
  return `Variants made alongside ${who}. Useful when a campaign needs a near-miss rather than a new face.`;
}

export function siblingsNoneLine(name: string | null | undefined): string {
  const trimmed = castName(name);
  const when = trimmed ? `${trimmed} was` : "they were";
  return `Nothing else was kept from when ${when} created.`;
}
