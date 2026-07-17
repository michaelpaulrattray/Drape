import {
  isModelDraftStatus,
  isModelMintedStatus,
} from '@shared/modelLifecycle';

const DRAFT_AUTO_NAME = 'Draft Model';

/** Return the first founder-visible name, ignoring the internal draft sentinel. */
export function honestModelName(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const trimmed = (value ?? '').trim();
    if (trimmed && trimmed !== DRAFT_AUTO_NAME) return trimmed;
  }
  return '';
}

/** Honest profile identity copy while server truth is loading or unavailable. */
export function castingIdentityLabel(input: {
  status?: string | null;
  agencyId?: string | null;
  pending: boolean;
}): string {
  if (input.pending) return 'Loading identity…';
  if (isModelMintedStatus(input.status)) {
    return input.agencyId?.trim() || 'Identity unavailable';
  }
  if (isModelDraftStatus(input.status)) return 'Draft';
  return 'Identity unavailable';
}
