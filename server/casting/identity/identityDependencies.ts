import type {
  AuthorizableIdentityField,
  AuthorizedIdentityEdit,
  AuthorizedIdentityPatch,
} from "./identityTypes";

/**
 * Hair geometry leaves that may be physically coupled in a generated image.
 * This list is deliberately closed: color, texture, hairline, every face and
 * skin field, demographics, marks, and overall identity can never enter it.
 */
export const HAIR_GEOMETRY_DEPENDENT_FIELDS = [
  "person.hair.style",
  "person.hair.length",
  "person.hair.fringe",
  "person.hair.parting",
  "person.hair.volume",
  "person.hair.fade",
  "person.hair.flyaways",
  "person.hair.tuck",
] as const satisfies readonly AuthorizableIdentityField[];

export type HairGeometryDependentField = typeof HAIR_GEOMETRY_DEPENDENT_FIELDS[number];

/** Static, reviewed, and intentionally non-transitive. Only the fields the
 * user explicitly authorized are looked up; dependent values never trigger
 * another lookup. */
export const IDENTITY_EDIT_DEPENDENCIES = {
  "person.hair.length": [
    "person.hair.style",
    "person.hair.fringe",
    "person.hair.parting",
    "person.hair.volume",
    "person.hair.fade",
    "person.hair.flyaways",
    "person.hair.tuck",
  ],
  "person.hair.style": [
    "person.hair.length",
    "person.hair.fringe",
    "person.hair.parting",
    "person.hair.volume",
    "person.hair.fade",
    "person.hair.flyaways",
    "person.hair.tuck",
  ],
} as const satisfies Partial<Record<AuthorizableIdentityField, readonly HairGeometryDependentField[]>>;

function fieldForEdit(edit: AuthorizedIdentityEdit): AuthorizableIdentityField {
  return edit.kind === "leaf" ? edit.leaf : edit.edit.field;
}

export function explicitFieldsForPatch(patch: AuthorizedIdentityPatch): AuthorizableIdentityField[] {
  return Array.from(new Set(patch.edits.map(fieldForEdit)));
}

/** Dependent fields released by this patch, excluding fields the user also
 * explicitly authorized. No chaining: only explicit fields consult the map. */
export function dependentFieldsForPatch(patch: AuthorizedIdentityPatch): HairGeometryDependentField[] {
  const explicit = new Set<AuthorizableIdentityField>(explicitFieldsForPatch(patch));
  const dependents = new Set<HairGeometryDependentField>();
  for (const field of Array.from(explicit)) {
    const declared = IDENTITY_EDIT_DEPENDENCIES[field as keyof typeof IDENTITY_EDIT_DEPENDENCIES] ?? [];
    for (const dependent of declared) {
      if (!explicit.has(dependent)) dependents.add(dependent);
    }
  }
  return Array.from(dependents);
}

export function dependentPromptDirectives(patch: AuthorizedIdentityPatch): string[] {
  const dependents = dependentFieldsForPatch(patch);
  if (dependents.length === 0) return [];
  return [
    `EXPECTED PHYSICAL CONSEQUENCES — these hair-geometry details may adapt only as required by the authorized change: ${dependents.join(", ")}.`,
    "Do not change hair color, hair texture, hairline, face, skin, demographics, permanent marks, or overall facial identity as a consequence.",
  ];
}
