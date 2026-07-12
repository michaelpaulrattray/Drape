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
}

export function FromPromptField({ onParsed }: { onParsed: (result: ParsePromptResult) => void }) {
  const [value, setValue] = useState("");

  const parseMutation = trpc.generation.parsePrompt.useMutation({
    onSuccess: (res) => {
      onParsed(res as ParsePromptResult);
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
    <div className="px-4 pb-3">
      <div
        className="flex items-center gap-2 rounded-canvas-md px-3 bg-canvas-surface border-hairline border-canvas-border focus-within:border-canvas-ink transition-colors"
        style={{ height: 38 }}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Describe your model — the form fills itself..."
          disabled={parseMutation.isPending}
          className="flex-1 min-w-0 bg-transparent focus:outline-none disabled:opacity-50 text-canvas-ink placeholder:text-canvas-ink-faint"
          style={{ fontSize: 12.5 }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!value.trim() || parseMutation.isPending}
          aria-label="Translate brief"
          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-opacity disabled:opacity-30 bg-canvas-ink text-canvas-surface"
        >
          {parseMutation.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <ArrowUp className="w-3 h-3" strokeWidth={2} />
          )}
        </button>
      </div>
    </div>
  );
}
