- [x] Fix Wardrobe accessibility bug: viewType mismatch ('fullBody'→'frontFull', 'sideProfile'→'sideClose') in DrapeStudio sync effect
- [x] Improve LoadingOverlay contrast: increase scan line and tip text opacity against #f0ebe3 background
- [x] Add pulse animation to Wardrobe icon in ToolRail when hasFullBody becomes true
- [x] Fix Wardrobe tools not auto-hiding on mouse-off (should match Casting's hover behavior via shared StudioCanvas)
- [x] Fix: Wardrobe shows "No model on canvas" after switching from Casting with full body — model URL not passing through
- [x] Add contextual next-step chip in casting shortcuts bar (Next → Full Body, Dress this model →, Export Identity →)
- [x] Implement CastModelModal — gate Wardrobe access behind identity save (auto-generate missing side view + mint model)
- [x] Wire CastModelModal into ToolRail click handler and DrapeStudio orchestration
- [x] Add Wardrobe image download button for saving dressed model images
- [x] Fix: Cast modal re-appears when switching back to Casting after already minting
- [x] Implement read-only Casting mode after mint (disable refine/retry/regenerate, allow side view gen + export)
- [x] Make side view generation optional in CastModelModal (recommended but not required)
- [x] Persist minted state across page refresh (load model assets from DB on page load)
- [x] Add "New Model" escape button in read-only Casting mode
- [x] Add generic studio.getLastSession server endpoint (queries wardrobe_sessions, future-proof for scenery etc.)
- [x] Add DB helper getLatestUserSession in server/db/wardrobe.ts
- [x] Build ContinueSessionCard component for StudioLobby
- [x] Wire ContinueSessionCard into StudioLobby with restore logic
- [ ] Future: "Projects" feature — multi-model session switching (post-launch)
- [x] Fix #1: VTO history wipe on session resume — useModelSetup clears history when modelImageUrl changes
- [x] Fix #2: Missing masterPrompt in casting generation store on session restore
- [x] Fix #3: ensureSession double-creation race — add mutex ref
- [x] Fix #4: No isGenerating guard on generateVTO/generateIncremental — add early return
- [x] Fix #5: overlayCache and selectionSnapshots not pruned/shifted on history truncation
- [x] Fix #6: isGenerating is local state — move to Zustand store for cross-remount persistence
- [x] Fix #7: DecompositionDrawer URL.createObjectURL never revoked
- [x] Remove destructive reset modal from Casting icon click — switch directly to read-only Casting Studio
- [x] Handle uploaded model state in Casting — show "not cast" message with Cast New Model CTA
- [x] Move reset confirmation to "New Model" button inside Casting read-only footer
- [x] Fix: Gallery-loaded models show empty "Ready to Cast" in Casting overview — hydrate casting generation store with model assets from DB
- [x] Audit and unify panel designs between Casting and Wardrobe (widths, rounded edges, spacing)
- [x] Decide on shared StudioSidePanel shell component — used by both Casting and Wardrobe
- [x] Fix 1: Accumulate style notes from overlay clicks in store before calling refineResult
- [x] Fix 2: Replace LayersPanel textarea with parsed chips + freeform tags (SOT pattern: toggleChip, removeFreeform, addCustom, edit count badge)
- [x] Intercept full_look slot upload to open DecompositionDrawer instead of normal upload
- [x] Add pendingDecomposeFile to useWardrobeStore
- [x] Auto-analyze pendingDecomposeFile when DecompositionDrawer opens
- [x] Add 'Keep as Full Look' button in DecompositionDrawer
- [x] Nice-to-have: Smart decomposition for non-full-look uploads — upload to S3, detect garments, open drawer if >2 matching items found in target category
- [x] Disable generate button when any selected garment has status 'processing' — add hasProcessingSelected guard + visual disable
- [x] Replace generic toolbar status text with contextual garment slot summary (e.g. 'Top + Bottoms · v3')
- [x] Remove rate limit text and status dot lights from toolbar — too clunky/breaks immersion
- [x] Improve default state text (not just 'Wardrobe'/'Casting' — user already knows the tool)
- [x] Show garment short names when 1-2 items selected (e.g. 'White Tee + Dark Jeans · v2')
- [x] Add fade/slide transition animation when toolbar status text changes
- [x] Apply same contextual status pattern to Casting Studio toolbar
- [x] Add checkImageQuality to garment upload pipeline — run in parallel with detect, persist qualityIssues to DB
- [x] Show toast warning when garment upload completes with quality issues
- [x] Show quality warning badge/icon on garment card in rack panel
- [x] Bug: Session restore missing overlay — auto-scan VTO result overlay after session resume
- [x] Bug: Casting shows 'This model was uploaded' for saved/minted models — should distinguish source
- [x] Bug: Session restore missing tattooMap — persist and restore tattoo data across sessions
- [x] Audit: check for any other missing state in session restore flow
- [x] Critical Bug: Casting new model after session restore doesn't update Wardrobe's model — Wardrobe still shows old restored model
- [x] Bug: Restored session from saved cast model shows 'uploaded' in Casting (pre-fix sessions)
- [x] Persist styleNotes across session restore — prevent style instructions from being lost
- [ ] Persist Gemini chat context across session restore — prevent model drift on refinements
- [x] Clean up draft models from DB — verified only Janet and Dumb exist (no cleanup needed)
- [x] Fix lobby loading experience — lifted queries to StudioLobby, coordinated skeleton → reveal animation
- [x] Fix janky image loading when switching from Wardrobe to Casting — preload casting asset URLs before panel reveal
- [x] Bug: Infinite re-render loop in DrapeStudio — stabilized Zustand selector with useMemo
- [x] Casting panel transitions don't feel as smooth as Wardrobe — removed center opacity/scale gate, preloader now cache-warms only
- [x] Add client-side guard to skip analyzeTattoos/checkQuality when model URL hasn't changed since last successful call
- [x] Remove lobby confirmation modal — make lobby navigation frictionless (session auto-saves)
- [x] Add subtle note on lobby about session replacement when starting new
- [x] Backend: add getRecentSessions query returning up to 4 sessions with VTO history
- [x] Backend: cap sessions at 4 per user — delete oldest when creating 5th
- [x] Frontend: replace single ContinueSessionCard with multi-session horizontal scroll
- [x] Update StudioLobby to use new multi-session endpoint and pass array to component
- [x] Update bottom hint text (remove "replace" wording since sessions now persist)
- [x] Bug: Multi-session lobby — fixed modelId source (use canvas.castModelId not casting store), reset casting store on model load/resume, fixed corrupted session 90003
- [x] Bug: Lobby still shows only 1 session card — fixed: getRecent query was never invalidated after session create/VTO generation (only `list` was)
- [x] Bug: Multi-session cards hidden behind horizontal scroll — rewrote layout as vertical stack (featured + compact rows)
- [x] Bug: Rate-limit error toast showing for background mutations — suppressed TOO_MANY_REQUESTS in global mutation error handler
- [x] Add delete button to each session card on the lobby to remove old/unwanted sessions
- [x] Bug: Clicking 'Cast a Model' from lobby loads stale session — now resets casting, wardrobe, and canvas state before entering casting
- [x] Fix: Delete X button on compact session cards overlaps the Resume button — moved to top-left over thumbnail
- [x] Bug: Decomp modal image cutoff — full-body image is cropped, legs are missing
- [x] Bug: Slow garment import — importing selected garments from decomp takes too long
- [x] UX: Improve wardrobe item loading — garment cards feel janky/delayed when appearing
- [ ] UX: Adjust garment digitization prompt background color to match rack card (#f0ebe3) for visual cohesion
- [x] Build useExportPack hook — wraps PDF generation, image download, and mint logic
- [x] Build ExportPanel component — model card, view gallery, PDF download, mint status
- [x] Wire ExportPanel into DrapeStudio replacing the "Coming soon" placeholder
- [x] Write tests for export pack feature
- [x] Add wardrobe_looks DB table (id, userId, sessionId, modelId, imageUrl, name, garmentIds, createdAt)
- [x] Add DB helpers for looks CRUD (saveLook, getUserLooks, deleteLook, renameLook)
- [x] Add backend endpoints: looks.save, looks.list, looks.delete, looks.rename
- [x] Add "Save Look" button in wardrobe viewer (near existing download button)
- [x] Extend ExportPanel with LOOKS gallery section (query by modelId)
- [x] Extend useExportPack to include saved looks in ZIP under LOOKS/ subfolder
- [x] Update center preview to show latest saved look as hero when looks exist
- [x] Write tests for looks feature
- [x] Bug: Export button in ToolRail is disabled/unclickable when in Wardrobe mode
- [x] Deduplicate recent sessions in lobby by modelId — show only the latest session per model
- [x] UX: Always return to lobby when navigating back to studio from profile/dashboard
- [x] UI: Change 'Minted' label to 'Casted' in export panel
- [x] UI: Cleaner/less cramped identity attributes layout in export panel
- [x] Data: Session look count should reflect saved gallery looks, not VTO history iterations
- [x] Bug: Studio still restores last tool (e.g. export) instead of lobby when navigating from dashboard
- [x] Bug 1: toGarmentForVTO sends wrong image — should prefer isolatedImageUrl over originalImageUrl
- [x] Bug 2: Decompose import passes full outfit photo to digitizer instead of crop — need cropUrl pipeline
- [x] Bug 3: VTO service image fallback chain is backwards — should prefer isolated over raw
- [x] Add subtle visibility hint to decomposed garments — extend detection with visibility score, show QualityBadge-style indicator for partially hidden items
- [x] Add "Reset Look" button in LayersPanel + keyboard shortcut (R) in wardrobe — clears VTO history, selection, style notes, reverts canvas to original model
- [x] Audit and fix keyboard shortcuts across casting and wardrobe — Ctrl+G reported broken in casting
- [x] Remove R keyboard shortcut for Reset Look — too easy to hit accidentally
- [x] Clean up shortcuts bar — remove "Reset Look" hint, it was too long and looked odd
- [x] Move Reset Look button below Dress/Update Look as a secondary text link
- [x] Increase garment card thumbnail size (32→48px) and text size in LayersPanel
- [x] Move "Keep" (save to gallery) to canvas overlay — Camera icon, right side, hover-reveal, tooltip "Shoot Look"
- [x] Add subtle camera shutter flash effect when tapping "Shoot Look" on canvas
- [x] Prevent duplicate saves — visually disable Camera button after save, re-enable on new VTO result
- [x] Match Camera icon button styling to Casting's ToolButton pattern for visual consistency
- [x] Bug: Draft casting sessions prematurely create model records in MY MODELS — headshot-only drafts appear as saved models before user completes the cast
- [x] Bug: Casting sessions with generated headshots don't appear in Recent Sessions after exiting — user loses access to paid content
- [x] Fix existing draft model in DB — revert status from 'active' to 'draft' for the headshot-only model
- [x] Add server-side models.delete procedure with cascade (delete assets, sessions, looks)
- [x] Add delete button (X on hover) to ModelGallery cards with confirmation dialog
- [x] Add delete button to DraftCastsRow cards with confirmation dialog
- [x] Bug: Resuming a draft cast from lobby enters read-only casting mode — should be editable since model is not minted
- [x] Cap Draft Casts display to 3 most recent in lobby — preserve all drafts in DB, no auto-deletion of paid content
- [x] Bug: Duplicate save to gallery possible after session resume — lastSavedUrlRef resets on re-mount, needs server-side tracking
- [x] Bug: Camera icon active state (black button + green tick) is jarring — replace with subtle checkmark animation that fades back to camera icon
- [x] Bug: Nested button HTML error on /studio page — button inside button causing React DOM validation warning
- [x] Increase garment card thumbnail and text size in LayersPanel — still too small and hard to read
- [x] Standardize delete buttons across all lobby components — inconsistent styles between ModelGallery, DraftCastsRow, ContinueSessionCard, SavedOutfitCard
- [x] Refine delete buttons: use Trash2 icon instead of X, no red hover (breaks immersion)
- [x] Move compact session card delete button inline before Resume (currently overlapping)
- [x] Reduce MY MODELS delete button size slightly (24→20px)
- [x] Bug: Nested button error — DeleteOverlayButton renders <button> inside parent <button> elements (FeaturedCard, CompactCard)
- [x] Bug: Resuming draft cast from lobby has noticeable delay — should feel instantaneous like Recent Sessions and My Models
- [x] Bug: Disabled tools in ToolRail show not-allowed cursor (red circle with line) — breaks immersion, should use default cursor
- [x] Add subtle unlock glow animation to ToolRail when tools become available (e.g. after casting)
- [~] Match garment digitization prompt background to rack card color (#f0ebe3) — declined by user
- [x] Remove Resume buttons from compact session cards — clicking the card itself navigates, button is redundant
- [x] Move trash icon to end of compact session card — more room now that Resume button is removed
- [x] Fix draft cast Resume button hover state — no visual feedback on hover
- [x] Remove "Load Model" hover overlay text from MY MODELS cards — click behavior is implied
- [x] Bug: Delete operations (sessions, models, drafts) have noticeable UI delay — should feel instant with optimistic updates
- [x] Add visual layer hierarchy to LayersPanel — inner/outer garment nesting with tree-line connectors
- [x] Issue #14: Investigate refine missing allGarmentIds + tattooMap in useWardrobeGeneration.ts
- [x] Issue #16: Investigate changedSlots hardcoded empty in incremental/applyStyleChanges in useWardrobeGeneration.ts
- [x] Fix all download/save buttons across studio to trigger direct file downloads instead of navigating to URL strings
- [x] Bug: Export panel individual image download shows "Failed to download image" toast — CORS fix via server proxy
- [x] Bug: vto.incremental route doesn't persist results to DB session — incremental garment swaps lost on resume
- [x] Bug: vto.refine route doesn't persist results to DB session — refinements lost on resume
- [x] Add styleNotes to sessions.update input schema for independent persistence
- [x] Bug: useSessionRestore missing technicalSchema + preferences — Spec tab empty and ControlPanel shows defaults after page refresh
- [x] Bug: Gallery model load (MY MODELS) doesn't hydrate casting generation store — Spec tab shows null when switching to Casting after loading a minted model
- [x] Rename localStorage key from formastudio_active_session to drape_active_session
- [x] Homepage redesign: Replace current multi-section landing page with hero-only page
- [x] Homepage redesign: Add liquid-glass CSS + Instrument Serif/Barlow/Geist fonts
- [x] Homepage redesign: New glassmorphism floating navbar
- [x] Homepage redesign: New HeroContent with headline, subtitle, email waitlist CTA
- [x] Homepage redesign: New PartnersBar with text-based brand names (Instrument Serif italic)
- [x] Homepage redesign: Mux video background with gradient fade
- [x] Homepage redesign: Powered by Gemini fixed badge
- [x] Homepage redesign: Remove unused sections (About, Blog, FAQ, Footer, Process, Services, WhyUs, Work)
- [x] Fix: Upload user's video to CDN and replace Mux video source
- [x] Fix: PartnersBar doesn't match reference design — needs liquid-glass pill container with exact styling
- [x] Fix: Powered by Gemini badge doesn't match reference — needs liquid-glass pill with Gemini sparkle icon
- [x] Fix: Match all component styling exactly to celestial-horizon reference
- [x] Fix: Proxy hero video through server route to bypass preview iframe URL safety check
- [ ] Pre-launch: Switch hero video back to direct CDN URL before publishing
- [x] Change navbar CTA from "Join Waitlist" to "Claim a Spot"
- [x] Replace text "drape" logo in navbar with user's logo image
- [x] Verify Klaviyo waitlist email integration is wired correctly — added newsletterSignup call to waitlist.join
- [x] Wire "Claim a Spot" navbar button to open a beta invite modal with compelling copy and email capture
- [x] Replace hero background video with new higher-quality version, optimized for fast loading with SEO-friendly filename
- [x] Add subtle "Log in" link in navbar for beta users, positioned before "Claim a Spot"
- [x] Update PartnersBar: change label to "Built for teams on" and names to Shopify, Instagram, Meta, TikTok, Pinterest
- [x] Simplify /login page default view: show "I have an access code" / "I already have an account" as landing state instead of waitlist
- [x] Change homepage "Log in" navbar link to redirect to /login instead of Manus OAuth portal
- [ ] Future: Replace Manus OAuth with direct Google OAuth + email/password auth system
- [x] Add view transition animations (fade/slide) between login page views (choose, code, oauth, waitlist, returning-user)
- [x] Auto-detect returning users via cookie/localStorage and skip to "Welcome back" sign-in view
- [x] Replace login page right panel (branded text) with full-height hero image
- [x] Audit and align login page styles with homepage (logo, nav, card styling, colors, typography consistency)
- [x] Add smooth page transition animation between homepage and login page (shared layout with AnimatePresence)
- [x] Update homepage platform section copy from "Built for teams on" to "Where the best campaigns begin"
- [x] Add "See it in action" button to hero → cinematic auto-play video modal (placeholder video for now)
- [x] Move "See it in action" button inline with Join Waitlist CTA (primary/secondary pair on same row)
- [x] Strip homepage nav to just "Log In" and "Claim a Spot" — remove Product, Pricing, About links
- [x] Verify Klaviyo waitlist integration sends emails and names correctly (both hero input and Claim a Spot modal)
- [x] Fix Klaviyo integration to pass name (first_name) along with email from waitlist signups
- [x] AUTH MIGRATION: Audit current Manus OAuth system — map all files, flows, dependencies
- [x] AUTH MIGRATION: Design new auth schema (email/password + Google OAuth)
- [x] AUTH MIGRATION: Implement email/password registration + login backend
- [x] AUTH MIGRATION: Implement Google OAuth direct integration
- [x] AUTH MIGRATION: Update Login.tsx UI to use new auth endpoints
- [ ] AUTH MIGRATION: Test all auth flows end-to-end
- [x] AUTH MIGRATION: Configure Google OAuth credentials (GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET)
- [x] AUTH MIGRATION: Write vitest tests for email auth routes (register + login)
- [x] AUTH MIGRATION: Write vitest tests for Google OAuth routes (initiate + callback)
- [x] Bug: upsertUser silently drops passwordHash and authProvider fields — add handling for both
- [x] Email Verification: Add emailVerified + verificationToken fields to schema
- [x] Email Verification: Implement server-side email sending via Resend
- [x] Email Verification: Create verify-email endpoint with auto-login
- [x] Email Verification: Update email auth register to send verification email
- [x] Email Verification: Update email auth login to block unverified users
- [x] Email Verification: Build "Check Your Email" client page with resend
- [x] Email Verification: Write vitest tests for verification flow
- [x] Email Verification: Upgrade email template to match Drape brand aesthetic
- [x] AUTH CLEANUP: Audit and remove all remaining Manus OAuth references (getLoginUrl, sdk.exchangeToken, OAuth callback)
- [x] Studio Canvas: Widen both left and right side panels from 280/260px to 320px
- [x] Studio Canvas: Change canvas background from cream to white with subtle dot grid pattern
- [x] Studio Panels: Change panel backgrounds to #F4F4F5
- [x] Bug: Background layer visible behind studio panel slide-outs (was #f0ebe3 cream on DrapeStudio wrapper)
- [x] Studio Panels: Migrate all warm beige colors to cool zinc neutral palette (ElevenLabs-inspired)
- [x] Casting Tool: Increase preview thumbnail sizes from 56×70 to 72×90
- [x] Studio Panels: Increase text sizes and darken grey text colors for better readability
- [x] Studio Panels: Add visual separation (border/shadow) between side panels and white canvas
- [x] Bug: Left panel shadow not applying correctly — right panel shadow looks good
- [x] Studio Panels: Warm up palette from cool zinc to warm stone tones (align with homepage editorial aesthetic)
- [x] Studio Canvas: Warm up canvas background from pure #ffffff to subtle warm tone with faint dot grid
- [x] ToolRail: Make icons bolder/thicker so they stand out more
- [x] Wardrobe: Rename "Btms" category label to "Legs"
- [x] Wardrobe: Add shadow/border to unselected garment cards for definition
- [x] StudioHeader: Make the studio name text bolder to match icon weight
- [x] StudioHeader: Replace tool-specific text label with Drape logo (consistent across all tools)
- [x] ToolRail: Shorten tooltips from "Casting Studio" to "Cast", "Wardrobe Studio" to "Style", etc.
- [x] StudioHeader: Add "Beta Access" badge next to Drape logo
- [x] StudioHeader: Increase header height and enlarge logo to avoid pixelation
- [x] Casting Panels: Overhaul button borders, colors, and component styling for better visual clarity
- [x] Image Overlay: Add action icons (download, copy, triple-dot menu) to all tool images — top-right corner
- [x] Image Overlay: Add heart/like icon on wardrobe and export images only (not casting)
- [x] Image Overlay: Remove top middle bar ("Headshot · final" etc), move undo/redo to image overlay
- [x] Image Overlay: Convert keyboard shortcut labels and view labels to overlay pills on image
- [x] Image Overlay: Preserve all existing overlays (chat bubbles, badges, surgical tools)
- [x] Fix: Move next-step chip (Side View/Export) onto the image bottom-right instead of below
- [x] Fix: Switch ImageActionBar + undo/redo from dark frosted glass to white frosted glass (match surgical tools)
- [x] Fix: Triple-dot menu sometimes doesn't open — make it toggle (click to open/close)
- [x] Fix: Triple-dot menu opens to the left — should open to the right
- [x] Fix: Download button doesn't work — needs server proxy for CORS
- [x] Fix: Copy button doesn't work — needs server proxy for CORS
- [x] Move NextStepChip to bottom-right of image as overlay
- [x] Fix triple-dot menu toggle (click to open/close)
- [x] Fix download button via server proxy
- [x] Fix copy button via server proxy
- [x] Change undo/redo pill from dark to white frosted glass
- [x] Bug: Triple-dot menu still doesn't close on re-click — fixed with toggleRef exclusion in outside-click handler
- [x] Bug: Bottom overlay (refine panel + tip) shifted down off image — fixed by removing h-full from hover container
- [x] Bug: Quick Ideas suggestions not appearing — no code change needed, suggestions only appear after first generation/refinement
- [x] Redesign NextStepChip as dark floating badge with animated arrow (Option C)
- [x] Bug: Triple-dot menu shows empty/nothing on locked casts — hide triple-dot when menu would be empty
- [x] Bug: Surgical tool icons have no hover state — added scale, shadow lift, and color change on hover
- [x] Wire heart icon in wardrobe to save/unsave result image to export gallery (pipeline was already built, icon visibility fixed)
- [x] Bug: Heart icon not appearing in wardrobe ImageActionBar — was hidden when onLike=undefined (disabled state), now always renders when showHeart=true
- [x] Apply hero serif italic accent font (Instrument Serif) to studio empty state headings for brand consistency
- [x] Bug: Contextual tip text floating too high above refine chatbox — moved from absolute bottom-32 to flow layout inside bottom controls container
- [x] Bug: Undo/redo pill visible when there's no edit history — added (canUndo || canRedo) guard to hide pill until first edit
- [x] Bug: Undo/redo pill on initial model view — fixed duplicate pushHistory in 4 restore flows (DrapeStudio x2, StudioLobby, useSessionPersistence) by using setHistory+setHistoryIndex instead
- [x] Bug: Starting a new cast doesn't reset form preferences — added resetForm() to onSelectCasting in DrapeStudio + all 5 reset paths in useSessionReset
- [x] Bug: Saved cast shows default identity — added preferences re-hydration to DrapeStudio modelAssetsQuery useEffect (was missing after resetForm was added)
- [x] Remove edit log section from casting right side panel (MasterPromptPanel)
- [x] Bug: Undo history lost when resuming a draft — added buildHistoryFromAssets utility to reconstruct history stack from DB assets across all 4 restore paths
- [x] Bug: View count shows incorrect number — changed viewCount from currentAssets.length to unique viewTypes count
- [x] Bug: Lobby draft cast view count still showing total asset rows — fixed getDraftModels server query to count unique viewTypes instead of all rows
- [x] Auto-dismiss contextual tip after user's first refinement, with localStorage persistence
- [x] Phase 1: Build AppSidebar component with expand/collapse (ElevenLabs pattern)
- [x] Phase 1: Wire AppSidebar into DrapeStudio replacing ToolRail
- [x] Phase 2: Make sidebar always visible including lobby state
- [x] Phase 3: Absorb Dashboard into Studio, change login redirect to /studio
- [x] Phase 4: Make sidebar full-height (extend into header area, logo inside sidebar)
- [x] Phase 4: Widen collapsed (48→56px) and expanded (220→240px) sidebar
- [x] Phase 4: Polish sidebar icons, spacing, section labels (TOOLS, ADMIN)
- [x] Phase 4: Refine toggle button styling
- [x] Phase 4: Cleanup dead Dashboard code and unused imports
- [x] Widen sidebar: collapsed 56→64px, expanded 240→260px to match ElevenLabs proportions
- [x] Add premium sparkle icon next to breadcrumb text in StudioHeader
- [x] Remove credits pill from StudioHeader top bar
- [x] Redesign StudioHeader top bar: add Feedback, Docs, bell notifications dropdown like ElevenLabs
- [x] Keep bug report icon AND add polished text-based "Feedback" link
- [x] Add "Docs" text link (placeholder for future guides)
- [x] Add bell icon with news/updates dropdown panel
- [x] Fix studio lobby content width being too narrow — maxWidth 680→960
- [x] Remove category selection from bug report popout
- [x] Make Feedback its own separate report type (distinct from bug reports)
- [x] Wire "Feedback" header link to open a dedicated feedback popout
- [x] Polish sidebar icons: swap to more distinctive Lucide icons (ScanFace, Palette, PackageCheck, Compass)
- [x] Reduce icon stroke weight from 2.0 to 1.5 for lighter, more refined feel
- [x] Lighten active state: replace solid black bg with subtle tint (like hover), darken text color on selection
- [x] Increase sidebar logo size — bumped from 18px to 24px height
- [x] Bug: Sidebar highlight bleeds — fixed: root cause was glow detection useEffect firing on activeTool changes (not just canvas changes), causing false-positive "newly unlocked" glow on sibling tools for 4.5s. Removed activeTool from useEffect deps in both AppSidebar and ToolRail, using ref instead. Also removed CSS transitions from active state changes.
- [x] Remove /dashboard page and all traces — deleted Dashboard.tsx, removed import+route from App.tsx, renamed nav labels to Studio
- [x] Clean up unused DashboardLayout + DashboardLayoutSkeleton + AccountFrozenBanner + features/dashboard/ directory — all orphaned, deleted
- [x] Audit and remove legacy routes — deleted /casting-studio redirect + CastingStudioRedirect component, cleaned up Redirect import

## Canvas Board System — Phase 1
- [x] Step 1: Add boards + board_items tables to schema, push migration
- [x] Step 2: Server procedures (CRUD for boards + items) + vitest tests (all 1538 passing)
- [x] Step 3: Board lobby page (/app) — BoardLobby, BoardCard, AppLobby page, /app route wired
- [x] Step 4: Canvas engine (React Flow integration) — @xyflow/react installed, BoardItemNode + BoardCanvas built, zero TS errors
- [x] Step 5: Board page shell (/app/board/:id) — BoardPage + BoardHeader built, route wired, tool rail + canvas + right panel layout
- [x] Step 6: Wire casting tool into board
- [ ] Step 7: Wire wardrobe tool into board
- [ ] Step 8: Wire export into board
- [ ] Step 9: Board auto-save + resume
- [ ] Step 10: Polish + lobby toggle

### Step 6 Sub-tasks
- [x] Canvas dotted background (match old studio dot pattern)
- [x] BoardCanvas: forward onNodeDoubleClick event
- [x] BoardCastingPanel: right panel wrapping ControlPanel + generation hooks + board item insertion
- [x] Skeleton card on canvas when casting starts
- [x] Auto-insert model card on successful generation
- [x] ModelEditorOverlay: fullscreen overlay wrapping ImageViewerPanel for refinement on double-click
- [x] Wire BoardCastingPanel and ModelEditorOverlay into BoardPage
- [x] ControlPanel polish: grouped sections with subtle dividers
- [x] ControlPanel polish: inline field pairs (age+ethnicity, texture+finish)
- [x] ControlPanel polish: sticky generate button pinned to panel bottom
- [x] ControlPanel polish: softer field styling matching warm beige aesthetic

### Step 6 Bug Fixes
- [x] Bug: Model card not appearing on canvas after casting in board (no card during generation or after success)
- [x] Bug: Unwanted prompt dialog when loading into board canvas (asks to cast or style)

### Step 6 Bug Fixes (Round 2)
- [x] Bug: Dragging model cards on canvas feels janky/unsmooth
- [x] Bug: Double-click editor overlay UX needs to be a popout, not current implementation
- [x] Bug: Canvas background doesn't match original studio background

### Step 6 Bug Fixes (Round 3)
- [x] Bug: Canvas background still doesn't match old studio exactly
- [x] Bug: Double-click editor overlay shows empty 'ready to cast' instead of the casted image

### Step 6 Bug Fixes (Round 4)
- [x] Fix: Canvas background should match reference — subtle light cross-hatch dot grid, not bold dots
- [x] Fix: Empty canvas state should be minimal "+" button with "Click to add a node" text, not two-button overlay

### Step 6 Bug Fixes (Round 5)
- [x] Fix: Remove MiniMap from bottom-right corner of canvas
- [x] Fix: Canvas dots are invisible — increase size/contrast to match reference

### Step 6 Bug Fixes (Round 6)
- [x] Fix: Canvas dots still not visible — React Flow pane likely covering container background

### Step 6 Improvements (Round 7)
- [x] Fix: Canvas background too white/blinding — warm it up
- [x] Fix: Canvas dots too small — increase size
- [x] Feature: Add node dropdown menu on + click and right-click (Luma/ElevenLabs style)

### Step 6 Improvements (Round 8)
- [x] Redesign AddNodeMenu: dark glassmorphic style matching ElevenLabs reference

### Step 6 Improvements (Round 9)
- [x] Fix: Canvas background too cream — switch to cleaner white
- [x] Fix: AddNodeMenu should be light frosted glass, not dark (we are light theme)

### Canvas Bottom UI (Luma-style)
- [x] Remove left-side tool rail from BoardPage
- [x] Remove React Flow Controls component from BoardCanvas
- [x] Create CanvasZoomControls: polished pill with −/zoom%/+ (bottom-left)
- [x] Create CanvasToolbar: centered floating pill with tool icons (bottom-center)
- [x] Create CanvasChatToggle: chat button placeholder (bottom-right)
- [x] Wire all three into BoardPage as children of BoardCanvas (ReactFlow context access)

### Canvas Bottom UI — Toolbar Redesign
- [x] Redesign CanvasToolbar to match Luma Labs reference: larger pill, bigger icons, prominent white circle highlight on active tool (cursor), more generous spacing between icons, white frosted glass style

### Canvas Bottom UI — Polish Round 2
- [x] Change canvas background color to #DFDFDF
- [x] Fix toolbar icons not looking crisp — use geometricPrecision SVG rendering, consistent stroke weights
- [x] Zoom controls: step 25% at a time, more pill-shaped capsule (borderRadius 20)
- [x] Chat toggle: remove "AI" text, icon-only circular button

### Canvas Context Menus
- [x] Build NodeContextMenu — right-click on image/node shows image-specific actions (Style Outfit, Remove Background, Download, Copy, Open in New Tab, Delete, etc.)
- [x] Differentiate node right-click from canvas right-click — canvas shows AddNodeMenu, node shows NodeContextMenu
- [x] Wire node right-click event from BoardCanvas into BoardPage (with stopPropagation)

### Node Context Menu — Modify & Generate Views
- [x] Add "Modify / Iterate" action to NodeContextMenu that opens ModelEditorOverlay (same as double-click)
- [x] Add "Generate Views" action with expanding submenu (Front, Side, Back, 3/4, All)
- [x] Wire both actions in BoardPage (modify opens editor overlay, views show toast placeholder)

### Node Context Menu — Enhancements Round 2
- [x] Add inline "Start typing..." prompt input at top of context menu for quick iteration
- [x] Add Info button showing cast image specs/details (toast with metadata)
- [x] Add Extract Palette action (placeholder)
- [x] Remove the Duplicate action (was placeholder)
- [x] Fix Download Image to actually work (proper fetch+blob download)
- [x] Change "Copy Image URL" to "Copy Image" (copies image to clipboard via canvas conversion)
- [x] Rename "Style Outfit" to "Wardrobe"
- [x] Make Rename action work (custom event dispatches to BoardItemNode inline edit)
- [x] Remove 3-dot menu from BoardItemNode (right-click replaces it)

### Node Context Menu — Bug Fixes Round 3
- [x] Fix Download Image: server proxy endpoint with Content-Disposition: attachment
- [x] Fix Copy Image: proxy fetch bypasses CORS, PNG blob written to clipboard
- [x] Redesign Info as NodeInfoPanel popout modal — shows model specs, master prompt, preferences, metadata

### Board Canvas Iteration System
- [x] DB: Create board_item_versions table (itemId, version, imageUrl, prompt, createdAt)
- [x] Server: Add boards.addItemVersion and boards.getItemVersions tRPC procedures
- [x] Server: Add boards.revertItemVersion procedure (swap node imageUrl to selected version)
- [x] Hook: Build useBoardIteration hook bridging board items to casting iterate endpoint
- [x] Upgrade ModelEditorOverlay with refine bar (chat input), surgical/eraser tools, loading overlay
- [x] Build VersionHistoryBadge — clean layers icon on upper-left of node (only shows if versions exist)
- [x] Build VersionHistoryModal — horizontal scrollable thumbnail strip with select/revert
- [x] Wire context menu "Start typing..." prompt to fire-and-forget iteration with version save
- [x] Wire context menu "Modify / Iterate" to open upgraded ModelEditorOverlay
- [x] After each iteration (overlay or context menu), save version + replace node imageUrl in-place
- [x] Tests: 11 board version endpoint tests (add, get, count, revert, auth checks)

### Iteration Overlay — UX Improvements
- [x] Add reference image upload to ModelEditorOverlay (like casting studio RefinePanel)
- [ ] Make surgical/eraser tools more prominent and obvious in the overlay toolbar
- [ ] Add right-click context menu inside the iteration overlay (download, copy, info, etc.)

### Iteration Overlay — Reference Image Upload
- [x] Add reference image upload button (image icon) next to refine input
- [x] Show thumbnail preview in refine bar with remove button
- [x] Pass referenceImage base64 to iterate call, clear after submit

### Canvas — Drag-to-Resize Images
- [x] Enable resize handles on image nodes (React Flow NodeResizer)
- [x] Persist resized dimensions to board item (width/height)

### Canvas — Frame/Group Boxes
- [x] Add "Frame" node type to canvas for grouping images
- [x] Frame nodes are resizable containers with labeled headers
- [x] Add "Add Frame" option to AddNodeMenu and toolbar

### Canvas — Text Notes
- [x] Add "Note" node type to canvas for writing text
- [x] Notes are editable inline with warm sticky-note style (double-click to edit, Ctrl+Enter to save)
- [x] Add "Add Note" option to AddNodeMenu and toolbar

### Canvas UX Improvements — Keyboard Delete, Note Size, Toolbar Wiring
- [x] Keyboard Delete: pressing Delete/Backspace on selected node deletes it (guard against text editing)
- [x] Note text size: increase from 13px to 16px, bump default note dimensions to 280×200
- [x] Wire Frame creation into toolbar (add 'frame' to CanvasToolId, replace PlusCircle with Frame icon)
- [x] Wire Note + Frame toolbar clicks to create nodes at viewport center (not random position)
- [x] Click-to-place mode for Note/Frame: cursor changes to crosshair, click canvas to place, then revert to Select
- [x] Bug: Placement mode crosshair cursor overridden by React Flow's grab cursor — needs CSS specificity fix
