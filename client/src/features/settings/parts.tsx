/**
 * The row grammar every Settings section is written in.
 *
 * ⚠ **THE BRIEF'S HAIRLINE RULE IS SUPERSEDED BY HIS OWN PROTOTYPE (#381).**
 * §5 said *"All rows use the leader / hairline grammar — label and note left,
 * control right, `--rule` between. **No cards inside cards.**"* and this file
 * built exactly that. His correction, 2026-09-01, verbatim: *"section 03 isnt
 * just usage corrections most of the pages are designed incorrectly missing
 * cards and borders and correct layout"* … *"where my brief describes a row
 * inline and the prototype draws a card, **the prototype wins**. Open it beside
 * each section rather than building from my prose."*
 *
 * Read at `design_handoff_studio/Klieg Studio.dc.html` beside every pane: the
 * prototype draws **bordered cards** for Notifications rows, Security rows, the
 * Billing plan row and Storage; a **bordered list** for Members and Invoices;
 * and a **three-column bordered card** for the Usage stats. The hairline row
 * survives only where the prototype really does draw one.
 *
 * So there are three shapes here now, not one, and the inner content of a row
 * and a card is ONE function (`RowBody`) rather than two copies — the whole
 * reason the grammar was centralised in the first place.
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

/**
 * The inside of a row, drawn ONCE.
 *
 * A hairline row and a bordered card differ only in their container; letting
 * each write its own label/note/spacer/control is working law 4 in miniature,
 * and it is how the two would drift apart the first time one of them is
 * touched.
 */
function RowBody({
  label,
  note,
  children,
}: {
  label: ReactNode;
  note?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <>
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
    </>
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
      <RowBody label={label} note={note}>
        {children}
      </RowBody>
    </div>
  );
}

/**
 * A row the prototype draws as its own bordered card.
 *
 * Notifications, Security and the Billing plan row are all this shape in
 * `Klieg Studio.dc.html` — `padding: 12-16px 14-17px; border: 1px solid
 * var(--borderCard); border-radius: 10-12px`, with a gap between cards rather
 * than a hairline between rows. `tone="accent"` is the one variant the
 * prototype has: the Delete workspace card, `--accentLine` on `--accentWash`.
 */
export function SettingsCard({
  label,
  note,
  tone,
  children,
}: {
  label: ReactNode;
  note?: ReactNode;
  tone?: "accent";
  children?: ReactNode;
}) {
  return (
    <div className={tone === "accent" ? "dp-set__cardrow dp-set__cardrow--accent" : "dp-set__cardrow"}>
      <RowBody label={label} note={note}>
        {children}
      </RowBody>
    </div>
  );
}

/**
 * A bordered container whose children are divided by hairlines — the prototype's
 * Members list and its invoice list, both `border: 1px solid var(--borderCard);
 * border-radius: 11px; overflow: hidden` with `box-shadow: 0 0 0 0.5px` between
 * rows.
 *
 * This is the ONE place the hairline grammar survives, and it survives because
 * the prototype draws it: a list of like things reads as a list, and giving each
 * member its own card would say they were separate subjects.
 */
export function SettingsList({ children }: { children: ReactNode }) {
  return <div className="dp-set__list">{children}</div>;
}

/**
 * The Usage stats: ONE bordered card in three columns, each column stacking
 * label → value → note.
 *
 * His item 1 and 2 on #381, and he names the cause as his own brief's: *"§5
 * said 'three stat rows' and gave the inline format. You built exactly that …
 * My brief summarised where it should have specified."* The prototype draws
 * `grid-template-columns: repeat(3, 1fr)` inside one border.
 *
 * ⚠ **THE TYPE HERE FOLLOWS HIS CARD, WHICH DIFFERS FROM THE PROTOTYPE MARKUP,
 * AND THAT DIVERGENCE IS DELIBERATE AND DECLARED.** The card specifies label
 * `400 11px --metaStrong`, value `500 22px` mono, note `400 10.5px --faint`;
 * the prototype's own inline style is `400 10.5px --metaStrong`, `500 19px`
 * Archivo, `400 10.5px --metaStrong`. Two of our artifacts say mono — his card
 * and the brief's *"Values in mono; they are measured numbers"* — against the
 * prototype's one, and mono is what `.dp-set__value` has always used for a
 * measured number. The structure is the prototype's; the type is his card's.
 */
export function StatCard({
  stats,
}: {
  stats: { label: string; value: string; note?: string }[];
}) {
  return (
    <div className="dp-set__statcard">
      {stats.map((stat) => (
        <div className="dp-set__statcell" key={stat.label}>
          <span className="dp-set__statlabel">{stat.label}</span>
          <span className="dp-set__statnum">{stat.value}</span>
          {stat.note ? <span className="dp-set__statnote">{stat.note}</span> : null}
        </div>
      ))}
    </div>
  );
}

/**
 * A field that STACKS — label above, control beneath, note under that.
 *
 * The prototype draws every Profile field this way (`flex-direction: column;
 * gap: 6px`, the whole pane capped at 440px), and #381's four questions name it
 * explicitly: *"what STACKS vs sits inline."* A leader row puts a 220px input in
 * a `flex: none` column against a label, which is the shape for a SETTING you
 * flick; a field somebody types their own name into wants its full width and
 * its label directly above it.
 */
export function SettingsField({
  label,
  note,
  children,
}: {
  label: ReactNode;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="dp-set__stackfield">
      <span className="dp-set__fieldlabel">{label}</span>
      {children}
      {note ? <span className="dp-set__fieldnote">{note}</span> : null}
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
