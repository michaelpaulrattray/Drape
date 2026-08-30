/**
 * LobbyUtilityMenu — the quiet three-dot help menu in the lobby's topbar,
 * rendered into the shell's `topbarRight` slot beside the credits chip.
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
 * Section 00b (`docs/specs/Casting-ui-ux-design/drape-redesign/00b-chrome-and-menus.md`).
 * Same mutation, same flows, same copy. What changed:
 *
 *  - ⚠ **THE NO-DEAD-LINKS RULE THAT USED TO STAND HERE IS SUPERSEDED.** This
 *    file's own header used to argue that Documentation, theme and cookie
 *    preferences were LEFT OUT until those systems existed. The founder ruled
 *    the other way on #228 (2026-08-30), verbatim: *"a stub names a place,
 *    never a capability, and never carries an unread dot"* — unbuilt features
 *    are designed in and rendered inert, on `Rail.tsx`'s existing pattern. His
 *    reason is a product one: *"the shape of the product is a decision I want
 *    fixed now, while it's cheap."* So they are shown, inert, and the rule the
 *    old comment was protecting still holds — nothing here claims a
 *    capability, it names a place.
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
import { toast } from 'sonner';
import {
  Bug,
  BookOpen,
  Cookie,
  Keyboard,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Send,
  SunMoon,
  X,
} from 'lucide-react';
import { usePopover } from '@/foundation';
import { trpc } from '@/lib/trpc';
import { logRawFailure, readableFailure } from "@/lib/failureSentence";

type FormMode = 'feedback' | 'bug';

const FORM_COPY: Record<FormMode, { title: string; placeholder: string; category: 'feedback' | 'other' }> = {
  feedback: {
    title: 'Send feedback',
    placeholder: 'What should we improve?',
    category: 'feedback',
  },
  bug: {
    title: 'Report a bug',
    placeholder: 'What happened, and what did you expect?',
    category: 'other',
  },
};

/**
 * One width in both states (00b §1). 264px holds the longest live label and the
 * longest inert one without wrapping, and the form's textarea reads comfortably
 * at it.
 */
const PANEL_WIDTH = 264;

export function LobbyUtilityMenu() {
  const [mode, setMode] = useState<FormMode | null>(null);
  const [description, setDescription] = useState('');

  /* Escape, capture-phase click-away, outside-scroll and the containing-block
     correction all come from the hook — see its header for what each defends
     against. */
  const popover = usePopover({ placement: 'bottom-end' });
  const { close: closePopover, open, panelRef, panelStyle, surfaceProps, toggle, triggerRef } = popover;

  const close = () => closePopover();

  /*
    ⚠ THE RESET HANGS OFF `open`, NOT OFF THE CLOSE BUTTON — found by driving it
    (founder law 6). `usePopover` owns four of the five ways this panel closes:
    Escape, capture-phase click-away, outside scroll, and a second click on the
    trigger. All four call the hook's own setter, so a reset written into a local
    `close()` runs on exactly ONE of them.

    What that looked like in the app: type half a bug report, press Escape, open
    the menu again — and you are staring at the half-typed form instead of the
    menu. The previous version reset on Escape because it owned the key handler
    itself; centralising the discipline in the hook quietly took that away, which
    is a change to what the menu DOES and 00b forbids exactly that.
  */
  useEffect(() => {
    if (open) return;
    setMode(null);
    setDescription('');
  }, [open]);

  const submitMutation = trpc.bugReports.submit.useMutation({
    onSuccess: () => {
      toast.success(mode === 'bug' ? 'Bug report submitted. Thank you!' : 'Feedback submitted. Thank you!');
      close();
    },
    onError: (err) => {
      logRawFailure('bugReports.submit', err);
      toast.error(readableFailure(err, 'Failed to submit. Please try again.'));
    },
  });

  const handleSubmit = () => {
    if (!mode) return;
    if (description.trim().length < 10) {
      toast.error('Please describe it in at least 10 characters.');
      return;
    }
    submitMutation.mutate({
      description: description.trim(),
      category: FORM_COPY[mode].category,
      page: window.location.pathname,
    });
  };

  return (
    <div className="hidden md:block">
      <button
        ref={triggerRef}
        onClick={() => (open ? close() : toggle())}
        type="button"
        className="dp-iconbtn"
        aria-label="Help and preferences"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Help and preferences"
        {...surfaceProps}
      >
        <MoreHorizontal size={15} strokeWidth={1.8} />
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
            padding: mode ? 'var(--s-6)' : 'var(--s-2)',
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--borderCard)',
            background: 'var(--surface)',
            boxShadow: 'var(--shadowPop)',
          }}
        >
          {!mode ? (
            <>
              <MenuGroup label="HELP" />
              <MenuItem icon={MessageSquare} label="Send feedback" onClick={() => setMode('feedback')} />
              <MenuItem icon={Bug} label="Report a bug" onClick={() => setMode('bug')} />
              <StubItem icon={BookOpen} label="Documentation" />
              <StubItem icon={Keyboard} label="Keyboard shortcuts" />

              <MenuGroup label="PREFERENCES" />
              {/* The shell owns the live theme toggle; this row names the place
                  a preferences panel will live, and does not duplicate it. */}
              <StubItem icon={SunMoon} label="Theme" />
              <StubItem icon={Cookie} label="Cookie preferences" />
            </>
          ) : (
            <>
              <div className="flex items-center justify-between" style={{ marginBottom: 'var(--s-5)' }}>
                <span style={{ font: '500 12.5px var(--font-sans)', color: 'var(--ink)' }}>
                  {FORM_COPY[mode].title}
                </span>
                <button type="button" onClick={close} aria-label="Close" className="dp-iconbtn">
                  <X size={13} strokeWidth={1.8} />
                </button>
              </div>
              <textarea
                autoFocus
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={FORM_COPY[mode].placeholder}
                rows={4}
                className="w-full outline-none resize-none"
                style={{
                  padding: 'var(--s-4)',
                  borderRadius: 'var(--r-sm)',
                  font: '400 12.5px var(--font-sans)',
                  color: 'var(--ink)',
                  background: 'var(--fill)',
                  border: '1px solid var(--borderInput)',
                }}
              />
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
                className="flex items-center justify-center gap-1.5 w-full"
                style={{
                  marginTop: 'var(--s-3)',
                  padding: 'var(--s-3)',
                  borderRadius: 'var(--r-sm)',
                  background: 'var(--ink)',
                  color: 'var(--surface)',
                  font: '500 12.5px var(--font-sans)',
                  cursor: submitMutation.isPending ? 'wait' : 'pointer',
                }}
              >
                {submitMutation.isPending ? (
                  <Loader2 size={13} strokeWidth={1.8} className="animate-spin" />
                ) : (
                  <Send size={13} strokeWidth={1.8} />
                )}
                Send
              </button>
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
