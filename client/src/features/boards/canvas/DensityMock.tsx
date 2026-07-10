/**
 * VC1 density mock — dev-only, reached via /app/board/:id?mock=density.
 *
 * PASS_1_BUILD_PLAN.md M1: a seeded ~40-node board rendered through the REAL
 * canvas primitives on the real React Flow shell, with a live control panel
 * for the zoom-tier thresholds (D-1/2/3 are provisional until tuned here) and
 * the 5-vs-6 chip question (D-19 re-evaluation flag).
 *
 * Everything in this file is throwaway EXCEPT what it exercises: the
 * primitives, the tier system, and the counter-scaled chrome. No DB, no tRPC.
 */
import { createContext, useContext, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { DottedGridBackground } from "./DottedGridBackground";
import { CanvasNodeShell } from "./CanvasNodeShell";
import { NodeLabelRow } from "./NodeLabelRow";
import { ConnectionDot } from "./ConnectionDot";
import { CastImageArea } from "./CastImageArea";
import { NodeInlinePrompt } from "./NodeInlinePrompt";
import { NodeControlStrip, type ControlSegment } from "./NodeControlStrip";
import { BlenderChipStrip } from "./BlenderChipStrip";
import { NodeFloatingToolbar, type NodeToolbarAction } from "./NodeFloatingToolbar";
import { NodeStatusBadge, type NodeStatus } from "./NodeStatusBadge";
import {
  ZoomTierContext,
  useZoomTier,
  useZoomTierContext,
  DEFAULT_THRESHOLDS,
  type ZoomTierThresholds,
} from "./zoomTiers";

/* ── Mock config (dev panel state) ─────────────────────────── */

interface MockConfig {
  chipCount: 5 | 6;
}
const MockConfigContext = createContext<MockConfig>({ chipCount: 6 });

/* ── Seeded content ────────────────────────────────────────── */

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Flat monochrome portrait silhouette as a data URI — no external hosts (CSP). */
function mockPortrait(rand: () => number): string {
  const tones = ["#D6D6D3", "#CCCCC9", "#C2C2BF", "#B8B8B5", "#AEAEAB"];
  const bg = tones[Math.floor(rand() * tones.length)];
  const fg = "#8A8A87";
  const headX = 90 + Math.round(rand() * 20);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="140" viewBox="0 0 200 140">` +
    `<rect width="200" height="140" fill="${bg}"/>` +
    `<circle cx="${headX}" cy="58" r="24" fill="${fg}"/>` +
    `<path d="M ${headX - 44} 140 Q ${headX} 84 ${headX + 44} 140 Z" fill="${fg}"/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const NAMES = [
  "Maya R.", "Jonas K.", "Anaïs B.", "Theo M.", "Zola N.", "Iris V.",
  "Kenji T.", "Lena P.", "Dario F.", "Noor A.", "Sasha W.", "Emeka O.",
];
const VIEW_LABELS = ["Full front", "Side close", "Side full", "Back full"];

interface MockNodeData extends Record<string, unknown> {
  variant: "root" | "view";
  name: string;
  viewLabel?: string;
  imageUrl: string | null;
  prompt: string;
  status?: NodeStatus;
  pinned?: boolean;
  empty?: boolean;
}

function buildMockBoard(): { nodes: Node<MockNodeData>[]; edges: Edge[] } {
  const rand = mulberry32(20260710);
  const nodes: Node<MockNodeData>[] = [];
  const edges: Edge[] = [];

  NAMES.forEach((name, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const rx = col * 1150 + Math.round(rand() * 100);
    const ry = row * 620 + Math.round(rand() * 100);
    const rootId = `root-${i}`;
    const empty = i === 10; // one freshly-dropped node
    const rootStatus: NodeStatus | undefined =
      i === 5 ? { type: "error", message: "The engine returned no image for this run. Credits were refunded." } : undefined;

    nodes.push({
      id: rootId,
      type: "mockCast",
      position: { x: rx, y: ry },
      data: {
        variant: "root",
        name,
        imageUrl: empty || rootStatus ? null : mockPortrait(rand),
        prompt: empty ? "" : "athletic, strong jaw, editorial vibe, mid-twenties",
        status: rootStatus,
        empty,
      },
    });

    const viewCount = empty ? 0 : Math.floor(rand() * 4); // 0–3 views per root
    for (let v = 0; v < viewCount; v++) {
      const viewId = `view-${i}-${v}`;
      const stale = i === 3; // one cluster fully stale
      nodes.push({
        id: viewId,
        type: "mockCast",
        position: { x: rx + 310 + v * 230, y: ry + 40 + Math.round(rand() * 30) },
        data: {
          variant: "view",
          name,
          viewLabel: VIEW_LABELS[v],
          imageUrl: mockPortrait(rand),
          prompt: "",
          status: stale
            ? { type: "stale", message: `${name.split(" ")[0]}'s identity was updated. This view still reflects the previous vibe.` }
            : undefined,
          pinned: i === 3 && v === 1,
        },
      });
      edges.push({
        id: `e-${rootId}-${viewId}`,
        source: rootId,
        target: viewId,
        type: "smoothstep",
      });
    }
  });

  return { nodes, edges };
}

/* ── Mock cast node (composes the real primitives) ─────────── */

const CHIP_FILLS: Record<string, string | null> = {
  brand: "Saint Laurent",
  vibe: "Editorial",
  ethnicity: "Brazilian + Japanese",
  skin: "Tan",
  hair: "Jet Black",
  eyes: "Hazel",
};

function chipPlaceholder(label: string) {
  return (
    <div className="text-canvas-sm text-canvas-ink-soft leading-relaxed">
      <span className="font-medium text-canvas-ink">{label}</span> opens its tactile
      component here in M5. This popover exists so the chip's open state can be judged.
    </div>
  );
}

function MockCastNode({ data, selected }: NodeProps<Node<MockNodeData>>) {
  const { tier } = useZoomTierContext();
  const { chipCount } = useContext(MockConfigContext);
  const [activeChipId, setActiveChipId] = useState<string | null>(null);

  const isRoot = data.variant === "root";
  const width = tier === "far" ? (isRoot ? 260 : 200) : isRoot ? 260 : 200;
  const typeLabel = isRoot ? `Cast · ${data.name}` : `Cast · ${data.name} · ${data.viewLabel}`;
  const promptState = data.empty ? "empty" : "complete";

  const toolbarActions: NodeToolbarAction[] = [
    { id: "rerun", label: "Rerun", onClick: () => {} },
    { id: "variations", label: isRoot ? "Variations" : "Not available on view nodes", onClick: () => {}, disabled: !isRoot },
    { id: "duplicate", label: isRoot ? "Duplicate" : "Not available on view nodes", onClick: () => {}, disabled: !isRoot },
    { id: "download", label: "Download", onClick: () => {}, disabled: !data.imageUrl },
    { id: "delete", label: "Delete", onClick: () => {} },
    { id: "info", label: "Info", onClick: () => {} },
  ];

  const controlSegments: ControlSegment[] = isRoot
    ? [
        { kind: "action", content: "+ Views", onClick: () => {} },
        { kind: "label", content: "v1" },
        { kind: "action", content: "···", onClick: () => {} },
      ]
    : [
        ...(data.pinned ? [{ kind: "pin", content: "Pinned — kept as finished work" } as ControlSegment] : []),
        { kind: "label", content: "v1" },
        { kind: "action", content: "···", onClick: () => {} },
      ];

  const chips = isRoot
    ? (["brand", "vibe", "ethnicity", "skin", "hair", "eyes"] as const)
        .slice(0, chipCount)
        .map((id) => ({
          id,
          label: id.charAt(0).toUpperCase() + id.slice(1),
          value: data.empty ? null : CHIP_FILLS[id],
          popoverContent: chipPlaceholder(id.charAt(0).toUpperCase() + id.slice(1)),
        }))
    : [];

  return (
    <div className="relative" style={{ width }}>
      {selected && !data.empty && <NodeFloatingToolbar actions={toolbarActions} />}

      <NodeLabelRow type={typeLabel} engine={data.empty ? undefined : "Gemini"} selected={selected} />

      <CanvasNodeShell selected={selected}>
        <ConnectionDot kind="prompt" id="prompt-in" top={22} />
        {isRoot && <ConnectionDot kind="image" id="ref-in" top={40} />}
        {/* Invisible output anchor — edges need a source handle to render.
            The visible output-pin design is a CastNode (M4) question. */}
        <Handle type="source" position={Position.Right} id="out" style={{ opacity: 0, right: -2 }} />

        {data.status && !data.pinned && (
          <NodeStatusBadge
            status={data.status}
            primaryLabel={data.status.type === "stale" ? "Refresh · ~300 credits" : "Retry · ~350 credits"}
            onPrimary={() => {}}
            onSecondary={() => {}}
          />
        )}

        <CastImageArea
          imageUrl={data.imageUrl}
          promptState={promptState}
          dimmed={data.status?.type === "stale" && !data.pinned}
          error={data.status?.type === "error"}
          onRetry={() => {}}
          height={isRoot ? 150 : 130}
        />

        <NodeInlinePrompt
          value={data.prompt}
          onChange={() => {}}
          onSubmit={() => {}}
          state={promptState}
          placeholder={isRoot ? "Describe your model..." : "Pose..."}
          canRun={false}
        />
      </CanvasNodeShell>

      {selected && (
        <>
          {!data.empty && <NodeControlStrip segments={controlSegments} />}
          {isRoot && (
            <BlenderChipStrip
              chips={chips}
              activeChipId={activeChipId}
              onActiveChange={setActiveChipId}
            />
          )}
        </>
      )}
    </div>
  );
}

const nodeTypes = { mockCast: MockCastNode };

/* ── Tier provider + dev panel ─────────────────────────────── */

function ZoomTierProvider({
  thresholds,
  children,
}: {
  thresholds: ZoomTierThresholds;
  children: React.ReactNode;
}) {
  const value = useZoomTier(thresholds);
  return <ZoomTierContext.Provider value={value}>{children}</ZoomTierContext.Provider>;
}

function DevPanel({
  thresholds,
  onChange,
  chipCount,
  onChipCount,
}: {
  thresholds: ZoomTierThresholds;
  onChange: (t: ZoomTierThresholds) => void;
  chipCount: 5 | 6;
  onChipCount: (c: 5 | 6) => void;
}) {
  const { tier, zoom } = useZoomTierContext();
  const { fitView, zoomTo } = useReactFlow();

  return (
    <div className="absolute top-4 right-4 z-20 w-[230px] p-3.5 bg-canvas-surface border-hairline border-canvas-border-strong rounded-canvas-md">
      <div className="text-canvas-sm font-medium text-canvas-ink mb-0.5">Zoom-tier tuning</div>
      <div className="text-canvas-xs text-canvas-ink-faint mb-3">
        VC1 · zoom {(zoom * 100).toFixed(0)}% · tier <span className="text-canvas-ink-soft font-medium">{tier}</span>
      </div>

      <label className="block mb-3">
        <div className="flex justify-between text-canvas-xs text-canvas-ink-soft mb-1">
          <span>Mid threshold</span>
          <span>{thresholds.mid.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={0.4}
          max={0.9}
          step={0.01}
          value={thresholds.mid}
          onChange={(e) => onChange({ ...thresholds, mid: Number(e.target.value) })}
          className="w-full accent-[#0A0A0A]"
        />
      </label>

      <label className="block mb-3">
        <div className="flex justify-between text-canvas-xs text-canvas-ink-soft mb-1">
          <span>Far threshold</span>
          <span>{thresholds.far.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={0.15}
          max={0.6}
          step={0.01}
          value={thresholds.far}
          onChange={(e) => onChange({ ...thresholds, far: Number(e.target.value) })}
          className="w-full accent-[#0A0A0A]"
        />
      </label>

      <div className="flex items-center justify-between mb-3">
        <span className="text-canvas-xs text-canvas-ink-soft">Blender chips</span>
        <div className="flex gap-1">
          {([5, 6] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChipCount(n)}
              className={
                chipCount === n
                  ? "px-2 py-0.5 rounded-canvas-sm text-canvas-xs bg-canvas-ink text-canvas-surface font-medium"
                  : "px-2 py-0.5 rounded-canvas-sm text-canvas-xs text-canvas-ink-soft border-hairline border-canvas-border hover:border-canvas-border-strong"
              }
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1 mb-1.5">
        {([1, 0.5, 0.3] as const).map((z) => (
          <button
            key={z}
            type="button"
            data-zoom-preset={z}
            onClick={() => zoomTo(z, { duration: 250 })}
            className="py-1.5 rounded-canvas-md border-hairline border-canvas-border text-canvas-xs text-canvas-ink-soft hover:border-canvas-border-strong transition-colors"
          >
            {Math.round(z * 100)}%
          </button>
        ))}
        <button
          type="button"
          data-zoom-preset="fit"
          onClick={() => fitView({ duration: 250 })}
          className="py-1.5 rounded-canvas-md border-hairline border-canvas-border text-canvas-xs text-canvas-ink-soft hover:border-canvas-border-strong transition-colors"
        >
          Fit
        </button>
      </div>

      <div className="text-canvas-xs text-canvas-ink-faint mt-3 leading-relaxed">
        When it feels right, these numbers become ZOOM_TIER_MID / ZOOM_TIER_FAR in zoomTiers.ts.
      </div>
    </div>
  );
}

/* ── Root ──────────────────────────────────────────────────── */

function DensityMockInner() {
  const [thresholds, setThresholds] = useState<ZoomTierThresholds>(DEFAULT_THRESHOLDS);
  const [chipCount, setChipCount] = useState<5 | 6>(6);
  const { nodes: initialNodes, edges: initialEdges } = useMemo(buildMockBoard, []);

  return (
    <MockConfigContext.Provider value={{ chipCount }}>
      <ZoomTierProvider thresholds={thresholds}>
        <TierAwareFlow initialNodes={initialNodes} initialEdges={initialEdges} />
        <DevPanel
          thresholds={thresholds}
          onChange={setThresholds}
          chipCount={chipCount}
          onChipCount={setChipCount}
        />
      </ZoomTierProvider>
    </MockConfigContext.Provider>
  );
}

function TierAwareFlow({
  initialNodes,
  initialEdges,
}: {
  initialNodes: Node<MockNodeData>[];
  initialEdges: Edge[];
}) {
  const { tier } = useZoomTierContext();
  const edges = useMemo(
    () =>
      initialEdges.map((e) => ({
        ...e,
        style: {
          stroke: "var(--color-canvas-border-strong)",
          strokeWidth: 1,
          opacity: tier === "far" ? 0.6 : 0.4,
        },
      })),
    [initialEdges, tier],
  );

  return (
    <ReactFlow
      defaultNodes={initialNodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      minZoom={0.1}
      maxZoom={5}
      proOptions={{ hideAttribution: true }}
      panOnDrag
    />
  );
}

export default function DensityMock() {
  return (
    <div className="canvas-scope fixed inset-0">
      <div className="absolute inset-0">
        <DottedGridBackground />
        <ReactFlowProvider>
          <DensityMockInner />
        </ReactFlowProvider>
      </div>
      <div className="absolute top-4 left-4 z-20 text-canvas-xs text-canvas-ink-faint">
        Density mock · dev only · not saved
      </div>
    </div>
  );
}
