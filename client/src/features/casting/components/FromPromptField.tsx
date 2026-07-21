/**
 * FromPromptField — the "from prompt" option inside the create path (D-33/R2).
 * A sentence goes to the server parser; the host (ControlPanel) applies the
 * result with the D-41 choreography: visible fill sweep, summary strip where
 * the action happened (no corner toast — D-40), Engine's-choice on the rest,
 * Cast button armed.
 */
import { useState } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export interface ParsePromptResult {
  intent: "parsed" | "random";
  preferences: Record<string, unknown>;
  randomizeFields: string[];
  parsedFieldCount: number;
  /** Client-only context used to keep the translated brief visible in UX. */
  sourcePrompt?: string;
}

interface FromPromptFieldProps {
  onParsed: (result: ParsePromptResult) => void;
  variant?: "panel" | "hero";
}

export function FromPromptField({ onParsed, variant = "panel" }: FromPromptFieldProps) {
  const [value, setValue] = useState("");
  const isHero = variant === "hero";

  const parseMutation = trpc.generation.parsePrompt.useMutation({
    onSuccess: (res) => {
      onParsed({ ...(res as ParsePromptResult), sourcePrompt: value.trim() });
      setValue("");
    },
    onError: (err) => toast.error(err.message),
  });

  const submit = () => {
    const prompt = value.trim();
    if (!prompt || parseMutation.isPending) return;
    parseMutation.mutate({ prompt });
  };

  return (
    <div className={isHero ? "w-full" : "px-4 pb-3"}>
      <div
        className={`flex items-center gap-3 bg-canvas-surface border-hairline border-canvas-border-strong focus-within:border-canvas-ink transition-colors ${
          isHero ? "rounded-canvas-lg px-4" : "rounded-canvas-md px-3"
        }`}
        style={{ height: isHero ? 58 : 38 }}
      >
        <input
          type="text"
          aria-label="Describe your model"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={isHero
            ? "e.g. mid-20s Korean model, editorial, sharp bob, hazel eyes"
            : "Describe your model — the form fills itself..."}
          disabled={parseMutation.isPending}
          className="flex-1 min-w-0 bg-transparent focus:outline-none disabled:opacity-50 text-canvas-ink placeholder:text-canvas-ink-faint"
          style={{ fontSize: isHero ? 14 : 12.5 }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!value.trim() || parseMutation.isPending}
          aria-label="Translate brief"
          className={`shrink-0 rounded-full flex items-center justify-center transition-opacity disabled:opacity-30 bg-canvas-ink text-canvas-surface ${
            isHero ? "w-8 h-8" : "w-6 h-6"
          }`}
        >
          {parseMutation.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <ArrowUp className="w-3 h-3" strokeWidth={2} />
          )}
        </button>
      </div>
      {isHero && (
        <p className="mt-2 px-1 text-canvas-sm text-canvas-ink-faint">
          Enter to translate — nothing generates yet
        </p>
      )}
    </div>
  );
}
