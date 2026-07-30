import { Check, X } from "lucide-react";
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
