/**
 * EngineChoiceChip — the explicit "Engine's choice" state on a required
 * field (D-41). Selecting it satisfies validation and clears any value
 * (delegating un-chooses); picking a value clears the delegation. Absence in
 * prefs is what the engine actually receives — this chip is UI truth about
 * that, never a sentinel string in prompts.
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
          ? "The engine will choose this — select a value to take it back"
          : "Let the engine choose this from the brand direction"
      }
      className={cn(
        "shrink-0 px-2 py-[3px] rounded-canvas-pill text-canvas-xs transition-colors",
        on
          ? "bg-canvas-surface-inset border border-canvas-ink text-canvas-ink font-medium"
          : "border-hairline border-canvas-border text-canvas-ink-faint hover:text-canvas-ink-soft hover:border-canvas-border-strong",
      )}
    >
      Engine's choice
    </button>
  );
}
