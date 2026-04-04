/**
 * AppLobby — Page wrapper for /app route.
 *
 * Handles auth guard and renders BoardLobby.
 */
import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl } from '@/const';
import { BoardLobby } from '@/features/boards/BoardLobby';

export default function AppLobby() {
  const { user, loading, logout } = useAuth();

  // Redirect to login if not authenticated
  if (!loading && !user) {
    window.location.href = getLoginUrl();
    return null;
  }

  // Show nothing while checking auth
  if (loading) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: '100vh', background: '#f8f7f4' }}
      />
    );
  }

  return <BoardLobby user={user} onLogout={logout} />;
}
