# FormaStudio™ Project TODO

## Phase 1: Foundational Backend & Authentication

### Database Schema
- [x] Users table with role-based access control
- [x] Points table for balance tracking
- [x] Point transactions table for history

### Design System
- [x] Configure dark theme with zinc palette
- [x] Add Instrument Serif font
- [x] Set up glassmorphism utilities
- [x] Configure animations (fade-in-up, etc.)

### Backend
- [x] Points system tRPC procedures (balance, transactions, deduct)
- [x] Initialize points for new users
- [x] Transaction history tracking

### Authentication UI
- [x] Dark card login design
- [x] Social login buttons (Google, Apple)
- [x] Email/password form styling
- [x] Responsive layout

### Navigation & Layout
- [x] Fixed navigation with mix-blend-difference
- [x] Glass panel components
- [x] Mobile-responsive navigation

### Dashboard
- [x] User dashboard page
- [x] Points balance display
- [x] Transaction history view
- [x] User profile section

### Testing
- [x] Points system unit tests
- [x] Authentication flow verification


## Phase 1.5: Waitlist Landing Page

### Landing Page Structure
- [x] Hero section with compelling headline and value proposition
- [x] Problem/solution section addressing pain points
- [x] Benefits section with key features
- [x] Social proof section (testimonials, brand logos, stats)
- [x] How it works section
- [x] Pricing preview / early access benefits
- [x] FAQ section
- [x] Final CTA section

### Waitlist System
- [x] Waitlist database table for email capture
- [x] Email signup form with validation
- [x] Success confirmation state
- [x] tRPC procedure for waitlist signup

### Copy & Conversion
- [x] Headline copy targeting creative directors
- [x] Benefit-driven feature descriptions
- [x] Urgency/scarcity messaging for early access
- [x] Clear call-to-action copy

### Polish
- [x] Smooth scroll animations
- [x] Mobile-responsive design
- [x] Loading states and error handling


## LUMEN Complete Redesign
- [x] Rewrite homepage to match LUMEN portfolio exactly
- [x] Hero section: 4-column grid with brand, image carousel, stats
- [x] Exploration section: 2-column gallery with project slider
- [x] Process section: stats with AI workflow content
- [x] Methodology section: camera image with philosophy text
- [x] Recognition section: 4-column awards grid
- [x] Journal section: featured article with sidebar entries
- [x] Waitlist section: centered form with name/email
- [x] Footer: 4-column layout with social links
- [x] Add sky-blue accent color (#38bdf8)
- [x] Grayscale image treatment with contrast boost

## Replace Recognition with Draggable Cards
- [x] Replace Recognition section with scrolling draggable card section
- [x] Add dark theme cards with hover effects and descriptions
- [x] Implement drag-to-scroll functionality with momentum
- [x] Style consistently with LUMEN light theme (dark section with light cards)

## Draggable Cards Auto-Scroll
- [x] Add slow auto-scroll animation to draggable cards section
- [x] Implement infinite loop with cloned cards
- [x] Pause auto-scroll on drag interaction

## Restyle Draggable Cards to LUMEN Style
- [x] Change dark background to light/white background
- [x] Update card styling to match LUMEN aesthetic (light cards, clean borders)
- [x] Update typography to match rest of page (Geist font, consistent sizing)
- [x] Add sky-blue accent color for hover states

## Gridline Background Consistency
- [x] Add subtle gridline background to "Solving Problems With Intelligent AI" section
- [x] Ensure visual continuity with other sections when scrolling

## Intelligent Gridlines for Services Section
- [x] Analyze how other sections frame content with gridlines
- [x] Design gridlines that stop/frame around content elements in Services Marquee
- [x] Create visual hierarchy with intentional grid placement

## Header, Hero & Page Cleanup
- [x] Redesign header to be inline like Spark Labs (mix-blend-difference, logo left, Join Waitlist pill right)
- [x] Remove hamburger menu and dropdown
- [x] Remove "View Studios" button from hero section
- [x] Make "Get Access" button more prominent in hero
- [x] Remove /app route (users go directly to dashboard)
- [x] Remove /settings page
- [x] Update OAuth callback to redirect to /dashboard

## Login Page Redesign
- [x] Match homepage light theme (bg-zinc-50, text-zinc-900)
- [x] Add subtle gridlines background
- [x] Use inline header style with forma studio logo
- [x] Style login button with sky-blue accent
- [x] Add cohesive typography and spacing

## Dashboard Redesign - Dark Theme
- [x] Create dark theme dashboard matching reference design
- [x] Add sidebar with navigation (Home, Studios, Library, History, etc.)
- [x] Add header with profile banner, avatar, and tabs
- [x] Add Team Members section with member avatars
- [x] Add Recent Work content grid section
- [x] Style with dark background (#0D0C12), rose accent for active items
- [x] Add Quick Actions cards for studio access

## Dashboard Clean Modern Dark Theme
- [x] Background: #151515 to #1a1a1a (dark gray, not pure black)
- [x] Text: #e5e5e5 to #f0f0f0 for readability
- [x] Accents: muted violet (#8b5cf6), sky (#60a5fa), amber colors
- [x] Generous spacing with subtle shadows
- [x] 12-16px border-radius on cards (rounded-xl, rounded-2xl)
- [x] WCAG contrast compliance for eye comfort
- [x] Match homepage fonts/weights/line-height

## Dashboard Sidebar Label Updates
- [x] Change "TEMPLATES" to "RESOURCES"
- [x] Change "MY STUDIO" to "TOOLS"

## Dashboard Reorganization
- [x] Move Studios (Casting, Wardrobe, Photo) under Tools menu
- [x] Move current Tools items (Library, History, etc.) under Home menu
- [x] Remove Team Members section
- [x] Add logout button (in sidebar user profile area)
- [x] Change profile picture gradient to grayscale abstract style

## Dashboard Updates - Profile & Menu Reorganization
- [x] Make user profile editable (profile picture, header background, email)
- [x] Add Billing & Usage to Home menu items
- [x] Remove small inline menu under profile picture (tabs)
- [x] Remove Downloads, History, Library menu items
- [x] Update Resources section:
  - [x] Casting Pro → Learn Casting
  - [x] Style Guide → Learn Wardrobe
  - [x] Campaign Kit → Learn Campaign
  - [x] Add Affiliate Program
  - [x] Add Legal & Copyright

## Dashboard Glass Morphism Restyle
- [x] Dark charcoal background (#0A0A0A) with subtle grid pattern
- [x] Glass morphism panels with backdrop-blur and white/10 borders
- [x] Orange accent color (#f97316/orange-500) for highlights
- [x] Monospace labels for section numbers ([01/01] // DASHBOARD style)
- [x] Monospace technical labels ([01/08] // SYS.INIT style)
- [x] Frosted glass cards with gradient borders
- [x] Clip animation inspired orange accent on hover
- [x] Editorial/premium creative studio aesthetic

## Dashboard Background Update
- [x] Remove checkerboard/grid pattern from dashboard
- [x] Add abstract landscape image as background
- [x] Desaturate and fade image to very subtle opacity (8% opacity + grayscale)
- [x] Ensure seamless blend with dark background (edge gradients)

## Dashboard Corner Styling Update
- [x] Mix soft rounded corners (rounded-lg, rounded-xl) with sharp edges
- [x] Apply rounded-full to icon buttons and avatars
- [x] Use rounded-lg for internal cards and content areas
- [x] Keep some elements sharp/square for contrast
- [x] Add gradient borders with border-gradient style
- [x] Improve backdrop-blur and glass effects

## Dashboard Default Images
- [x] Add default cover/banner image for users without custom upload
- [x] Add default profile picture/avatar for users without custom upload
- [x] Ensure professional appearance for new users

## Profile Settings Modal
- [x] Add cog/settings icon next to logout button in sidebar
- [x] Create profile settings modal/popout component
- [x] Include profile editing section (name, email, avatar, banner)
- [x] Include billing plan display and upgrade option
- [x] Include account settings (notifications, preferences)
- [x] Remove inline edit functionality from profile header
- [x] Style modal with glass morphism to match dashboard aesthetic

## Dashboard Button Styling Update
- [x] Change main buttons to white pill-shaped (rounded-full)
- [x] Use white/light backgrounds instead of orange for primary buttons
- [x] Keep orange only for small accents (dots, indicators, hover borders)
- [x] Apply consistent pill shape across all dashboard buttons

## Bug Fixes
- [x] Fix cover photo showing checkerboard pattern instead of uploaded image

## Landing Page Updates
- [x] Change title from "FORMA+" to "FORMA Studio"
- [x] Add scrolling brand logos section below hero with "Trusted by top creatives working for:"
- [x] Redesign "Join the Waitlist" section to match landing page aesthetic
- [x] Update "Solving Problems With Intelligent AI" section typography and style to match rest of page
- [x] Add email input field above Get Early Access button in hero section
- [x] Update Trusted By section icons to target market brands (Shopify, Meta, Facebook, Nike, Instagram, Google)
- [x] Integrate Forma Studio logo throughout website
- [x] Add automatic white color inversion for dark mode (dashboard)
- [x] Replace Trusted By section icons with proper SVG files (Instagram, Nike, Meta, Facebook, Shopify, Google Chrome)

## Accent Color Updates
- [x] Change hero "Get Early Access" button from blue to black
- [x] Replace all blue accent colors (sky-500, sky-600) with orange accent color from dashboard

## Phase 2: Core AI & Points System Integration
### Points System (Already Implemented)
- [x] Points table in database schema
- [x] Point transactions tracking
- [x] getUserPoints, deductPoints, addPoints functions
- [x] tRPC endpoints for balance, transactions, deduct, add, checkBalance
- [x] Initial signup bonus (100 points)

### AI Service Integration (Implemented)
- [x] Create AI service module for Gemini API integration
- [x] Implement generateMasterPrompt() - Generate casting specification from preferences
- [x] Implement generateCastingImage() - Generate model image from master prompt
- [x] Implement generateFullBody() - Expand headshot to full body
- [x] Implement generateRemainingViews() - Generate side/back views
- [x] Create tRPC endpoints for AI generation
- [x] Integrate points deduction with AI generation

### Model Data Persistence (Implemented)
- [x] Create models table in database schema
- [x] Create model_assets table in database schema
- [x] Implement model CRUD operations in db.ts
- [x] Create tRPC endpoints for model management
- [x] Link AI generations to model records
- [x] Generation history tracking
- [x] Unit tests for AI service and models

## Phase 3: Model & Asset Storage (Completion)

### User Profile Persistence
- [x] Add profile fields to user table (displayName, bio, avatarUrl, avatarKey, bannerUrl, bannerKey)
- [x] Add storage quota fields to user table (storageUsed, storageLimit)
- [x] Create profile.get tRPC endpoint to fetch full profile
- [x] Create profile.update tRPC endpoint for displayName and bio
- [x] Create profile.uploadAvatar tRPC endpoint with S3 storage
- [x] Create profile.uploadBanner tRPC endpoint with S3 storage
- [x] Create profile.storageInfo tRPC endpoint for storage usage
- [x] Update Dashboard to fetch and display persistent profile data
- [x] Update ProfileSettingsModal to save changes to database
- [x] Add storage usage display in profile settings

### Asset Management & Scalability
- [x] Add storageDelete function to storage.ts for S3 cleanup
- [x] Add S3 cleanup on profile image update (delete old avatar/banner)
- [x] Implement file size limits and validation (5MB avatar, 10MB banner)
- [x] Implement storage quota per user (100MB default limit)
- [x] Add storage limit enforcement on uploads
- [x] Track storage usage with updateUserStorageUsed function
- [ ] Implement asset upload endpoint for reference images
- [ ] Add S3 cleanup on model deletion (delete associated assets)
- [ ] Add image compression/optimization before upload

### Asset Versioning
- [ ] Track iteration history for each view type
- [ ] Allow users to view previous versions of generated images

### Testing
- [x] Profile management unit tests (16 tests)
- [x] All 49 tests passing

## Phase 4: Casting Studio UI

### Core Casting Studio Page
- [x] Create CastingStudio page component at /casting-studio route
- [x] Implement two-panel layout (ControlPanel left, ImageViewer right)
- [x] Add dark theme styling matching dashboard aesthetic

### Control Panel (Model Creation Wizard)
- [x] Brand & Style section (6 brand tones, 6 moods)
- [x] Gender selector (Female, Male, Non-Binary)
- [x] Age range dropdown
- [x] Ethnicity chip selector (8 options)
- [x] Skin tone visual picker (7 colors)
- [x] Eye color visual grid selector (7 colors)
- [x] Hair section (10 colors, 5 lengths, 12 styles)
- [x] Face Details section (features text, reference description)
- [x] Collapsible sections with expand/collapse animation
- [x] Form validation for required fields

### Image Viewer & Generation
- [x] Main image display with loading states
- [x] Multi-view tabs (Front, Full Body, Side, Back)
- [x] Undo/Redo history navigation
- [ ] Iteration/refinement text input with AI enhancement
- [ ] Reference image upload with drag-and-drop

### Backend Integration
- [x] Connect to models.create for master prompt generation
- [x] Connect to generation.castingImage for headshot
- [x] Connect to generation.fullBody for full body view
- [x] Connect to generation.multiView for side/back views
- [x] Integrate points deduction on generation
- [x] Save generated models to database
- [x] Display points balance and cost per generation

### Polish & UX
- [x] Loading animations and progress indicators
- [x] Error handling with toast notifications
- [x] Mobile responsive design with collapsible panel
- [x] All 65 tests passing (including 16 Casting Studio tests)
- [ ] Mobile-responsive layout
- [ ] Keyboard shortcuts for common actions

## Bug Fix: Casting Studio UI Mismatch (COMPLETED)

### Issues Identified & Fixed
- [x] Added TriBlend selector (Editorial/Commercial/Runway triangle)
- [x] Added HairColorWheel component (visual color wheel picker with Dyed/Natural tabs)
- [x] Added Physique section with body type icons (Ultra Thin, Slim, Athletic, Muscular, Curvy, Petite)
- [x] Fixed brand options (Gucci, Prada, Saint Laurent, Balenciaga, Miu Miu, Versace, Zara, Social Media)
- [x] Added skin texture and finish options
- [x] Added advanced face details (jawline, cheekbones, cheeks, eye shape, nose, lips)
- [x] Added hair builder options (length, texture, fringe, parting, volume, flyaways, hairline, tuck, fade)
- [x] Added reference image upload node in ImageViewer (drag-and-drop)
- [x] Added refinement text input for iterations
- [ ] Missing resolution selector and upscale options (future)
- [ ] Missing export pack functionality (future)

### Rebuild Tasks Completed
- [x] Copied exact components from reference app (TriBlendSelector, HairColorWheel, Tooltip)
- [x] Matched styling with studio-* color classes
- [x] Implemented TriBlendSelector component with draggable puck
- [x] Implemented HairColorWheel component with color wheel and tone controls
- [x] Matched ImageViewer layout with reference node
- [x] All 65 tests passing

## Cross-Reference Audit: Casting Studio vs Reference App (COMPLETED)

### Structural Comparison
- [x] ControlPanel width matches reference (400px) - VERIFIED
- [x] ImageViewer takes remaining space (flex-1) - VERIFIED
- [x] Overall layout structure matches - VERIFIED

### ControlPanel Components Audit
- [x] Brand selector (8 options with descriptions) - MATCHES
- [x] TriBlendSelector component - MATCHES
- [x] Gender segmented control with icons - MATCHES
- [x] Age slider (18-85) - MATCHES
- [x] Ethnicity multi-select (max 2 or Mixed) - MATCHES
- [x] Physique body type icons (6 options) - MATCHES
- [x] Face Shape icons (6 options) - MATCHES
- [x] Eyebrow Style selector - MATCHES
- [x] Advanced Face Features toggle - MATCHES
- [x] Skin Tone visual picker (6 colors) - MATCHES
- [x] Skin Texture dropdown - MATCHES
- [x] Skin Finish dropdown - MATCHES
- [x] Eye Color visual grid (15 colors) - MATCHES
- [x] HairColorWheel component - MATCHES
- [x] Hair Style Family selector - MATCHES
- [x] Hair Length dropdown - MATCHES
- [x] Hair Texture dropdown - MATCHES
- [x] Hair Fringe dropdown - MATCHES
- [x] Hair Parting dropdown - MATCHES
- [x] Hair Volume dropdown - MATCHES
- [x] Advanced Hair toggle - MATCHES
- [x] Flyaways, Hairline, Tuck, Fade options - MATCHES

### ImageViewer Components Audit
- [x] View tabs (Headshot, Full Body, Side, Back) - MATCHES
- [x] Undo/Redo buttons - MATCHES
- [x] Download button - MATCHES
- [x] ReferenceNode drag-and-drop - MATCHES
- [x] Loading spinner animation - MATCHES
- [x] Empty state with branding - MATCHES
- [x] Points display - MATCHES
- [x] Cost breakdown - MATCHES
- [x] Refinement text input - MATCHES
- [x] Action buttons (Full Body, Side, Back, Recast) - MATCHES

### Missing Features - NOW IMPLEMENTED
- [x] ConnectorLine SVG animation between reference node and main image
- [x] StageLockModal confirmation dialogs
- [x] Surgical/Eraser masking tools for refinement (canvas-based drawing)
- [x] Export Pack modal (character name + resolution selection)
- [x] Resolution selector (1K/2K toggle)
- [x] enhanceUserPrompt AI enhancement for refinement text
- [x] Retry button on error
- [x] ToolButton component with active state indicators

### Styling Verification
- [x] studio-* color classes match reference
- [x] custom-scrollbar styling implemented
- [x] Animation classes (animate-in, fade-in, slide-in-from-top-2) working
- [x] Hover states and transitions verified

### Workflow Implementation
- [x] Stage-based generation (headshot → body → sheet) with StageLockModal
- [x] Downstream views cleared when upstream changes
- [x] Iteration with mask support (surgical/eraser tools)
- [x] View locking system with unlock mode
- [x] All 65 tests passing


## Bug Fix: Sidebar Scroll Issue (COMPLETED)

- [x] Fix control panel sidebar to enable vertical scrolling
- [x] Changed aside from lg:block to lg:flex lg:flex-col for proper flex container
- [x] Added min-h-0 to scrollable content div to enable flex shrinking
- [x] Added custom-scrollbar CSS class for dark theme scrollbar styling
- [x] Ensure all options (color wheel, hair, face details) are accessible
- [x] Verified scrolling works - all sections now accessible


## Comprehensive Casting Studio Audit (COMPLETED)

### Phase 1: CSS/Styling Verification
- [x] Verify studio-* color classes exist in index.css
- [x] Verify animation classes (animate-in, fade-in, slide-in-from-top-2)
- [x] Verify custom-scrollbar styling
- [x] Fix any missing Tailwind utilities

### Phase 2: ControlPanel Options Verification
- [x] Verify all dropdown options match reference exactly
- [x] Verify ethnicity count (10 options: Slavic, Nordic, East Asian, South Asian, Afro-Caribbean, West African, Latino, Middle Eastern, Mixed, Polynesian)
- [x] Verify hair families are gender-specific (Female vs Male options)
- [x] Verify advanced face options (jawline, cheekbones, cheeks, eye shape, nose, lips)
- [x] Verify advanced hair options (flyaways, hairline, tuck, fade)
- [x] Verify Recast button only shows when hasCurrentAsset
- [x] Added Facial Hair dropdown for Male gender

### Phase 3: ImageViewer Components Verification
- [x] Verify reference node positioning (top-24 right-12, w-64 h-96)
- [x] Verify connector line positioning and animation
- [x] Verify empty state with progress bar and required fields display
- [x] Verify view thumbnail layout and interactions
- [x] Added ULTRA (4K) resolution option

### Phase 4: State & Workflow Verification
- [x] Verify stage progression logic (Headshot → Body → Sheet → Export)
- [x] Verify downstream clearing when iterating upstream views
- [x] Verify form validation (7 required fields)
- [x] Verify retry mechanism stores and retries failed actions

### Phase 5: Final Testing
- [x] Test full generation flow end-to-end
- [x] Test all UI interactions
- [x] Test responsive behavior (sidebar scrolling fixed)
- [x] Test error handling and retry
- [x] All 65 tests passing


## Eye Color Selector Images Update (COMPLETED)

- [x] Upload realistic eye images to S3 (ice, sky, azure, navy, grey, steel, mint, green, olive, hazel, amber, honey, brown, dark, black)
- [x] Update EYE_PRESETS constant with image URLs from CDN
- [x] Update VisualEyeGrid component to render images instead of gradients
- [x] Test eye color selector displays correctly with realistic eye images


## Gemini Prompt & Model Audit (COMPLETED)

### Model Versions
- [x] Uses platform's invokeLLM and generateImage helpers (model selection handled by Forge API)
- [x] Prompts structured to match reference app's Gemini integration

### Prompt Directives Implemented
- [x] MASTER_PROMPT_SYSTEM_INSTRUCTION - detailed casting director system prompt (60+ lines)
- [x] BASE_STUDIO_SETTINGS - visual directives for lighting, camera, background
- [x] Brand-specific directives (Gucci, Prada, Saint Laurent, Balenciaga, Miu Miu, Versace, Zara, Social Media)
- [x] TriBlend vibe descriptions (Editorial/Commercial/Runway percentages)
- [x] Skin texture descriptions (Raw, Glass, Freckled, Textured, Mature)
- [x] Skin finish descriptions (Natural, Matte, Dewy, Oily)
- [x] Negative constraints (no CGI, no smiling, no tattoos unless specified)
- [x] Tattoo persistence rules (clean skin vs body art)
- [x] Geometry locking for surgical edits
- [x] Frame directives (headshot vs full body constraints)

### Functions Implemented
- [x] generateMasterPrompt - with full system instruction and JSON schema output
- [x] generateCastingImage - with dynamic studio settings and mode support (NEW/ITERATE)
- [x] generateFullBody - with gender-specific wardrobe constraints
- [x] generateRemainingViews - side/back views with character consistency
- [x] iterateModel - with surgical mask support and frame locking
- [x] enhanceUserPrompt - AI prompt enhancement for refinement input
- [x] All 66 tests passing
- [ ] getSkinDescription - detailed skin texture/finish descriptions
- [ ] getBrandDirectives - brand-specific casting instructions
- [ ] getNegativeConstraints - avoid list for image generation
- [ ] getStudioSettings - dynamic studio configuration
- [ ] formatGeminiError - user-friendly error messages

### Implementation Tasks
- [ ] Update aiService.ts with reference app's prompt structure
- [ ] Add MASTER_PROMPT_SYSTEM_INSTRUCTION constant
- [ ] Add brand descriptors and vibe blend logic
- [ ] Add skin texture/finish descriptions
- [ ] Add surgical edit protocols for iterations
- [ ] Verify model versions match reference


## Gemini API Direct Integration (Hard Requirement)

### Requirements
- [ ] Use user's GEMINI_API_KEY directly (not Forge API)
- [ ] Use exact same models as reference app:
  - Text: gemini-3-pro-preview (primary), gemini-3-flash-preview (fallback)
  - Image: gemini-3-pro-image-preview (primary), gemini-2.5-flash-image (fallback)
- [ ] Match reference app's API calls exactly

### Implementation Tasks
- [ ] Create geminiService.ts matching reference app exactly
- [ ] Implement generateCastingSpec() with exact same prompts
- [ ] Implement generateImage() with exact same parameters
- [ ] Implement enhanceUserPrompt() with exact same logic
- [ ] Update aiService.ts to use geminiService
- [ ] Add SAFETY_SETTINGS to disable content filters
- [ ] Test with real Gemini API calls


## Two-Step Generation Pipeline Logic Audit

### 1. Data Structure (types.ts / ModelPreferences)
- [ ] Verify ModelPreferences interface has all required fields
- [ ] Check: castingBrand, castingVibe (Tri-Blend), gender, ethnicity, skinTexture, hairStyle, facialHair, etc.

### 2. Input Layer (ControlPanel / CastingStudio)
- [ ] Verify TriBlend Selector calculates weights between Editorial/Commercial/Runway
- [ ] Verify HairColorWheel maps visual selection to text strings (e.g., "Warm Copper")
- [ ] Verify all UI inputs update the prefs state correctly

### 3. Orchestrator (App.tsx / CastingStudio)
- [ ] Verify two-step pipeline execution:
  - Step A: generateMasterPrompt(prefs) - Text Generation
  - Step B: generateCastingImage(masterPrompt) - Image Generation

### 4. Logic Core (geminiService.ts)
- [ ] Verify brandDescriptors dictionary (Gucci → "Eclectic, unconventional beauty...")
- [ ] Verify Vibe Logic calculates "Vibe Blend" string from Tri-Blend weights
- [ ] Verify getSkinDescription helper generates detailed skin paragraph
- [ ] Verify getStudioSettings injects camera/lighting rules
- [ ] Verify SAFETY_SETTINGS and negative prompts are applied
- [ ] Verify output includes natural_description (300+ words) and technical_schema

### 5. System Instruction (constants.ts / MASTER_PROMPT_SYSTEM_INSTRUCTION)
- [ ] Verify "Technical Director" persona is defined
- [ ] Verify rules: "No marketing fluff", "Describe skin texture in extreme detail"
- [ ] Verify tattoo location rules are enforced


## Master Prompt Logic Fix

### Issues Identified
- [ ] Hairstyle details not being passed properly (e.g., "updo with curtain bangs" becomes just "updo")
- [ ] Brand DNA not being translated correctly (Miu Miu should produce "subversive preppy, youthful intellectual" look)
- [ ] Vibe blend instructions not being appended based on thresholds (>60% Editorial should add "Features should be striking and unconventional")

### Missing Logic from Reference App
- [ ] Brand Directive Injection for image model (different from text description)
- [ ] Quality Baseline Construction merging Brand DNA + Vibe Calculation
- [ ] Proper hair detail concatenation (style + fringe + length + texture)
- [ ] Threshold-based vibe instructions (>60% triggers specific text)

### Fixes Required
- [ ] Update generateMasterPrompt to include all hair details in prompt
- [ ] Update getBrandDirectives to match reference app exactly
- [ ] Add threshold checks for vibe blend instructions
- [ ] Verify quality baseline construction matches reference


## Workspace Layout Fix (Reference Design Match) - COMPLETED

### Layout Structure Issues
- [x] Fix main workspace layout to match reference design exactly
- [x] Add Director's Note section at bottom of workspace (shows master prompt)
- [x] Position iterate/chat input overlaying the bottom of the image container
- [x] Add vertical shot thumbnails strip on LEFT side of image container
- [x] HEAD thumbnail at top with label, ADD BODY button below
- [x] Empty placeholder slots for additional shots (side, back views)
- [x] Move reference upload node to RIGHT side panel
- [x] Add NEXT STAGE / GENERATE FULL BODY button on right side
- [x] Ensure proper spacing and alignment matches reference


## Post-Casting Workspace QA Audit - COMPLETED

### Tool Selection + Guided Overlays
- [x] Tool tip/selector visibly highlights as "active" when clicked (ToolButton component with pulsing dot)
- [x] Contextual overlays/instructions appear to guide user on next steps (STEP 01/02 badges)
- [x] Match reference app's SURGICAL EDIT and MAGIC ERASER tool states (Tool Mode Overlay Badge)

### Enhance Prompt Placement + Behavior
- [x] Enhance Prompt action lives next to Send button
- [x] Clicking Enhance Prompt transforms/enhances user's prompt text (calls generation.enhance mutation)
- [x] Enhanced prompt flows correctly into generation/send action
- [x] Does not replace unrelated fields

### Contextual Tool Availability
- [x] Only appropriate edit tools visible depending on current view/state
- [x] Tool enable/disable rules match original app logic
- [x] Surgical Edit tool available on headshot views
- [x] Magic Eraser tool available with proper state management

### Master Prompt Rules
- [x] Master Prompt is copyable (Copy button works in Director's Note)
- [x] Master Prompt is dynamic (updates every iteration via generateMasterPrompt)
- [x] Master Prompt reflects latest source of truth for model identity (stored in DB and returned)
- [x] View Schema button works correctly (toggles between natural description and technical schema)


## Surgical Edit & Magic Eraser Tool Verification - COMPLETED

### Surgical Edit Tool
- [x] Verify mask painting works correctly (canvas drawing)
- [x] Verify mask is sent to backend as base64 (added getGuideOverlayDataUrl function)
- [x] Verify surgical edit generation uses mask correctly (passes maskBase64 through iteration endpoint)
- [x] Verify step instructions match reference (STEP 01: Paint Target Area, STEP 02: Describe Edit)

### Magic Eraser Tool
- [x] Verify eraser mask painting works correctly
- [x] Verify "ERASE" button appears after painting
- [x] Verify eraser generation removes painted areas (uses automatic prompt with mask)
- [x] Verify step instructions match reference (STEP 01: Paint Area, STEP 02: Click Erase Button)

### Common Functionality
- [x] Verify tool switching clears previous mask (useEffect on activeTool)
- [x] Verify mask overlay is visible during painting (canvas with pointer events)
- [x] Verify brush size/cursor is appropriate (20px line width, crosshair cursor)
- [x] Verify mask paths are properly stored and cleared


## Export/Upscale Function Verification - COMPLETED

### Export Workflow
- [x] Verify every export has a unique ID (generateExportId() creates MOD-YY-XXXXXX format)
- [x] Verify export modal shows correct options (1K/2K/4K resolution)
- [x] Verify export creates ZIP with all views and PDF identity document
- [x] Verify export downloads work correctly (blob URL download)
- [x] Upscale function exists in geminiService (upscaleExistingImage)

### Export ID System
- [x] Check reference app's export ID generation logic (MOD-YY-XXXXXX format)
- [x] Implement unique export ID for each export action (generateExportId helper)
- [x] Export ID included in ZIP filename and PDF document


## Fix Disconnected Features - COMPLETED

### Reference Image in Generation
- [x] Pass reference image from frontend to backend in castingImage endpoint
- [x] Update routers.ts to accept and use referenceImage parameter
- [x] Verify reference image is used in AI generation

### Upscale on Export
- [x] Create upscale tRPC endpoint in routers.ts (generation.upscale)
- [x] Integrate upscale with export flow based on resolution selection
- [x] Support 1K (original), 2K, and 4K resolutions

### Back View Generation
- [x] Fix workflow to generate both side AND back views
- [x] Update Next Stage flow to include back view generation (4 steps now)
- [x] Ensure all 4 views are generated before export


## Model Identity Registry System

### Database Schema Updates
- [x] Add mintedAt timestamp column to models table
- [x] Make agencyId nullable in models table (null during draft)
- [x] Update status enum to include 'locked' for immutable models
- [x] agencyId becomes unique only when set (on export)

### Draft Session (Casting)
- [x] Update model creation to use status='draft' without agencyId
- [x] Allow iterations and refinements on draft models
- [x] Draft models are mutable

### Export Minting Flow
- [x] On export: generate and assign agencyId (MOD-YY-XXXXXX)
- [x] Lock identity bundle (masterPrompt, technicalSchema)
- [x] Change status from 'draft' to 'active' (or 'locked')
- [x] Generate legal PDF with minted agencyId
- [x] Model becomes immutable after minting

### Cross-App Identity Retrieval
- [x] Create registry.lookup endpoint for cross-app lookup by agencyId
- [x] Create registry.verify endpoint to check if model exists and is minted
- [x] Return identity prompt for injection into other app generations
- [x] Only return data for 'active' models (not drafts)

## Debug Utility for Casting Studio
- [x] Create randomized preferences generator function
- [x] Add debug button to casting studio UI (dev mode only)
- [x] Auto-populate all form fields with random valid values
- [x] Auto-trigger model generation after populating form
- [x] Add keyboard shortcuts: Ctrl+Shift+D (fill) and Ctrl+Shift+G (fill + generate)


## Bug Fixes
- [x] Fix infinite loop in HairColorWheel component (useEffect dependency issue at line 80)


## UI/UX Fixes to Match Original App (Reference Image 1)

### Workspace Layout
- [x] Match left sidebar thumbnail size and spacing from reference (w-24)
- [x] Match main image container positioning and size
- [x] Match right panel (reference node + next stage button) positioning
- [x] Fix overall spacing and alignment to match Reference Image 1

### Chat/Iteration Submission
- [x] Fix chat box to allow submission when tool is selected + text entered
- [x] Ensure correct iteration flow is triggered (surgical tool requires mask + text)

### Download Button
- [x] Fix Download button to trigger immediate browser download (fetches as blob for cross-origin)

### Reference Node Connections
- [x] Add SVG curved connector line from reference node to main image
- [x] Position connector to flow naturally between elements (updated curve path)
- [x] Ensure connector scales properly at different screen sizes

### Technical Schema Viewer
- [x] Implement "View Technical Schema" in Director's Notes
- [x] Display JSON representation of master prompt / technical schema
- [x] Create proper viewer/modal/panel for JSON display (toggle button in Director's Notes)

### Tool Icon Visibility
- [x] Increase visibility of tool icons in default (inactive) state
- [x] Maintain hover/active styling

### Undo/Redo Behavior
- [x] Fix undo/redo stack consistency (already working correctly)
- [x] Include/exclude tool actions and prompt edits appropriately
- [x] Reflect state updates in UI immediately

### Auto-Generation Flow
- [x] Add walking side view generation (step 4 in workflow)
- [x] Auto-trigger next view generation after each view completes (handleAutoGenerateAllViews)
- [x] Show progress indicator during sequential generation
- [x] Allow user to cancel auto-generation if needed (Cancel button)

### Export Functionality
- [x] Export individual PNG images for each view (all views in ZIP)
- [x] Generate correct PDF layout with embedded images
- [x] Fix export packaging/layout to match original app
