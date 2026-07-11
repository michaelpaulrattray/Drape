/**
 * CastPickerModal — the empty cast node's front door (D-32/D-33).
 *
 * Modal-class SELECTION surface per the refined no-modal rule: single-purpose
 * choose-and-dismiss, one purpose, no nesting, no editing workflows inside.
 * Two tabs:
 *  - "Your models" — canonical cast reference imagery only (§1.5): never VTO
 *    outputs, styled renders, or scene imagery. Grid + search.
 *  - "Cast new" — interim prompt path until the D-35 takeover environment
 *    lands; the parser's "from prompt" option and the full casting
 *    environment plug in here, never on the node face.
 *
 * Portaled to <body> with its own canvas-scope wrapper (D-22) so it renders
 * in the canvas light language regardless of host theme.
 */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { SafeImage } from "./ImageFallback";
import { CostLabel } from "./CostLabel";
import { useCastActions } from "./useCastActions";

export interface CastPickerModalProps {
  boardId: number;
  /** The empty cast node being filled. May briefly be an optimistic negative
   *  id — actions stay disabled until the server id is confirmed (BoardPage
   *  swaps the prop in place on confirm). */
  itemId: number;
  onClose: () => void;
}

type PickerTab = "models" | "new";

export function CastPickerModal({ boardId, itemId, onClose }: CastPickerModalProps) {
  const [tab, setTab] = useState<PickerTab>("models");
  const [search, setSearch] = useState("");
  const [prompt, setPrompt] = useState("");

  const actions = useCastActions({ boardId, itemId, enablePlan: true });
  const disabled = actions.fillPending || itemId < 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const { data: models, isLoading } = trpc.boardOps.listCastableModels.useQuery({ limit: 30 });

  const filtered = useMemo(() => {
    const list = models ?? [];
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((m) => (m.name ?? "").toLowerCase().includes(q));
  }, [models, search]);

  const canRun = prompt.trim().length > 0 && !disabled;
  const pick = (modelId: number) => {
    actions.fillFromLibrary(modelId);
    onClose();
  };
  const castNew = () => {
    actions.run(prompt.trim());
    onClose();
  };

  return createPortal(
    <div className="canvas-scope fixed inset-0 z-50 flex items-center justify-center">
      {/* Scrim — click dismisses (choose-and-dismiss surface) */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(10,10,10,0.3)" }}
        onClick={onClose}
      />

      <div className="relative w-[640px] max-w-[92vw] max-h-[80vh] flex flex-col bg-canvas-surface border-hairline border-canvas-border-strong rounded-canvas-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <span className="text-canvas-md font-medium text-canvas-ink">Cast</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-6 h-6 rounded-canvas-sm flex items-center justify-center text-canvas-ink-soft hover:text-canvas-ink hover:bg-canvas-surface-inset transition-colors"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.6} />
          </button>
        </div>

        {/* Tabs — one purpose each, hairline underline */}
        <div className="flex gap-5 px-5 border-b-hairline border-canvas-border">
          {(
            [
              { id: "models", label: "Your models" },
              { id: "new", label: "Cast new" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "pb-2.5 text-canvas-sm transition-colors border-b -mb-px",
                tab === t.id
                  ? "text-canvas-ink font-medium border-canvas-ink"
                  : "text-canvas-ink-faint hover:text-canvas-ink-soft border-transparent",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "models" ? (
          <div className="flex-1 min-h-0 flex flex-col p-5">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search models..."
              autoFocus
              className="w-full mb-4 px-3 py-2 bg-canvas-surface-inset rounded-canvas-md text-canvas-sm text-canvas-ink placeholder:text-canvas-ink-faint focus:outline-none"
            />
            {isLoading ? (
              <div className="py-14 text-center text-canvas-xs text-canvas-ink-faint">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 flex flex-col items-center text-canvas-ink-faint">
                <User className="w-4 h-4 opacity-50" strokeWidth={1.2} />
                <span className="text-canvas-xs mt-1.5">
                  {search.trim() ? "No models match" : "No models yet"}
                </span>
                {!search.trim() && (
                  <button
                    type="button"
                    onClick={() => setTab("new")}
                    className="mt-2.5 text-canvas-xs text-canvas-ink-soft hover:text-canvas-ink transition-colors"
                  >
                    Cast a new one
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-3 overflow-y-auto pr-1">
                {filtered.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => pick(m.id)}
                    className="text-left group disabled:opacity-50"
                  >
                    {/* 3:4 — canonical cast geometry (D-31); the model image is sacred */}
                    <div className="aspect-[3/4] rounded-canvas-sm overflow-hidden border-hairline border-canvas-border group-hover:border-canvas-ink transition-colors bg-canvas-surface-inset">
                      <SafeImage
                        src={m.headshotUrl}
                        alt=""
                        fallbackIconOnly
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-canvas-xs text-canvas-ink-soft truncate mt-1.5">
                      {m.name ?? "Untitled"}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-5">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && canRun) {
                  e.preventDefault();
                  castNew();
                }
              }}
              rows={3}
              autoFocus
              placeholder="Describe your model — look, age, vibe, brand..."
              className="w-full resize-none px-3 py-2.5 bg-canvas-surface-inset rounded-canvas-md text-canvas-sm text-canvas-ink placeholder:text-canvas-ink-faint focus:outline-none leading-relaxed"
            />
            <div className="flex items-center justify-end gap-2.5 mt-4">
              {canRun && <CostLabel credits={actions.runCost} />}
              <button
                type="button"
                disabled={!canRun}
                onClick={castNew}
                className={cn(
                  "px-3.5 py-1.5 rounded-canvas-pill text-canvas-xs font-medium transition-colors",
                  canRun
                    ? "bg-canvas-ink text-canvas-surface hover:opacity-90"
                    : "bg-canvas-surface-inset text-canvas-ink-faint border-hairline border-canvas-border",
                )}
              >
                Run
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
