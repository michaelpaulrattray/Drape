/**
 * The row grammar every Settings section is written in.
 *
 * Section 03 §5: *"All rows use the leader / hairline grammar — label and note
 * left, control right, `--rule` between. **No cards inside cards.**"* Six
 * sections all drawing that shape by hand is six chances for one of them to
 * drift, which is working law 4; it is drawn once here.
 *
 * ⚠ **`Stub` IS A COMPONENT ON PURPOSE, NOT A PROP.** The founder's placeholder
 * law has three conditions and two of them are mechanical — out of the tab
 * order, and honest about why. A boolean on a button leaves both to whoever
 * writes the next one; a component that cannot be rendered without a reason
 * string leaves neither.
 */
import type { ReactNode } from "react";

export function SettingsGroup({
  title,
  note,
  children,
}: {
  title: string;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="dp-set__group">
      <h3 className="dp-set__grouphead">{title}</h3>
      {note ? <p className="dp-set__groupnote">{note}</p> : null}
      {children}
    </section>
  );
}

export function SettingsRow({
  label,
  note,
  children,
}: {
  label: ReactNode;
  note?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="dp-set__row">
      <span className="dp-set__rowtext">
        <span className="dp-set__label">{label}</span>
        {note ? <span className="dp-set__note">{note}</span> : null}
      </span>
      {/*
        §3 rule 3 — a `flex: 1` SPACER, never `flex: 1; min-width: 0` on the
        label. A label given the flexible track can be sized below its own
        content and breaks mid-word; the spacer cannot, because it has none.
      */}
      <span className="dp-set__spacer" />
      {children ? <span className="dp-set__control">{children}</span> : null}
    </div>
  );
}

/**
 * The label a stub wears, and the only way to say "not built yet" in here.
 *
 * It is a `<span>`, so it can never be tabbed to or clicked — the failure mode
 * of a greyed BUTTON is that it still takes focus and still announces itself as
 * a control.
 */
export function StubNote({ children = "NOT BUILT YET" }: { children?: ReactNode }) {
  return <span className="dp-set__stubnote">{children}</span>;
}

/**
 * An inert control that LOOKS like the control it will one day be.
 *
 * `aria-disabled` rather than `disabled`, `tabIndex={-1}` so it leaves the tab
 * order, a `title` that says why, and no `onClick` at all — a stub with a
 * handler is one edit away from being live by accident.
 */
export function StubControl({
  reason,
  className,
  children,
}: {
  reason: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={className ? `dp-set__stub ${className}` : "dp-set__stub"}
      aria-disabled="true"
      tabIndex={-1}
      title={reason}
    >
      {children}
    </span>
  );
}

/**
 * The toggle rows in Notifications.
 *
 * ⚠ **THERE IS NO NOTIFICATION-PREFERENCE STORE IN THE PRODUCT** — no table in
 * `drizzle/schema.ts`, no procedure, no reader (BRIEF-RECONCILIATION Q3). So
 * every one of these ships INERT and says so, rather than flipping a switch
 * that persists nowhere: a toggle that forgets on reload is worse than one that
 * never claimed to remember.
 */
export function SettingsToggle({ on, reason }: { on: boolean; reason: string }) {
  return (
    <span
      className="dp-set__toggle"
      role="switch"
      aria-checked={on}
      aria-disabled="true"
      aria-label={reason}
      tabIndex={-1}
      title={reason}
    />
  );
}

/** A greyscale bar. The fill colour is passed as a TOKEN NAME, never a hex. */
export function Bar({ ratio, token }: { ratio: number; token: string }) {
  const width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
  return (
    <span className="dp-set__bar">
      <span className="dp-set__barfill" style={{ width, background: `var(${token})` }} />
    </span>
  );
}
