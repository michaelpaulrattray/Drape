/**
 * NodeInfoPanel — Frosted-glass popout panel showing model specs,
 * master prompt, and metadata for a board item.
 *
 * Appears near the right-clicked node. Fetches linked model data
 * via tRPC boards.getItemModelInfo.
 */
import { useEffect, useRef } from 'react';
import {
  X,
  User,
  Hash,
  FileText,
  Layers,
  Calendar,
  Copy,
  Loader2,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

/* ── Types ────────────────────────────────────────────────── */

type NodeInfoPanelProps = {
  itemId: number;
  position: { x: number; y: number };
  onClose: () => void;
};

/* ── Helpers ──────────────────────────────────────────────── */

type PrefsObj = Record<string, unknown>;

const PREF_LABELS: Record<string, string> = {
  gender: 'Gender',
  ethnicity: 'Ethnicity',
  ethnicityBlend: 'Ethnicity Blend',
  castingBrand: 'Brand',
  castingVibe: 'Vibe',
  age: 'Age',
  bodyType: 'Body Type',
  hairStyle: 'Hair Style',
  hairColor: 'Hair Color',
  eyeColor: 'Eye Color',
  skinTone: 'Skin Tone',
  facialHair: 'Facial Hair',
  tattoos: 'Tattoos',
  piercings: 'Piercings',
  height: 'Height',
  build: 'Build',
  expression: 'Expression',
};

// Never rendered as spec rows: huge blobs and dev-side state (D-41 — internal
// identifiers must not leak into copy)
const HIDDEN_PREF_KEYS = new Set(['referenceImage', 'engineChoice']);

function isBlendArray(v: unknown): v is Array<{ name: string; pct: number }> {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every((e) => !!e && typeof e === 'object' && 'name' in e && 'pct' in e)
  );
}

/** Human-readable spec values (VC-R4 fix 2) — raw JSON is the fallback of
 *  last resort, never the rendering for known shapes. */
function formatPrefValue(key: string, val: unknown): string {
  if (isBlendArray(val)) {
    return val.map((e) => `${e.name} ${Math.round(Number(e.pct))}%`).join(' · ');
  }
  if (key === 'castingVibe' && val && typeof val === 'object' && !Array.isArray(val)) {
    // {commercial, editorial, runway} as fractions of 1
    return Object.entries(val as Record<string, unknown>)
      .filter(([, n]) => typeof n === 'number' && n > 0.005)
      .map(([k, n]) => `${k.charAt(0).toUpperCase()}${k.slice(1)} ${Math.round((n as number) * 100)}%`)
      .join(' · ');
  }
  return typeof val === 'object' ? JSON.stringify(val) : String(val ?? '—');
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* ── Component ────────────────────────────────────────────── */

export function NodeInfoPanel({ itemId, position, onClose }: NodeInfoPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = trpc.boards.getItemModelInfo.useQuery(
    { itemId },
    { staleTime: 30_000 },
  );

  // Close on click outside or Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Clamp position to viewport
  const panelW = 340;
  const panelH = 480;
  const pad = 16;
  let x = position.x + 12;
  let y = position.y;
  if (typeof window !== 'undefined') {
    if (x + panelW + pad > window.innerWidth) x = position.x - panelW - 12;
    if (y + panelH + pad > window.innerHeight) y = window.innerHeight - panelH - pad;
    if (x < pad) x = pad;
    if (y < pad) y = pad;
  }

  const prefs = (data?.model?.preferences ?? {}) as PrefsObj;
  const schema = (data?.model?.technicalSchema ?? {}) as PrefsObj;

  return (
    <div
      ref={panelRef}
      className="fixed z-[110]"
      style={{
        left: x,
        top: y,
        animation: 'infoPanelIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <style>{`
        @keyframes infoPanelIn {
          from { opacity: 0; transform: scale(0.96) translateX(-8px); }
          to { opacity: 1; transform: scale(1) translateX(0); }
        }
      `}</style>

      <div
        style={{
          width: panelW,
          maxHeight: panelH,
          borderRadius: 14,
          background: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(24px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.14), 0 4px 12px rgba(0, 0, 0, 0.06)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px 10px',
            borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>
            Item Details
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#999',
              display: 'flex',
              padding: 2,
              borderRadius: 6,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 16px 16px',
          }}
        >
          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <Loader2 size={20} className="animate-spin" style={{ color: '#999' }} />
            </div>
          )}

          {error && (
            <p style={{ fontSize: 13, color: '#dc2626', textAlign: 'center', padding: 16 }}>
              Failed to load info
            </p>
          )}

          {data && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Basic item info */}
              <Section title="Item">
                <InfoRow icon={<Layers size={13} />} label="Type" value={data.item.type} />
                <InfoRow icon={<FileText size={13} />} label="Label" value={data.item.label ?? '—'} />
                <InfoRow icon={<Calendar size={13} />} label="Added" value={formatDate(data.item.createdAt)} />
              </Section>

              {/* FR-4: archived source — say so explicitly, never render as
                  an ordinary unlinked item. The item snapshot above remains
                  the historical evidence; the model document is not exposed. */}
              {!data.model && data.sourceArchived && (
                <Section title="Model">
                  <InfoRow
                    icon={<User size={13} />}
                    label="Source"
                    value="Unavailable — the linked model was removed"
                  />
                </Section>
              )}

              {/* Model info — only if linked */}
              {!!data.model && (
                <>
                  <Section title="Model">
                    <InfoRow icon={<User size={13} />} label="Name" value={data.model.name ?? '—'} />
                    <InfoRow icon={<Hash size={13} />} label="Agency ID" value={data.model.agencyId ?? 'Not minted'} />
                    <InfoRow icon={<Layers size={13} />} label="Status" value={data.model.status} />
                    <InfoRow icon={<Calendar size={13} />} label="Created" value={formatDate(data.model.createdAt)} />
                    {data.assetCount !== undefined && (
                      <InfoRow icon={<Layers size={13} />} label="Assets" value={`${data.assetCount} views`} />
                    )}
                  </Section>

                  {/* Specs from preferences — human-readable (VC-R4 fix 2) */}
                  {Object.keys(prefs).length > 0 && (
                    <Section title="Specs">
                      {Object.entries(prefs).map(([key, val]) => {
                        if (HIDDEN_PREF_KEYS.has(key)) return null;
                        const label = PREF_LABELS[key] ?? key;
                        const display = formatPrefValue(key, val);
                        if (!val || !display || display === '—' || display === 'null' || display === 'undefined') return null;
                        return <InfoRow key={key} label={label} value={display} />;
                      })}
                    </Section>
                  )}

                  {/* Technical schema — the JSON master prompt, copyable in
                      full (VC-R4 fix 2), same affordance as Master Prompt */}
                  {Object.keys(schema).length > 0 && (
                    <CopyableBlock
                      title="Technical Schema"
                      copyLabel="Copy technical schema"
                      copiedToast="Technical schema copied"
                      content={JSON.stringify(schema, null, 2)}
                    />
                  )}

                  {/* Master prompt */}
                  <CopyableBlock
                    title="Master Prompt"
                    copyLabel="Copy master prompt"
                    copiedToast="Master prompt copied"
                    content={data.model.masterPrompt || ''}
                  />
                </>
              )}

              {/* Non-model items: show metadata if any */}
              {!data.model && !!data.item.metadata && (
                <Section title="Metadata">
                  {Object.entries(data.item.metadata as Record<string, unknown>).map(([key, val]) => {
                    const display = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '—');
                    return <InfoRow key={key} label={key} value={display} />;
                  })}
                </Section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ───────────────────────────────────────── */

/** Titled mono block with a Copy affordance — Master Prompt and Technical
 *  Schema share this exact surface (VC-R4 fix 2). */
function CopyableBlock({
  title,
  content,
  copyLabel,
  copiedToast,
}: {
  title: string;
  content: string;
  copyLabel: string;
  copiedToast: string;
}) {
  const copy = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      toast.success(copiedToast);
    } catch {
      toast.error('Failed to copy');
    }
  };
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </span>
        <button
          onClick={copy}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#999',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            padding: '2px 4px',
            borderRadius: 4,
          }}
          title={copyLabel}
        >
          <Copy size={12} />
          Copy
        </button>
      </div>
      <div
        style={{
          fontSize: 12,
          lineHeight: 1.6,
          color: '#444',
          background: 'rgba(0, 0, 0, 0.03)',
          borderRadius: 8,
          padding: '10px 12px',
          maxHeight: 140,
          overflowY: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}
      >
        {content || '—'}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#888',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          display: 'block',
          marginBottom: 6,
        }}
      >
        {title}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {children}
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      {icon && (
        <span style={{ color: '#aaa', flexShrink: 0, marginTop: 2 }}>{icon}</span>
      )}
      <span style={{ color: '#888', flexShrink: 0, minWidth: 72 }}>{label}</span>
      <span style={{ color: '#2a2a2a', fontWeight: 500, wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}
