/**
 * LobbyStub — the one shape Home, Library and Canvas hold while they are
 * redesigned (#302).
 *
 * # Why the pages are stubs at all
 *
 * Founder-ordered, 2026-08-30, verbatim: *"clean up Home and Library, and make
 * the Canvas page a blank slate as well — we'll be redesigning all of these
 * from scratch later. You can stub Home and Library out until they're designed.
 * The current Library functionality is obsolete and needs to be unhooked, along
 * with anything that currently hooks into Home."*
 *
 * # An honest stub, which is a narrow thing
 *
 * His own standing rule (`PROGRAM.md`, the placeholder amendment): *a stub
 * names a place, never a capability, and never carries an unread dot.* So this
 * component may say WHERE you are and that it is being rebuilt, and it may say
 * where a capability moved to — and it draws **no controls at all**. A button
 * that does nothing is the exact thing the rule forbids, and an empty page with
 * no words is the other failure: it reads as broken rather than as unbuilt.
 *
 * # Why it is here and not in `foundation/`
 *
 * His rule of 2026-08-30: *"two real consumers in the codebase, or it waits."*
 * This has three, and all three are lobby pages — it is not chrome, and nothing
 * outside the lobby has any use for it. It moves to the foundation on the day a
 * surface outside `features/lobby/` needs it, and not before.
 *
 * # ⚠ The type is the FOUNDATION's, not the retired page's
 *
 * The first draft of this file quoted `HomeView`'s own title — `fontWeight:
 * 700`, `clamp(24px, 4vw, 32px)` — because sitting the stub exactly where the
 * page sat looked like the careful choice. It is the opposite. The foundation
 * README states *"weights 400 and 500 only; 600 exists in the webfont and is
 * never used"*, and his redesign pack answers the temptation by name:
 * *"Existing does not mean finished … a section that touches a working feature
 * is still expected to bring it onto the grammar."* The pages being replaced
 * here are, in his words, *"placeholders that accumulated, not decisions"* — so
 * quoting their type is quoting a non-decision, twice as odd on the very
 * component whose job is to say the old page is gone.
 *
 * Every value below therefore comes from a foundation class: `.dp-headline`
 * (500 31px), `.dp-body` (400 13px/1.65, capped 520px) and the `--s-*` scale.
 * Nothing here sets a size, a weight or a colour of its own.
 */

/** One stubbed lobby page: the place named, one line of why, one line of where. */
export function LobbyStub({
  title,
  note,
}: {
  /** The destination's own name, as the rail says it. */
  title: string;
  /** Where the capability went, or what is untouched. Plain sentence, no link. */
  note: string;
}) {
  return (
    <div
      className="px-6 sm:px-12 xl:px-16 pt-8 sm:pt-12 pb-16"
      style={{ maxWidth: 1500, width: '100%', margin: '0 auto' }}
    >
      <h1 className="dp-headline">{title}</h1>

      <p className="dp-body" style={{ marginTop: 'var(--s-4)' }}>
        Being redesigned.
      </p>

      <p
        className="dp-body"
        style={{
          borderTop: '1px solid var(--border)',
          marginTop: 'var(--s-11)',
          paddingTop: 'var(--s-9)',
          color: 'var(--meta)',
        }}
      >
        {note}
      </p>
    </div>
  );
}
