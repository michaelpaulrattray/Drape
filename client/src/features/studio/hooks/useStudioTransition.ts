/**
 * useStudioTransition — Orchestrates the "studio assembles around content" animation.
 *
 * When activeTool changes from null (lobby) to a tool, or between tools,
 * this hook manages staggered reveal phases so the workspace feels like
 * it forms around the content rather than just swapping views.
 *
 * Timeline (lobby → tool):
 *   0ms   — lobby fades out
 *   200ms — tool rail slides in from left
 *   350ms — left panel slides in from left
 *   450ms — center canvas fades in / scales up
 *   550ms — right panel slides in from right
 *
 * Timeline (tool → tool):
 *   0ms   — panels cross-fade (shorter, 250ms)
 */
import { useState, useEffect, useRef } from 'react';
import type { ActiveTool } from '../types';

/** Which phase of the assembly animation we're in */
export interface TransitionPhases {
  /** Lobby is visible / fading out */
  lobbyVisible: boolean;
  /** Tool rail has entered */
  railReady: boolean;
  /** Left panel has entered */
  leftReady: boolean;
  /** Center canvas has entered */
  centerReady: boolean;
  /** Right panel has entered */
  rightReady: boolean;
  /** Full workspace is settled (all animations done) */
  settled: boolean;
}

const INITIAL: TransitionPhases = {
  lobbyVisible: true,
  railReady: false,
  leftReady: false,
  centerReady: false,
  rightReady: false,
  settled: false,
};

const ALL_READY: TransitionPhases = {
  lobbyVisible: false,
  railReady: true,
  leftReady: true,
  centerReady: true,
  rightReady: true,
  settled: true,
};

export function useStudioTransition(activeTool: ActiveTool) {
  const [phases, setPhases] = useState<TransitionPhases>(
    activeTool === null ? INITIAL : ALL_READY
  );
  const prevToolRef = useRef<ActiveTool>(activeTool);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const prevTool = prevToolRef.current;
    prevToolRef.current = activeTool;

    // Clear any pending timers
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    // Returning to lobby
    if (activeTool === null) {
      // Quick collapse: panels out, then lobby in
      setPhases({
        lobbyVisible: false,
        railReady: false,
        leftReady: false,
        centerReady: false,
        rightReady: false,
        settled: false,
      });
      timersRef.current.push(
        setTimeout(() => {
          setPhases((p) => ({ ...p, lobbyVisible: true, settled: true }));
        }, 200)
      );
      return;
    }

    // From lobby → tool: full orchestrated assembly
    if (prevTool === null) {
      // Start: hide lobby
      setPhases({
        lobbyVisible: false,
        railReady: false,
        leftReady: false,
        centerReady: false,
        rightReady: false,
        settled: false,
      });

      // Staggered reveal
      timersRef.current.push(
        setTimeout(() => setPhases((p) => ({ ...p, railReady: true })), 150),
        setTimeout(() => setPhases((p) => ({ ...p, leftReady: true })), 300),
        setTimeout(() => setPhases((p) => ({ ...p, centerReady: true })), 400),
        setTimeout(() => setPhases((p) => ({ ...p, rightReady: true })), 500),
        setTimeout(() => setPhases((p) => ({ ...p, settled: true })), 700),
      );
      return;
    }

    // Tool → tool: quick cross-fade
    setPhases({
      lobbyVisible: false,
      railReady: true,
      leftReady: false,
      centerReady: false,
      rightReady: false,
      settled: false,
    });

    timersRef.current.push(
      setTimeout(() => setPhases((p) => ({ ...p, leftReady: true })), 80),
      setTimeout(() => setPhases((p) => ({ ...p, centerReady: true })), 150),
      setTimeout(() => setPhases((p) => ({ ...p, rightReady: true })), 220),
      setTimeout(() => setPhases((p) => ({ ...p, settled: true })), 350),
    );
  }, [activeTool]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  return phases;
}
