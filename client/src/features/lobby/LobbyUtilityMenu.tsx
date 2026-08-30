/**
 * LobbyUtilityMenu — the help menu in the lobby's topbar, rendered into the
 * shell's `topbarRight` slot beside the credits chip and the bug button.
 *
 * It used to sit `absolute top-4 right-5` — the viewport's top-right
 * corner, Luma-style — which was fine until the M2 foundation shell put
 * the theme toggle in that exact square (`Topbar.tsx`, shell-owned per
 * plan §D.8). Two controls in one 30px box: the z-40 one won and the
 * theme toggle became unclickable (#73). So the menu is now an ordinary
 * `dp-iconbtn` in the topbar's row, and the shell keeps its corner.
 * **That fix is not superseded and must not be undone.**
 *
 * ---------------------------------------------------------------------------
 * Section 02 (`docs/specs/Casting-ui-ux-design/drape-redesign/02-topbar-and-rail.md`).
 * The `···` became a **question mark**, because that is what this menu is: the
 * brief's right cluster carries three discrete icons — bug, help, what's new —
 * and this is the help one. Two things left it in the same commit:
 *
 *  - **Report a bug** is its own topbar icon now (`ReportBugButton`). His
 *    reason, verbatim: *"Two clicks deep gets you fewer bug reports, which is
 *    backwards."* The form itself did not change; it moved into `FeedbackForm`
 *    so both entrances share one copy.
 *  - **Theme and Cookie preferences are gone** — his correction on the 00b
 *    frames (#267/#268), and section 02's own list of what the menu keeps says
 *    the same thing. Theme, verbatim: *"A greyed row saying Theme reads as
 *    'theming isn't built' while the product visibly themes"*, and there is a
 *    working toggle in the same bar. Cookie preferences was his open question
 *    and the answer is that the product has **no consent mechanism and no
 *    third-party trackers** — one strictly-necessary session cookie — so there
 *    is nothing for a preferences panel to govern and nothing to promise.
 *
 * What remains: Send feedback, live; Documentation and Keyboard shortcuts,
 * inert, because both will exist.
 *
 * ---------------------------------------------------------------------------
 * Section 00b, unchanged and still binding:
 *
 *  - ⚠ **THE NO-DEAD-LINKS RULE THAT USED TO STAND HERE IS SUPERSEDED.** This
 *    file's own header used to argue that Documentation and friends were LEFT
 *    OUT until those systems existed. The founder ruled the other way on #228
 *    (2026-08-30), verbatim: *"a stub names a place, never a capability, and
 *    never carries an unread dot"* — unbuilt features are designed in and
 *    rendered inert, on `Rail.tsx`'s existing pattern. His reason is a product
 *    one: *"the shape of the product is a decision I want fixed now, while it's
 *    cheap."* So they are shown, inert, and the rule the old comment was
 *    protecting still holds — nothing here claims a capability, it names a
 *    place.
 *  - `usePopover` replaces `absolute right-0 top-10`. The magic offset was
 *    correct only while the panel's ancestor happened not to establish a
 *    containing block; the hook measures.
 *  - **One width, 264px, in both states.** It was `mode ? 300 : 200`, so the
 *    panel resized when you clicked inside it, which reads as a glitch.
 *  - The eyebrow is mono. It was the sans face at `600 11px`, which is both the
 *    banned weight and the wrong face for a machine-ish label.
 *  - The `<style>` block is gone; the hover is `.dp-menuitem` in
 *    `foundation.css`, shared with the account menu.
 */
import { useEffect, useState } from 'react';
import { BookOpen, CircleHelp, Keyboard, MessageSquare } from 'lucide-react';
import { usePopover } from '@/foundation';

import { FeedbackForm } from './FeedbackForm';

/**
 * One width (00b §1). 264px holds the longest live label and the longest inert
 * one without wrapping, and the feedback form reads comfortably at it.
 */
const PANEL_WIDTH = 264;

export function LobbyUtilityMenu() {
  const [feedback, setFeedback] = useState(false);

  const popover = usePopover({ placement: 'bottom-end' });
  const { close: closePopover, open, panelRef, panelStyle, surfaceProps, toggle, triggerRef } = popover;

  const close = () => closePopover();

  /*
    ⚠ THE RESET HANGS OFF `open`, NOT OFF THE CLOSE BUTTON — found by driving it
    (founder law 6). `usePopover` owns four of the five ways this panel closes:
    Escape, capture-phase click-away, outside scroll, and a second click on the
    trigger. All four call the hook's own setter, so a reset written into a local
    `close()` runs on exactly ONE of them.

    What that looked like in the app: type half a message, press Escape, open the
    menu again — and you are staring at the half-typed form instead of the menu.
    The previous version reset on Escape because it owned the key handler itself;
    centralising the discipline in the hook quietly took that away, which is a
    change to what the menu DOES and 00b forbids exactly that.

    The textarea's own contents clear with it: `FeedbackForm` holds them, and it
    unmounts when this flips back to false.
  */
  useEffect(() => {
    if (open) return;
    setFeedback(false);
  }, [open]);

  return (
    <div className="hidden md:block">
      <button
        ref={triggerRef}
        onClick={() => (open ? close() : toggle())}
        type="button"
        className="dp-iconbtn"
        aria-label="Help"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Help"
        {...surfaceProps}
      >
        <CircleHelp size={15} strokeWidth={1.8} />
      </button>

      {open && (
        <div
          ref={panelRef}
          role="menu"
          className="dp-menu"
          {...surfaceProps}
          style={{
            ...panelStyle,
            zIndex: 50,
            width: PANEL_WIDTH,
            padding: feedback ? 'var(--s-6)' : 'var(--s-2)',
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--borderCard)',
            background: 'var(--surface)',
            boxShadow: 'var(--shadowPop)',
          }}
        >
          {feedback ? (
            <FeedbackForm mode="feedback" onDone={close} />
          ) : (
            <>
              <MenuGroup label="HELP" />
              <MenuItem icon={MessageSquare} label="Send feedback" onClick={() => setFeedback(true)} />
              <StubItem icon={BookOpen} label="Documentation" />
              <StubItem icon={Keyboard} label="Keyboard shortcuts" />
            </>
          )}
        </div>
      )}
    </div>
  );
}

type Glyph = React.ComponentType<{ size?: number | string; strokeWidth?: number | string }>;

function MenuGroup({ label }: { label: string }) {
  return (
    <div className="dp-menugroup">
      <span className="dp-menugroup__label">{label}</span>
      <span className="dp-menugroup__rule" aria-hidden="true" />
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick }: { icon: Glyph; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="dp-menuitem">
      <Icon size={13} strokeWidth={1.8} />
      <span className="dp-menuitem__label">{label}</span>
    </button>
  );
}

/**
 * A place the product will go, drawn and inert (00b §3). Not a link and not a
 * button: a `<span>` with `aria-disabled` is out of the tab order by
 * construction, which is the whole reason `Rail.tsx` shapes its stubs this way.
 */
function StubItem({ icon: Icon, label }: { icon: Glyph; label: string }) {
  return (
    <span className="dp-menuitem dp-menuitem--stub" aria-disabled="true" title={`${label} — not built yet`}>
      <Icon size={13} strokeWidth={1.8} />
      <span className="dp-menuitem__label">{label}</span>
    </span>
  );
}
