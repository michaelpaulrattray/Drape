/**
 * Report a bug — its own topbar icon (section 02 §1d).
 *
 * His reason, verbatim from the brief: *"Report a bug moves out of the `···`
 * menu and becomes its own icon. Two clicks deep gets you fewer bug reports,
 * which is backwards."* So the row left the help menu and this button took its
 * place in the bar. Same form, same mutation, same copy — see `FeedbackForm`,
 * which both entrances share so they cannot drift apart.
 *
 * ⚠ **THE RESET HANGS OFF `open`, NOT OFF THE CLOSE BUTTON.** `useAnchoredPanel`
 * owns most of the ways this panel closes — Escape, capture-phase click-away,
 * another panel opening, and a second click on the trigger — so a reset
 * written into a local `close()` runs on exactly one of them. That was found by
 * driving the menu (founder law 6) and it applies here identically: type half a
 * report, press Escape, open it again, and you would be staring at the
 * half-typed form. The form's own state is remounted rather than cleared, which
 * is the same fix in fewer moving parts.
 */
import { Icon, P, useAnchoredPanel } from '@/foundation';

import { FEEDBACK_PANEL_STYLE, FeedbackForm } from './FeedbackForm';

export function ReportBugButton() {
  const popover = useAnchoredPanel({ align: 'fromTheRight' });
  const { close, open, panelRef, panelStyle, surfaceProps, toggle, triggerRef } = popover;

  return (
    <div className="hidden md:block">
      <button
        ref={triggerRef}
        onClick={() => (open ? close() : toggle())}
        type="button"
        className="dp-iconbtn"
        aria-label="Report a bug"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Report a bug"
        {...surfaceProps}
      >
        <Icon d={P.bug} size={15} />
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Report a bug"
          className="dp-menu"
          {...surfaceProps}
          style={{ ...panelStyle, ...FEEDBACK_PANEL_STYLE }}
        >
          <FeedbackForm mode="bug" onDone={close} />
        </div>
      )}
    </div>
  );
}
