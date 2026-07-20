/**
 * refusalCopy — the ratified refusal vocabulary (IDENTITY_EDIT_INTERIM_POLICY
 * §15, Batch C). Typed, honest, never advertising unsupported capability;
 * temporary limits framed as temporary ("not yet", never "never").
 *
 * One module so every door and every M-matrix test consumes the same strings.
 */

export const REFUSAL_COPY = {
  /** §8.1 — all mark families, all operations, text and reference. */
  markEdit:
    "Permanent marks — tattoos, scars, freckles, birthmarks, piercings — can't be edited yet. Tattoos can be included when you cast; other mark editing is coming later.",

  /** §5.2 — presentation refuse-and-route (ratified wording). */
  presentationRouting:
    "Casting creates the reusable character identity. Apply this on Canvas for a quick creative result, or continue to Wardrobe for precise garment control.",

  /** §15 — makeup / cosmetic lash treatments. */
  cosmeticLash:
    "Makeup and lash styling live on Canvas — the cast sheet stays natural.",

  /** §15 — post-creation eyelash edits, natural or cosmetic. */
  eyelashPostCreation:
    "Eyelash changes aren't supported yet — describe natural lashes in the casting brief when you cast. Coming later.",

  /** §8.2 — person-level structured attributes at a free-text door. */
  personStructured:
    "Build, age, gender, skin tone, and ethnicity change through the character editor on a draft — or re-cast for a different person.",

  /** §15 — ambiguous / parent-only identity request. */
  ambiguousIdentity:
    "Tell me exactly what to change — for example 'a sharper jawline' or 'shorter hair'.",

  /** §15 — unmapped leaf (chin, brow color under R9). */
  unmappedLeaf: "That specific change isn't supported yet — coming later.",

  /** A successful identity edit's sibling truth (§8.3 / founder final hair
   *  ruling): existing views keep the OLD identity until refreshed — the
   *  edit never regenerates them or spends credits automatically. */
  siblingsNeedRefresh:
    "The other views still show the previous identity — refresh them when you're ready to bring the whole card in line.",

  /** W5 identity-output gate: the image engine changed protected traits. */
  identityDrift: (name: string | null) =>
    `That change is allowed, but the generated result also changed ${name || "this model"}'s protected identity. Nothing was saved. Try again or describe the change more precisely.`,

  /** W5 identity-output gate: the verifier itself could not return a safe verdict. */
  identityVerificationUnavailable:
    "The edit couldn't be verified just now — nothing was changed. Try again in a moment.",

  /** An identity classification without its typed patch is never allowed to
   * fall through to the image-only path. */
  identityAuthorizationUnavailable:
    "The identity edit couldn't be authorized safely — nothing was changed or charged. Try again in a moment.",

  /** Identity edit typed against a non-anchor view. */
  nonAnchorView:
    "Identity changes happen on the headshot — it anchors every other view. Open the headshot and make the change there.",

  /** Identity edit typed against a frontClose that isn't the authoritative anchor. */
  nonAuthoritativeHeadshot:
    "Identity changes happen on the current headshot — switch to the latest headshot version and make the change there.",

  /** F4 fork copy (minted). */
  mintedIdentity: (name: string | null) =>
    `This changes who ${name || "this model"} is — their identity is minted. Fork to explore it, or include it at casting time.`,

  /** §9.1 rule 3. */
  vagueReference:
    "Name exactly what to take from the reference — for example 'use the hairstyle from the reference'. Whole-look transfers aren't supported.",

  /** Whole-face / whole-person replacement. */
  wholeIdentityReference:
    "Casting can't replace who this person is with someone else. Cast a new model, or name one exact feature to change.",

  /** Unsupported reference modality for a leaf. */
  unsupportedReference: (label: string) =>
    `Transferring ${label} from a reference isn't supported yet — describe the change in words instead.`,

  /** Ratified but modality-disabled in the runtime registry. */
  registryDisabled: (label: string) =>
    `Editing ${label} here isn't available yet — coming later.`,

  /** R2 — classifier outage / malformed classification: free and retryable. */
  classifierUnavailable:
    "We couldn't safely understand that edit just now. Nothing was charged — try again in a moment.",

  /** Fail-closed default. */
  unknown:
    "We couldn't place that change safely, so nothing was charged. Try naming one exact feature — or style it downstream on Canvas.",

  /** §8.6 step 4. */
  normalizationFailed:
    "We couldn't pin that change down to an exact value, so nothing was charged. Try describing it more concretely.",

  /** D-56.1 — a hair-length edit whose wording names no single length band.
   *  The durable value is always the band the user named; vague or
   *  conflicting wording can justify none, so it refuses free. */
  hairLengthVague:
    "Choose one clear final hair length — 'short', 'medium', 'long', 'very long', or one matching length such as 'chin-length' or 'waist-length'. If you named more than one length, choose the single result you want. Nothing was charged.",

  /** §7.4 — cross-revision restore (headshots AND sibling views). */
  crossRevisionRestore:
    "This version belongs to an earlier identity and can't replace the current cast. Fork or re-cast to use it.",

  /** §7.4 — missing/uncertain legacy provenance. */
  uncertainRestoreProvenance:
    "This version's identity lineage can't be verified, so it can't replace the current cast. Refresh the view to get a current version.",

  /** §14 check 1 — identity-anchor validity. */
  mintAnchorInvalid:
    "This model's identity reference needs attention — refresh or re-roll the headshot before minting.",

  /** §14 check 2 — display-headshot validity. */
  mintDisplayHeadshotInvalid:
    "The displayed headshot belongs to an earlier identity — switch to a current version before minting.",

  /** §14 check 3 — tier-view validity (cross-revision uses §7.4's copy). */
  mintTierViewStale: (label: string) =>
    `${label} is out of sync with the current identity — refresh it (unpin first if pinned) before minting.`,
  mintTierViewCrossRevision: (label: string) =>
    `${label} belongs to an earlier identity and can't be minted with the current cast. Refresh it before minting.`,
  mintTierViewFailed: (label: string) =>
    `${label} failed to generate — retry it before minting.`,

  /** §14 credit honesty. */
  mintRetryCredit:
    "The failed attempt was refunded. Retrying charges the normal view price only if generation succeeds.",

  /** Reconcile — R7 ratified: keep off. */
  reconcileDisabled:
    "Automatic reconcile is off — the identity document changes only through deliberate edits, never from a generated image.",

  /** §10.2 — presentation language in a creation brief. */
  creationPresentation:
    "The casting brief describes who the person is — clothing, accessories, and makeup come later on Canvas or in Wardrobe. Remove the styling language to cast.",

  /** §5.2 — cosmetic-lash creation language. */
  creationCosmeticLash:
    "Cosmetic lash treatments aren't part of the cast sheet — describe natural lashes instead, and style makeup later on Canvas.",

  /** §10.3 — reference images at creation. */
  creationReference:
    "A new cast is established from your selections and brief — reference images join after the first headshot, through the refine bar.",

  /** Pinned stale view — unpin-and-refresh route (§14). */
  pinnedStale: (label: string) =>
    `${label} is pinned but out of sync with the current identity — unpin it to refresh.`,
} as const;
