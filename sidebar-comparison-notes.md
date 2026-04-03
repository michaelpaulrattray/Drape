# Sidebar Comparison Notes (from screenshot)

## Our current sidebar (top half of screenshot):
- Logo "drape BETA" in header bar, sidebar starts below header
- Sidebar has: Home (highlighted blue), TOOLS section (Cast, Style, Export), ADMIN section (Overview, Moderator)
- Sidebar is narrower than ElevenLabs
- Header is separate from sidebar (sidebar doesn't extend into header)

## ElevenLabs sidebar (bottom half of screenshot):
- Logo "ElevenLabs" is INSIDE the sidebar at the top
- Below logo: workspace selector "ElevenCreative" with dropdown
- Main nav: Home, Voices (+), Studio (highlighted), Flows (New badge), Files
- "Pinned" section label: Text to Speech, Sound Effects, Image & Video, Voice Isolator, Voice Changer, Music, Speech to Text
- "More tools" expandable
- Bottom: "Invite team members" card + "Developers" link
- Sidebar extends full height of viewport
- No separate header bar above the sidebar
- The top bar only shows "Studio" breadcrumb + right-side actions (Feedback, Docs, Ask, etc.)
- Wider sidebar overall (~240px expanded)

## Key differences to implement:
1. Sidebar must extend full height - no header above it
2. Logo goes inside sidebar top
3. Wider: ~56px collapsed, ~240px expanded
4. Section labels: "TOOLS" and "ADMIN" (like their "Pinned")
5. Active item has subtle highlight background (not heavy blue)
6. Toggle button more refined
7. Header only shows on the content side (right of sidebar)
