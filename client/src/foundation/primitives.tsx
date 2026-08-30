import { Check, X } from "lucide-react";
import { useState } from "react";
import type {
  ButtonHTMLAttributes,
  CSSProperties,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";

import { cn } from "@/lib/utils";

/**
 * Foundation primitives (build order per README §11 items 3–6).
 *
 * Every interactive affordance is a real <button> — the candidate grid's
 * Keep/Discard/Follow must be reachable by keyboard, so hover-only divs are
 * banned at the primitive layer rather than remembered at each call site
 * (plan §D.10). The focus-visible ring comes from tokens.css.
 *
 * Nothing here portals. Radix portals mount on <body>, outside the `.dp-root`
 * token scope, so dialog/menu/tooltip primitives arrive with M2's promotion of
 * the tokens to :root (see tokens.css header).
 */

/* ---------------------------------------------------------------- buttons */

type ButtonBase = ButtonHTMLAttributes<HTMLButtonElement>;

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "quiet"
  | "onMedia"
  | "onMediaPrimary";

const BUTTON_VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "dp-btn--primary",
  secondary: "dp-btn--secondary",
  quiet: "dp-btn--quiet",
  onMedia: "dp-btn--onmedia",
  onMediaPrimary: "dp-btn--onmediaPrimary",
};

export function Button({
  variant = "secondary",
  size,
  destructive,
  className,
  type = "button",
  ...rest
}: ButtonBase & {
  variant?: ButtonVariant;
  size?: "small";
  /** Destructive is a hover state on a secondary button, never a resting red. */
  destructive?: boolean;
}) {
  return (
    <button
      type={type}
      className={cn(
        "dp-btn",
        BUTTON_VARIANT_CLASS[variant],
        size === "small" && "dp-btn--small",
        destructive && "dp-btn--destructive",
        className,
      )}
      {...rest}
    />
  );
}

export function IconButton({
  label,
  className,
  type = "button",
  children,
  ...rest
}: ButtonBase & { label: string }) {
  return (
    <button
      type={type}
      className={cn("dp-iconbtn", className)}
      title={label}
      aria-label={label}
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * The instruction that replaces a disabled primary (README §5, rule 9).
 * "Keep the ones worth a second look" beats a greyed-out Sign.
 */
export function Instruction({ children }: { children: ReactNode }) {
  return <span className="dp-instruction">{children}</span>;
}

/* ----------------------------------------------------------------- inputs */

export function Field({
  invalid,
  compact,
  className,
  children,
}: {
  invalid?: boolean;
  compact?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "dp-field",
        compact && "dp-field--compact",
        invalid && "dp-field--invalid",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Placeholders are examples, never instructions (README §5). */
export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("dp-input", className)} {...rest} />;
}

export function RequiredMarker() {
  return <span className="dp-required">REQUIRED</span>;
}

/* ------------------------------------------------------------ chips, pills */

/** Action chip: one tap, does something. Hover previews the accent. */
export function Chip({ className, type = "button", ...rest }: ButtonBase) {
  return <button type={type} className={cn("dp-chip", className)} {...rest} />;
}

/**
 * Derived chip: a setting the system inferred or the user changed, shown so it
 * can be removed. No setting is ever applied invisibly (README §5).
 */
export function DerivedChip({
  label,
  onRemove,
  removeLabel,
}: {
  label: string;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <button
      type="button"
      className="dp-chip dp-chip--derived"
      onClick={onRemove}
      aria-label={removeLabel ?? `Remove ${label}`}
    >
      {label}
      <X size={10} strokeWidth={2.4} aria-hidden="true" />
    </button>
  );
}

export function ScopePill({
  active,
  className,
  type = "button",
  ...rest
}: ButtonBase & { active?: boolean }) {
  return (
    <button
      type={type}
      className={cn("dp-scopepill", className)}
      aria-pressed={active ?? false}
      {...rest}
    />
  );
}

export function StatusPill({
  tone = "neutral",
  icon,
  children,
}: {
  tone?: "neutral" | "accent" | "onMedia";
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "dp-statuspill",
        tone === "accent" && "dp-statuspill--accent",
        tone === "onMedia" && "dp-statuspill--onmedia",
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/* ------------------------------------------------------- cards, rows, media */

export function Card({
  raised,
  interactive,
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { raised?: boolean; interactive?: boolean }) {
  return (
    <div
      className={cn(
        "dp-card",
        raised && "dp-card--raised",
        interactive && "dp-card--interactive",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function SectionHead({ eyebrow, aside }: { eyebrow: string; aside?: ReactNode }) {
  return (
    <div className="dp-sectionhead">
      <span className="dp-eyebrow">{eyebrow}</span>
      {aside ? <span className="dp-small">{aside}</span> : null}
    </div>
  );
}

/**
 * A real drop-slot: `--media` behind the imagery so an unloaded image looks
 * intentional rather than broken. Only for ≥64px — use `GradientTile` below
 * that, where placeholder prose clips mid-word (README §6).
 */
export function MediaFrame({
  src,
  alt,
  selected,
  overlay,
  topLeft,
  className,
}: {
  src?: string;
  alt?: string;
  selected?: boolean;
  overlay?: ReactNode;
  topLeft?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("dp-media", className)}>
      {src ? <img src={src} alt={alt ?? ""} /> : null}
      {topLeft ? <span className="dp-media__pill">{topLeft}</span> : null}
      {overlay ? <span className="dp-media__scrim">{overlay}</span> : null}
      {selected ? (
        <>
          <span className="dp-selected-ring" />
          <span className="dp-selected-check">
            <Check size={11} strokeWidth={2.6} aria-hidden="true" />
          </span>
        </>
      ) : null}
    </div>
  );
}

export function GradientTile({
  label,
  title,
  width,
  height,
}: {
  label?: string;
  title?: string;
  width: number;
  height: number;
}) {
  return (
    <span className="dp-tile" style={{ width, height }} title={title}>
      {label}
    </span>
  );
}

/** Dashed means "you can put something here". Never decoration. */
export function DropZone({
  className,
  type = "button",
  children,
  ...rest
}: ButtonBase) {
  return (
    <button type={type} className={cn("dp-dropzone", className)} {...rest}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------- dock */

/**
 * Sticky bottom dock. The scroll container must carry `dp-dock-scroll` so the
 * last row is never trapped underneath (README §5).
 */
export function Dock({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("dp-dock", className)}>{children}</div>;
}

/* ----------------------------------------------------------------- states */

/**
 * Skeleton tile. Streaming beats batching: render one of these per expected
 * result immediately and swap each on its own arrival, never behind the
 * slowest (README §8, non-negotiable 12).
 */
export function Skeleton({
  label,
  className,
  style,
}: {
  label?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={cn("dp-skeleton", className)} style={style}>
      {label ? <span className="dp-skeleton__label">{label}</span> : null}
    </div>
  );
}

/** Names the thing, explains the mechanism in one line, offers the action. */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="dp-empty">
      <span className="dp-label">{title}</span>
      <span className="dp-secondary" style={{ maxWidth: 220 }}>
        {body}
      </span>
      {action}
    </div>
  );
}

/**
 * The credit balance in the topbar (D-45 — visible wherever spending is
 * possible). A button when there is somewhere to go, plain text otherwise:
 * a chip that looks clickable and isn't is a dead control.
 */
export function CreditsChip({
  balance,
  onClick,
  label = "credits",
}: {
  balance: number | undefined;
  onClick?: () => void;
  label?: string;
}) {
  if (balance === undefined) return null;
  const content = `${balance.toLocaleString()} ${label}`;
  return onClick ? (
    <button type="button" className="dp-credits" onClick={onClick} title="Billing">
      {content}
    </button>
  ) : (
    <span className="dp-credits">{content}</span>
  );
}

export function Progress({ value }: { value: number }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      className="dp-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
    >
      <span className="dp-progress__bar" style={{ width: `${clamped}%` }} />
    </div>
  );
}

/* ==========================================================================
   SECTION 00 — the shared parts, once
   (docs/specs/Casting-ui-ux-design/drape-redesign/00-foundation-topup.md)

   Twelve surfaces reuse these nine. The visual grammar for MediaCard,
   HoverActions and Marquee is `10-shared-patterns.md`; the other six are
   specified by brief 00 itself. Nothing here is used by one surface only —
   that is the bar for a place in the foundation.
   ========================================================================== */

export type MediaRatio = "4/5" | "16/9" | "1/1" | "16/10" | "2.39/1";
export type MediaCardState = "default" | "kept" | "pending" | "gap" | "create";

export type HoverActionItem = {
  icon: ReactNode;
  /** Both the tooltip and the accessible name — an icon button has no other name. */
  title: string;
  onClick?: () => void;
};

/**
 * The action row revealed by hovering the CARD (grammar: *Hover reveal*).
 *
 * The reveal is parent-driven and cannot be inline: the prototype put `:hover`
 * on the row itself, so the buttons only appeared once the cursor was already
 * inside the thin strip they live in — you had to find them to make them
 * findable. The rule lives in `foundation.css` (`[data-hoverhost]:hover
 * [data-hoverfade]`); this component supplies the marked node, and any host
 * must carry `data-hoverhost`.
 *
 * Standard set, in order: Use as reference · Download · Copy image · Save to
 * assets. `meta` is the optional right-aligned mono note (kind · ratio · time).
 */
export function HoverActions({
  items,
  meta,
}: {
  items: HoverActionItem[];
  meta?: ReactNode;
}) {
  return (
    <div className="dp-hoveractions" data-hoverfade>
      {items.map((item) => (
        <button
          key={item.title}
          type="button"
          className="dp-hoveractions__btn"
          title={item.title}
          aria-label={item.title}
          onClick={item.onClick}
        >
          {item.icon}
        </button>
      ))}
      {meta ? <span className="dp-hoveractions__meta">{meta}</span> : null}
    </div>
  );
}

/**
 * The single most reused thing in the redesign — Library, Assets, Home,
 * Casting, Templates, Cinema, Crew (grammar: *Media card*, *Dashed create
 * tile*).
 *
 * Three rules it enforces so no surface has to remember them:
 *
 * - **The label row is BELOW the media, never over it.** A filled slot's
 *   caption centres in the card, which on a short 4:3 is exactly where a bottom
 *   overlay's text lands. They collided in the prototype; the rule is absolute.
 * - **`state="kept"` is the only accent a card ever carries** — a 3px bar along
 *   the bottom of the media plus one pill.
 * - **The dashed tile is ONE shape with TWO sentences**, and conflating them was
 *   the brief's own error, corrected by the founder at the frames (2026-08-30).
 *   `state="create"` says the ACTION and carries no word over the glyph — "New
 *   canvas", "New cast member", "Upload"; `state="gap"` says **NEEDED** plus
 *   what is blocking — "The Broker, no wardrobe yet, needed by SC 5". His
 *   sentence: *"One means you can make one; the other means the production is
 *   short of one. A card labelled 'New cast member NEEDED' says neither."*
 *   A CREATE tile must stay FIRST in a collection grid so the create action
 *   never hides behind eight items.
 *
 * The aspect-ratio rule (§5) is baked in here rather than restated per surface:
 * the grid gives the card a definite width, the media's height stays `auto`,
 * and `aspect-ratio` resolves it. Pinning both axes is what stops it resolving
 * at all.
 *
 * The click target is a button INSIDE the well rather than a button wrapping
 * the card, because `actions` are themselves buttons and a button inside a
 * button is invalid HTML that browsers silently unnest.
 */
export function MediaCard({
  ratio = "4/5",
  src,
  alt,
  badge,
  corner,
  label,
  meta,
  actions,
  state = "default",
  onClick,
  className,
}: {
  ratio?: MediaRatio;
  src?: string;
  alt?: string;
  badge?: ReactNode;
  corner?: ReactNode;
  label?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  state?: MediaCardState;
  onClick?: () => void;
  className?: string;
}) {
  const aspect = ratio.replace("/", " / ");
  const media = (
    <>
      {state === "gap" || state === "create" ? (
        <span className="dp-mediacard__gap">
          <span className="dp-mediacard__plus" aria-hidden="true" />
          {/* NEEDED belongs to the GAP only. Founder correction of his own
              brief (2026-08-30): "One means you can make one; the other means
              the production is short of one. A card labelled 'New cast member
              NEEDED' says neither." Same shape, two sentences. */}
          {state === "gap" ? <span className="dp-mediacard__needed">NEEDED</span> : null}
        </span>
      ) : null}
      {state !== "gap" && state !== "create" && src ? <img src={src} alt={alt ?? ""} /> : null}
    </>
  );

  return (
    <div className={cn("dp-mediacard", className)} data-hoverhost>
      <div
        className={cn(
          "dp-mediacard__well",
          state === "kept" && "dp-mediacard__well--kept",
          state === "pending" && "dp-mediacard__well--pending",
          (state === "gap" || state === "create") && "dp-mediacard__well--gap",
        )}
        style={{ aspectRatio: aspect }}
      >
        {onClick ? (
          <button
            type="button"
            className="dp-mediacard__hit"
            onClick={onClick}
            aria-label={typeof label === "string" ? label : alt}
          >
            {media}
          </button>
        ) : (
          media
        )}
        {badge ? <span className="dp-mediacard__badge">{badge}</span> : null}
        {corner ? <span className="dp-mediacard__corner">{corner}</span> : null}
        {actions}
      </div>
      {label || meta ? (
        <div className="dp-mediacard__row">
          <span className="dp-mediacard__label">{label}</span>
          {meta ? <span className="dp-mediacard__meta">{meta}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The bar at the top of a full-height working surface — Cinema's production
 * bar and the staff ops bar are one component with two consumers.
 *
 * ⚠ **The overflow discipline is the whole point of it existing.** Four
 * separate overflow bugs in the prototype came from a `flex: 1; min-width: 0`
 * title beside `flex: none` controls; the last put the primary action fully
 * off-screen at 924px. So: the title column takes `min-width: 0` and ellipsis,
 * the meta cluster takes a min-width floor and may wrap, the spacer is
 * `flex: 1 1 0` with `min-width: 0`, and the bar wraps. **Never
 * `overflow-x: auto` on this bar** — a header behind a horizontal scroll is a
 * control nobody finds.
 */
export function SurfaceBar({
  eyebrow,
  title,
  segments,
  meta,
  right,
}: {
  eyebrow?: string;
  title: ReactNode;
  segments?: {
    value: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
  };
  meta?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="dp-surfacebar">
      <div className="dp-surfacebar__title">
        {eyebrow ? <span className="dp-eyebrow">{eyebrow}</span> : null}
        <span className="dp-surfacebar__heading">{title}</span>
      </div>
      {segments ? (
        <div className="dp-segmented" role="tablist">
          {segments.options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={option.value === segments.value}
              className={cn(
                "dp-segmented__seg",
                option.value === segments.value && "dp-segmented__seg--on",
              )}
              onClick={() => segments.onChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
      <span className="dp-surfacebar__spacer" />
      {meta ? <span className="dp-surfacebar__meta">{meta}</span> : null}
      {right ? <span className="dp-surfacebar__right">{right}</span> : null}
    </div>
  );
}

export type DataColumn = {
  label: string;
  /** A flex string, not a grid track: `0 0 104px` for pills and stamps, `1 1 0` for the column that gives way. */
  width: string;
};

export type DataFact = { label: string; value: ReactNode };

export type DataRow = {
  id: string;
  cells: ReactNode[];
  /** Present = the row expands. Absent = it is a plain row. */
  facts?: DataFact[];
  /** Plain-English paragraph on `--well`. What a reader needs, not a JSON dump. */
  evidence?: ReactNode;
  actions?: ReactNode;
};

/**
 * A row that opens IN PLACE (brief 00 §2).
 *
 * This is what replaces `UserDetailModal`, `AuditLogDetailModal`,
 * `LogDetailModal`, `ReviewModal` and `ChangeRequestDetail` for read-and-decide
 * flows: five modals whose whole job was to show a handful of facts about the
 * row you just clicked. **Modals stay only where a form must be filled** — a
 * dialog is right for "type a reason and confirm", wrong for "show me this".
 */
export function ExpandableRow({
  columns,
  row,
  open,
  onToggle,
}: {
  columns: DataColumn[];
  row: DataRow;
  open: boolean;
  onToggle: () => void;
}) {
  const expandable = Boolean(row.facts || row.evidence || row.actions);
  const cells = row.cells.map((cell, index) => (
    <span
      key={columns[index]?.label ?? index}
      className="dp-table__cell"
      style={{ flex: columns[index]?.width }}
    >
      {cell}
    </span>
  ));

  return (
    <div className={cn("dp-table__rowgroup", open && "dp-table__rowgroup--open")}>
      {expandable ? (
        <button
          type="button"
          className="dp-table__row dp-table__row--button"
          aria-expanded={open}
          onClick={onToggle}
        >
          {cells}
        </button>
      ) : (
        <div className="dp-table__row">{cells}</div>
      )}
      {open && expandable ? (
        <div className="dp-table__panel">
          {row.facts ? (
            <div className="dp-table__facts">
              {row.facts.map((fact) => (
                <span key={fact.label} className="dp-table__fact">
                  <span className="dp-chrome">{fact.label}</span>
                  <span className="dp-table__factvalue">{fact.value}</span>
                </span>
              ))}
            </div>
          ) : null}
          {row.evidence ? <p className="dp-table__evidence">{row.evidence}</p> : null}
          {row.actions ? <div className="dp-table__actions">{row.actions}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Staff tables. Columns are flex strings rather than a grid, so a pill column
 * can be exactly as wide as a pill and one column gives way.
 *
 * One row open at a time: two open expansions on a 4,471-entry log turns a
 * table into a pile.
 */
export function DataTable({
  columns,
  rows,
  footer,
  emptyLabel = "Nothing to show",
}: {
  columns: DataColumn[];
  rows: DataRow[];
  footer?: { meta: ReactNode; onBack?: () => void; onNext?: () => void };
  emptyLabel?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div className="dp-table">
      <div className="dp-table__head">
        {columns.map((column) => (
          <span key={column.label} className="dp-table__cell" style={{ flex: column.width }}>
            {column.label}
          </span>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="dp-table__empty dp-secondary">{emptyLabel}</div>
      ) : (
        rows.map((row) => (
          <ExpandableRow
            key={row.id}
            columns={columns}
            row={row}
            open={openId === row.id}
            onToggle={() => setOpenId((was) => (was === row.id ? null : row.id))}
          />
        ))
      )}
      {footer ? (
        <div className="dp-table__foot">
          <span className="dp-metadata">{footer.meta}</span>
          <span className="dp-surfacebar__spacer" />
          {footer.onBack ? (
            <Button variant="quiet" size="small" onClick={footer.onBack}>
              Back
            </Button>
          ) : null}
          {footer.onNext ? (
            <Button variant="quiet" size="small" onClick={footer.onNext}>
              Next
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export type CostSign = "+" | "−" | "!" | "=";
export type Cost = { sign: CostSign; text: ReactNode };

const COST_SIGN_COLOR: Record<CostSign, string> = {
  "+": "var(--ink)",
  "−": "var(--metaStrong)",
  "!": "var(--errorInk)",
  "=": "var(--faint)",
};

/**
 * A choice with its consequence priced — Crew decisions, run scopes, model
 * picks.
 *
 * **A decision with no stated consequence is a conversation, not a decision.**
 * This component is the mechanism that stops us shipping the former: you cannot
 * render one without saying what it costs.
 */
export function CostedOption({
  optionKey,
  label,
  costs,
  onClick,
}: {
  optionKey: string;
  label: ReactNode;
  costs: Cost[];
  onClick?: () => void;
}) {
  return (
    <button type="button" className="dp-costed" onClick={onClick}>
      <span className="dp-costed__head">
        <span className="dp-chrome">{optionKey}</span>
        <span className="dp-label">{label}</span>
      </span>
      <span className="dp-costed__costs">
        {costs.map((cost, index) => (
          <span key={index} className="dp-costed__cost">
            <span className="dp-costed__sign" style={{ color: COST_SIGN_COLOR[cost.sign] }}>
              {cost.sign}
            </span>
            <span className="dp-secondary">{cost.text}</span>
          </span>
        ))}
      </span>
    </button>
  );
}

export type Milestone = {
  id: string;
  name: string;
  /** Segment width is proportional to this. Equal segments lie about where the work is. */
  weight: number;
  done: number;
  total: number;
};

/**
 * Plan progress as a proportional rail. Crew today; the shape of any
 * plan-progress display we add later.
 *
 * ⚠ **Segment width is `flex: weight`, not `flex: 1`.** A rail of equal
 * segments says a nine-item milestone and a two-item one are the same size,
 * which is precisely the thing a progress display exists to communicate.
 *
 * The three states are DERIVED from the counts rather than passed in beside
 * them — a `status` field next to `done`/`total` is a second list shadowing a
 * source of truth, and it drifts.
 */
export function MilestoneRail({
  milestones,
  held = false,
}: {
  milestones: Milestone[];
  held?: boolean;
}) {
  return (
    <div className="dp-milestones">
      <div className="dp-milestones__rail">
        {milestones.map((milestone) => {
          const closed = milestone.total > 0 && milestone.done >= milestone.total;
          const started = milestone.done > 0;
          return (
            <span
              key={milestone.id}
              className={cn(
                "dp-milestones__seg",
                closed && "dp-milestones__seg--closed",
                !closed && started && "dp-milestones__seg--current",
                !closed && started && held && "dp-milestones__seg--held",
                !started && "dp-milestones__seg--todo",
              )}
              style={{ flex: milestone.weight }}
              title={`${milestone.id} · ${milestone.name} · ${milestone.done}/${milestone.total}`}
            />
          );
        })}
      </div>
      <div className="dp-milestones__legend">
        {milestones.map((milestone) => (
          <span key={milestone.id} className="dp-metadata" style={{ flex: milestone.weight }}>
            {milestone.id}
          </span>
        ))}
      </div>
    </div>
  );
}

export type TranscriptEntry = {
  who: string;
  when: string;
  body: ReactNode;
  /** A ruling, a decision, a citation — whatever the entry produced. */
  ref?: { kind: string; text: ReactNode } | null;
  /**
   * The reader's own entries are weighted and get a solid spine.
   *
   * A flag rather than `who === "you"`: keying a look on the spelling of a
   * label is how a contract breaks the day someone writes "founder".
   */
  own?: boolean;
};

/**
 * A two-speaker conversation record. Crew today.
 *
 * ⚠ **The speaker column is 80px and does not shrink.** `"night shift"` needs
 * 69.3px at 10.5px mono and clips at 64px — and the answer is not a smaller
 * font: 10.5px is the mono floor in this system.
 */
export function Transcript({ entries }: { entries: TranscriptEntry[] }) {
  return (
    <div className="dp-transcript">
      {entries.map((entry, index) => (
        <div
          key={index}
          className={cn("dp-transcript__entry", entry.own && "dp-transcript__entry--own")}
        >
          <span className="dp-transcript__who">{entry.who}</span>
          <span className="dp-transcript__spine" aria-hidden="true" />
          <div className="dp-transcript__body">
            <span className="dp-transcript__when dp-metadata">{entry.when}</span>
            <span className="dp-transcript__text">{entry.body}</span>
            {entry.ref ? (
              <span className="dp-transcript__ref">
                <span className="dp-chrome">{entry.ref.kind}</span>
                <span className="dp-secondary">{entry.ref.text}</span>
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The auto-scrolling row on the Canvas tab header (grammar: *Motion
 * vocabulary* → `dsmarq`).
 *
 * ⚠ **The animated track carries no padding and no `gap`.**
 * `translateX(-50%)` has to equal exactly one copy's stride, and a `gap`
 * applies BETWEEN items only — so a gapped track is one gap short of two full
 * copies and jumps visibly on every loop. Items space themselves with
 * `margin-right` (which every item gets, including the last) and the inset
 * lives on the wrapper.
 *
 * The list is rendered twice; `aria-hidden` on the second copy so a screen
 * reader hears each item once.
 */
export function Marquee({
  items,
  itemWidth,
  gap = 14,
  duration = 62,
  pauseOnHover = true,
}: {
  items: ReactNode[];
  itemWidth: number;
  gap?: number;
  duration?: number;
  pauseOnHover?: boolean;
}) {
  const copy = (hidden: boolean) =>
    items.map((item, index) => (
      <span
        key={`${hidden ? "b" : "a"}-${index}`}
        className="dp-marquee__item"
        style={{ width: itemWidth, marginRight: gap }}
        aria-hidden={hidden || undefined}
      >
        {item}
      </span>
    ));

  return (
    <div className={cn("dp-marquee", pauseOnHover && "dp-marquee--pausable")}>
      <div className="dp-marquee__track" style={{ animationDuration: `${duration}s` }}>
        {copy(false)}
        {copy(true)}
      </div>
    </div>
  );
}
