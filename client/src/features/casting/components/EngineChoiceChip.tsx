/**
 * EngineChoiceChip — the explicit "Open" state on a required field (D-41 as
 * amended by ruling A, 2026-07-11): deliberately unspecified, resolved at
 * generation. UI vocabulary is "Open" everywhere this state appears — the
 * internal engineChoice naming stays dev-side and must never leak into copy.
 * Selecting Open satisfies validation and clears any value (leaving it open
 * un-chooses); picking a value takes it back. Absence in prefs is what the
 * engine actually receives — this chip is UI truth about that, never a
 * sentinel string in prompts.
 *
 * Styled in the canvas language (new surface — survives the R6 restyle).
 */
import { cn } from "@/lib/utils";
import { useCastingFormStore, type RequiredCastField } from "../stores/useCastingFormStore";

export function EngineChoiceChip({ field }: { field: RequiredCastField }) {
  const on = useCastingFormStore((s) => !!s.engineChoice[field]);
  const setEngineChoice = useCastingFormStore((s) => s.setEngineChoice);

  return (
    <button
      type="button"
      onClick={() => setEngineChoice(field, !on)}
      title={
        on
          ? "Left open — the casting resolves it. Select a value to take it back."
          : "Leave this open — the casting resolves it"
      }
      className={cn(
        "shrink-0 px-2 py-[3px] rounded-canvas-pill text-canvas-xs transition-colors",
        on
          ? "bg-canvas-surface-inset border border-canvas-ink text-canvas-ink font-medium"
          : "border-hairline border-canvas-border text-canvas-ink-faint hover:text-canvas-ink-soft hover:border-canvas-border-strong",
      )}
    >
      Open
    </button>
  );
}
