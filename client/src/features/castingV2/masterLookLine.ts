/**
 * The line under a signed cast's master picture, once the views are done
 * (#2124, the founder's word 2026-10-09: "This is Pigman's master look. Every
 * view and shot starts from it." it uses the casts name?).
 *
 * "and shot" is left out on purpose: shots belong to the cinema studio, which
 * is not built yet, and the copy must be honest about what exists today. When
 * cinema ships, this line gains "and shot" back.
 *
 * The possessive is always `'s`, names ending in s included ("James's"), and a
 * cast with no name reads "their".
 */
export function masterLookLine(name: string | null | undefined): string {
  const trimmed = name?.trim() ?? "";
  const whose = trimmed ? `${trimmed}'s` : "their";
  return `This is ${whose} master look. Every view starts from it.`;
}
