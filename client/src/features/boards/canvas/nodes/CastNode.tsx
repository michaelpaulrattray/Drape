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
import { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Popover, PopoverAnchor } from "@/components/ui/popover";
import { CanvasPopoverContent } from "../CanvasPopover";
import { CanvasNodeShell } from "../CanvasNodeShell";
import { NodeLabelRow } from "../NodeLabelRow";
import { ConnectionDot } from "../ConnectionDot";
import { CastImageArea } from "../CastImageArea";
import { type ControlSegment } from "../NodeControlStrip";
import { NodeStatusBadge } from "../NodeStatusBadge";
import { NodeFloatingToolbar, type NodeToolbarAction } from "../NodeFloatingToolbar";
import { ForkRecastPopoverContent } from "../ForkRecastPopover";
import { VariationsPopoverContent } from "../VariationsPopover";
import { downloadImage } from "../imageActions";
import { useRegisterCanvasLayer } from "../../stores/useCanvasLayers";
import { useCastNodeController } from "./useCastNodeController";
import { CharacterSheetImageArea } from "../CharacterSheetImageArea";
import { useIsMultiSelect } from "../GroupSelectionOverlay";
import { BulkRefreshDialog } from "../BulkRefreshDialog";
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
  /** VC-R6b bug 4: rename commits through the host (boardOps label update) */
  onRename?: (itemId: number, label: string) => void;
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
  // Label grammar (founder, drive 2): the NAME is the label — "jerrryt",
  // "jerrryt · Full front", "jerrryt · Draft". The old "Cast · … · Library"
  // spelled out provenance vocabulary nobody needed on chrome; "Cast" now
  // appears only on unnamed empty nodes (a type placeholder, not a prefix).
  const baseLabel = data.label || "Cast";
  const typeLabel = isDraft
    ? `${baseLabel} · Draft`
    : prov?.type === "cast_view"
      ? `${baseLabel} · ${VIEW_ANGLE_LABEL[prov.viewAngle] ?? prov.viewAngle}`
      : baseLabel;
  // (The label row's engine slot is dead — C7 label pass; raw engine ids
  // were the D-41 leak class. provenance.engine stays for Info/audit.)
  const errored = data.status?.type === "error";
  const showFrontDoor =
    controller.isEmpty && !errored && controller.promptState !== "generating";

  // R3: Edit opens the casting environment on this model — for drafts it is
  // the promotion route (name/mint/add views; the node updates in place)
  const modelId = prov && "modelId" in prov ? prov.modelId : null;
  // modelId > 0 — optimistic rows carry a -1 placeholder until the server
  // confirm swaps in the real id; acting on that would target a dead session
  const modelReady = typeof modelId === "number" && modelId > 0 && data.itemId > 0;
  const openEdit = (openUpgrade = false, initialAngle?: string) =>
    window.dispatchEvent(
      new CustomEvent("board-edit-cast", {
        detail: { itemId: data.itemId, modelId, draft: isDraft, openUpgrade, initialAngle },
      }),
    );
  const hasEdit = Boolean(modelReady && data.imageUrl);

  // ── R5: the comp card (DS §5.17) — the model's package rendered on the
  // root; tile popover is the ONE per-view surface (D-29 restraint) ─────────
  const sheet = useSheetController(data, {
    enabled: modelReady && !isView && !!data.imageUrl,
  });
  const tileAnchorRef = useRef<HTMLElement | null>(null);
  useRegisterCanvasLayer(`sheet-tile-${data.itemId}`, sheet.popoverAngle !== null);

  // VC-R6b bug 4: cast nodes answer the rename event like every other node
  const [renaming, setRenaming] = useState(false);
  const [renameText, setRenameText] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onRenameEvent = (e: Event) => {
      if ((e as CustomEvent<{ itemId: number }>).detail?.itemId === data.itemId) {
        setRenameText(data.label ?? "");
        setRenaming(true);
        setTimeout(() => {
          renameInputRef.current?.focus();
          renameInputRef.current?.select();
        }, 30);
      }
    };
    window.addEventListener("board-rename-node", onRenameEvent);
    return () => window.removeEventListener("board-rename-node", onRenameEvent);
  }, [data.itemId, data.label]);
  const commitRename = () => {
    if (renaming && renameText.trim() && renameText.trim() !== data.label) {
      data.onRename?.(data.itemId, renameText.trim());
    }
    setRenaming(false);
  };

  // D-53 thumb-strip: the vN chip opens the angle's ledger history — filled
  // rows newest-first, "Use this version" on non-head rows (copy-forward)
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  useEffect(() => {
    setVersionsOpen(false);
    setSelectedVersionId(null);
  }, [sheet.popoverAngle]);
  const slotVersionsQuery = trpc.generation.slotVersions.useQuery(
    { modelId: sheet.modelId ?? 0, angle: sheet.popoverAngle ?? "frontClose" },
    { enabled: versionsOpen && !!sheet.modelId && sheet.popoverAngle !== null },
  );
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

  // Aggregate refresh entry (dormant in pass 1 — D-43 removed the trigger;
  // renders only when model_assets carry stale, i.e. pass 2)
  const staleSegment: ControlSegment[] =
    showSheet && sheet.staleCount > 0
      ? [{
          kind: "action",
          content: `${sheet.staleCount} stale`,
          onClick: () => {
            sheet.prefetchPlan();
            sheet.setBulkRefreshOpen(true);
          },
        }]
      : [];

  // D-43 v-chip ruling: hidden at v1; at >1 the chip itself opens history.
  // VC-R6b bug 1: model-backed nodes count from the LEDGER's headshot head
  // (one version vocabulary, D-53) and the chip opens the headshot's
  // thumb-strip popover — restore/refresh/iterate now move the chip. Non-
  // model nodes keep the board-item version + VersionHistoryModal.
  const ledgerChipVersion = modelReady ? sheet.headshotVersion : null;
  const versionSegment: ControlSegment[] =
    ledgerChipVersion !== null
      ? ledgerChipVersion > 1
        ? [{
            kind: "action" as const,
            content: `v${ledgerChipVersion}`,
            onClick: () => {
              tileAnchorRef.current = containerRef.current;
              sheet.setPopoverAngle("frontClose");
            },
          }]
        : []
      : (data.version || 1) > 1
        ? [{
            kind: "action" as const,
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

  // R6 consolidation (founder-directed, drive 2): the strip is dead — its
  // contextual segments ride the ONE node pill as trailing text, after the
  // icon verbs. D-51's verb states and the ledger vN survive unchanged.
  // Views carry no root chrome (slim ruling): no package verb, no headshot
  // vN, no ··· — right-click keeps the context-menu parity
  const trailingSegments: ControlSegment[] = isView
    ? []
    : [
        ...packageVerb,
        ...staleSegment,
        ...versionSegment,
        { kind: "action", content: "···", onClick: openMenu },
      ];

  // ── R4 toolbar: type-scoped action set (Decision 7 grammar; DS §5.10) ──
  const dispatchNodeEvent = (name: string) =>
    window.dispatchEvent(new CustomEvent(name, { detail: { itemId: data.itemId } }));

  // Popped views SLIM (founder-ruled with the trap ruling): a popped view is
  // a REFERENCE — Return to sheet · Download · Delete · Info, nothing else.
  // Edit is reserved for the root (identity work has one door); the old
  // disabled Rerun/Variations/Duplicate rows were dead weight.
  const toolbarActions: NodeToolbarAction[] = [
    ...(isView
      ? [
          // Popped views SLIM (founder-ruled with the trap ruling): a view is
          // a REFERENCE — its verbs are Return to sheet · Download · Delete ·
          // Info. Edit stays on the root (identity work has one door); the
          // old disabled Rerun/Variations/Duplicate rows were dead weight.
          {
            id: "collapse" as const,
            label: "Return to sheet",
            disabled: data.itemId <= 0,
            onClick: () => dispatchNodeEvent("board-collapse-view"),
          },
        ]
      : [
          // Edit leads — the pen is the node's primary verb (R6 consolidation)
          ...(hasEdit
            ? [{
                id: "edit" as const,
                label: isDraft ? "Edit — name and mint this draft" : "Edit",
                onClick: () => openEdit(),
              }]
            : []),
          {
            id: "rerun" as const,
            label: modelReady ? "Rerun" : "Rerun — still landing",
            disabled: !modelReady,
            onClick: () => setPopover((p: NodePopover) => (p === "forkRecast" ? null : "forkRecast")),
          },
          {
            id: "variations" as const,
            label: modelReady ? "Variations" : "Variations — still landing",
            disabled: !modelReady,
            onClick: () => setPopover((p: NodePopover) => (p === "variations" ? null : "variations")),
          },
          {
            id: "duplicate" as const,
            label: "Duplicate",
            disabled: data.itemId <= 0,
            onClick: () => dispatchNodeEvent("board-duplicate-node"),
          },
        ]),
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

  // D-50: in a multi-selection the group toolbar replaces per-node toolbars
  const multiSelect = useIsMultiSelect();
  const showToolbar =
    selected && !multiSelect && !controller.isEmpty && controller.promptState !== "generating";

  return (
    <div ref={containerRef} className="relative" style={{ width: cardWidth }}>
      {showToolbar && (
        <NodeFloatingToolbar
          actions={toolbarActions}
          trailing={
            <>
              {data.pinned && (
                <span
                  className="px-1.5 text-canvas-xs text-canvas-ink-faint whitespace-nowrap"
                  title="Pinned — kept as finished work"
                >
                  Pinned
                </span>
              )}
              {trailingSegments.map((seg, i) =>
                seg.kind === "action" && seg.onClick ? (
                  <button
                    key={i}
                    type="button"
                    onClick={seg.onClick}
                    className="px-2 h-7 rounded-canvas-pill text-canvas-sm text-canvas-ink-soft hover:bg-canvas-surface-inset hover:text-canvas-ink transition-colors whitespace-nowrap"
                  >
                    {seg.content}
                  </button>
                ) : (
                  <span key={i} className="px-1.5 text-canvas-xs text-canvas-ink-faint whitespace-nowrap">
                    {seg.content}
                  </span>
                ),
              )}
            </>
          }
        />
      )}

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

      {renaming ? (
        // VC-R6b bug 4: inline rename in the label row's place — Enter/blur
        // commit through the host, Esc cancels (BoardItemNode's contract)
        <div className="px-0.5 pb-1.5">
          <input
            ref={renameInputRef}
            value={renameText}
            onChange={(e) => setRenameText(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setRenaming(false);
            }}
            onBlur={commitRename}
            className="w-full bg-canvas-surface border-hairline border-canvas-border-strong rounded-canvas-sm px-1 py-0.5 text-canvas-xs text-canvas-ink outline-none"
            placeholder="Name this cast..."
          />
        </div>
      ) : (
        <NodeLabelRow type={typeLabel} selected={selected} />
      )}

      {/* Output pin — the lineage anchor AND the D-36a spawn gesture: drag
          into empty canvas to pop a package view out pre-connected (R5).
          Monochrome (D-7): outputs have no type color; the typed hues stay
          on inputs. Lives OUTSIDE the shell (whose overflow-hidden clipped it
          to an invisible white sliver — VC-R5 F2); grows + inks on node
          hover/selection (discoverability, promoted from the R6 log). */}
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        isConnectable={modelReady && !!data.imageUrl}
        className="spawn-dot"
        style={{ opacity: modelReady && data.imageUrl ? 1 : 0 }}
      />

      <CanvasNodeShell selected={selected}>
        <ConnectionDot kind="prompt" id="prompt-in" top={22} />
        {isRoot && !isLibrary && <ConnectionDot kind="image" id="ref-in" top={40} />}
        {/* (The out-pin renders OUTSIDE this shell — its overflow-hidden was
            clipping the pin to an invisible white sliver, VC-R5 F2) */}
        {/* Input anchor (R5): lineage edges land here — invisible; the typed
            ConnectionDots above are pass-2 wiring surfaces, not lineage ends */}
        <Handle type="target" position={Position.Left} id="in" style={{ opacity: 0, left: -2 }} isConnectable={false} />

        {data.status && !data.pinned && !errored && (
          <NodeStatusBadge status={data.status} onPrimary={controller.retry} />
        )}

        <div
          className="relative"
          onMouseEnter={showSheet ? sheet.prefetchPlan : undefined}
          // D-54: root double-click opens the environment (tiles stop their
          // own dblclick first, carrying the clicked view). Popped views have
          // no handler here — they bubble to the board's D-52 viewer.
          onDoubleClick={
            hasEdit && !isView
              ? (e) => {
                  e.stopPropagation();
                  openEdit();
                }
              : undefined
          }
        >
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
              onTileDoubleClick={(angle) => {
                // D-54: tiles are WORKING objects — double-click opens the
                // environment focused on that view. (The D-52 view-only
                // viewer remains the double-click for image-class cards:
                // popped views, future image nodes.) The single-click
                // popover from the first click yields to it.
                sheet.setPopoverAngle(null);
                openEdit(false, angle);
              }}
              onGhostClick={() => openEdit(true)}
            />
          ) : (
            <CastImageArea
              // VC-R6b bug 1: the ledger's headshot head wins when the model
              // is live — item.imageUrl is only the landing-time snapshot.
              // ROOTS/LIBRARY ONLY: a popped VIEW shows its own angle, and the
              // shared packageState cache would swap it for the headshot
              // (the pop-out-shows-wrong-view regression, second drive)
              imageUrl={(modelReady && !isView ? sheet.headshotUrl : null) ?? data.imageUrl}
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
                      {/* D-43.3/D-53: at v1 the chip hides; at >1 the vN IS the
                          door to the version history (the tile thumb-strip) */}
                      {slot.version > 1 ? (
                        <button
                          type="button"
                          className="text-left text-canvas-sm font-medium text-canvas-ink"
                          title={versionsOpen ? undefined : "Version history"}
                          onClick={() => setVersionsOpen((o) => !o)}
                        >
                          {slot.label}
                          <span className="text-canvas-ink-faint font-normal underline decoration-dotted underline-offset-2"> · v{slot.version}</span>
                        </button>
                      ) : (
                        <div className="text-canvas-sm font-medium text-canvas-ink">{slot.label}</div>
                      )}
                      {versionsOpen && slot.version > 1 && (
                        <div className="flex flex-col gap-1">
                          {/* Two-step by hard lesson (VC-R6b drive 2): a bare
                              thumb click COMMITTED a restore, so browsing the
                              strip minted a new version per click (v8 ledgers
                              of identical rows). Click = select; only the
                              explicit action commits. */}
                          <div className="flex gap-1 overflow-x-auto pb-0.5">
                            {(slotVersionsQuery.data?.versions ?? []).map((v) => (
                              <button
                                key={v.assetId}
                                type="button"
                                disabled={sheet.restoring}
                                title={v.isHead ? "Current version" : "Select this version"}
                                className={cn(
                                  "relative flex-shrink-0 w-9 rounded-canvas-sm overflow-hidden transition-opacity",
                                  v.isHead
                                    ? "border border-canvas-ink"
                                    : selectedVersionId === v.assetId
                                      ? "border border-canvas-ink-soft"
                                      : "border-hairline border-canvas-border hover:border-canvas-border-strong",
                                  sheet.restoring && "opacity-50",
                                )}
                                style={{ aspectRatio: "3 / 4" }}
                                onClick={() => setSelectedVersionId(v.isHead ? null : v.assetId)}
                              >
                                <img src={v.url} alt="" className="w-full h-full object-cover" draggable={false} />
                              </button>
                            ))}
                          </div>
                          {sheet.restoring ? (
                            <div className="text-canvas-xs text-canvas-ink-faint">Restoring…</div>
                          ) : selectedVersionId !== null ? (
                            <button
                              type="button"
                              className="w-full text-left px-2 py-1.5 rounded-canvas-sm text-canvas-sm text-canvas-ink hover:bg-canvas-surface-inset transition-colors"
                              onClick={() => {
                                sheet.restoreVersion(slot.angle, selectedVersionId);
                                setSelectedVersionId(null);
                              }}
                            >
                              Use this version — free, lands as the newest
                            </button>
                          ) : (
                            <div className="text-canvas-xs text-canvas-ink-faint">
                              Select an earlier version to restore it
                            </div>
                          )}
                        </div>
                      )}
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
                            // D-54: focused on THIS view, same as tile dblclick
                            openEdit(false, slot.angle);
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

      {/* The below-card strip died in the R6 consolidation — its segments
          ride the node pill's trailing slot now */}

      {/* Aggregate refresh confirm — portaled: fixed positioning can't live
          inside React Flow's transformed node tree */}
      {sheet.bulkRefreshOpen &&
        createPortal(
          <BulkRefreshDialog
            slots={sheet.bulkStaleRows}
            totalCost={
              sheet.refreshPlan
                ? sheet.bulkStaleRows.reduce((sum, s) => sum + s.cost, 0)
                : null
            }
            onConfirm={() => {
              sheet.refreshSlots(sheet.bulkStaleRows.map((s) => s.angle));
              sheet.setBulkRefreshOpen(false);
            }}
            onCancel={() => sheet.setBulkRefreshOpen(false)}
          />,
          document.body,
        )}
    </div>
  );
}

export const CastNode = memo(CastNodeInner);
