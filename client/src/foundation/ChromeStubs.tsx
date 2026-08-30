import { ChevronDown, FolderClosed, Megaphone } from "lucide-react";

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
