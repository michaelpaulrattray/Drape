/**
 * AppLobby — the /app lobby: auth guard and the routed view.
 *
 * M2 moved the chrome to the shared foundation shell (plan §D.4, §D.14): the
 * 76px rail and 56px topbar replace the old 216px text rail and the mobile
 * header, so the lobby and Casting V2 now navigate identically and both
 * follow the theme. All five lobby URLs render this same component, so the
 * shell never remounts between them.
 *
 * #278 took the chrome one step further out. This page used to be the ONLY
 * place that composed the topbar cluster, the account menu and the account
 * modals, which is why every casting page had none of them. That composition
 * now lives in `components/AppChrome.tsx` and every in-app page mounts it, so
 * what is left here is the auth guard and which view the URL selects — the
 * page's content and nothing else.
 *
 * #302 changed the information architecture for the first time since: all
 * three views are STUBS while the founder redesigns them. His words, 2026-08-30:
 * *"clean up Home and Library, and make the Canvas page a blank slate as well —
 * we'll be redesigning all of these from scratch later."*
 *
 * ⚠ **The five URLs still resolve.** A stubbed page is still a place — the rail
 * keeps all eight destinations, and `/app/models`, `/app/garments` and
 * `/app/looks` render the Library stub rather than 404ing.
 *
 * ⚠ **`HomeView`, `LibraryView` and `BoardsView` are UNMOUNTED, not deleted,
 * and neither is anything on the server.** His instruction was to unhook, and
 * the endpoints behind them are not dead code: `wardrobe.model.listMinted` and
 * `wardrobe.garments.list` still serve the wardrobe workspace and the legacy
 * studio. Removing any of it is N8's retirement job, not this card's.
 */
import type { ReactElement } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl } from '@/const';
import type { RailDestinationId } from '@/foundation';
import { AppChrome } from '@/components/AppChrome';
import { LobbyStub } from '@/features/lobby/LobbyStub';

/*
  MobileHeader retired at M2. Below 720px the foundation rail collapses to
  icons but keeps every destination and the account chip, so the slim header
  (logo + log out) no longer covered anything the rail does not.
*/

export default function AppLobby() {
  const { user, loading } = useAuth();
  const [location] = useLocation();

  // Redirect to login if not authenticated
  if (!loading && !user) {
    window.location.href = getLoginUrl();
    return null;
  }

  // Show nothing while checking auth
  if (loading) {
    return <div style={{ height: '100vh', background: 'var(--surface)' }} />;
  }

  /*
    The Library stub is one page behind three URLs. The old view took a `kind`
    and drew a different list per URL; there is no list now, so the three read
    identically and the breadcrumb drops its second segment — a crumb saying
    "Library / Garments" over a page that names neither would be the stub
    claiming a capability, which is the one thing it may not do.
  */
  const LIBRARY: { view: ReactElement; crumb: string; rail: RailDestinationId } = {
    view: (
      <LobbyStub
        title="Library"
        note="The old library is retired. Your casts live in Casting Studio, on the rail."
      />
    ),
    crumb: 'Library',
    rail: 'library',
  };

  const LOBBY_VIEWS: Record<
    string,
    { view: ReactElement; crumb: string; rail: RailDestinationId }
  > = {
    '/app/boards': {
      view: (
        <LobbyStub
          title="Canvas"
          note="This is the list page only. Canvases themselves are untouched and still open at their own address."
        />
      ),
      crumb: 'Canvas',
      rail: 'canvas',
    },
    '/app/models': LIBRARY,
    '/app/garments': LIBRARY,
    '/app/looks': LIBRARY,
  };
  const current = LOBBY_VIEWS[location] ?? {
    view: (
      <LobbyStub
        title="Home"
        note="Nothing has been removed. Casting, Canvas and your account are all reachable from the rail."
      />
    ),
    crumb: 'Home',
    rail: 'home' as RailDestinationId,
  };

  return (
    <AppChrome breadcrumb={current.crumb} current={current.rail} width="bare">
      {current.view}
    </AppChrome>
  );
}
