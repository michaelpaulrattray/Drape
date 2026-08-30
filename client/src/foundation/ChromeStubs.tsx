import { ChevronDown, FolderClosed, Megaphone, Search } from "lucide-react";

/**
 * Inert topbar chrome (brief 00b §3, §4).
 *
 * Two places the product will one day go, drawn now and rendered inert. The
 * rule they follow is `Rail.tsx`'s, generalised by 00b §3 and by the founder's
 * own ruling on #228: *"a stub names a place, never a capability, and never
 * carries an unread dot."*
 *
 * Neither is a link and neither is a button — a `<span>` with `aria-disabled`
 * is out of the tab order by construction, so nothing here depends on somebody
 * remembering a `tabindex`. Both carry the `— not built yet` tooltip, both sit
 * at `--muted`, and neither has a hover state: a control that lights up under
 * the cursor and then does nothing is worse than one that plainly says "not
 * yet".
 *
 * ⚠ **The prototype puts an unread dot on What's new; we do not.** A dot is a
 * claim that there is something to read, and there is not. That is the line
 * between a stub and a lie, and it is the reason this file has a comment.
 */

/**
 * The project switcher.
 *
 * Projects do not exist. The label is nonetheless TRUE rather than a
 * placeholder — everything in the workspace *is* all projects — which is what
 * makes this stub honest. The scoping does not ship at all: no `projectId` on
 * any query, no per-project counts, no brand dots (00b §4). The switcher names
 * a place; per-project filtering is a capability, and a capability is not faked
 * in the UI, in a query signature, or in a count.
 */
export function ProjectSwitcherStub() {
  return (
    <span className="dp-projswitch" aria-disabled="true" title="Projects — not built yet">
      <FolderClosed size={13} strokeWidth={1.8} aria-hidden="true" />
      All projects
      <ChevronDown size={11} strokeWidth={2.2} aria-hidden="true" />
    </span>
  );
}

/**
 * What's new.
 *
 * A release feed we do not have. 15px glyph, matching the topbar's other icon
 * buttons rather than the 13px used inside menu rows — two icon sizes in the
 * chrome, not four (00b §1).
 */
export function WhatsNewStub() {
  return (
    <span
      className="dp-iconbtn dp-iconbtn--stub"
      aria-disabled="true"
      title="What's new — not built yet"
    >
      <Megaphone size={15} strokeWidth={1.8} aria-hidden="true" />
    </span>
  );
}

/**
 * The centred search (section 02 §1c).
 *
 * ⚠ **IT IS A `<span>` AND IT MAY NEVER BECOME AN `<input>`.** His ruling,
 * verbatim: *"The search must not be an `<input>`. It's a span, not focusable,
 * no ⌘K binding. A text field that takes keystrokes and does nothing claims a
 * capability, which is the one thing a stub may never do."* His brief names
 * this as the single item in the section most likely to be "improved" into a
 * lie, so it is guarded in the suite as well as written here: see
 * `section02-guard.test.ts`.
 *
 * **And there is no ⌘K handler, deliberately.** The key chips describe the
 * shortcut the feature will have when it exists. Binding them to nothing is the
 * same lie in a different shape — a keystroke that swallows itself.
 *
 * `cursor: text` is the one place this stub differs from the others: the shape
 * is a field, and a text cursor over a field is what the eye expects. It still
 * takes no focus, no keys and no click.
 */
export function SearchStub() {
  return (
    <span className="dp-search" aria-disabled="true" title="Search — not built yet">
      <Search size={13} strokeWidth={2} aria-hidden="true" />
      <span className="dp-search__label">Search frames, faces, prompts…</span>
      <span className="dp-search__keys" aria-hidden="true">
        <span className="dp-search__key">⌘</span>
        <span className="dp-search__key">K</span>
      </span>
    </span>
  );
}
