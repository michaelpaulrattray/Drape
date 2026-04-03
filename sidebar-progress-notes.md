# Sidebar Progress Notes

## Phase 2 Status: In Progress
- AppSidebar renders correctly in collapsed state (48px) alongside lobby content
- Lobby content renders next to sidebar ("How would you like to start?" heading visible)
- Upload Your Own and Cast a Model cards are visible below the fold
- Login page is overlapping on scroll — this is because the auth redirect is happening
- The sidebar icons (Home, Cast, Style, Export) are visible and interactive
- StudioHeader still shows at top with logo, credits, avatar

## Key Issue Found
- The login page is showing because I'm not authenticated in this browser session
- The sidebar + lobby layout is working correctly when authenticated
- Need to verify with authenticated session (user will test)

## What's Working
1. Sidebar always visible on lobby (no more conditional hide)
2. Lobby content fills the space next to sidebar
3. Lobby changed from absolute overlay to flex child
