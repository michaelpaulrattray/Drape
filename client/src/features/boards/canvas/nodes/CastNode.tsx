/**
 * CastNode — the single React Flow node type for casts (DESIGN_SYSTEM.md
 * §5.11). One component for cast_root, cast_view, and library_cast
 * provenance; branch on provenance.type, never split into separate files.
 *
 * Node face = label row, image, control strip — nothing else (D-34). The
 * empty node's front door is the CastPickerModal (D-33): choose existing or
 * cast new. No inline prompt, no attribute chrome; configuration and
 * post-cast editing consolidate in the casting environment (D-35, gated).
 *
 * R4: selection raises the floating toolbar (Decision 7 grammar). Rerun
 * opens the ForkRecastPopover (3f, as amended by D-43 — recast sealed on
 * minted); Variations opens the plan-priced popover; Duplicate/Delete/Info
 * dispatch to BoardPage (which owns modals, the trust net, and optimistic
 * landings); Download acts directly.
 */
import { memo, useRef, useState } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { trpc } from "@/lib/trpc";
import { Popover, PopoverAnchor } from "@/components/ui/popover";
import { CanvasPopoverContent } from "../CanvasPopover";
import { CanvasNodeShell } from "../CanvasNodeShell";
import { NodeLabelRow } from "../NodeLabelRow";
import { ConnectionDot } from "../ConnectionDot";
import { CastImageArea } from "../CastImageArea";
import { NodeControlStrip, type ControlSegment } from "../NodeControlStrip";
import { NodeStatusBadge } from "../NodeStatusBadge";
import { NodeFloatingToolbar, type NodeToolbarAction } from "../NodeFloatingToolbar";
import { ForkRecastPopoverContent } from "../ForkRecastPopover";
import { VariationsPopoverContent } from "../VariationsPopover";
import { downloadImage } from "../imageActions";
import { useRegisterCanvasLayer } from "../../stores/useCanvasLayers";
import { useCastNodeController } from "./useCastNodeController";
import { CharacterSheetImageArea } from "../CharacterSheetImageArea";
import { CostLabel } from "../CostLabel";
import { useSheetController } from "./useSheetController";
import type { Provenance, NodeStatus, CastAttributes } from "@shared/boardTypes";

export interface CastNodeData extends Record<string, unknown> {
  itemId: number;
  boardId: number;
  provenance: Extract<Provenance, { type: "cast_root" | "cast_view" | "library_cast" }> | null;
  label: string | null;
  imageUrl: string | null;
  userPrompt?: string;
  attributes?: CastAttributes;
  status?: NodeStatus | null;
  pinned?: boolean;
  version: number;
}

export type CastFlowNode = Node<CastNodeData, "cast">;

const VIEW_ANGLE_LABEL: Record<string, string> = {
  frontClose: "Headshot",
  frontFull: "Full front",
  sideClose: "Side close",
  sideFull: "Walk",
  backFull: "Back full",
  threeQuarter: "Three-quarter",
};

type NodePopover = "forkRecast" | "variations" | null;

function CastNodeInner({ data, selected }: NodeProps<CastFlowNode>) {
  const controller = useCastNodeController(data);
  const utils = trpc.useUtils();
  const containerRef = useRef<HTMLDivElement>(null);
  const [popover, setPopover] = useState<NodePopover>(null);
  useRegisterCanvasLayer(`cast-node-popover-${data.itemId}`, popover !== null);

  const prov = data.provenance;
  const isRoot = !prov || prov.type === "cast_root"; // empty nodes are roots-to-be
  const isLibrary = prov?.type === "library_cast";
  // Card size (VC2 ruling, 2026-07-11): canonical/library 280, views 200; the
  // image area is a 3:4 portrait matching the generation ratio exactly.
  const isView = prov?.type === "cast_view";
  const cardWidth = isView ? 200 : 280;
  // D-42: placed drafts wear their status in the label row
  const isDraft = isLibrary && prov?.type === "library_cast" && prov.draft === true;
  // D-43: a non-draft library cast is a MINTED identity — recast is sealed
  const isMinted = isLibrary && !isDraft;
  const baseLabel = data.label ? `Cast · ${data.label}` : "Cast";
  const typeLabel = isDraft
    ? `${baseLabel} · Draft`
    : isLibrary
      ? `${baseLabel} · Library`
      : prov?.type === "cast_view"
        ? `${baseLabel} · ${VIEW_ANGLE_LABEL[prov.viewAngle] ?? prov.viewAngle}`
        : baseLabel;
  const engine = prov && "engine" in prov ? prov.engine : undefined;
  const errored = data.status?.type === "error";
  const showFrontDoor =
    controller.isEmpty && !errored && controller.promptState !== "generating";

  // R3: Edit opens the casting environment on this model — for drafts it is
  // the promotion route (name/mint/add views; the node updates in place)
  const modelId = prov && "modelId" in prov ? prov.modelId : null;
  // modelId > 0 — optimistic rows carry a -1 placeholder until the server
  // confirm swaps in the real id; acting on that would target a dead session
  const modelReady = typeof modelId === "number" && modelId > 0 && data.itemId > 0;
  const openEdit = (openUpgrade = false) =>
    window.dispatchEvent(
      new CustomEvent("board-edit-cast", {
        detail: { itemId: data.itemId, modelId, draft: isDraft, openUpgrade },
      }),
    );
  const editSegment: ControlSegment[] =
    modelReady && data.imageUrl
      ? [{ kind: "action", content: "Edit", onClick: () => openEdit() }]
      : [];

  // ── R5: the comp card (DS §5.17) — the model's package rendered on the
  // root; tile popover is the ONE per-view surface (D-29 restraint) ─────────
  const sheet = useSheetController(data, {
    enabled: modelReady && !isView && !!data.imageUrl,
  });
  const tileAnchorRef = useRef<HTMLElement | null>(null);
  useRegisterCanvasLayer(`sheet-tile-${data.itemId}`, sheet.popoverAngle !== null);
  const showSheet = sheet.isSheet && controller.promptState === "complete" && !errored && !controller.isEmpty;

  // D-51: the package verb — one strip slot, three honest states. Ghost
  // tiles are the in-card accelerator; this is the stable anchor.
  const packageVerb: ControlSegment[] =
    modelReady && data.imageUrl && !isView
      ? isDraft
        ? [{ kind: "action", content: "Build comp card", onClick: () => openEdit(true) }]
        : sheet.minted && !sheet.completeCard
          ? [{ kind: "action", content: "Complete card", onClick: () => openEdit(true) }]
          : [] // complete six-slot card: the verb disappears entirely
      : [];

  // D-43 v-chip ruling: hidden at v1; at >1 the chip itself opens history
  const versionSegment: ControlSegment[] =
    (data.version || 1) > 1
      ? [{
          kind: "action",
          content: `v${data.version}`,
          onClick: () =>
            window.dispatchEvent(
              new CustomEvent("board-open-version-history", { detail: { itemId: data.itemId } }),
            ),
        }]
      : [];

  // R4: the ··· segment opens the node menu (same surface as right-click)
  const openMenu = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    window.dispatchEvent(
      new CustomEvent("board-open-node-menu", {
        detail: {
          itemId: data.itemId,
          x: rect ? rect.right + 8 : window.innerWidth / 2,
          y: rect ? rect.top : window.innerHeight / 2,
        },
      }),
    );
  };

  const controlSegments: ControlSegment[] = isRoot && !isLibrary
    ? [
        ...editSegment,
        ...packageVerb,
        ...versionSegment,
        { kind: "action", content: "···", onClick: openMenu },
      ]
    : [
        ...(data.pinned ? [{ kind: "pin", content: "Pinned — kept as finished work" } as ControlSegment] : []),
        ...editSegment,
        ...packageVerb,
        ...versionSegment,
        { kind: "action", content: "···", onClick: openMenu },
      ];

  // ── R4 toolbar: type-scoped action set (Decision 7 grammar; DS §5.10) ──
  const dispatchNodeEvent = (name: string) =>
    window.dispatchEvent(new CustomEvent(name, { detail: { itemId: data.itemId } }));

  const toolbarActions: NodeToolbarAction[] = [
    {
      id: "rerun",
      label: modelReady ? "Rerun" : "Rerun — still landing",
      disabled: !modelReady,
      onClick: () => setPopover((p) => (p === "forkRecast" ? null : "forkRecast")),
    },
    {
      id: "variations",
      label: isView
        ? "Not available on view nodes"
        : modelReady
          ? "Variations"
          : "Variations — still landing",
      disabled: isView || !modelReady,
      onClick: () => setPopover((p) => (p === "variations" ? null : "variations")),
    },
    {
      id: "duplicate",
      label: isView ? "Not available on view nodes" : "Duplicate",
      disabled: isView || data.itemId <= 0,
      onClick: () => dispatchNodeEvent("board-duplicate-node"),
    },
    {
      id: "download",
      label: data.imageUrl ? "Download" : "No image yet",
      disabled: !data.imageUrl,
      onClick: () => {
        if (data.imageUrl) void downloadImage(data.imageUrl, `drape-${data.label || data.itemId}.png`);
      },
    },
    {
      id: "delete",
      label: "Delete",
      disabled: data.itemId <= 0,
      onClick: () => dispatchNodeEvent("board-delete-node"),
    },
    {
      id: "info",
      label: "Info",
      disabled: data.itemId <= 0,
      onClick: () => {
        const rect = containerRef.current?.getBoundingClientRect();
        window.dispatchEvent(
          new CustomEvent("board-node-info", {
            detail: {
              itemId: data.itemId,
              x: rect ? rect.right + 12 : window.innerWidth / 2,
              y: rect ? rect.top : window.innerHeight / 2,
            },
          }),
        );
      },
    },
  ];

  const showToolbar =
    selected && !controller.isEmpty && controller.promptState !== "generating";

  return (
    <div ref={containerRef} className="relative" style={{ width: cardWidth }}>
      {showToolbar && <NodeFloatingToolbar actions={toolbarActions} />}

      {/* Rerun/Variations popovers — anchored above the card, beside the
          toolbar; screen-space via the portal, so screen-legible at any zoom */}
      <Popover open={popover !== null} onOpenChange={(open) => !open && setPopover(null)}>
        <PopoverAnchor asChild>
          <div className="absolute inset-x-0 top-0 h-0 pointer-events-none" />
        </PopoverAnchor>
        {popover !== null && (
          <CanvasPopoverContent
            side="top"
            sideOffset={52}
            className={popover === "forkRecast" ? "w-[260px]" : "w-[248px]"}
            onOpenAutoFocus={(e) => popover === "variations" && e.preventDefault()}
          >
            {popover === "forkRecast" ? (
              <ForkRecastPopoverContent
                boardId={data.boardId}
                itemId={data.itemId}
                name={data.label}
                isMinted={isMinted}
                onFork={() => {
                  setPopover(null);
                  dispatchNodeEvent("board-fork-cast");
                }}
                onRecast={() => {
                  setPopover(null);
                  dispatchNodeEvent("board-recast-cast");
                }}
              />
            ) : (
              <VariationsPopoverContent
                boardId={data.boardId}
                itemId={data.itemId}
                onCancel={() => setPopover(null)}
                onGenerate={(count, positions) => {
                  setPopover(null);
                  window.dispatchEvent(
                    new CustomEvent("board-run-variations", {
                      detail: { itemId: data.itemId, count, positions },
                    }),
                  );
                }}
              />
            )}
          </CanvasPopoverContent>
        )}
      </Popover>

      <NodeLabelRow type={typeLabel} engine={engine} selected={selected} />

      <CanvasNodeShell selected={selected}>
        <ConnectionDot kind="prompt" id="prompt-in" top={22} />
        {isRoot && !isLibrary && <ConnectionDot kind="image" id="ref-in" top={40} />}
        {/* Output anchor — edges need a source handle to render (M1 finding) */}
        <Handle type="source" position={Position.Right} id="out" style={{ opacity: 0, right: -2 }} />
        {/* Input anchor (R5): lineage edges land here — invisible; the typed
            ConnectionDots above are pass-2 wiring surfaces, not lineage ends */}
        <Handle type="target" position={Position.Left} id="in" style={{ opacity: 0, left: -2 }} isConnectable={false} />

        {data.status && !data.pinned && !errored && (
          <NodeStatusBadge status={data.status} onPrimary={controller.retry} />
        )}

        <div className="relative" onMouseEnter={showSheet ? sheet.prefetchPlan : undefined}>
          {showSheet ? (
            // The comp card substitutes ONLY the completed image state —
            // empty/generating/error/draft paths keep §5.12 untouched. The
            // grid is 3:4 overall, so node geometry never shifts (D-31).
            <CharacterSheetImageArea
              tiles={sheet.tiles}
              activeTileAngle={sheet.popoverAngle}
              onTileClick={(angle, el) => {
                tileAnchorRef.current = el;
                sheet.prefetchPlan();
                sheet.setPopoverAngle(angle);
              }}
              onGhostClick={() => openEdit(true)}
            />
          ) : (
            <CastImageArea
              imageUrl={data.imageUrl}
              promptState={controller.isEmpty && !errored ? "empty" : controller.promptState}
              progressFraction={controller.progressFraction}
              progressSeconds={controller.progressSeconds}
              dimmed={data.status?.type === "stale" && !data.pinned}
              error={errored}
              onRetry={controller.retry}
            />
          )}

          {/* The one per-view surface (D-29): label · vN, status, actions */}
          <Popover
            open={sheet.popoverAngle !== null}
            onOpenChange={(open) => !open && sheet.setPopoverAngle(null)}
          >
            <PopoverAnchor virtualRef={tileAnchorRef as React.RefObject<HTMLElement>} />
            {sheet.popoverAngle !== null && sheet.activeSlot && (
              <CanvasPopoverContent side="right" sideOffset={10} className="w-[236px] p-3">
                {(() => {
                  const slot = sheet.activeSlot!;
                  const isHeadshot = slot.angle === "frontClose";
                  const planSlot = sheet.refreshPlan?.slots.find((s) => s.angle === slot.angle);
                  const refreshCost = planSlot ? planSlot.cost : null;
                  const refreshable = !isHeadshot && !slot.pinned && (slot.filled || !!slot.failed);
                  const close = () => sheet.setPopoverAngle(null);
                  return (
                    <div className="flex flex-col gap-1.5">
                      <div className="text-canvas-sm font-medium text-canvas-ink">
                        {slot.label}
                        {slot.version > 1 && (
                          <span className="text-canvas-ink-faint font-normal"> · v{slot.version}</span>
                        )}
                      </div>
                      {slot.pinned ? (
                        <div className="text-canvas-xs text-canvas-ink-soft">Pinned — kept as finished work</div>
                      ) : slot.failed ? (
                        <div className="text-canvas-xs text-canvas-ink-soft">
                          Failed: {slot.failed.reason} — you weren't charged
                        </div>
                      ) : slot.stale ? (
                        <div className="text-canvas-xs text-canvas-ink-soft">Out of sync</div>
                      ) : null}

                      <div className="flex flex-col border-t border-hairline border-canvas-border mt-1 pt-1.5">
                        {slot.filled && (
                          sheet.poppedItemId ? (
                            <button
                              type="button"
                              className="w-full text-left px-2 py-1.5 rounded-canvas-sm text-canvas-sm text-canvas-ink hover:bg-canvas-surface-inset transition-colors"
                              onClick={() => {
                                sheet.collapse(sheet.poppedItemId!);
                                close();
                              }}
                            >
                              Return to sheet
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="w-full text-left px-2 py-1.5 rounded-canvas-sm text-canvas-sm text-canvas-ink hover:bg-canvas-surface-inset transition-colors"
                              onClick={() => {
                                sheet.popOut(slot.angle);
                                close();
                              }}
                            >
                              Pop out ⤢
                            </button>
                          )
                        )}
                        {isHeadshot ? (
                          // D-43: the headshot IS the identity — no refresh, ever
                          <div className="px-2 py-1.5 text-canvas-xs text-canvas-ink-faint">
                            The headshot is this identity — fork to change it
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={!refreshable}
                            title={slot.pinned ? "Pinned — unpin to refresh" : undefined}
                            className="w-full text-left px-2 py-1.5 rounded-canvas-sm text-canvas-sm text-canvas-ink hover:bg-canvas-surface-inset transition-colors disabled:opacity-40 disabled:hover:bg-transparent flex items-center justify-between gap-2"
                            onClick={() => {
                              sheet.refreshSlot(slot.angle);
                              close();
                            }}
                          >
                            <span>{slot.failed && !slot.filled ? "Retry" : "Refresh"}</span>
                            <CostLabel credits={refreshCost} />
                          </button>
                        )}
                        {slot.filled && (
                          <button
                            type="button"
                            className="w-full text-left px-2 py-1.5 rounded-canvas-sm text-canvas-sm text-canvas-ink hover:bg-canvas-surface-inset transition-colors"
                            onClick={() => sheet.setPinned(slot.angle, !slot.pinned)}
                          >
                            {slot.pinned ? "Unpin" : "Pin"}
                          </button>
                        )}
                        <button
                          type="button"
                          className="w-full text-left px-2 py-1.5 rounded-canvas-sm text-canvas-sm text-canvas-ink hover:bg-canvas-surface-inset transition-colors"
                          onClick={() => {
                            close();
                            openEdit();
                          }}
                        >
                          Open in environment
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </CanvasPopoverContent>
            )}
          </Popover>
          {/* The front door (D-33): one dark pill, below the empty-slot glyph.
              The picker itself is hosted by BoardPage — node-local state dies
              on the optimistic temp→real id remount. */}
          {showFrontDoor && (
            <div className="absolute inset-x-0 top-[58%] flex justify-center">
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onMouseEnter={() => void utils.boardOps.listCastableModels.prefetch({ limit: 30 })}
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("board-open-cast-picker", { detail: { itemId: data.itemId } }),
                  )
                }
                className="px-3 py-1.5 rounded-canvas-pill text-canvas-xs font-medium bg-canvas-ink text-canvas-surface hover:opacity-90 transition-opacity"
              >
                Choose or cast a model
              </button>
            </div>
          )}
        </div>
      </CanvasNodeShell>

      {selected && !controller.isEmpty && <NodeControlStrip segments={controlSegments} />}
    </div>
  );
}

export const CastNode = memo(CastNodeInner);
