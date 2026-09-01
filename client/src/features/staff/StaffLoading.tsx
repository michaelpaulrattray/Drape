/**
 * The staff pages' auth-loading state.
 *
 * All nine pages drew this identically — `min-h-screen bg-[#EBEBEB]` around a
 * Tailwind spinner with a `border-[#0A0A0A]` — which is nine copies of a page
 * background this brief is taking away from them, in a colour that would be
 * wrong in the dark theme.
 *
 * ⚠ **It deliberately does NOT render the staff bar.** At this moment the
 * role has not come back yet, so which bar (or whether the reader may see one
 * at all) is not known. Drawing ADMIN over a screen that is about to redirect
 * a customer to the lobby would be the frame claiming something the server has
 * not said.
 */
export function StaffLoading() {
  return (
    <div className="dp-staff dp-staff--loading">
      <span className="dp-staff__spinner" aria-label="Loading" role="status" />
    </div>
  );
}
