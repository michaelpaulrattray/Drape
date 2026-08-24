/**
 * What `useModelSetup` should do when the model photo changes.
 *
 * Lifted out of the hook's effect BYTE-PRESERVING (2026-08-25, 3g);
 * `useModelSetup` is its production reader.
 *
 * ⚠ WHY, and this is 3g's worst functional drift: `server/wardrobe.test.ts`
 * carried a private `getModelSetupActions`, commented "Simulate the hook's
 * decision logic for what to do on model URL change", and it described a hook
 * with NO GUARDS AT ALL —
 *
 *     const actions = { clearHistory: true, clearTattooMap: true, … };
 *     if (newUrl) { actions.runTattooAnalysis = true; actions.runQualityCheck = true; }
 *
 * — where the real hook has four, and every one of them exists to protect
 * something:
 *
 *   - history is cleared ONLY when there is none to lose. On a session
 *     resume the history has just been hydrated and wiping it is the bug the
 *     guard was added for.
 *   - the tattoo map is cleared ONLY when there is not one already, for the
 *     same reason — it may have just come back from the database.
 *   - the tattoo analysis runs ONLY without an existing map AND for a URL not
 *     already analyzed.
 *   - the quality check runs ONLY for a URL not already checked.
 *
 * So five arms asserted, as correct, the behaviour those guards were written
 * to prevent. Deleting the resume guard would have turned them GREEN about a
 * customer losing their session. Working law 4: derive, never mirror.
 */

export interface ModelSetupInputs {
  newUrl: string | null;
  prevUrl: string | null;
  /** VTO history already in the store — a resumed session has some. */
  hasHistory: boolean;
  /** A tattoo map already in the store — a resumed session has one. */
  hasTattooMap: boolean;
  /** The last URL the tattoo analysis succeeded for, across remounts. */
  lastAnalyzedUrl: string | null;
  /** The last URL the quality check succeeded for, across remounts. */
  lastQualityUrl: string | null;
}

export interface ModelSetupActions {
  clearHistory: boolean;
  clearTattooMap: boolean;
  runTattooAnalysis: boolean;
  runQualityCheck: boolean;
}

/** `null` when the URL has not actually changed — the effect does nothing at all. */
export function planModelSetup(inputs: ModelSetupInputs): ModelSetupActions | null {
  const { newUrl, prevUrl, hasHistory, hasTattooMap, lastAnalyzedUrl, lastQualityUrl } = inputs;

  if (newUrl === prevUrl) return null;

  const clearHistory = !hasHistory;
  const clearTattooMap = !hasTattooMap;

  // No API calls if the model is cleared.
  if (!newUrl) {
    return { clearHistory, clearTattooMap, runTattooAnalysis: false, runQualityCheck: false };
  }

  return {
    clearHistory,
    clearTattooMap,
    runTattooAnalysis: !hasTattooMap && lastAnalyzedUrl !== newUrl,
    runQualityCheck: lastQualityUrl !== newUrl,
  };
}

/** Whether a quality result is worth warning the customer about. */
export function shouldShowQualityWarning(quality: string): boolean {
  return quality === "poor";
}
