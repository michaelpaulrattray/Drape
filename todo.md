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


## Post-Generation UI Layout Fixes (Match Reference)
- [x] Move reference image node higher on right side with dashed border box
- [x] Position tool buttons on right edge of main image (adjusted to -right-2)
- [x] Update chat input area to match reference "PAINT AREA TO ERASE" style (shows when eraser active)
- [x] Position view label badge ("FRONT CLOSE") at bottom left of image
- [x] Ensure Director's Note section is at very bottom, full width
- [x] Match overall spacing and alignment from reference
- [x] Reduced left sidebar thumbnail width from w-24 to w-14


## Post-Generation UI Improvements
- [x] Move chat input bar to overlay bottom of main image container
- [x] Reduce dead space in workspace
- [x] Enlarge main image to fill more of the available space (max-h-[calc(100vh-180px)])
- [x] Adjust spacing between elements for tighter layout (reduced Director's Note padding)


## Connector Link Redesign
- [x] Redesign the connector between reference image node and main image
- [x] Create elegant, minimal connection design (S-curve with animated traveling dot)
- [x] Ensure smooth animation and responsive behavior (pulse animation, glow effects)


## Connector Position Fine-Tuning
- [x] Align connector start point with reference image node center (top: 180px, right: 224px)
- [x] Align connector end point toward main image container
- [x] Use dashed line with gradient and animated traveling dot


## Overlay Element Alignment
- [x] Resize view label to fit better (bottom-2 left-2, smaller padding)
- [x] Align chat input bar properly within image bounds (bottom-2, max-w-xl, compact padding)
- [x] Position download button to align with other elements (bottom-2 right-2)
- [x] Ensure consistent spacing between overlay elements (all at bottom-2)


## Thumbnail Size & Design Enhancement
- [x] Increase thumbnail width from w-14 to w-20 or larger
- [x] Improve thumbnail aspect ratio for better visibility
- [x] Add subtle glow/border effect on hover (ring-2 with shadow glow)
- [x] Enhance locked placeholder design (added labels, improved styling)
- [x] Add view type labels with better typography (9px, tracking-widest, gradient bg)
- [ ] Consider adding thumbnail preview on hover (future enhancement)


## Bug Fix: Asset Not Found Error
- [x] Investigate which mutation is throwing "Asset not found" error
- [x] Fix the asset lookup logic - now returning assetId from all generation mutations
- [x] Update frontend to use returned assetId instead of Date.now()


## Bug Fix: Surgical Edit/Eraser Buttons Not Working
- [x] Investigate Apply button click handler for surgical edit
- [x] Investigate Erase button click handler for eraser tool
- [x] Fix the submission logic - added crossOrigin="anonymous" to fix CORS tainted canvas error


## Bug Fix: Main Image Not Loading After CORS Fix
- [x] Remove crossOrigin attribute that breaks image loading
- [x] Implement alternative approach for mask canvas export (fetch image as blob, draw to canvas)


## Bug Fix: Mask Overlay Fetch Failing (CORS)
- [x] Fetch to S3 URL failing due to CORS - need alternative approach
- [x] Implemented: Frontend sends mask-only PNG (transparent with red strokes)
- [x] Server composites mask with base image using sharp library
- [x] No CORS issues since server fetches the base image directly


## Responsiveness & Loading State Improvements
- [x] Add immediate button feedback (disable + spinner on click)
- [x] Implement optimistic UI updates for faster perceived response
- [x] Add progress indicators for long operations (generation, iteration)
- [x] Add skeleton loaders for image placeholders during generation
- [x] Reduce perceived delay with instant visual feedback (animate-in fade-in)
- [x] Add subtle animations/transitions for state changes
- [x] Show estimated time remaining for generation operations (ElapsedTimeDisplay)


## Bug Fix: Multi-View Generation (Side/Walk/Back)
- [x] Analyze original app's multi-view generation logic
- [x] Compare with current implementation - found issue: was generating all 3 views but only using 1
- [x] Fix: Created generateSingleView function that generates only the requested view
- [x] Updated aiService to use new single view generation


## Verify Thumbnail & Export Workflow
- [x] Check how multi-view results populate thumbnails in frontend
- [x] Verify view type mapping (side→sideClose, walk→sideFull, back→backFull)
- [x] Created batch generateAllViews endpoint that generates all 3 views in parallel
- [x] Updated frontend to use batch endpoint and populate all thumbnails at once
- [ ] Ensure export includes all generated views
- [ ] Check workflow progression after all views are generated


## Bug Fix: Export CORS Errors
- [x] Export function failing to fetch S3 images due to CORS
- [x] Create server-side image proxy endpoint to fetch images (proxyImage)
- [x] Update frontend export to use proxy endpoint for ZIP and PDF images


## UX Enhancements - Performance Perception
- [x] Optimistic thumbnail updates - Show placeholder in thumbnail strip when generation starts
- [x] Progress stages - Break loading into visible stages with rotating tips every 4s
- [x] Background pre-loading - Pre-load icons and fonts during idle time

## UX Enhancements - Premium Feel
- [x] Subtle ambient animations - Slow-moving gradient backgrounds in empty state (ambient-gradient, animate-float)
- [x] Custom cursors - Brush cursor for masking, eraser cursor for eraser tool (cursor-brush, cursor-eraser)
- [x] Loading variety - Rotate through different loading messages/tips during generation

## UX Enhancements - UI/Styling
- [x] Micro-interactions - Scale/glow effects on button hovers (hover-scale, hover-glow, active:scale-95)
- [x] Visual hierarchy - Section indicator dots, left border on content, required field styling
- [x] Floating action feedback - Pulse animation on Generate button (animate-button-pulse)
- [x] Toast notifications redesign - Styled toasts with icons, progress bars, slide-in animations

## UX Enhancements - Image Loading
- [x] Progressive blur-to-sharp loading - blur-loading class with transition to sharp on load
- [x] Skeleton shimmer effect - skeleton-shimmer animation for loading states
- [x] Fade-in transition - Opacity 0→1 over 300ms when images load (blur-loading.loaded)
- [x] Low-res preview first - Blurred placeholder transitioning to full image
- [x] Fix null classList error at line 3284 in CastingStudio.tsx
- [ ] Fix 'No image generated' API mutation error (added logging to diagnose)

## Casting Studio Audit - Phase 1: Types Foundation

### Comparison: Reference types.ts vs Our Implementation

**Reference App types.ts:**
- GenerationMode: NEW, REFERENCE, ITERATE ✓
- ImageResolution: STD='1K', HIGH='2K', ULTRA='4K' ✓
- AspectRatio: SQUARE, PORTRAIT, LANDSCAPE, TALL, WIDE ✓
- SkinTextureType: 5 options ✓
- SkinFinishType: 4 options ✓
- ModelPreferences: Complete interface with castingTone, hairSides ✓
- ModelViews: frontClose, frontFull, sideClose, sideFull, backFull ✓
- GeneratedAsset: id (string), imageUrl, views, masterPrompt, technicalSchema, timestamp, resolution, engine, isExpanding ✓
- GenerationState: isGenerating, currentStep, error ✓

**Our Implementation (3 locations):**

1. **client/src/types/castingStudio.ts** - MATCHES REFERENCE ✓
   - Exact copy of reference types

2. **client/src/pages/CastingStudio.tsx** (inline types) - SIMPLIFIED VERSION
   - GeneratedAsset: id (number), viewType, storageUrl - DIFFERENT STRUCTURE
   - ModelPreferences: Missing castingTone, hairSides fields
   - GenerationState: Added progress, startTime, estimatedDuration - ENHANCED

3. **server/geminiService.ts** - BACKEND VERSION
   - ModelPreferences: All fields optional, missing castingTone, hairSides
   - ImageResolution: Uses pixel dimensions (1024x1024) instead of labels (1K)
   - ModelViews: Uses 'headshot' instead of 'frontClose'

### Issues Found:
- [ ] MISMATCH: CastingStudio.tsx GeneratedAsset uses different structure than reference
- [ ] MISMATCH: geminiService.ts ImageResolution uses different format
- [ ] MISMATCH: geminiService.ts ModelViews uses 'headshot' vs 'frontClose'
- [ ] MISSING: castingTone field in CastingStudio.tsx ModelPreferences
- [ ] MISSING: hairSides field in CastingStudio.tsx ModelPreferences

### Assessment:
The inline types in CastingStudio.tsx are intentionally simplified for our database-backed architecture.
The reference app stores everything client-side, while we persist to database with different ID types.
This is acceptable as long as the UI/API contract is maintained.


## Casting Studio Audit - Phase 1 Part 2: Constants (AI Brain)

### MASTER_PROMPT_SYSTEM_INSTRUCTION Comparison

| Element | Reference App | Our Implementation | Status |
|---------|--------------|-------------------|--------|
| JSON Output Format | "natural_description" + "technical_schema" | Same | ✓ Match |
| Style Guide | Ultra realistic, editorial language, no fluff | Same | ✓ Match |
| Location Boundaries | Tattoo/scar geometry rules | Same | ✓ Match |
| Technical Schema Structure | subject, facial_features, context | Same | ✓ Match |
| responseMimeType | "application/json" | Same | ✓ Match |

### Other Constants Comparison

| Constant | Reference App | Our Implementation | Status |
|----------|--------------|-------------------|--------|
| INTERNAL_GENERATION_PREFIX | Defined but UNUSED in code | Not present | ✓ OK (unused) |
| UPSCALE_PROMPT | Present | Present and identical | ✓ Match |
| DEFAULT_PLACEHOLDER_IMAGE | picsum.photos URL | Not present | ⚠️ Missing |
| SAFETY_SETTINGS | All BLOCK_NONE | Same | ✓ Match |
| BASE_STUDIO_SETTINGS | Visual directives | Same | ✓ Match |
| CLEAN_SKIN_RULE | Rule #6 for clean skin | Same | ✓ Match |
| TATTOO_PERSISTENCE_RULE | Rule #6 for tattoos | Same | ✓ Match |

### Service Layer JSON Parsing

Both implementations correctly:
1. Set `responseMimeType: "application/json"` to enforce JSON output
2. Strip markdown code fences: `jsonText.replace(/```json/g, '').replace(/```/g, '')`
3. Parse and extract: `parsed.natural_description` and `parsed.technical_schema`
4. Use fallback models on 403/404 errors

### Assessment:
The constants and system instructions are **functionally identical**. The INTERNAL_GENERATION_PREFIX is defined but never used in the reference app, so its absence in our code is not an issue. The DEFAULT_PLACEHOLDER_IMAGE is also not critical as we use database-backed asset storage.

**Verdict: PASS** - The AI "brain" is correctly configured.


## Casting Studio Audit - Phase 2: geminiService.ts (Backend Logic Layer)

### 1. generateMasterPrompt - Preference Injection

| Preference Field | Reference App | Our Implementation | Status |
|-----------------|--------------|-------------------|--------|
| gender | ✓ Injected | ✓ Injected | ✓ Match |
| age | ✓ Injected | ✓ Injected | ✓ Match |
| ethnicity | ✓ Injected | ✓ Injected | ✓ Match |
| bodyType | ✓ Injected | ✓ Injected | ✓ Match |
| faceShape | ✓ Injected | ✓ Injected | ✓ Match |
| skinTone | ✓ Injected | ✓ Injected | ✓ Match |
| eyeColor | ✓ Injected | ✓ Injected | ✓ Match |
| hairStyle | ✓ Injected | ✓ Injected | ✓ Match |
| hairColor | ✓ Injected | ✓ Injected | ✓ Match |
| hairLength/Texture/Fringe/Parting/Volume | ✓ Injected | ✓ Injected | ✓ Match |
| hairFlyaways/Hairline/Tuck/Fade | ✓ Injected | ✓ Injected | ✓ Match |
| castingBrand | ✓ Brand descriptors | ✓ Brand descriptors | ✓ Match |
| castingVibe (tri-blend) | ✓ Percentage blend | ✓ Percentage blend | ✓ Match |
| jawline/cheekbones/cheeks | ✓ Feature list | ✓ Feature list | ✓ Match |
| eyeShape/noseShape/lipShape | ✓ Feature list | ✓ Feature list | ✓ Match |
| eyebrowStyle | ✓ With special handling | ✓ With special handling | ✓ Match |
| facialHair (male only) | ✓ Conditional | ✓ Conditional | ✓ Match |
| features | ✓ Additional traits | ✓ Additional traits | ✓ Match |
| skinTexture/skinFinish | ✓ getSkinDescription() | ✓ getSkinDescription() | ✓ Match |

**Verdict: PASS** - All preferences are correctly injected into the text prompt.

### 2. generateCastingImage - Two-Step Pipeline

| Pipeline Step | Reference App | Our Implementation | Status |
|--------------|--------------|-------------------|--------|
| NEW mode prompt construction | prefix + wardrobe + expression + studio + masterPrompt | Same structure | ✓ Match |
| ITERATE mode prompt construction | frameDirective + framingLock + surgicalInstructions | Same structure | ✓ Match |
| Brand directives | getBrandDirectives() | getBrandDirectives() | ✓ Match |
| Negative constraints | getNegativeConstraints() | getNegativeConstraints() | ✓ Match |
| Dynamic studio settings | getStudioSettings() | getStudioSettings() | ✓ Match |
| Model fallback (pro → flash) | ✓ 403/404 handling | ✓ 403/404 handling | ✓ Match |

**Verdict: PASS** - Two-step pipeline is correctly implemented.

### 3. maskImageBase64 Logic - Surgical Edit/Eraser

| Multipart Request Component | Reference App | Our Implementation | Status |
|---------------------------|--------------|-------------------|--------|
| IMAGE 1: referenceImageBase64 | ✓ TARGET SOURCE | ✓ TARGET SOURCE | ✓ Match |
| IMAGE 2: maskImageBase64 | ✓ GUIDE OVERLAY (PNG, red region) | ✓ GUIDE OVERLAY (PNG, red region) | ✓ Match |
| IMAGE 3: additionalReferenceBase64 | ✓ ATTRIBUTE REFERENCE | ✓ ATTRIBUTE REFERENCE | ✓ Match |
| inputMapDescription | ✓ Describes each image role | ✓ Describes each image role | ✓ Match |
| Surgical with tattoo reference | ✓ INK REALISM PROTOCOL | ✓ INK REALISM PROTOCOL | ✓ Match |
| Surgical without reference | ✓ SEMANTIC INPAINTING | ✓ SEMANTIC INPAINTING | ✓ Match |
| Skin feature protocol | ✓ SCARS/BIRTHMARKS/SPOTS rules | ✓ SCARS/BIRTHMARKS/SPOTS rules | ✓ Match |
| Framing lock (headshot) | ✓ GEOMETRY ENFORCEMENT | ✓ GEOMETRY ENFORCEMENT | ✓ Match |

**Verdict: PASS** - Mask/guide image logic is correctly implemented for surgical edit and eraser tools.

### 4. Additional Functions Comparison

| Function | Reference App | Our Implementation | Status |
|----------|--------------|-------------------|--------|
| generateFullBody | ✓ Present | ✓ Present (identical) | ✓ Match |
| generateRemainingViews | ✓ Present (3 views parallel) | ✓ Present (identical) | ✓ Match |
| generateSingleView | Not present | ✓ Added (enhanced) | ✓ Enhanced |
| upscaleExistingImage | ✓ Present | ✓ Present (identical) | ✓ Match |
| enhanceUserPrompt | ✓ Present | ✓ Present (identical) | ✓ Match |

### Overall Assessment

The geminiService.ts implementation is **functionally identical** to the reference app with one enhancement:
- Added `generateSingleView()` function for generating individual views instead of all 3 at once

**Verdict: PASS** - All critical functionality is correctly implemented.


## Casting Studio Audit - Phase 3: Complex UI Helpers

### 1. TriBlendSelector.tsx - Barycentric Coordinate Math

**Geometry Constants:**
| Constant | Reference | Ours | Status |
|----------|-----------|------|--------|
| WIDTH | 280 | 280 | ✓ Match |
| HEIGHT | 240 | 240 | ✓ Match |
| PADDING_TOP | 25 | 25 | ✓ Match |
| PADDING_BOTTOM | 25 | 25 | ✓ Match |
| PADDING_X | 25 | 25 | ✓ Match |
| Vertex A (Editorial) | (140, 25) | (140, 25) | ✓ Match |
| Vertex B (Commercial) | (25, 215) | (25, 215) | ✓ Match |
| Vertex C (Runway) | (255, 215) | (255, 215) | ✓ Match |

**Barycentric Math Verification:**

The formula `getWeightsFromXY(x, y)` uses standard barycentric coordinates:
```
denominator = (B.y - C.y) * (A.x - C.x) + (C.x - B.x) * (A.y - C.y)
u = ((B.y - C.y) * (x - C.x) + (C.x - B.x) * (y - C.y)) / denominator  // Editorial
v = ((C.y - A.y) * (x - C.x) + (A.x - C.x) * (y - C.y)) / denominator  // Commercial
w = 1 - u - v  // Runway
```

**Weight Output Guarantees:**
1. Corner snap at 96%: `if (u > 0.96) { u = 1; v = 0; w = 0; }` ✓
2. Safety clamp: `u = Math.max(0, Math.min(1, u))` ✓
3. Normalization: `u /= sum; v /= sum; w /= sum;` ✓
4. Output format: `{ editorial: u, commercial: v, runway: w }` ✓

**Verdict: PASS** - Weights are guaranteed to be between 0.0 and 1.0, summing to 1.0.

### 2. HairColorWheel.tsx - Color-to-String Mapping

**Color Data:**
| Category | Reference Count | Ours Count | Status |
|----------|-----------------|------------|--------|
| NATURAL_COLORS | 16 | 16 | ✓ Match |
| DYED_COLORS | 22 | 22 | ✓ Match |

**String Output Format:**
| Tone | Output Format | Example | Status |
|------|---------------|---------|--------|
| Neutral | `{label}` | "Copper" | ✓ Match |
| Warm | `Warm {label}` | "Warm Copper" | ✓ Match |
| Cool | `Cool / Ash {label}` | "Cool / Ash Copper" | ✓ Match |

**commitSelection() Logic:**
```typescript
let finalString = color.label;
if (tone === 'Warm') {
    finalString = `Warm ${color.label}`;
} else if (tone === 'Cool') {
    finalString = `Cool / Ash ${color.label}`;
}
onColorSelect(finalString);
```

**Enhancement in Our Implementation:**
- Added `userInteractedRef` to prevent auto-commit during initialization
- Added `lastExternalColorRef` to prevent re-initialization loops
- Added `initializedRef` to track first load

**Verdict: PASS** - Color strings match expected format for service layer (e.g., "Warm Copper", "Cool / Ash Platinum").

### Overall Phase 3 Assessment

Both complex UI helpers are **functionally identical** to the reference with minor stability improvements in HairColorWheel to prevent initialization loops.


## Casting Studio Audit - Phase 4: Main UI Composition

### 1. ControlPanel.tsx → CastingStudio.tsx (Integrated)

**Architecture Difference:**
- Reference app: Separate `ControlPanel.tsx` component
- Our app: Control panel integrated directly into `CastingStudio.tsx`

**State Management Verification:**

| UI Element | Reference updatePref | Our updatePref | Status |
|------------|---------------------|----------------|--------|
| castingBrand | `updatePref('castingBrand', opt.value)` | `updatePref('castingBrand', opt.value)` | ✓ Match |
| castingVibe | `updatePref('castingVibe', val)` | `updatePref('castingVibe', val)` | ✓ Match |
| gender | `updatePref('gender', val)` | `updatePref('gender', opt.value)` | ✓ Match |
| age | `updatePref('age', e.target.value)` | `updatePref('age', e.target.value)` | ✓ Match |
| ethnicity | `handleEthnicityClick()` → `updatePref('ethnicity', ...)` | Same logic | ✓ Match |
| bodyType | `updatePref('bodyType', opt.value)` | `updatePref('bodyType', opt.value)` | ✓ Match |
| faceShape | `updatePref('faceShape', val)` | `updatePref('faceShape', val)` | ✓ Match |
| eyebrowStyle | `updatePref('eyebrowStyle', val)` | `updatePref('eyebrowStyle', val)` | ✓ Match |
| jawline/cheekbones/cheeks | `updatePref(key, v)` | `updatePref(key, v)` | ✓ Match |
| eyeShape/noseShape/lipShape | `updatePref(key, v)` | `updatePref(key, v)` | ✓ Match |
| facialHair (male) | Conditional render | Conditional render | ✓ Match |
| skinTone | `updatePref('skinTone', tone.value)` | `updatePref('skinTone', tone.value)` | ✓ Match |
| skinTexture/skinFinish | `updatePref(key, v)` | `updatePref(key, v)` | ✓ Match |
| eyeColor | `updatePref('eyeColor', val)` | `updatePref('eyeColor', val)` | ✓ Match |
| hairColor | `updatePref('hairColor', val)` | `updatePref('hairColor', val)` | ✓ Match |
| hairStyle | `updatePref('hairStyle', style)` | `updatePref('hairStyle', style)` | ✓ Match |
| hairLength/Texture/Fringe/Parting | `updatePref(key, v)` | `updatePref(key, v)` | ✓ Match |
| hairVolume | `updatePref('hairVolume', v)` | `updatePref('hairVolume', v)` | ✓ Match |
| hairFlyaways/Hairline/Tuck/Fade | `updatePref(key, v)` | `updatePref(key, v)` | ✓ Match |
| referenceImage | `updatePref('referenceImage', img)` | `updatePref('referenceImage', img)` | ✓ Match |

**updatePref Function Comparison:**
```typescript
// Reference:
const updatePref = (key: keyof ModelPreferences, value: any) => {
    setPrefs({ ...prefs, [key]: value });
};

// Ours (type-safe):
const updatePref = <K extends keyof ModelPreferences>(key: K, value: ModelPreferences[K]) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
};
```

**Verdict: PASS** - Our implementation is type-safe and functionally identical.

### 2. ImageViewer.tsx → CastingStudio.tsx (Integrated)

**Architecture Difference:**
- Reference app: Separate `ImageViewer.tsx` component with `onRefine` callback
- Our app: Image viewer and canvas logic integrated into `CastingStudio.tsx`

**Canvas Overlay Logic (getGuideOverlayDataUrl):**

| Feature | Reference | Ours | Status |
|---------|-----------|------|--------|
| Canvas creation | `document.createElement('canvas')` | Same | ✓ Match |
| Canvas dimensions | `img.naturalWidth/Height` | Same | ✓ Match |
| Brush size | `Math.max(10, img.naturalWidth * 0.04)` | Same | ✓ Match |
| Line cap/join | `'round'` | Same | ✓ Match |
| Primary stroke | `rgba(255, 0, 0, 0.45)` | Same | ✓ Match |
| Secondary stroke | `rgba(255, 0, 0, 0.1)` at 80% width | Same | ✓ Match |
| Path normalization | `path[0].x * cvs.width` | Same | ✓ Match |
| Output format | `cvs.toDataURL('image/png')` | Same | ✓ Match |

**Key Difference:**
- Reference draws base image first: `ctx.drawImage(img, 0, 0)`
- Ours uses transparent background: `ctx.clearRect(0, 0, cvs.width, cvs.height)`

This is an **intentional improvement** - we send only the mask overlay to the server, which composites it with the original image. This reduces data transfer and allows the server to handle the compositing.

**handleRefineSubmit → performIteration Argument Verification:**

| Argument | Reference | Ours | Status |
|----------|-----------|------|--------|
| refinementText | `refineInput` or auto-prompt for eraser | Same | ✓ Match |
| activeView | `activeView` | `activeView` (via currentAsset lookup) | ✓ Match |
| maskBase64 | `getGuideOverlayDataUrl()` | `await getGuideOverlayDataUrl()` | ✓ Match |

**Eraser Tool Auto-Prompt:**
```typescript
// Reference:
const prompt = "FIX ARTIFACT: Remove the content in the masked area...";
onRefine(prompt, activeView, maskBase64);

// Ours:
const prompt = "FIX ARTIFACT: Remove the content in the masked area...";
await performIteration(prompt, maskBase64);
```

**Verdict: PASS** - Canvas overlay logic and argument passing are correct.

### Overall Phase 4 Assessment

Both ControlPanel and ImageViewer functionality are **correctly integrated** into CastingStudio.tsx with:
1. Type-safe state management
2. Identical canvas overlay rendering
3. Correct argument passing for surgical edit/eraser


## Casting Studio Audit - Phase 5: The Orchestrator (Integration)

### 1. handleGenerate Flow Verification

**Reference App Flow:**
```
handleGenerate() 
  → executeGeneration(GenerationMode.NEW)
    → generateMasterPrompt(prefs, mode) → { natural, schema }
    → generateCastingImage(masterPrompt, refImage, res, aspect, mode, text, styleRef, brand, frame, vibe, mask)
    → setCurrentAsset(newAsset)
```

**Our App Flow:**
```
handleGenerate()
  → createModelMutation.mutateAsync({ preferences, name })
    → Backend: generateMasterPrompt() → { natural, schema }
    → Returns: { modelId, masterPrompt, technicalSchema }
  → generateCastingMutation.mutateAsync({ modelId, referenceImage })
    → Backend: generateCastingImage()
    → Returns: { success, imageUrl, assetId }
  → setCurrentAssets([newAsset])
```

**Key Difference:** Our implementation uses a **two-step API pattern** (create model → generate image) vs reference's single `executeGeneration()` call. This is intentional for database persistence.

**Verdict: PASS** - Both call generateMasterPrompt then generateCastingImage in sequence.

### 2. handleRefine → Mask Passing Verification

**Reference App:**
```typescript
handleRefine(refinementText, targetView, maskBase64)
  → executeGeneration(ITERATE, specificIterationText, targetView, maskBase64)
    → generateCastingImage(..., maskBase64)
```

**Our App:**
```typescript
handleRefineSubmit()
  → maskBase64 = await getGuideOverlayDataUrl()
  → performIteration(prompt, maskBase64)
    → iterateMutation.mutateAsync({ modelId, feedback, assetId, maskBase64 })
      → Backend routers.ts: iterate endpoint receives maskBase64
        → geminiService.iterateModel(..., { maskBase64 })
```

**Backend Verification (routers.ts line 756-810):**
- Input schema: `maskBase64: z.string().optional()`
- Passed to service: `maskBase64: input.maskBase64`

**Verdict: PASS** - Mask is correctly passed from UI → tRPC mutation → backend service.

### 3. PDF Generation (generateIdentityPdf) Verification

**Reference App Data Mapping:**
| Field | Source | Reference | Ours | Status |
|-------|--------|-----------|------|--------|
| Name | User input | `safeName` | `safeName` | ✓ Match |
| ID | Asset | `currentAsset.id` | `exportId` (generated) | ✓ Equivalent |
| Age | Schema/Prefs | `stats.age \|\| prefs.age` | `prefs.age` | ✓ Match |
| Height | Prefs | Derived from bodyType | Not included | ⚠️ Missing |
| Hair | Schema/Prefs | `stats.hair_color \|\| prefs.hairColor` | `prefs.hairColor` | ✓ Match |
| Eyes | Schema/Prefs | `stats.eye_color \|\| prefs.eyeColor` | `prefs.eyeColor` | ✓ Match |
| Date | Generated | `new Date().toLocaleDateString()` | Same | ✓ Match |
| Headshot | Views | `finalViews.frontClose` | `headshotAsset.storageUrl` | ✓ Match |
| Master Prompt | Asset | `currentAsset.masterPrompt` | `currentMasterPrompt` | ✓ Match |
| Legal Text | Static | Identical text | Identical text | ✓ Match |
| Secure Hash | Generated | `simpleHash(id + timestamp + "FORMA")` | Same algorithm | ✓ Match |

**Additional Views (Reference):**
```typescript
const additionalViews = [
  { label: "FULL BODY / WARDROBE", url: finalViews.frontFull },
  { label: "PROFILE / DETAIL", url: finalViews.sideClose },
  { label: "MOVEMENT / WALK", url: finalViews.sideFull },
  { label: "REAR / STRUCTURE", url: finalViews.backFull }
];
// Each gets its own page with addSimpleHeader()
```

**Our Implementation:**
- Images are added to ZIP but **not to PDF pages**
- PDF only contains primary headshot + stats

**Minor Gap:** Reference adds additional view pages to PDF; ours only includes headshot in PDF.

### 4. TypeScript Error (line 1271)

There's a stale reference to `trpc.generation.enhance` that doesn't exist:
```
Property 'enhance' does not exist on type...
```

This needs to be fixed - either remove the reference or add the endpoint.

### Overall Phase 5 Assessment

| Component | Status | Notes |
|-----------|--------|-------|
| handleGenerate flow | ✓ PASS | Two-step API pattern, functionally equivalent |
| handleRefine mask passing | ✓ PASS | maskBase64 correctly flows to backend |
| PDF generation | ⚠️ PARTIAL | Missing additional view pages in PDF |
| TypeScript error | ❌ FIX NEEDED | Remove stale `enhance` reference |


- [x] Fix TypeScript error on line 1271 - verified enhance endpoint exists and build passes (stale LSP cache)

## Casting Studio Audit - Phase 6: Entry & Configuration (Final Phase)

### 1. index.tsx / main.tsx Entry Point Verification

| Feature | Reference App | Our App | Status |
|---------|--------------|---------|--------|
| Root element lookup | `document.getElementById('root')` | Same | ✓ Match |
| Error handling | Throws if root not found | Uses `!` assertion | ✓ Equivalent |
| React.StrictMode | Yes | No (wrapped in providers) | ⚠️ Different |
| tRPC Provider | N/A (no backend) | Yes, properly configured | ✓ Enhanced |
| QueryClient | N/A | Yes, with error handling | ✓ Enhanced |
| Auth redirect | N/A | Yes, on UNAUTHORIZED | ✓ Enhanced |

**Key Enhancement:** Our entry point includes full tRPC/React Query setup with automatic auth redirect on 401 errors.

### 2. index.html Verification

| Feature | Reference App | Our App | Status |
|---------|--------------|---------|--------|
| Root div | `<div id="root"></div>` | Same | ✓ Match |
| Module script | `<script type="module" src="/index.tsx">` | `<script type="module" src="/src/main.tsx">` | ✓ Match |
| Viewport meta | Basic | Enhanced with `maximum-scale=1` | ✓ Enhanced |
| Google Fonts | Inter, JetBrains Mono | Geist, Inter, Space Grotesk, Instrument Serif | ✓ Enhanced |
| Tailwind CDN | Yes (runtime) | No (build-time via Vite) | ✓ Better |
| Analytics | None | Umami integration | ✓ Enhanced |

### 3. Tailwind/CSS Configuration

| Feature | Reference App | Our App | Status |
|---------|--------------|---------|--------|
| Tailwind setup | CDN with inline config | Build-time with @import | ✓ Better |
| Studio colors | Inline tailwind.config | Custom CSS classes in index.css | ✓ Match |
| Custom scrollbar | Inline styles | CSS classes (.custom-scrollbar) | ✓ Match |
| Font families | Inter, JetBrains Mono | Geist, Inter, Space Grotesk | ✓ Enhanced |
| Dark theme | Body styles only | Full OKLCH color system | ✓ Enhanced |

### 4. Font Configuration

**Reference App:**
- Inter (300-600) for UI
- JetBrains Mono (400-500) for code

**Our App:**
- Geist (300-700) for headings
- Inter (300-700) for body
- Space Grotesk (300-700) for mono/code
- Instrument Serif for decorative

**Verdict:** Enhanced font stack with more weights and decorative options.

### Overall Phase 6 Assessment: PASS

The entry and configuration files are properly set up with several enhancements over the reference:
1. Full tRPC/React Query integration with auth handling
2. Build-time Tailwind (better performance than CDN)
3. Enhanced font stack
4. Analytics integration
5. Full OKLCH color system for theming


## Premium PDF Identity Document Implementation
- [x] Replace existing PDF generation with new premium 7-page identity document design
- [x] Create server-side PDF generation service using jsPDF
- [x] Implement all 7 pages: Cover, Composite Card, Character Sheet, Director's Notes, Certificate, Technical Appendix, Legal
- [x] Update frontend export function to use new PDF generation
- [x] Test PDF export with real model data (6 unit tests passing)

## Editorial Dark Dashboard Redesign
- [x] Remove monospace tech labels ([01/08] // SYS.INIT style)
- [x] Unify typography with Geist font throughout
- [x] Soften glass morphism (reduce blur, subtler borders)
- [x] Replace gradient borders with simple 1px muted gray borders
- [x] Match border-radius values with landing page (rounded-xl)
- [x] Increase whitespace and padding to match landing page
- [x] Simplify card styling (less tech, more editorial)
- [x] Keep orange accent usage minimal and consistent

## Profile Settings Fixes
- [x] Fix display name not persisting after update (now uses displayName from profile.get query)
- [x] Ensure profile picture changes persist after refresh (already working via profileData sync)
- [x] Ensure cover photo changes persist after refresh (already working via profileData sync)
- [x] Update Profile Settings modal styling to match Editorial Dark dashboard
- [x] Test all profile changes persist after server restart (91 tests passing)

## Dashboard Profile Editing Fixes
- [x] Fix direct profile picture edits on dashboard not persisting after refresh (added upload mutations)
- [x] Fix direct cover photo edits on dashboard not persisting after refresh (added upload mutations)
- [x] Fix flash of default profile content on page refresh (wait for profileLoading, use initial fallback)
- [x] Optimize profile image loading speed (show preview immediately, upload in background)

## Dashboard Upload Improvements
- [x] Implement subtle loading spinner for avatar upload progress
- [x] Implement subtle loading spinner for banner upload progress
- [x] Add client-side image compression before uploading to reduce file sizes (avatar: 400x400, banner: 1920x600)

## Profile Settings Modal Upload UX
- [x] Replace confirmation banner with loading spinner for avatar upload
- [x] Replace confirmation banner with loading spinner for banner upload
- [x] Match the smooth loading experience from dashboard uploads

## Credits System - Phase 1: Foundation
- [x] Audit current points system implementation
- [x] Create credit cost constants (Initial: 7, Edit: 7, Eraser: 7, Body: 6, Angles: 18, Upscale: 6, Export: 30)
- [x] Update database schema - rename points to credits, add tracking fields (totalEarned, totalSpent)
- [x] Update backend routers - rename all point references to credits
- [x] Update deduction logic with new credit costs per action
- [x] Add Flash fallback detection with 50% credit cost reduction (calculateCreditCost helper)
- [x] Update all frontend UI - rename points to credits throughout
- [x] Test credit deductions work correctly (95 tests passing)

## Credits System - Phase 2: Plan Tiers & Billing
- [ ] Define plan tiers in database (Free: 100, Starter: 1500, Pro: 4000, Studio: 10000)
- [ ] Add Stripe integration via webdev_add_feature
- [ ] Create subscription products in Stripe (Starter $12, Pro $29, Studio $59)
- [ ] Create credit top-up products in Stripe (100 credits = $1.50)
- [ ] Implement subscription checkout endpoint
- [ ] Implement credit purchase endpoint
- [ ] Add monthly credit refresh logic with rollover
- [ ] Create upgrade/downgrade subscription flow
- [ ] Build billing UI in Profile Settings modal
- [ ] Add plan badge display on dashboard
- [ ] Test all billing flows


## Phase 2: Plan Tiers & Billing

### Stripe Integration
- [x] Create stripeService.ts with checkout session creation
- [x] Create customer portal session function
- [x] Create webhook handler for Stripe events
- [x] Handle checkout.session.completed event
- [x] Handle customer.subscription.updated event
- [x] Handle customer.subscription.deleted event
- [x] Handle invoice.payment_succeeded event
- [x] Handle invoice.payment_failed event

### Backend Endpoints
- [x] Add billing router to routers.ts
- [x] Create billing.createCheckoutSession endpoint
- [x] Create billing.createPortalSession endpoint
- [x] Create billing.getSubscriptionStatus endpoint
- [x] Create billing.getPricingPlans endpoint
- [x] Add subscription update functions to db.ts

### Frontend UI
- [x] Create BillingModal component with pricing cards
- [x] Create CreditTopupModal component
- [x] Add upgrade buttons to Profile Settings
- [ ] Add low balance warning with top-up prompt

### Testing
- [x] Write unit tests for billing logic (24 tests)
- [ ] Test Stripe checkout flow end-to-end (requires Stripe sandbox claim)
- [ ] Test webhook handling (requires Stripe sandbox claim)

## Phase 2 Enhancements

### Low-Balance Warning System
- [x] Create LowBalanceWarning component with toast/banner
- [x] Add warning threshold constant (50 credits)
- [x] Integrate warning into Dashboard and generation pages
- [x] Show warning after credit deduction if balance drops below threshold
- [x] Add "Top Up Now" button linking to CreditTopupModal

### Proration for Plan Changes
- [x] Add proration_behavior to Stripe checkout session
- [x] Create upgrade/downgrade endpoint with proration
- [x] Handle credit adjustments for mid-cycle changes
- [x] Update BillingModal to show prorated pricing
- [x] Add confirmation dialog for plan changes with cost preview

### Testing
- [x] Write tests for low-balance warning logic
- [x] Write tests for proration calculations

## Billing Tab Enhancement (Manus-style)

### Backend
- [x] Add billing.getInvoices endpoint to fetch Stripe invoices
- [x] Add billing.getAllInvoices endpoint with pagination
- [x] Add billing.getSubscriptionDetails endpoint for renewal date

### Frontend - Billing Tab Redesign
- [x] Show current plan with renewal date and Manage/Add credits buttons
- [x] Display credits breakdown (total, rollover, monthly)
- [x] Show recent activity/invoices list with Date, Amount, Download
- [x] Add "View all invoices" link with expand/collapse
- [x] Integrate Manage button to open billing modal
- [x] Add "Add credits" button to open topup modal

### Testing
- [x] Write tests for invoice retrieval and subscription details

## Usage Tab Feature

### Backend
- [x] Add usage.getHistory endpoint to fetch credit transactions
- [x] Add usage.getStats endpoint for consumption summary
- [x] Add usage.getDailyUsage endpoint for chart data

### Frontend - Usage Tab
- [x] Add "Usage" tab to ProfileSettingsModal navigation
- [x] Create UsageTabContent component with chart and history
- [x] Show daily credit consumption bar chart
- [x] Display generation history with type, credits used, date
- [x] Add period selector (7d, 30d, 90d)

### Testing
- [x] Write tests for usage data aggregation (13 new tests)

## Dashboard Light Mode Restyle

### Global Theme
- [ ] Update index.css with light mode color palette (canvas #FAFAFA, surface #FFFFFF, obsidian #111111)
- [ ] Add Plus Jakarta Sans font for modern typography
- [ ] Create premium-card class with subtle shadows and borders
- [ ] Update ThemeProvider to use light mode as default

### Dashboard.tsx
- [ ] Restyle sidebar with light background and subtle borders
- [ ] Update cards with premium-card styling (white bg, soft shadows)
- [ ] Change text colors to obsidian/charcoal/subtle palette
- [ ] Add technical-grid background pattern
- [ ] Update buttons with light mode styling

### Modals and Components
- [ ] Update ProfileSettingsModal for light mode
- [ ] Update BillingModal and CreditTopupModal for light mode
- [ ] Ensure all modals have consistent light styling

## Dashboard Light Mode Restyle

### Global Theme
- [x] Update index.css with light mode color palette
- [x] Change theme to light mode (warm gray/cream background)
- [x] Add custom color tokens (obsidian, charcoal, subtle, cream, etc.)
- [x] Update scrollbar and selection styles for light mode

### Dashboard.tsx
- [x] Restyle header with light mode colors
- [x] Update sidebar navigation for light mode
- [x] Restyle model cards with light backgrounds and subtle shadows
- [x] Update empty states and loading skeletons
- [x] Apply monochromatic/grayscale aesthetic from mood board

### ProfileSettingsModal
- [x] Update modal container and backdrop for light mode
- [x] Restyle sidebar tabs with light mode colors
- [x] Update form fields (inputs, textareas) for light mode
- [x] Update notifications and security tabs for light mode


## Dashboard Color Contrast Fixes

### Profile Header
- [x] Change display name text to white for readability on dark banner
- [x] Update PRO badge to use white/obsidian instead of dark blue
- [x] Ensure credits text is readable (white with drop shadow)
- [x] Add dark gradient overlay on banner for text contrast

### Usage Tab in Modal
- [x] Restyle stats cards to light backgrounds (gray-50)
- [x] Update chart area to light theme with gray bars
- [x] Restyle transaction table to match light modal design
- [x] Fix period selector buttons to light theme


## Phase 2.5: Billing & Modal Enhancements

### Annual Billing Toggle
- [x] Add annual billing toggle to BillingModal with 17% discount
- [x] Update pricing display to show monthly vs annual rates
- [x] Calculate and display annual savings

### Light Mode Modal Updates
- [x] Update BillingModal to light mode (white backgrounds, gray-900 text)
- [x] Update CreditTopupModal to light mode styling
- [x] Ensure all modal dialogs match the new light theme palette

### Profile Settings Modal Improvements
- [x] Add image compression utility to Profile Settings modal (match dashboard compression)
- [x] Show instant preview in modal while uploading (like dashboard does)
- [x] Replace inline error banner with toast notification for cleaner UX

### User Popout Light Theme
- [x] Ensure all tabs in user popout match light theme palette
- [x] Remove orange buttons and dark background accents in cards
- [x] Apply consistent gray/white color scheme across all tabs


## Phase 2.6: Remove Orange Accents from Dashboard

### Dashboard Page
- [x] Audit Dashboard.tsx for orange color classes - NONE FOUND (already monochromatic)
- [x] Replace orange accents with monochromatic alternatives (gray-900, charcoal, obsidian)
- [x] Update any orange hover states to gray variants

### Profile Settings Modal
- [x] Remove any remaining orange buttons or accents (generation badge, activity icon)
- [x] Ensure all tabs use consistent gray color scheme

### Billing & Credit Modals
- [x] Replace orange discount badges with gray or green alternatives (already done in Phase 2.5)
- [x] Update any orange CTAs to gray-900 (already done in Phase 2.5)

### Low Balance Warning
- [x] Restyle orange warning to use amber palette (maintains urgency)

### Testing
- [x] Verify no orange colors remain in dashboard UI
- [x] Ensure visual consistency across all dashboard components


## Phase 2.7: Dashboard Button & UI Restyle (Soft Blue-Gray Palette)

### Color Palette Update
- [x] Define new soft blue-gray color palette based on inspiration images
- [x] Update CSS variables in index.css with new palette
- [x] Replace dark gray-900 buttons with softer blue-gray accent

### Button Styling
- [x] Restyle primary buttons with new accent color (#6E7F8D slate)
- [x] Add subtle neumorphic shadows for depth
- [x] Update hover states to complement new palette

### UI Elements
- [x] Update cards and containers with soft shadows
- [x] Ensure text contrast meets accessibility standards
- [x] Apply consistent styling across all dashboard components

### Testing
- [x] Verify visual consistency across dashboard
- [x] Test accessibility contrast ratios

## Phase 2.8: Login Page Redesign

### Design Updates
- [x] Update login page to match dashboard light theme
- [x] Apply soft blue-gray palette (slate accent #6E7F8D)
- [x] Use consistent typography and spacing
- [x] Add neumorphic card styling for login container (card-soft class)

### Testing
- [x] Verify visual consistency with dashboard
- [x] Test responsive design on mobile

## Phase 2.9: Casting Studio Light Mode Restyle

### Background & Container Updates
- [x] Replace dark backgrounds (zinc-900, zinc-800) with light backgrounds (white, gray-50, canvas)
- [x] Update container borders from dark to light (gray-200, gray-300)
- [x] Apply card-soft neumorphic styling where appropriate

### Text & Icon Colors
- [x] Replace white/light text with dark text (obsidian, charcoal, gray-900)
- [x] Update icon colors from white to slate-accent or gray-700
- [x] Ensure proper contrast ratios for accessibility

### Button & Interactive Elements
- [x] Replace dark buttons with btn-slate styling
- [x] Update hover states to use slate-accent colors
- [x] Ensure consistent styling with dashboard buttons

### Testing
- [x] Verify visual consistency with dashboard
- [x] Test all interactive features still work correctly
- [x] Verify mobile responsiveness

## Phase 2.10: Fix Remaining Dark Elements in Casting Studio

### Issues Reported
- [x] Fix scrollbar styling (updated custom-scrollbar to light theme)
- [x] Fix tone selector under hairstyles (updated HairColorWheel to light mode)
- [x] Fix cast model button visibility (changed to slate-accent background)

## Phase 2.11: Align Casting Studio Styling with Dashboard

### Typography
- [x] Audit font families used in Casting Studio vs Dashboard
- [x] Align heading styles and weights (removed font-mono, added font-medium/font-semibold)
- [x] Standardize body text and label styling (text-xs, text-sm instead of pixel values)

### Buttons
- [x] Replace mono/uppercase button styles with dashboard button patterns
- [x] Apply btn-slate class where appropriate
- [x] Standardize hover states and transitions

### Components
- [x] Align card/panel styling with dashboard cards
- [x] Standardize select dropdowns and form inputs
- [x] Apply consistent border radius and shadows (rounded-lg)

### Testing
- [x] Verify visual consistency across both sections
- [x] Test all interactive elements still work correctly

## Phase 2.12: Casting Studio UI Polish

### Issues Reported
- [x] Fix resolution selector (1K/2K/4K) - now uses slate-accent background for selected state
- [x] Fix eye color grid - increased gap, removed grey bg, added slate-accent selection ring
- [x] Fix age slider thumb - added custom slider-slate class with visible slate thumb
- [x] Fix tooltips - updated to light mode (white bg, gray border, charcoal text)
- [x] Fix debug options - now admin-only in toggleable "Admin Tools" menu


## Phase 2.13: Additional Casting Studio UI Fixes

### Issues Reported
- [x] Fix age slider track - changed to #C1CBD8 (darker blue-gray) with 6px height
- [x] Fix iris images - added white background to container, inset images 8% for clean look
- [x] Fix hair color wheel - increased swatch size to 40px, added py-3 padding, increased spacing

### Eye Preset Images Update
- [x] Replace eye preset images with new transparent PNGs
- [x] Upload all 15 eye images to S3 (ice, sky, azure, navy, grey, steel, mint, green, olive, hazel, amber, honey, brown, dark, black)
- [x] Update CastingStudio.tsx with new S3 URLs
- [x] Increase eye image size in the UI (w-14 h-14 = 56px)

### Iris Image Size and Style Update
- [x] Increase iris image size (w-12 h-12 = 48px with scale-125 on select)
- [x] Remove border ring around iris images - now standalone with ring only on selection

### Fix Iris Image Size to Match Original App
- [x] Match original app sizing: w-full aspect-square (not fixed w-11 h-11)
- [x] Use grid-cols-5 gap-2 layout
- [x] Updated border styling for light theme (border-gray-200 unselected, border-slate-accent selected)
- [x] Selected state: border-slate-accent ring-1 ring-slate-accent scale-110 z-10

### Iris Image Final Polish
- [x] Remove visible border from iris images (borderless like original)
- [x] Change to grid-cols-4 for larger individual iris images

### Age Slider Track Visibility Fix
- [x] Make age slider track darker/more visible against white background (changed from #C1CBD8 to #8A9AAB)

### Age Slider Track Color Update
- [x] Changed slider track from blue-grey (#5A6A7A) to neutral grey (#D1D5DB)

### Tone & Energy Component Font Consistency
- [x] Ensure Tone & Energy component fonts/styles match rest of control panel
- [x] Changed header from text-sm text-gray-900 to text-xs font-medium text-subtle
- [x] Changed description from font-mono to regular text-subtle/70
- [x] Changed triangle labels from font-bold text-gray-600 to font-semibold text-subtle
- [x] Changed readout text from font-mono to regular with text-subtle/text-obsidian
- [x] Changed preset chips from font-mono to regular with text-subtle/text-obsidian

### Eye Color Selector Horizontal Scroller
- [x] Convert eye color selector from 4-column grid to 2-row horizontal scroller
- [x] Save vertical space in the UI (w-12 h-12 = 48px per iris, 2 rows with gap-2)

### Increase Iris Image Size
- [x] Increase iris images from 48px (w-12 h-12) to 64px (w-16 h-16)

### Hair Color Wheel Texture Overlay
- [x] Generate grayscale hair texture image (vertical strands with highlights)
- [x] Upload texture to S3 (https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/XvNvHbhiiaEqOOfX.png)
- [x] Update HairColorWheel component to apply texture overlay using CSS blend modes
- [x] Applied to both wheel segments (SVG pattern + overlay blend) and swatches (backgroundBlendMode: overlay)

### Hair Color Swatches Scrollable
- [x] Make the bottom circle selectors (hair color swatches) scrollable/draggable
- [x] Enable horizontal scrolling with overflow-x-auto
- [x] Add drag support with cursor-grab/active:cursor-grabbing

### Eye Color Selector Draggable
- [x] Add scrollable/draggable functionality to eye color selector
- [x] Match hair color wheel styling with cursor-grab/active:cursor-grabbing
- [x] Maintain consistency between both selectors

### Eye/Hair Selector Improvements
- [x] Remove scroll from eye color selector - drag only (overflow: hidden)
- [x] Prevent text/image selection during drag (select-none, e.preventDefault)
- [x] Prevent image dragging (draggable={false}, pointer-events-none)
- [x] Add gradient fade indicators on left/right edges of eye selector
- [x] Add gradient fade indicators on left/right edges of hair selector


## DNA Helix Progress Indicator for Casting Studio
- [x] Create DNAHelix SVG component with horizontal scientific illustration style
- [x] Implement 12 base pair rungs with connecting lines
- [x] Add floating molecular particles/nodes around helix
- [x] Add hexagonal/molecular background pattern
- [x] Implement progress mapping to form completion state
- [x] Add animation states: dormant (0%), building (1-99%), complete (100%)
- [x] Add CSS animations for rotation, glow, and particle effects
- [x] Integrate with CastingStudio form validation state
- [x] Replace current CASTING STUDIO hero section with DNA component
- [x] Ensure responsive sizing for different screen sizes

## DNA Helix Cleanup
- [x] Remove status card component below DNA helix (System Status, Credits Balance, pricing info)

## DNA Helix Animation Enhancements
- [x] Implement subtle pulsing animation on active DNA rung to highlight current section
- [x] Create SEQUENCE COMPLETE celebration animation when all required fields are filled

## DNA Helix Visual Improvements
- [x] Increase particle effects density and visibility
- [x] Add interconnected lines between nodes (network/molecular style)
- [x] Make helix look more like real DNA with connecting strands
- [x] Add hover tooltips on each DNA rung showing form section status


## DNA Helix Redesign (Canvas-based)
- [x] Create new canvas-based DNA helix component matching provided design
- [x] Implement smooth animated double helix with 3D depth effect (z-axis opacity)
- [x] Add particle storm effect with interconnected network lines
- [x] Add background scattered particles with subtle connections
- [x] Add molecular circles decorations
- [x] Integrate progress tracking - rungs light up as form sections complete
- [x] Add celebration effect when sequence is complete
- [x] Replace existing SVG-based DNAHelix component with new canvas version
- [x] Ensure mobile responsiveness


## DNA Helix v2 - Improved Design
- [x] Replace current DNA helix with new provided design
- [x] Implement proper 3D depth rendering with back-to-front sorting
- [x] Add mouse grab/attract effect with connecting lines to nearby particles
- [x] Add background scattered dots with physics (gravity toward helix, orbit when close)
- [x] Add decorative circles with pulsing animation
- [x] Add molecular connection lines between circles
- [x] Integrate progress tracking - rungs light up blue as sections complete
- [x] Add green celebration effect when sequence is complete
- [x] Ensure smooth animation performance


## DNA Helix - Enhance Particle Visibility
- [x] Increase background particle size and opacity to match reference
- [x] Make decorative circles more visible with higher opacity
- [x] Ensure mouse grab effect lines are more prominent
- [x] Increase particle count for denser effect


## DNA Helix - Debug Particle Rendering Issue
- [ ] Investigate why particles are not appearing on screen
- [ ] Check if particles are being drawn but outside visible area
- [ ] Check if there's a z-index or layering issue
- [ ] Verify the drawBackgroundElements function is being called
- [ ] Fix the particle rendering issue


## DNA Helix - Revert Particle Settings to Original
- [x] Revert particle size back to original (1-4px)
- [x] Revert particle opacity back to original (0.1-0.35)
- [x] Revert particle color back to original lighter gray (120,120,120)
- [x] Revert particle count to 80
- [x] Revert mouse radius to 120px
- [x] Revert grab line opacity to 0.4
- [x] Revert inter-particle line opacity to 0.3
- [x] Keep the canvas scaling fix that made particles visible


## DNA Helix - White Glow Effect
- [x] Replace blue progress color with white glow using canvas shadowBlur
- [x] Apply white glow to lit rungs and endpoint spheres
- [x] Use white glow throughout including completion state (no green)
- [x] Add strong shadowBlur effect for luminous appearance
- [x] Update celebration burst and ripple effects to white glow


## DNA Helix - Black Glow Effect (Better Contrast)
- [x] Replace white glow with black/dark gray for lit rungs
- [x] Add subtle outer glow effect using shadowBlur
- [x] Update endpoint spheres to dark with glow
- [x] Update celebration and ripple effects to dark theme
- [x] Ensure high contrast on white background


## DNA Helix - Click-to-Navigate & Entrance Animation
- [ ] Implement click detection on DNA rungs
- [ ] Map each rung to corresponding form section ID
- [ ] Add smooth scroll to form section on rung click
- [ ] Add visual feedback (cursor change, hover effect) for clickable rungs
- [ ] Create entrance animation - helix assembles from center outward
- [ ] Add staggered reveal for rungs during entrance
- [ ] Add fade-in for particles during entrance
- [ ] Ensure entrance animation only plays once on page load


## TypeScript Cache Issue Documentation
- [x] Add dev note near generation.enhance callsite documenting stale TS cache issue
- [x] Include steps to resolve: restart TS server, restart dev server, re-run typegen


## CastingStudio Refactor - Phase 1: HairSection Extraction
- [x] Analyze HairSection code boundaries in CastingStudio.tsx
- [x] Create client/src/components/CastingStudio/HairSection.tsx
- [x] Define HairSectionProps interface with required props
- [x] Extract Hair collapsible section JSX to new component
- [x] Import and use HairSection in CastingStudio.tsx
- [x] Verify all hair options work correctly
- [x] Ensure all 149 tests still pass


## CastingStudio Refactor - Phase 2: EyeSection Extraction
- [x] Analyze EyeSection code boundaries in CastingStudio.tsx
- [x] Create client/src/components/CastingStudio/EyeSection.tsx
- [x] Define EyeSectionProps interface with required props
- [x] Extract Eye collapsible section JSX to new component
- [x] Import and use EyeSection in CastingStudio.tsx
- [x] Verify all eye color options work correctly
- [x] Ensure all 149 tests still pass


## CastingStudio Refactor - Phase 3: SkinSection Extraction
- [x] Analyze SkinSection code boundaries in CastingStudio.tsx
- [x] Create client/src/components/CastingStudio/SkinSection.tsx
- [x] Define SkinSectionProps interface with required props
- [x] Extract Skin collapsible section JSX to new component
- [x] Import and use SkinSection in CastingStudio.tsx
- [x] Verify all skin options work correctly (tone, texture, finish)
- [x] Ensure all 149 tests still pass


## CastingStudio Refactor - Phase 4: FaceSection Extraction
- [x] Analyze FaceSection code boundaries in CastingStudio.tsx
- [x] Create client/src/components/CastingStudio/FaceSection.tsx
- [x] Define FaceSectionProps interface with required props
- [x] Extract Face collapsible section JSX to new component
- [x] Import and use FaceSection in CastingStudio.tsx
- [x] Verify all face options work correctly (jawline, cheekbones, eyes, nose, lips, eyebrows, advanced)
- [x] Ensure all 149 tests still pass


## CastingStudio Refactor - Phase 5: BrandSelector Extraction
- [x] Analyze BrandSelector code boundaries in CastingStudio.tsx
- [x] Create client/src/components/CastingStudio/BrandSelector.tsx
- [x] Define BrandSelectorProps interface with required props
- [x] Extract Brand & Vibe collapsible section JSX to new component (Casting Basics: brand, vibe, gender, age, ethnicity)
- [x] Import and use BrandSelector in CastingStudio.tsx
- [x] Verify all brand and vibe options work correctly
- [x] Ensure all 149 tests still pass


## CastingStudio Refactor - Phase 6: PhysiqueSelector Extraction
- [x] Analyze PhysiqueSelector code boundaries in CastingStudio.tsx
- [x] Create client/src/components/CastingStudio/PhysiqueSelector.tsx
- [x] Define PhysiqueSelectorProps interface with required props
- [x] Extract Physique collapsible section JSX to new component
- [x] Import and use PhysiqueSelector in CastingStudio.tsx
- [x] Verify all body type options work correctly
- [x] Ensure all 149 tests still pass


## CastingStudio Refactor - Phase 7: ImageViewer Extraction (Incremental)
- [x] Analyze ImageViewer code boundaries in CastingStudio.tsx
- [x] Create client/src/components/CastingStudio/ImageViewer/ directory structure
- [x] Extract ViewTabs.tsx (view switching: frontClose, frontFull, sideClose, backFull) - ~200 lines
- [x] MaskCanvas - kept inline due to tight coupling with canvas refs and state
- [x] Extract RefinePanel.tsx (text input + enhance button) - ~250 lines
- [x] Create ImageViewer/index.tsx barrel export
- [x] Integrate ImageViewer components into CastingStudio.tsx
- [x] Verify all image viewing and generation features work correctly
- [x] Ensure all 149 tests still pass

## CastingStudio Refactor - Phase 8: ToolsBar Extraction
- [x] Analyze ToolsBar code boundaries in CastingStudio.tsx
- [x] Create client/src/components/CastingStudio/ImageViewer/ToolsBar.tsx (~165 lines)
- [x] Define ToolsBarProps interface with required props
- [x] Extract Tools Bar JSX to new component (Surgical Edit, Magic Eraser, Tool Mode Badge)
- [x] Import and use ToolsBar in CastingStudio.tsx
- [x] Remove unused ToolButton component from main file
- [x] Verify all tool buttons work correctly
- [x] Ensure all 149 tests still pass

## CastingStudio Refactor - Phase 9: DirectorsNote Extraction
- [x] Analyze DirectorsNote code boundaries in CastingStudio.tsx
- [x] Create client/src/components/CastingStudio/DirectorsNote.tsx (~70 lines)
- [x] Define DirectorsNoteProps interface with required props
- [x] Extract Bottom Panel JSX to new component (master prompt, schema toggle, copy button)
- [x] Import and use DirectorsNote in CastingStudio.tsx
- [x] Remove unused showSchema and isCopied states from main file
- [x] Verify master prompt display and schema toggle work correctly
- [x] Ensure all 149 tests still pass

## CastingStudio Refactor - Phase 10: useCastingForm Hook Extraction
- [x] Analyze form state boundaries in CastingStudio.tsx
- [x] Create client/src/hooks/useCastingForm.ts (~200 lines)
- [x] Extract ModelPreferences state and updatePref helper
- [x] Extract form-related state (modelName, validation)
- [x] Add integration documentation to hook file
- [ ] Import and use useCastingForm in CastingStudio.tsx (DEFERRED - low risk/reward)
- [ ] Verify all form interactions work correctly (DEFERRED)
- [x] Ensure all 149 tests still pass

## CastingStudio Refactor - Phase 11: useGenerationState Hook Extraction
- [x] Analyze generation logic boundaries in CastingStudio.tsx
- [x] Create client/src/hooks/useGenerationState.ts (~220 lines)
- [x] Extract generation state (genState, currentAssets, history)
- [x] Extract mutation instances and computed values
- [x] Add integration documentation to hook file
- [ ] Import and use useGenerationState in CastingStudio.tsx (DEFERRED - high complexity)
- [ ] Verify all generation features work correctly (DEFERRED)
- [x] Ensure all 149 tests still pass

## CastingStudio Refactor - Phase 12: Move Constants to Shared File
- [x] Analyze constants in CastingStudio.tsx
- [x] Create client/src/constants/casting.ts (~180 lines)
- [x] Move all casting constants to shared file (BRAND_OPTIONS, ETHNICITIES, SKIN_*, EYE_PRESETS, CHAR_OPTIONS, HAIR_*, BODY_TYPES, FACE_SHAPES, CREDIT_COSTS)
- [x] Move shared types to constants file (CastingVibe, ModelPreferences, GeneratedAsset, GenerationState, EditTool, ImageResolution)
- [x] Update CastingStudio.tsx imports to use shared constants
- [x] Remove duplicate constant/type definitions from main file (~143 lines removed)
- [x] Verify all functionality works correctly
- [x] Ensure all 149 tests still pass

## CastingStudio Refactor - Phase 13: Error Boundaries with Retry Logic
- [x] Create reusable ErrorBoundary component with retry functionality
- [x] Add GenerationErrorBoundary specialized for image generation errors
- [x] Add InlineError component for inline error display
- [x] Add useRetryHandler hook for async error handling
- [x] Add withRetry utility for automatic retry logic
- [x] Enhanced error display in CastingStudio with retry and dismiss buttons
- [x] Verify error handling works correctly
- [x] Ensure all 149 tests still pass


## CastingStudio Refactor - Phase 16: Zustand State Management Migration

### Phase 1: UI State Store
- [x] Install Zustand dependency
- [x] Create client/src/stores/useCastingUIStore.ts (~140 lines)
- [x] Define UI state: activeView, activeTool, resolution, modals (isTopupOpen, lockModal, showExportModal), panels (showMobilePanel), refine input state, auto-generation state
- [x] Migrate UI state usage in CastingStudio.tsx (replaced 15+ useState hooks with store)
- [x] Added closeLockModal helper for cleaner modal dismissal
- [x] Verify all UI interactions work correctly
- [x] Ensure all 149 tests still pass

### Phase 2: Form/Preferences Store
- [x] Create client/src/stores/useCastingFormStore.ts (~120 lines)
- [x] Define form state: prefs (ModelPreferences), modelName, currentHairFamilies
- [x] Add updatePref and resetForm helpers
- [x] Migrate form state usage in CastingStudio.tsx (replaced ~35 line prefs declaration)
- [x] Fixed setPrefs calls to use direct object instead of callback pattern
- [x] Verify all form interactions work correctly
- CastingStudio.tsx reduced from 2,370 to 2,338 lines

### Phase 3: Generation Store
- [ ] Create client/src/stores/useCastingGenerationStore.ts
- [ ] Define generation state: genState, currentAssets, history, resolution
- [ ] Migrate generation state usage in CastingStudio.tsx
- [ ] Update ViewTabs, RefinePanel, ToolsBar, DirectorsNote
- [ ] Verify all generation features work correctly


## CastingStudio Refactor - Phase 17: Update Components to Use Zustand Stores Directly
- [x] Update HairSection to import from useCastingFormStore directly
- [x] Update SkinSection to import from useCastingFormStore directly
- [x] Update EyeSection to import from useCastingFormStore directly
- [x] Update FaceSection to import from useCastingFormStore directly
- [x] Update BrandSelector to import from useCastingFormStore directly
- [x] Update PhysiqueSelector to import from useCastingFormStore directly
- [x] Remove props from CastingStudio.tsx component calls
- [x] Verify all components work correctly with direct store access
- [x] Ensure all 149 tests still pass
- CastingStudio.tsx reduced from 2,338 to 2,318 lines (20 lines removed from prop passing)


## CastingStudio Refactor - Phase 18: Generation Store (Option B - State Only)
- [x] Create client/src/stores/useCastingGenerationStore.ts
- [x] Define generation state: genState, currentModelId, currentAssets, currentMasterPrompt, currentTechnicalSchema
- [x] Define history state: history, historyIndex with undo/redo helpers
- [x] Add computed selectors: getCurrentImageUrl, canUndo, canRedo
- [x] Integrate store into CastingStudio.tsx (replace useState hooks)
- [x] Update handlers to use store setters (pushHistory helper for history management)
- [x] Verify all generation features work correctly
- [x] Ensure all 149 tests still pass
- CastingStudio.tsx reduced from 2,318 to 2,317 lines (minimal reduction due to state-only migration)
