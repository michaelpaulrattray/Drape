interface CastingAuthoringModeInput {
  hasAssets: boolean;
  isReadOnly: boolean;
  mintedEdit: boolean;
  identityChangeOpen: boolean;
}

/**
 * The expert identity form is creation/recast machinery, not the ordinary
 * draft-refinement surface. Legacy minted sessions retain their existing form
 * until the dedicated Cast Profile phase replaces that path.
 */
export function shouldShowCastingControlPanel({
  hasAssets,
  isReadOnly,
  mintedEdit,
  identityChangeOpen,
}: CastingAuthoringModeInput) {
  return !hasAssets || isReadOnly || mintedEdit || identityChangeOpen;
}

/** A draft with a headshot may only recast from the deliberate identity door. */
export function canInvokeIdentityGeneration({
  hasAssets,
  isReadOnly,
  mintedEdit,
  identityChangeOpen,
}: CastingAuthoringModeInput) {
  if (isReadOnly || mintedEdit) return false;
  return !hasAssets || identityChangeOpen;
}

export function shouldOfferDraftIdentityDoor({
  hasAssets,
  isReadOnly,
  mintedEdit,
  identityChangeOpen,
}: CastingAuthoringModeInput) {
  return hasAssets && !isReadOnly && !mintedEdit && !identityChangeOpen;
}
