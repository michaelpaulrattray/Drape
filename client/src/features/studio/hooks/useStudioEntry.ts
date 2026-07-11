/**
 * useStudioEntry — resolves how /studio is entered, from the URL alone.
 *
 * Replaces the old mount effect that reset to the studio lobby. With the
 * lobby retired, /studio is a pure workspace: every entry must name a
 * tool (?tool=casting|wardrobe|export, plus ?new / ?modelId / ?sessionId
 * modifiers), and a bare /studio redirects to /app.
 *
 * Redirect-safety invariants (do not weaken these):
 *  1. The bare-/studio redirect fires ONLY in the synchronous branch
 *     below, decided from the URL before any async work is started. No
 *     state-driven code path issues it.
 *  2. entryStatus stays 'resolving' until a terminal branch has run.
 *     Every terminal branch — including the async wardrobe ones —
 *     synchronously sets activeTool to a tool OR (resetStudio +
 *     wardrobeStart=true; the reset matters because a stale activeTool
 *     left over from in-app navigation would out-render WardrobeStart)
 *     BEFORE the finally block flips entryStatus to 'settled'. The
 *     page's null-tool watcher is gated on entryStatus === 'settled',
 *     so it provably cannot fire mid-resolution, and at the moment the
 *     gate opens its predicate (activeTool null && !wardrobeStart) is
 *     already false.
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useStudioStore } from '../stores/useStudioStore';
import { useSessionReset } from './useSessionReset';
import { useResumeDraft } from './useResumeDraft';
import { useLoadWardrobeModel } from './useLoadWardrobeModel';
import { resetCastingSession } from './castingSessionReset';
import { useCastingGenerationStore } from '@/features/casting/stores/useCastingGenerationStore';
import { useCastingFormStore } from '@/features/casting/stores/useCastingFormStore';
import { useWardrobeStore } from '@/features/wardrobe/stores/useWardrobeStore';
import type { StudioTool } from '../types';

const VALID_TOOLS: StudioTool[] = ['casting', 'wardrobe', 'export'];

export type EntryStatus = 'resolving' | 'settled';

function positiveIntParam(params: URLSearchParams, key: string): number | null {
  const value = Number(params.get(key));
  return Number.isInteger(value) && value > 0 ? value : null;
}

interface UseStudioEntryOptions {
  /** Auth confirmed — entry waits for this */
  isAuthenticated: boolean;
  /** localStorage session restore still hydrating — entry waits so a
   *  ?new=1 reset can't be overwritten by a late-arriving restore */
  isRestoring: boolean;
}

export function useStudioEntry({ isAuthenticated, isRestoring }: UseStudioEntryOptions) {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const [entryStatus, setEntryStatus] = useState<EntryStatus>('resolving');
  const started = useRef(false);

  const trpcUtils = trpc.useUtils();
  const setActiveTool = useStudioStore((s) => s.setActiveTool);
  const setWardrobeStart = useStudioStore((s) => s.setWardrobeStart);
  const { resumeWardrobeSession } = useSessionReset();
  const { resumeDraftById } = useResumeDraft();
  const { loadMintedModelById } = useLoadWardrobeModel();

  useEffect(() => {
    if (started.current) return;
    if (!isAuthenticated || isRestoring) return;
    started.current = true;

    const params = new URLSearchParams(searchString);
    const tool = params.get('tool') as StudioTool | null;

    // ── Invariant 1: the ONLY bare-/studio redirect. Synchronous,
    // URL-decided, before any async work exists to race against.
    if (!tool || !VALID_TOOLS.includes(tool)) {
      navigate('/app', { replace: true });
      return; // entryStatus stays 'resolving'; we are leaving the page
    }

    const finish = () => setEntryStatus('settled');

    if (tool === 'export') {
      setActiveTool('export');
      finish();
      return;
    }

    if (tool === 'casting') {
      const modelId = positiveIntParam(params, 'modelId');
      if (params.get('new') === '1') {
        // Fresh casting session — the shared reset contract (also used by
        // the board's CastingTakeover, D-35)
        resetCastingSession();
        setActiveTool('casting');
        finish();
      } else if (modelId) {
        resumeDraftById(modelId)
          .then((model) => {
            toast.success(`Resumed draft — ${model.name || 'Draft Model'}`);
          })
          .catch(() => {
            toast.error('Could not load that model');
            setActiveTool('casting'); // land in casting rather than bouncing
          })
          .finally(finish);
      } else {
        setActiveTool('casting');
        finish();
      }
      return;
    }

    // tool === 'wardrobe' — async resolution. Invariant 2: every terminal
    // branch activates wardrobe or raises wardrobeStart before finish().
    void (async () => {
      const modelId = positiveIntParam(params, 'modelId');
      const sessionId = positiveIntParam(params, 'sessionId');
      try {
        if (modelId) {
          const loaded = await loadMintedModelById(modelId);
          if (loaded) return; // activeTool is now 'wardrobe'
          // Model unusable (no assets) — fall through to sessions
        }

        const sessions = await trpcUtils.wardrobe.sessions.getRecent.fetch();
        const match = sessionId
          ? sessions?.find((s) => s.sessionId === sessionId)
          : undefined;
        const target = match ?? sessions?.[0];

        if (target) {
          resumeWardrobeSession(target);
          toast.success(`Resumed session — ${target.modelName || 'Uploaded Model'}`);
        } else {
          // Nothing to resume — clean slate, then show the start screen.
          // resetStudio also nulls activeTool: a leftover tool from a
          // previous in-app studio visit would otherwise render instead
          // of WardrobeStart (which requires activeTool === null).
          useCastingGenerationStore.getState().resetGeneration();
          useCastingFormStore.getState().resetForm();
          useWardrobeStore.getState().resetWardrobe();
          useStudioStore.getState().resetStudio();
          setWardrobeStart(true);
        }
      } catch {
        // Fetch failed — the start screen is the safe landing
        toast.error('Could not load your sessions');
        useStudioStore.getState().resetStudio();
        setWardrobeStart(true);
      } finally {
        finish();
      }
    })();
  }, [
    isAuthenticated,
    isRestoring,
    searchString,
    navigate,
    setActiveTool,
    setWardrobeStart,
    resumeWardrobeSession,
    resumeDraftById,
    loadMintedModelById,
    trpcUtils,
  ]);

  return { entryStatus };
}
