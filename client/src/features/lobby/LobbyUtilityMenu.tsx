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
 *  - `useAnchoredPanel` replaces `absolute right-0 top-10`. The magic offset
 *    was correct only while the panel's ancestor happened not to establish a
 *    containing block; the hook measures. (It was `usePopover` until #304
 *    collapsed the three popover implementations onto one owner — casting's,
 *    with this hook's containing-block correction folded into it. The
 *    placement is unchanged and measured so: `output/304/placement-*.json`.)
 *  - **One width, 264px, in both states.** It was `mode ? 300 : 200`, so the
 *    panel resized when you clicked inside it, which reads as a glitch.
 *  - The eyebrow is mono. It was the sans face at `600 11px`, which is both the
 *    banned weight and the wrong face for a machine-ish label.
 *  - The `<style>` block is gone; the hover is `.dp-menuitem` in
 *    `foundation.css`, shared with the account menu.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { BookOpen, Keyboard, MessageSquare } from 'lucide-react';
import { Eyebrow, Icon as HouseIcon, IconButton, P, useAnchoredPanel } from '@/foundation';

import { FeedbackForm, type FeedbackMode } from './FeedbackForm';

/**
 * #2263 — WHERE THE TWO HELP ENTRANCES LIVE, BY WIDTH, STATED ONCE.
 *
 * The bug icon and this help menu sit in the topbar from 768px up and are gone
 * below it: on a phone the bar has no room for them (#2260 measured it). Before
 * this card that meant a phone customer who hit a problem had no way to tell
 * us at all. So below 768px the same two entrances appear inside the account
 * menu instead (`HelpInAccountMenu`, below).
 *
 * The two class strings are the two halves of ONE breakpoint, so they live
 * side by side: if one moved and the other did not, there would be a band of
 * widths with both entrances (a doubled menu) or neither (the bug this card
 * fixes). `helpPlacement2263-guard.test.ts` holds them to being complements.
 */
export const TOPBAR_HELP_VISIBILITY = 'hidden md:block';
const ACCOUNT_MENU_HELP_VISIBILITY = 'md:hidden';

/**
 * One width (00b §1). 264px holds the longest live label and the longest inert
 * one without wrapping, and the feedback form reads comfortably at it.
 */
const PANEL_WIDTH = 264;

export function LobbyUtilityMenu() {
  const [feedback, setFeedback] = useState(false);

  const popover = useAnchoredPanel({ align: 'fromTheRight' });
  const { close: closePopover, open, panelRef, panelStyle, surfaceProps, toggle, triggerRef } = popover;

  const close = () => closePopover();

  /*
    ⚠ THE RESET HANGS OFF `open`, NOT OFF THE CLOSE BUTTON — found by driving it
    (founder law 6). The panel hook owns most of the ways this panel closes:
    Escape, capture-phase click-away, another panel opening, and a second click
    on the trigger. All of them call the hook's own setter, so a reset written
    into a local `close()` runs on exactly ONE of them.

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
    <div className={TOPBAR_HELP_VISIBILITY}>
      <IconButton
        ref={triggerRef}
        onClick={() => (open ? close() : toggle())}
        label="Help"
        aria-haspopup="menu"
        aria-expanded={open}
        {...surfaceProps}
      >
        <HouseIcon d={P.help} size={15} />
      </IconButton>

      {open && (
        <div
          ref={panelRef}
          role="menu"
          className="dp-floatpanel dp-menu"
          {...surfaceProps}
          style={{
            ...panelStyle,
            zIndex: 50,
            width: PANEL_WIDTH,
            padding: feedback ? 'var(--s-6)' : 'var(--s-2)',
            boxShadow: 'var(--shadowPop)',
          }}
        >
          {feedback ? (
            <FeedbackForm mode="feedback" onDone={close} />
          ) : (
            <>
              <Eyebrow label="HELP" className="dp-menu__group" />
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

/**
 * #2263 — Report a bug and Help, inside the account menu, at phone width only.
 *
 * Wraps the account menu's own contents (`UserCard`) and adds one group under
 * it, `HELP`: Report a bug and Send feedback, which open the very same
 * `FeedbackForm` the topbar's two entrances open, and Documentation as the
 * same inert stub the help menu draws. Keyboard shortcuts is left out here on
 * purpose: this group only exists on a phone, which has no keyboard to
 * shortcut.
 *
 * Pressing a row turns the whole menu into the form, the way the help menu
 * already does on desktop, so the form is never squeezed beneath five other
 * rows. Closing the form (its X, or a sent report) returns to the menu.
 * Closing the account menu itself unmounts all of this, so a half-typed
 * report never comes back on the next open (the reset the two topbar panels
 * hang off `open` happens here by construction).
 *
 * Above 768px the group is not drawn and the menu is exactly what it was.
 */
export function HelpInAccountMenu({ children }: { children: ReactNode }) {
  const [form, setForm] = useState<FeedbackMode | null>(null);

  if (form) {
    return (
      <div style={{ padding: 'var(--s-6)' }}>
        <FeedbackForm mode={form} onDone={() => setForm(null)} />
      </div>
    );
  }

  return (
    <>
      {children}
      {/*
        ⚠ The breakpoint and `dp-menu` sit on TWO elements, never one. `.dp-menu`
        sets `display: flex` in foundation.css, which is unlayered, and an
        unlayered rule beats every Tailwind utility (they live in a cascade
        layer) — so `dp-menu md:hidden` on one element is never hidden, and the
        group drew twice on desktop. Found in the frames; the guard reads for it.
      */}
      <div className={ACCOUNT_MENU_HELP_VISIBILITY}>
        <div className="dp-menu">
          <Eyebrow label="HELP" className="dp-menu__group" />
          <button type="button" onClick={() => setForm('bug')} className="dp-menuitem">
            <HouseIcon d={P.bug} size={13} />
            <span className="dp-menuitem__label">Report a bug</span>
          </button>
          <MenuItem icon={MessageSquare} label="Send feedback" onClick={() => setForm('feedback')} />
          <StubItem icon={BookOpen} label="Documentation" />
        </div>
      </div>
    </>
  );
}

type Glyph = React.ComponentType<{ size?: number | string; strokeWidth?: number | string }>;

/*
  ⚠ The house set is imported here as `HouseIcon`, NOT as `Icon` (#321).

  `MenuItem` and `StubItem` below both destructure `icon: Icon` — a Lucide
  component passed in per row — which would shadow a module-level `Icon` inside
  those two functions only. It compiles either way today. It stops compiling in
  the worst possible manner the day somebody renames that parameter: the house
  `Icon` would quietly take its place, and it takes `d` rather than `size`, so
  the menu rows would render nothing. The alias makes the two impossible to
  confuse rather than merely currently-distinguishable.
*/
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
