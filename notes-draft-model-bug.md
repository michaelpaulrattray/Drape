# Draft Model Bug Investigation — Final

## Bug 1: Draft model appears in MY MODELS
**Root cause:** `castingImaging.ts` line 128 sets `status: "active"` immediately after generating a headshot.
**Fix:** Remove that line. The minting step in `castingExport.ts` already handles `draft → active` correctly.

## Bug 2: Casting sessions don't appear in Recent Sessions
**Root cause:** `getRecentUserSessions` queries `wardrobeSessions` table — these are WARDROBE sessions only. 
The casting tool doesn't create wardrobe sessions. A wardrobe session is only created when the user enters the wardrobe tool with a model.

So if a user:
1. Opens casting
2. Fills out the form
3. Generates a headshot
4. Exits without going to wardrobe

...there's no wardrobe session to show in Recent Sessions.

The "Recent Sessions" section is wardrobe-only by design. But the user expects to see their casting draft there too.

**Two approaches:**
A. Add a "Recent Casts" / "Draft Casts" section to the lobby that queries draft models with assets
B. Create a wardrobe session automatically when a cast generates its first asset, so it appears in Recent Sessions

Option A is cleaner — casting drafts are a different concept from wardrobe sessions. Mixing them could cause confusion.
Option B would require creating a wardrobe session with a modelImageUrl from the headshot, which doesn't make sense since the headshot isn't a full-body image suitable for wardrobe.

Actually the simplest fix: show draft models (with headshots) in the lobby as "Draft Casts" with a "Resume" button that takes them back to the casting tool.
