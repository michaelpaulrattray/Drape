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
 * What did NOT change is the information architecture — the views, the account
 * card's contents and the modals are as they were.
 */
import type { ReactElement } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl } from '@/const';
import type { RailDestinationId } from '@/foundation';
import { AppChrome } from '@/components/AppChrome';
import { HomeView } from '@/features/lobby/HomeView';
import { BoardsView } from '@/features/lobby/BoardsView';
import { LibraryView } from '@/features/lobby/LibraryView';

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

  const LOBBY_VIEWS: Record<
    string,
    { view: ReactElement; crumb: string; rail: RailDestinationId }
  > = {
    '/app/boards': { view: <BoardsView />, crumb: 'Canvas', rail: 'canvas' },
    '/app/models': { view: <LibraryView kind="models" />, crumb: 'Library / Models', rail: 'library' },
    '/app/garments': {
      view: <LibraryView kind="garments" />,
      crumb: 'Library / Garments',
      rail: 'library',
    },
    '/app/looks': { view: <LibraryView kind="looks" />, crumb: 'Library / Looks', rail: 'library' },
  };
  const current = LOBBY_VIEWS[location] ?? {
    view: <HomeView />,
    crumb: 'Home',
    rail: 'home' as RailDestinationId,
  };

  return (
    <AppChrome breadcrumb={current.crumb} current={current.rail} width="bare">
      {current.view}
    </AppChrome>
  );
}
