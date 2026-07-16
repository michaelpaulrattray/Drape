/**
 * useSheetController — binds a placed cast to its model's package ledger
 * (generation.packageState) and derives the comp-card state (DS §5.17).
 *
 * D-24 clean: tRPC + shared types only — no casting stores. Board mutations
 * (pop out / collapse) dispatch window events to BoardPage per the house
 * node→page contract; MODEL-level mutations (refresh, pin) live here.
 *
 * Query sharing: listEdges/getItems use the same keys BoardPage holds, so
 * React Query serves them from cache — the controller adds zero requests.
 */
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { CanonicalViewAngle, BoardItemCanvasMetadata } from "@shared/boardTypes";
import { isActionableStale } from "@shared/refreshPolicy";
import type { CastNodeData } from "./CastNode";
import type { SheetTile } from "../CharacterSheetImageArea";

export interface SheetSlotState {
  angle: CanonicalViewAngle;
  label: string;
  filled: boolean;
  url: string | null;
  pinned: boolean;
  stale: boolean;
  version: number;
  /** Ledger truth (Batch C final correction 1): `refunded` is what actually
   *  recorded — 0 when the automatic refund failed. */
  failed: { reason: string; refunded: number; refundReference?: string } | null;
}

/** Pure tile derivation — exported for tests. */
export function buildSheetTiles(
  slots: SheetSlotState[],
  poppedAngles: ReadonlySet<CanonicalViewAngle>,
  refreshingAngles: ReadonlySet<CanonicalViewAngle>,
): SheetTile[] {
  return slots.map((s) => ({
    angle: s.angle,
    label: s.label,
    url: s.url,
    filled: s.filled,
    pinned: s.pinned,
    stale: s.stale,
    failed: s.failed,
    poppedOut: poppedAngles.has(s.angle),
    refreshing: refreshingAngles.has(s.angle),
  }));
}

export function useSheetController(data: CastNodeData, opts: { enabled: boolean }) {
  const utils = trpc.useUtils();
  const prov = data.provenance;
  const modelId = prov && "modelId" in prov && typeof prov.modelId === "number" ? prov.modelId : null;
  const enabled = opts.enabled && modelId !== null && modelId > 0;

  const packageQuery = trpc.generation.packageState.useQuery(
    { modelId: modelId ?? 0 },
    { enabled, staleTime: 15_000 },
  );

  // Same query keys BoardPage holds — served from cache. refetchOnMount OFF:
  // these subscriptions must never DRIVE the queries (a node remount mid-undo
  // once refetched getItems while the restore was in flight and dropped the
  // optimistically-restored row — BoardPage owns the fetch lifecycle).
  const { data: boardEdges } = trpc.boardOps.listEdges.useQuery(
    { boardId: data.boardId },
    { enabled, staleTime: 30_000, refetchOnMount: false },
  );
  const { data: items } = trpc.boards.getItems.useQuery(
    { boardId: data.boardId },
    { enabled, staleTime: 10_000, refetchOnMount: false },
  );

  // Which angles already live on the board as pop-outs (⤢ + Return to sheet)
  const poppedByAngle = useMemo(() => {
    const map = new Map<CanonicalViewAngle, number>();
    if (!boardEdges || !items) return map;
    const itemById = new Map(items.map((i) => [i.id, i]));
    for (const edge of boardEdges) {
      if (edge.relation !== "generated_from_cast" || edge.source !== data.itemId) continue;
      const target = itemById.get(edge.target);
      if (!target) continue; // soft-deleted rows don't arrive in getItems
      const meta = (target.metadata ?? {}) as BoardItemCanvasMetadata;
      if (meta.provenance?.type === "cast_view") {
        map.set(meta.provenance.viewAngle, edge.target);
      }
    }
    return map;
  }, [boardEdges, items, data.itemId]);

  const [refreshingAngles, setRefreshingAngles] = useState<ReadonlySet<CanonicalViewAngle>>(new Set());
  const [popoverAngle, setPopoverAngle] = useState<CanonicalViewAngle | null>(null);
  const [bulkRefreshOpen, setBulkRefreshOpen] = useState(false);

  const slots = (packageQuery.data?.slots ?? []) as SheetSlotState[];
  const filledCount = slots.filter((s) => s.filled).length;
  const minted = packageQuery.data?.minted === true;
  /** The comp card renders once a package has ≥2 filled slots — MINTED OR
   *  DRAFT (D-55 / VC-R6 final r2: a draft may hold a full package and must
   *  show it on the canvas, or its views are invisible off the environment).
   *  Single-headshot models keep the plain image card. The verb (§5.17) still
   *  reads "Build comp card" on a draft vs "Complete card" on a minted gap. */
  const isSheet = enabled && filledCount >= 2;

  const tiles = useMemo(
    () => buildSheetTiles(slots, new Set(poppedByAngle.keys()), refreshingAngles),
    [slots, poppedByAngle, refreshingAngles],
  );

  // V8 count honesty: count ONLY what the refresh dialog can actually
  // refresh — the shared predicate the server's plan rows use. The stale
  // headshot is NOT a number that won't budge; it surfaces as its own
  // labeled state (staleHeadshot) with the F6 exits.
  const staleCount = slots.filter(isActionableStale).length;
  const staleHeadshot = slots.some((s) => s.angle === "frontClose" && s.filled && s.stale);
  const completeCard = filledCount >= 6;

  // ── Refresh plan (D-15: every cost is plan-derived) ────────────────────
  const planQuery = trpc.generation.refreshSlotsPlan.useQuery(
    { modelId: modelId ?? 0 },
    { enabled: enabled && isSheet && (popoverAngle !== null || bulkRefreshOpen), staleTime: 15_000 },
  );
  const prefetchPlan = useCallback(() => {
    if (enabled && modelId) void utils.generation.refreshSlotsPlan.prefetch({ modelId });
  }, [enabled, modelId, utils]);

  const invalidatePackage = useCallback(() => {
    if (modelId) void utils.generation.packageState.invalidate({ modelId });
    void utils.credits.getBalance.invalidate();
  }, [modelId, utils]);

  const refreshMutation = trpc.generation.refreshSlots.useMutation({
    onMutate: ({ angles }) => {
      setRefreshingAngles((prev) => {
        const next = new Set(prev);
        for (const a of angles) next.add(a);
        return next;
      });
    },
    onError: (err) => toast.error(err.message),
    onSettled: (_data, _err, { angles }) => {
      setRefreshingAngles((prev) => {
        const next = new Set(prev);
        for (const a of angles) next.delete(a);
        return next;
      });
      invalidatePackage();
    },
  });

  const pinMutation = trpc.generation.setSlotPinned.useMutation({
    // Optimistic flip (D-38) — the glyph changing IS the feedback (D-40)
    onMutate: ({ angle, pinned }) => {
      if (!modelId) return;
      utils.generation.packageState.setData({ modelId }, (old) =>
        old
          ? { ...old, slots: old.slots.map((s) => (s.angle === angle ? { ...s, pinned } : s)) }
          : old,
      );
    },
    onError: (err) => {
      toast.error(err.message);
      invalidatePackage();
    },
  });

  // D-53 "Use this version" — copy-forward restore on the ledger. The
  // response IS server truth (new head url + vN), so patch the slot cache
  // directly and revalidate behind (D-38 posture).
  const restoreMutation = trpc.generation.restoreSlotVersion.useMutation({
    onSuccess: (res) => {
      if (!modelId) return;
      utils.generation.packageState.setData({ modelId }, (old) =>
        old
          ? {
              ...old,
              slots: old.slots.map((s) =>
                s.angle === res.angle
                  ? { ...s, url: res.url, version: res.version, stale: false, pinned: false }
                  : s,
              ),
            }
          : old,
      );
      void utils.generation.packageState.invalidate({ modelId });
      void utils.generation.slotVersions.invalidate({ modelId, angle: res.angle });
    },
  });

  return {
    isSheet,
    modelId,
    // VC-R6b bug 1: the LEDGER's headshot head — model-backed nodes render
    // and version-count from this, so restore/refresh/iterate reach the node
    // (item.imageUrl is only the landing snapshot; no ledger op updates it)
    headshotUrl: slots.find((s) => s.angle === "frontClose")?.url ?? null,
    headshotVersion: slots.find((s) => s.angle === "frontClose")?.version ?? null,
    tiles,
    staleCount,
    /** V8: the headshot is out of sync — its own state, never in staleCount
     *  (refresh structurally refuses it). Status-aware exits (F6): a draft
     *  iterates in the environment, a minted identity forks, and either may
     *  restore an earlier version when history exists. */
    staleHeadshot,
    completeCard,
    minted,
    filledCount,
    popoverAngle,
    setPopoverAngle,
    /** The popover's slot (label · vN, status, action state). */
    activeSlot: popoverAngle ? slots.find((s) => s.angle === popoverAngle) ?? null : null,
    /** The angle's live pop-out placement, when one exists. */
    poppedItemId: popoverAngle ? poppedByAngle.get(popoverAngle) ?? null : null,
    refreshPlan: planQuery.data,
    prefetchPlan,
    // Aggregate refresh. The stale-writer is LIVE: an identity-classified
    // edit on a draft view marks the sibling head rows stale
    // (castingRefinement.ts iterate → markModelAssetsStale; pinned exempt).
    // Rows = unpinned stale slots the plan allows.
    bulkRefreshOpen,
    setBulkRefreshOpen,
    bulkStaleRows: (planQuery.data?.slots ?? [])
      .filter((s) => s.stale && s.refusal === null)
      .map((s) => ({ angle: s.angle, label: s.label, cost: s.cost })),
    refreshSlot: (angle: CanonicalViewAngle) => {
      if (modelId) refreshMutation.mutate({ modelId, angles: [angle] });
    },
    refreshSlots: (angles: CanonicalViewAngle[]) => {
      if (modelId && angles.length > 0) refreshMutation.mutate({ modelId, angles });
    },
    setPinned: (angle: CanonicalViewAngle, pinned: boolean) => {
      if (modelId) pinMutation.mutate({ modelId, angle, pinned });
    },
    restoreVersion: (angle: CanonicalViewAngle, assetId: number) => {
      if (modelId) restoreMutation.mutate({ modelId, angle, assetId });
    },
    restoring: restoreMutation.isPending,
    popOut: (angle: CanonicalViewAngle) => {
      window.dispatchEvent(
        new CustomEvent("board-pop-out-view", { detail: { itemId: data.itemId, angle } }),
      );
    },
    collapse: (poppedItemId: number) => {
      window.dispatchEvent(
        new CustomEvent("board-collapse-view", { detail: { itemId: poppedItemId } }),
      );
    },
  };
}
