# Sidebar Progress Notes

## Phase 1 Status: Wired In
- AppSidebar is rendering in collapsed state (48px)
- Shows: toggle button, Home, Cast, Style (disabled), Export (disabled)
- Shows: user avatar at bottom
- StudioHeader still shows at top (has credits pill, bug report, avatar)
- The lobby content area is empty/blank — this is because the lobby only renders when `isLobby && transition.lobbyVisible`

## Issues to Fix
1. Lobby content not showing — the sidebar is always visible now but lobby content area is blank
2. StudioHeader still has redundant avatar/settings button — will be cleaned up in Phase 4
3. Need to verify expanded state works
