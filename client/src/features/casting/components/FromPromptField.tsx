/**
 * FromPromptField — the "from prompt" option inside the create path (D-33/R2).
 * A sentence goes to the server parser; the extracted attributes PREFILL the
 * form controls (never bypass them — the user reviews, adjusts, generates).
 * Warm-styled to match the current environment; restyles with R6.
 */
import { useState } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { ModelPreferences } from "../constants";

export function FromPromptField({ onApply }: { onApply: (prefs: Partial<ModelPreferences>) => void }) {
  const [value, setValue] = useState("");

  const parseMutation = trpc.generation.parsePrompt.useMutation({
    onSuccess: (res) => {
      onApply(res.preferences as Partial<ModelPreferences>);
      toast.success(
        res.intent === "random"
          ? "Randomized from your brief"
          : `Brief translated — ${res.parsedFieldCount} field${res.parsedFieldCount === 1 ? "" : "s"} set`,
      );
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
        className="flex items-center gap-2 rounded-xl px-3"
        style={{ background: "#ffffff", border: "1px solid #E8E4DF", height: 38 }}
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
          className="flex-1 min-w-0 bg-transparent focus:outline-none disabled:opacity-50"
          style={{ fontSize: 12.5, color: "#1a1a1a" }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!value.trim() || parseMutation.isPending}
          aria-label="Translate brief"
          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-opacity disabled:opacity-30"
          style={{ background: "#1a1a1a", color: "#fff" }}
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
