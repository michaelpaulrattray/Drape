/**
 * Lobby types — client-side views of the lobby.recentWork union.
 */
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '../../../../server/routers';

export type RecentWorkItem = inferRouterOutputs<AppRouter>['lobby']['recentWork'][number];
