export interface CastingSessionGuard {
  token: number;
  isCurrent: () => boolean;
}

/** Capture one session generation. Every async continuation checks this. */
export function captureCastingSession(getToken: () => number): CastingSessionGuard {
  const token = getToken();
  return {
    token,
    isCurrent: () => getToken() === token,
  };
}
