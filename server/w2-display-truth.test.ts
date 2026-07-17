import { describe, expect, it } from 'vitest';
import {
  castingIdentityLabel,
  honestModelName,
} from '../client/src/features/casting/modelDisplayTruth';

describe('W2 casting display truth', () => {
  it('skips the internal draft sentinel before considering server truth', () => {
    expect(honestModelName('Draft Model', 'Chelsea')).toBe('Chelsea');
    expect(honestModelName('  ', ' Chelsea ')).toBe('Chelsea');
    expect(honestModelName('Draft Model')).toBe('');
  });

  it('never labels loading or unknown identity truth as a draft', () => {
    expect(castingIdentityLabel({ status: undefined, pending: true })).toBe('Loading identity…');
    expect(castingIdentityLabel({ status: undefined, pending: false })).toBe('Identity unavailable');
    expect(castingIdentityLabel({ status: 'draft', pending: false })).toBe('Draft');
  });

  it('shows only the real agency id for minted identities', () => {
    expect(castingIdentityLabel({ status: 'active', agencyId: ' MOD-93 ', pending: false })).toBe('MOD-93');
    expect(castingIdentityLabel({ status: 'locked', agencyId: null, pending: false })).toBe('Identity unavailable');
  });
});
