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


## CastingStudio Refactor - Phase 19: Update ImageViewer & DirectorsNote to Use Stores
- [x] Update ViewTabs to import from useCastingGenerationStore (currentAssets) and useCastingUIStore (activeView)
- [x] Update RefinePanel to import from useCastingUIStore (activeView, activeTool, refineInput, isEnhancing, unlockMode)
- [x] Update ToolsBar to import from useCastingGenerationStore (genState, currentAssets) and useCastingUIStore (activeTool, unlockMode)
- [x] Update DirectorsNote to import from useCastingGenerationStore (currentMasterPrompt, currentTechnicalSchema)
- [x] Remove props from CastingStudio.tsx component calls
- [x] Verify all components work correctly with direct store access
- [x] Ensure all 149 tests still pass
- CastingStudio.tsx reduced from 2,317 to 2,299 lines (18 lines removed from prop passing)


## Bug Fix: Skin Tone Selection Visibility
- [x] Improve visual feedback for selected skin tone (hard to see selection against background)
- Changed from white border to dark border (border-obsidian ring-2 ring-obsidian/50) with shadow-lg


## Bug Fix: Eye Color/Iris Selection Styling
- [x] Redesign iris selection to remove large ring and black circle
- Implemented Option B (Inset Shadow): shadow-[inset_0_0_0_3px_rgba(0,0,0,0.7)] scale-105
- Inset shadow overlays on the iris image, eliminating white gap between iris and border


## Waitlist Page Restyling - Match Dashboard
- [ ] Analyze dashboard styling (colors, typography, components)
- [ ] Apply dark theme to waitlist page
- [ ] Update hero section styling
- [ ] Update all sections to match dashboard design language
- [ ] Ensure mobile responsiveness


## Waitlist Page Restyling - Match Dashboard (COMPLETED)
- [x] Update hero section colors and styling (bg-canvas, text-obsidian)
- [x] Update services/exploration section styling
- [x] Update methodology section styling
- [x] Update journal section styling (bg-studio-950, slate-accent)
- [x] Update waitlist form section styling (neumorphic inputs, btn-slate)
- [x] Update footer styling (bg-canvas, bg-studio-950/80)
- [x] Replace all orange accents with slate-accent blue-gray
- [x] Apply neumorphic shadows and soft cards
- All sections now use dashboard color palette: bg-canvas, bg-studio-950, text-obsidian/charcoal/subtle, border-border, slate-accent for highlights


## Header Update - Icon Only & Reduced Height
- [x] Remove "forma studio" text from header, keep only icon
- [x] Reduce header height/padding (py-6/py-8 → py-3/py-4)


## Waitlist Page Section Updates
- [ ] Remove "Create, Scale & Deliver" section
- [ ] Remove "Journal" section
- [ ] Restyle "Solving Problems With Intelligent AI" section to match dashboard

## Waitlist Page Cleanup & Styling Consistency
- [x] Remove "Create, Scale & Deliver" (Methodology) section
- [x] Remove "Journal" section
- [x] Restyle "Solving Problems With Intelligent AI" section to match dashboard neumorphic design
  - [x] Replace orange accents with slate-accent (#6E7F8D)
  - [x] Replace zinc grays with obsidian/charcoal/subtle
  - [x] Update background to bg-canvas
  - [x] Add neumorphic shadows and rounded corners to cards
  - [x] Update grid lines to use border color


## New Home.tsx Page (Kanso Template Replication)

- [ ] Create Home.tsx file with base structure
- [ ] Header: Sticky navigation with logo, nav links, CTA button
- [ ] Hero: Large wordmark, tagline, logo marquee, trust badges, hero image
- [ ] About Section (01): Two-tone headline, stats row, video block
- [ ] Selected Work Section (02): Project grid with hover effects
- [ ] Why Us Section (03): Bento grid with testimonial, feature cards, brand statement
- [ ] Services Section (04): Dark background, service categories with numbers
- [ ] Process Section (05): Split layout with 4-step accordion
- [ ] Pricing Section (06): Toggle, dark pricing card, features list
- [ ] Testimonials Section (07): Dark carousel with navigation
- [ ] FAQ Section (08): Accordion with 7 questions
- [ ] Blog Section (09): Three blog cards
- [ ] Footer: Dark background, large wordmark, newsletter, links
- [ ] Mobile responsive optimization
- [ ] Update App.tsx routing for new Home page


## New Home.tsx Page (Kanso Template Replication)
- [x] Header with sticky navigation (Forma® logo, nav links, Start a project CTA)
- [x] Hero section with large "Forma®" wordmark
- [x] Logo marquee with client names (Shopify, Meta, Nike, Instagram, Google, Vogue)
- [x] Trust badge (4.9/5 rating, 100+ businesses)
- [x] About section (01) with two-tone headline and stats row
- [x] Video block with play button
- [x] Selected Work section (02) with 6 project cards
- [x] Why Us section (03) with bento grid layout
- [x] Services section (04) dark background with 4 service categories
- [x] Process section (05) with 4-step workflow
- [x] Pricing section (06) with Monthly/Project toggle
- [x] Testimonials section (07) dark background with 3 cards
- [x] FAQ section (08) with 7 accordion items
- [x] Blog section (09) with 3 article cards
- [x] Footer with large "Forma® Studio" wordmark, newsletter signup, links grid
- [x] Mobile responsive navigation with hamburger menu
- [x] Routing: Home at /, Waitlist moved to /waitlist


## About Section (01) Fix - Match Kanso Template
- [x] Two-tone headline: first line black, second line gray
- [x] Stats row: horizontal single line with "/" separators (not grid)
- [x] Description paragraph: right-aligned at same level as stats
- [x] Video block: add "Play Showreel" label below play button
- [x] Overall layout: more horizontal spread


## Hero Logo Marquee Fix
- [x] Make logo marquee and trust badge inline (same row)
- [x] Add gradient fade on left edge of marquee
- [x] Add gradient fade on right edge of marquee
- [x] Trust badge right-aligned on same line


## About Section + Global Font Fix
- [x] Add Inter font via Google Fonts CDN (already present)
- [x] Set Inter as global font in index.css (already configured)
- [x] Change headline font-weight from bold to medium (500)
- [x] Convert stats to scrolling marquee with gradient fades
- [x] Make stats marquee and description inline (same row)
- [x] Add "sans-serif" pill badge below headline


## About Section Refinements
- [x] Remove "sans-serif" pill badge
- [x] Bold numbers in stats, lighter text for labels
- [x] Remove border lines from stats row
- [x] Adjust spacing on stats row


## Stats Marquee & Header Fix
- [x] Fix stats marquee overlapping/garbled text
- [x] Ensure single smooth scrolling row
- [x] Add proper spacing between stat items
- [x] Reduce header/headline font size to match Kanso


## Selected Work Section Update
- [x] Increase header font size and set font-weight 500
- [x] Add subtext paragraph below header
- [x] Update "View all projects" button with + icon
- [x] Add image zoom effect on card hover
- [x] Add black background/border on card hover
- [x] Update card info layout (name, description, year)


## Card Background Color Fix
- [x] Update project card default background to #EBEBEB


## Card Hover Effect Updates
- [x] Keep border/padding constant on hover (no margin change)
- [x] Only zoom the image inside container
- [x] Add scroll-up animation for text info bar


## Text Replacement Scroll Animation
- [x] Add stacked text (black/white) with scroll-up replacement effect on hover


## Slower Card Hover Animations
- [x] Slow down background transition to 500ms
- [x] Slow down text scroll animation to 500ms
- [x] Slow down image zoom to 700ms


## Black Color Change to #121212
- [x] Replace all bg-black with bg-[#121212]
- [x] Replace all text-black with text-[#121212]
- [x] Replace all hover:bg-black with hover:bg-[#121212]
- [x] Replace all border-black with border-[#121212]


## Why Us Section Complete Restructure
- [x] Reduce title size to match About section
- [x] Set title font-weight to 500
- [x] Change secondary text color to #757575
- [x] Restructure to 4-column bento grid
- [x] Card 1: Dark building image card + bullet list card below
- [x] Card 2: Avatar/clients card + testimonial card below
- [x] Card 3: 3 stacked feature cards with icons
- [x] Card 4: Tall dark silhouette card with "Design with intent"


## Why Us Section Card Structure Fix
- [x] Card 1: #EBEBEB outer container with 2 inner cards (dark image + white bullet list)
- [x] Card 2: #EBEBEB background with avatars/rating at top, testimonial at bottom (single card)
- [x] Card 3: #EBEBEB outer container with 3 white module cards inside
- [x] Card 4: Keep as-is (dark silhouette card)


## Header Update (Kanso Style)
- [x] Changed header from fixed full-width to sticky constrained width
- [x] Header now matches section content width (max-w-[1400px])

## Visual Style Updates (Feb 5, 2026)
- [x] Services section: Fixed + sign counter-clockwise rotation on expand
- [x] Services section: Reduced grid gap to match reference
- [x] Why Us section: Reduced grid gap to match Selected Work
- [x] Changed global font to Inter, "Inter Placeholder", sans-serif
- [x] Fixed duplicate style attributes throughout Home.tsx
- [x] Added line-height 22px to body text paragraphs
- [x] Added line-height 59px to section headlines
- [x] Changed Services section numbers to Inter font with semibold weight
- [x] Updated section labels to 16px font size
- [x] Updated section number colors to #757575
- [x] Updated Services section background to #121212
- [x] Updated various font sizes per visual editor feedback
- [x] Added Framer Motion scroll animations to all sections

## Section Removal (Feb 5, 2026)
- [x] Remove Pricing Plans section from homepage
- [x] Remove Testimonials section from homepage

## Hero Scroll Effects (Feb 5, 2026)
- [x] Add hero image scroll-unzoom effect (scale 1.1 → 1.0 on scroll)

## Button Animation Fixes
- [x] Fix plus icon to be visible by default on all buttons (View all projects, See pricing, Let's talk, Contact us, View all articles)
- [x] Plus icon now slides DOWN on hover while new icon slides in from TOP (opposite direction to text)


## Button Slide Animations
- [x] Fix plus icon animation using absolute positioning (conveyor belt effect)
- [x] Plus icon visible by default, slides down on hover while new plus slides in from top
- [x] Applied to all 6 CTA buttons: View all projects, See pricing, Let's talk, Contact us, View all articles (desktop + mobile)
- [x] Add text slide animation to header "Start a project" button (desktop + mobile)
- [x] Add text slide animation to footer "Sign up" button


## Mega Menu Implementation
- [x] Add rotating + to X animation on header button click
- [x] Create dropdown mega menu panel (not full-screen) matching Kanso reference
- [x] Left column: Navigation links with numbered indices (Home, About, Projects, Blog, Contact)
- [x] Left bottom: Contact info (email, phone)
- [x] Right column: Feature image with FormaStudio™ branding
- [x] Right bottom: Social links (Twitter/X, Instagram, LinkedIn)
- [x] Smooth open/close animations
- [x] Backdrop overlay with page content visible below
- [x] Hide header nav items (About, Work, Services, Pricing, Blog) when mega menu is open
- [x] Seamless blend with header - same background color, no shadow
- [x] Header rounding transition (rounded-full to rounded-t-full when menu opens)
- [x] Header straight sides with slight bottom corner rounding only
- [x] Added opacity (95%) and backdrop blur to header and mega menu
- [x] Smooth roll-down animation using scaleY with origin-top
- [x] Slower/smoother mega menu animation (0.5s with ease-out curve)
- [x] Constant header background color and opacity (no changes on toggle)
- [x] Consistent header color - solid #EBEBEB for both header and mega menu (no opacity)
- [x] Fixed header z-index (z-100) to sit above backdrop overlay - header and mega menu now appear as one cohesive component
- [x] Fixed backdrop overlay to start below header (top: 56px) - header and mega menu now have consistent color
- [x] Mega menu dropdown constrained to same width as header (max-w-[1520px])
- [x] Fixed white strip issue - header uses conditional rounded-b-xl/rounded-b-none, mega menu has rounded-b-xl
- [x] Moved backdrop outside header element so z-index works correctly - header+menu now sits on top of backdrop
- [x] Changed header corners from rounded-xl to rounded-b-xl so only bottom corners are rounded (sides are straight)

## Mega Menu Bug Fixes
- [x] Fix mega menu background color to match header (#EBEBEB) - currently appears lighter/white
- [x] Fix mega menu bottom corners to be rounded (currently square)

## Design System Cleanup & Architecture
- [x] Fix duplicate inline styles in StatsMarquee (line 576)
- [x] Standardize headline sizes to 54px (Work section uses 64px)
- [x] Align FAQ accordion timing to 500ms
- [ ] Fix mixed font-weight patterns (Tailwind vs inline)
- [ ] Remove redundant container padding overrides
- [x] Create design system architecture proposal
- [x] Fix TypeScript errors related to Framer Motion easing types

## Design System Phase 1 Implementation
- [x] Create tokens.css with CSS custom properties (colors, spacing, typography, radius, motion)
- [x] Create motion.ts with Framer Motion presets and variants
- [x] Create animations.css with keyframe animations
- [x] Integrate new files into index.css

## Design System Phase 2 - Reusable Components
- [x] Create Section component with label and container
- [x] Create Container component with max-width and padding
- [x] Create Card component variants (outer, inner, project)
- [x] Create Button component with conveyor animation
- [x] Create Tag component
- [x] Create Heading component (section, hero variants)
- [x] Create Grid component with presets
- [x] Create ConveyorText component for hover animations

## Home.tsx Refactoring to Design System
- [ ] Import all design system components
- [ ] Replace section wrappers with Section component
- [ ] Replace containers with Container component
- [ ] Replace section labels with SectionLabel component
- [ ] Replace buttons with Button component (conveyor animation)
- [ ] Replace cards with Card variants
- [ ] Replace headings with SectionHeading/HeroHeading
- [ ] Replace body text with BodyText component
- [ ] Replace tags with Tag component
- [ ] Replace grid layouts with Grid component
- [ ] Remove duplicate inline styles and use tokens

## Phase 1 - Quick Wins (Claude's Optimization Guide)
- [x] Fix FAQ Plus icon rotation (180° → 45°)
- [x] Fix footer grid columns (4 → 3)
- [x] Add loading="lazy" to below-fold images (7 images updated)

## Phase 2 - Extract Conveyor Belt Button Pattern
- [ ] Review existing Button component in design system
- [ ] Identify all conveyor belt button instances in Home.tsx
- [ ] Update Button component to support all variants
- [ ] Refactor Home.tsx to use Button component

## Phase 2 - Extract Conveyor Belt Button Pattern (Claude's Optimization Guide)
- [x] Review existing Button component and identify all button instances
- [x] Update Button component to support all use cases (primary, secondary, secondary-invert, ghost variants)
- [x] Add NavLink and SocialLink components for navigation
- [x] Replace all conveyor belt buttons in Home.tsx with Button component
- [x] Replace header CTA button
- [x] Replace mobile menu CTA button
- [x] Replace mega menu social links with SocialLink component
- [x] Replace View all projects button
- [x] Replace See pricing button
- [x] Replace Let's talk button
- [x] Replace Contact us button
- [x] Replace View all articles buttons (desktop and mobile)
- [x] Replace Sign up newsletter button
- [x] Add header nav links with NavLink component

## Phase 3 - Convert Inline Styles to Tailwind Classes (Claude's Optimization Guide)
- [ ] Identify and catalog all inline style props in Home.tsx
- [ ] Convert font-related inline styles (fontSize, fontWeight, fontFamily)
- [ ] Convert spacing inline styles (padding, margin)
- [ ] Convert sizing inline styles (width, height)
- [ ] Convert border and color inline styles
- [ ] Remove conflicting padding overrides
- [ ] Verify all conversions maintain visual appearance

## Phase 3 - Convert Inline Styles to Tailwind (Claude's Optimization Guide)
- [x] Add custom utility classes to tokens.css
- [x] Convert font-related inline styles (fontWeight, fontSize, fontFamily)
- [x] Convert spacing inline styles (margin, padding)
- [x] Convert sizing inline styles (width, height)
- [x] Convert color inline styles
- [x] Convert remaining inline styles (borders, etc.)
- [x] Reduced inline styles from ~100+ to 13 (remaining are dynamic/Framer Motion specific)

## Bug Fixes
- [x] Fix Services section not displaying correctly (broken after Phase 3 changes)
- [x] Fix video section black bar at bottom of static image
- [x] Change Services section title background from #0A0A0A to #121212 to blend with card background
- [x] Add Escape key support to close mega menu for keyboard accessibility
- [x] Replace marquee text with brand logos (Facebook, Meta, Instagram, Nike, Shopify, etc.)
- [x] Add conveyor belt animation to footer menu links
- [x] Set up Klaviyo API key as environment secret
- [x] Research Klaviyo API for subscriber/profile creation
- [x] Create backend endpoint for newsletter signup
- [x] Connect footer newsletter form to Klaviyo API
- [x] Test newsletter signup flow end-to-end
- [x] Stack newsletter signup button below email input field
- [x] Add email format validation to newsletter form
- [x] Show "Thank You!" message after successful signup (like reference image)
- [x] Fix newsletter button to use #EBEBEB background by default, only change text on success
- [x] Add conveyor belt animation to "Sign up" button text, keep "Thank You!" static
- [x] Show "This email is already on the list." message for duplicate newsletter signups
- [x] Security audit: verify all sensitive routes use protectedProcedure
- [x] Audit credit deduction flow for race conditions and bypass vulnerabilities
- [x] Add rate limiting to public endpoints (waitlist, newsletter)
- [x] Add rate limiting to generation endpoints to prevent API abuse
- [x] Remove unused imports (ChevronLeft, ChevronRight, ArrowRight)
- [x] Remove unused variables (staggerItem, pricingFeatures)
- [x] Fix "Kanso" → "Forma" in testimonial
- [x] Use testimonials array instead of hardcoded quote
- [x] Add TypeScript interfaces for data arrays (Project, Service, FAQ, BlogPost)
- [x] Memoize formatTime function
- [x] Convert remaining inline styles to Tailwind classes (partial - some complex styles kept inline)
- [x] Add ARIA labels to navigation buttons
- [x] Add skip link for accessibility
- [x] Create reusable withAtomicCredits helper for universal credit deduction security
- [x] Apply atomic credit pattern to fullBody generation endpoint
- [x] Apply atomic credit pattern to multiView generation endpoint
- [x] Apply atomic credit pattern to generateAllViews endpoint
- [x] Apply atomic credit pattern to iterate endpoint
- [x] Apply atomic credit pattern to upscale endpoint
- [x] Add developer documentation for atomic credit pattern (see docs/ATOMIC_CREDITS.md)


## Developer Documentation & Audit Logging
- [x] Create docs/ folder structure
- [x] Write docs/SECURITY_OVERVIEW.md with index of all security guides
- [x] Write docs/ATOMIC_CREDITS.md with pattern explanation and examples
- [x] Write docs/AUTHENTICATION.md covering auth flow and protected procedures
- [x] Write docs/RATE_LIMITING.md covering rate limit implementation
- [x] Add audit_logs database table for sensitive operations
- [x] Create auditLog helper function for consistent logging
- [x] Implement abuse detection patterns (failed credits, rapid deletions, unusual billing)
- [x] Add owner notifications for detected abuse via notifyOwner helper
- [x] Integrate audit logging into billing endpoints (createSubscriptionCheckout, cancelSubscription, updateSubscriptionPlan, createTopupCheckout)
- [x] Integrate audit logging into model deletion endpoint
- [x] Write vitest tests for audit logging and abuse detection (19 tests)


## Admin Audit Logs Dashboard
- [x] Create tRPC admin procedures for querying audit logs
- [x] Create tRPC admin procedure for abuse alerts summary
- [x] Create AuditLogs admin dashboard page component
- [x] Implement audit log table with filtering and pagination
- [x] Implement abuse alerts section with severity indicators
- [x] Add real-time refresh capability for monitoring
- [x] Add route to admin navigation (/admin/audit-logs)
- [x] Write vitest tests for admin audit procedures (20 tests)


## User Account Suspension & Audit Enhancements
- [x] Add suspendedAt and suspendedReason fields to user schema
- [x] Create admin.suspendUser procedure
- [x] Create admin.unsuspendUser procedure
- [x] Add real-time suspension check to protectedProcedure middleware
- [x] Add suspension check to authentication flow (OAuth callback)
- [x] Add suspend/unsuspend buttons to audit log details modal
- [x] Add authentication event logging (login success, login failed, login blocked)
- [x] Integrate auth events into audit logs page
- [x] Add per-user rate limiting (protect against distributed attacks)
- [x] Add account lockout after failed login attempts (5 attempts = 15 min lockout)
- [x] Add global anomaly detection (system-wide attack detection - 50+ failed logins in 5 min)
- [x] Add credential stuffing detection pattern
- [x] Add admin access link to dashboard sidebar (admin only)
- [x] Implement CSV export for filtered audit logs (up to 1000 records)
- [x] Write vitest tests for suspension, auth logging, and attack protection (210 tests total)


## Security Audit Gap Fixes
- [x] Update AUTHENTICATION.md with suspension/lockout documentation
- [x] Update RATE_LIMITING.md with per-user rate limiting and global attack detection
- [x] Update Login.tsx with error message UI for suspended/locked users


## IP Blocking & Slack Notifications
- [x] Create blocked_ips database table with IP, reason, blockedBy, expiresAt fields
- [x] Create emergency_tokens table for secure action tokens
- [x] Add IP blocking check to rate limiter middleware
- [x] Create admin.blockIP and admin.unblockIP procedures
- [x] Create admin.listBlockedIPs procedure
- [x] Add "Block IP" button to audit logs page for IP-related events
- [x] Create blocked IPs management section in audit logs page (Blocked IPs tab)
- [x] Implement Slack notification system with interactive buttons
- [x] Create /api/slack/interactions endpoint for button actions
- [x] Add SLACK_WEBHOOK_URL and SLACK_SIGNING_SECRET secrets (to be configured)
- [x] Integrate Slack notifications into abuse detection
- [x] Update RATE_LIMITING.md with IP blocking documentation
- [x] Create NOTIFICATIONS.md security guide
- [x] Write vitest tests for IP blocking and Slack notifications (242 tests total)


## User Management Admin Page
- [x] Create admin.listUsers procedure with search, pagination, and filters
- [x] Create admin.getUserDetails procedure for full user profile and activity
- [x] Create admin.adjustCredits procedure for adding/deducting credits
- [x] Create admin.getUserActivity procedure for user's audit log history
- [x] Create AdminUserManagement.tsx page component
- [x] Implement user search with name/email filters
- [x] Implement user table with pagination
- [x] Implement user details modal with profile info
- [x] Implement suspend/unsuspend actions (reuse existing)
- [x] Implement credit adjustment modal
- [x] Implement user activity log view
- [x] Add /admin/users route to App.tsx
- [x] Add "User Management" link to dashboard admin menu
- [x] Write vitest tests for user management procedures (261 tests total)


## Security Hardening
- [x] Make Slack signature verification stricter - always require signing secret


## Advanced Security Hardening
- [x] Implement admin activity alerts - Slack notifications for ALL admin actions
- [x] Implement admin allowlist - hardcoded list of allowed admin user IDs/emails
- [x] Implement admin action confirmation - re-authentication for sensitive actions
- [x] Implement immutable audit log - separate append-only storage for critical logs
- [x] Update security documentation with new hardening measures
- [x] Write vitest tests for new security features (277 tests total)


## Security Integration into Admin Procedures
- [x] Integrate validateAdminAccess into adminProcedure middleware
- [x] Add logAdminAction calls to all admin procedures
- [x] Add confirmation token generation endpoint for sensitive actions
- [x] Add confirmation token validation to sensitive action endpoints
- [x] Add immutable logging for critical security events (suspend, credit adjust, IP block)
- [x] Update tests for integrated security features (277 tests passing)


## Slack-Based Approval Flow for Sensitive Admin Actions
- [x] Create pending actions in-memory store with expiry management
- [x] Create Slack approval message builder with Approve/Deny buttons
- [x] Update Slack interactions endpoint to handle approve/deny callbacks
- [x] Update sensitive admin procedures to require Slack approval (suspendUser, unsuspendUser, adjustCredits, blockIP, unblockIP)
- [x] Add admin.requestApproval tRPC endpoint that initiates the flow
- [x] Add admin.checkApprovalStatus tRPC endpoint for polling from UI
- [x] Add admin.executeApproved tRPC endpoint for executing approved actions
- [x] Remove UI-only confirmation token endpoints (generateConfirmationToken, validateToken)
- [x] Write vitest tests for Slack approval flow (30 tests)
- [x] Update security documentation
- [x] Auto-approve fallback when Slack is not configured


## Three-Channel Slack Setup with Tiered Emergency Buttons
- [x] Add SLACK_ADMIN_ACTIONS_WEBHOOK_URL secret
- [x] Add SLACK_AUDIT_LOG_WEBHOOK_URL secret
- [x] Refactor slackNotification.ts to route messages to correct channel based on type
- [x] Move emergency action buttons (Block IP, Suspend User) from #security-alerts to #admin-actions
- [x] Add "Escalate to Admin" button in #security-alerts for moderator use
- [x] Add escalation handler in slackInteractions.ts
- [x] For critical severity alerts, send to both #security-alerts (info) and #admin-actions (with buttons)
- [x] Route approval requests to #admin-actions channel
- [x] Send immutable log entries to #audit-log channel
- [x] Send completed action confirmations to #audit-log channel
- [x] Update slackApproval.ts to use admin-actions webhook
- [x] Update tests for three-channel routing (329 tests passing)
- [x] Update documentation (AUTHENTICATION.md)


## Moderator Role Implementation
- [x] Add 'moderator' to user role enum in database schema
- [x] Push database migration for new role
- [x] Create moderatorProcedure middleware (allows moderator OR admin)
- [x] Create moderator read-only procedures (10 read-only queries + getUserStats)
- [x] Create escalation tRPC endpoint for moderators to escalate to #admin-actions
- [x] Build moderator dashboard UI with view-only audit logs
- [x] Build moderator user activity viewer (read-only)
- [x] Build escalation UI component (select action type, target, reason, severity)
- [x] Update App.tsx routing for /moderator route
- [x] Update Dashboard sidebar navigation for moderator role
- [x] Ensure moderators cannot access admin-only actions (separate router, no mutations)
- [x] Update RoleBadge component to support moderator role
- [x] Write vitest tests for moderator procedures and middleware (47 tests)
- [x] Update AUTHENTICATION.md with moderator role documentation


## Moderator Management in Admin Dashboard
- [x] Add updateUserRole db helper function
- [x] Add admin.changeUserRole tRPC procedure (with security logging and Slack notification)
- [x] Update AdminUserManagement UI with role change buttons (Promote to Moderator / Demote to User)
- [x] Add confirmation dialog for role changes with user preview and reason field
- [x] Prevent admins from demoting themselves or changing other admin roles
- [x] Add moderator option to role filter dropdown
- [x] Add ROLE_CHANGED audit action
- [x] Write vitest tests for role change procedure (14 tests)


## Phase 1: Credit & Generation Log Viewers for Moderators (Complete)
- [x] Review database schema for credit transactions and generation tables
- [x] Add getModeratorCreditHistory db helper function (with summary, pagination, type filter)
- [x] Add getModeratorGenerationHistory db helper function (with summary, pagination, status/type filters)
- [x] Add moderator.getUserCreditHistory tRPC procedure (read-only)
- [x] Add moderator.getUserGenerationHistory tRPC procedure (read-only)
- [x] Build credit transaction log tab in moderator user detail panel (summary cards, type filter, paginated list)
- [x] Build generation history tab in moderator user detail panel (summary cards, status/type filters, paginated list)
- [x] Add Activity/Credits/Generations sub-tab navigation in user detail sidebar
- [x] Write vitest tests for new procedures (14 tests, 405 total passing)


## Bug Fix: ModeratorDashboard Hooks Violation
- [x] Fix conditional hooks in ModeratorDashboard causing "Rendered more hooks than during the previous render" error (moved useEffect before early returns)

## Phase 2: Structured Change Request System
- [x] Create change request CRUD helper functions in server/db.ts (createChangeRequest, getChangeRequestById, listChangeRequests, updateChangeRequestStatus, getChangeRequestsByModerator)
- [x] Replace escalateToAdmin mutation with createChangeRequest in moderator router
- [x] Add getMyChangeRequests procedure to moderator router
- [x] Add listChangeRequests + getChangeRequest procedures to admin router
- [x] Add reviewChangeRequest (approve/deny) procedure to admin router
- [x] Update ModeratorDashboard escalation modal to structured change request form (type dropdown, amount field, reason, evidence)
- [x] Add "My Requests" tab to moderator dashboard with status tracking
- [x] Fix database table schema mismatch (drop and recreate change_requests table)
- [x] Send Slack notifications to #admin-actions for new change requests
- [x] Write vitest tests for change request CRUD helpers
- [x] Write vitest tests for moderator change request procedures
- [x] Write vitest tests for admin change request review procedures
- [x] Verify all 453 tests pass (48 net new tests added)

## Phase 2 Continuation: Admin Review UI + Auto-Execute

### Admin Change Request Review UI
- [x] Create AdminChangeRequests.tsx page component
- [x] Add route to App.tsx and admin sidebar navigation
- [x] Implement request list with status/type/priority filters
- [x] Implement request detail view with full context
- [x] Add approve/deny buttons with confirmation dialog and review notes
- [x] Add status badges and priority indicators
- [x] Style with dark mode matching admin dashboard aesthetic

### Auto-Execute on Approval
- [x] Update reviewChangeRequest procedure to auto-execute approved actions
- [x] Auto-execute refund_credits: call addCredits for the target user
- [x] Auto-execute add_credits: call addCredits for the target user
- [x] Auto-execute suspend_user: call suspendUser for the target user
- [x] Auto-execute unsuspend_user: call unsuspendUser for the target user
- [x] Auto-execute block_ip: call blockIp for the target IP
- [x] Log auto-executed actions to audit trail and Slack
- [x] Handle execution failures gracefully (approve but flag execution error)

### Testing
- [x] Write tests for auto-execute logic (19 new tests)
- [x] Write tests for admin review UI procedures
- [x] Verify all 472 tests pass (19 net new tests added)

## Bug Fix
- [x] Fix "User is not on admin allowlist despite having admin role" error on /admin/audit-logs

## Bug Fixes - Moderator Dashboard
- [x] Fix credit balance display showing calculated sum instead of actual user balance (now fetches from credits table via getUserCredits)
- [x] Fix black text on dark background throughout moderator dashboard (CardTitle, user details, user list names, blocked IPs)
- [x] Improve overall text contrast/readability in moderator dashboard dark mode

## Audit: Admin Pages
- [x] Audit AdminAuditLogs.tsx for mock data and disconnected features — ALL CONNECTED
- [x] Audit AdminUserManagement.tsx for mock data and disconnected features — ALL CONNECTED
- [x] Audit AdminChangeRequests.tsx for mock data — ALL CONNECTED
- [x] No issues found — all features are wired to real backend

## Minor Enhancement - Plan Tier Display
- [x] Show user's plan tier in moderator dashboard user details panel (between Credits and Joined)

## Slack Approval Gating for Sensitive Change Requests
- [x] Backend: Add Slack approval gating to reviewChangeRequest for sensitive types (suspend_user, block_ip, refund_credits, add_credits, unsuspend_user)
- [x] Slack integration: Wire Slack approval callback to complete change request execution
- [x] Frontend: Update AdminChangeRequests UI to show "Awaiting Slack Approval" state
- [x] Tests: Add/update tests for both sensitive and non-sensitive approval paths
- [x] Verify all tests pass (500 tests, 26 files)

## Fix Duplicate Slack Alert Spam
- [x] Investigate root cause of duplicate Slack alerts (4 root causes identified)
- [x] Step 1: Create centralized slackDispatcher.ts with event-based API and dedup cache
- [x] Step 2: Migrate slackNotification.ts to route through dispatcher
- [x] Step 3: Migrate slackApproval.ts and adminSecurity.ts to use dispatcher
- [x] Step 4: Remove redundant Slack calls from routers.ts
- [x] Step 5: Mock Slack in test files to stop real messages during tests
- [x] Step 6: Write tests for dispatcher dedup logic (18 tests)
- [x] Verify all tests pass (518 tests, 27 files)

## Fix TypeScript Errors
- [x] Fix pending_execution status enum mismatch in listChangeRequests (routers.ts) and db.ts
- [x] Fix selectedRequest variable declaration order in AdminChangeRequests.tsx (used before declared)
- [x] Verify 0 TS errors and all 518 tests pass (27 files)

## Critical Security Fixes
- [x] Webhook idempotency: check for duplicate referenceId in addCredits before granting credits
- [x] Chargeback handler: add charge.dispute.created and charge.dispute.closed webhook handlers
- [x] Chargeback Slack alert: send critical alert to #admin-actions + #audit-log on dispute filed/resolved
- [x] Tests for idempotency (duplicate session.id rejected) — 6 tests
- [x] Tests for chargeback handler — 6 tests + 2 edge case tests
- [x] Verify all tests pass (532 tests, 28 files)

## Chargeback Auto-Suspend + Credit Revocation (Option A)
- [x] Update handleDisputeCreated: auto-suspend user + revoke credits (idempotent via dispute_{disputeId})
- [x] Update handleDisputeClosed (won): unsuspend user + restore credits (idempotent via dispute_restore_{disputeId})
- [x] Update handleDisputeClosed (lost): keep suspended + cancel Stripe subscription
- [x] Add getCreditTransactionByRef helper to db.ts for credit restoration lookup
- [x] Tests for dispute lifecycle — 20 tests covering created/won/lost/edge cases
- [x] Verify all tests pass (536 tests, 28 files)

## Security Headers Middleware
- [x] Create securityHeaders.ts middleware with HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- [x] Register middleware in Express server setup (first middleware, before body parsers)
- [x] Write tests for all 5 headers (9 tests)
- [x] Verify all tests pass (545 tests, 29 files)

## Dependency Vulnerability Updates
- [ ] Audit all 23 vulnerabilities and assess which updates are safe
- [ ] Update @trpc/server 11.6.0 → 11.8.0+ (prototype pollution fix)
- [ ] Update other vulnerable dependencies
- [ ] Verify all tests pass after updates
- [x] Update @trpc/* from 11.6.0 to 11.9.0 (prototype pollution fix)
- [x] Update @aws-sdk/* to latest (transitive vuln fixes)
- [x] Update vite to 7.3.1 (dev dependency patch)
- [x] Update pnpm packageManager field to 10.28.2
- [x] Add pnpm overrides for tar, lodash, lodash-es, qs, mdast-util-to-hast (19→11 vulns)
- [x] Upgrade vitest from v2.1.4 to v4.0.18 (resolved transitive vite 5.x vuln, 11→9 findings)

## Security Audit Update (Feb 2026)
- [x] Add billing-alerts Slack channel webhook and dispatcher
- [x] Add subscription cancellation Slack alert
- [x] Add failed payment Slack alert
- [x] Add large credit purchase Slack alert
- [x] Add unusual consumption spike Slack alert
- [x] Move chargeback alerts to billing-alerts channel
- [x] Implement credit purchase velocity limits (3/hr, 10/day, $500/day cap)
- [x] Write tests for billing alerts and velocity limits (21 new tests, 567 total)
- [x] Update SECURITY_AUDIT.md with current audit findings
- [x] Update docs/SECURITY_OVERVIEW.md with current status
- [x] Create docs/BILLING_ALERTS.md for billing alerts and velocity limits

## Billing Alert Noise Reduction
- [x] Auto-cancel subscription after Stripe exhausts retries (next_payment_attempt is null)
- [x] Remove subscription cancellation Slack alert from webhook handler
- [x] Only alert on final payment failure (when auto-cancelling), skip retry failures
- [x] Remove large purchase alert trigger from handleCheckoutCompleted

## Stripe Refund via Change Request Workflow
- [x] Add stripe_refund to CHANGE_REQUEST_TYPES and add refund fields to schema
- [x] Add issueStripeRefund helper in stripeService.ts
- [x] Add stripe_refund execution logic in approval handler (proportional/full, credits floored at 0)
- [x] Add stripeRefundIssued Slack alert template
- [x] Add stripe_refund to createChangeRequest input validation
- [x] Add mod dashboard UI for requesting Stripe refunds
- [x] Write tests for refund calculation and execution logic (11 tests, 578 total)
- [x] Update security/billing docs (BILLING_ALERTS.md updated with refund workflow, noise reduction, auto-cancel)

## Bug Fix: Moderator Dashboard Credit History Query
- [x] Fix invalid type value sent to credit history query on moderator page (frontend select options mismatched backend Zod enum)

## Fix: Admin Change Requests Dashboard - stripe_refund support
- [x] Add stripe_refund to TYPE_CONFIG in AdminChangeRequests.tsx
- [x] Add stripe_refund to SENSITIVE_TYPES in AdminChangeRequests.tsx
- [x] Add stripe_refund to type filter options
- [x] Add refund-specific detail display (session ID, refund type, amount, credits)

## Account Deletion / GDPR
- [x] Add deleteUserData() helper in server/deleteUserData.ts (anonymize user, zero credits, delete models/assets/generations)
- [x] Add S3 cleanup for user files (avatar, banner, model assets)
- [x] Add auth.deleteAccount protected procedure (cancel Stripe, delete data, clear session)
- [x] Wire up ProfileSettingsModal Delete Account button with confirmation dialog
- [x] Write tests for account deletion logic

## Bug Fixes
- [x] Fix React hooks order violation in ProfileSettingsModal (deleteAccountMutation after early return)
- [x] Reduce session cookie maxAge from 1 year to 30 days (security hardening)
- [x] Fix NaN userId error on /moderator page (tRPC query receiving NaN instead of number)
- [x] Show visible user ID numbers in moderator dashboard (users tab, audit logs, user details)
- [x] Show visible user ID numbers in admin user management dashboard
- [x] Research & propose interactive 3D hero image (Lando Norris style depth map + mouse tracking)

## Interactive 3D Hero Image
- [x] Generate depth map from hero-image-default.png
- [x] Upload hero images (default + secondary) and depth map to S3
- [x] Install React Three Fiber + drei dependencies
- [x] Create HeroScene.tsx component with depth-map parallax
- [x] Create depth/reveal shaders (depthRevealShader.ts)
- [x] Implement soft radial crossfade reveal between base and styled images
- [x] Integrate HeroScene into existing HeroSection layout
- [x] Add mobile fallback (static image for screens < 768px)
- [x] Performance test and polish (60fps, lazy loading)
- [x] Add liquid metaball trailing effect to crossfade reveal shader (reverted — cleaner without trail)
- [x] Fix reveal blob radius — tuned to 0.5 UV space
- [x] Fix trail flashing — resolved by reverting to clean radial reveal
- [x] Increase reveal radius (0.15 → 0.5, tuned iteratively)
- [x] Fix shadow at reveal edge (apply same parallax to both textures)
- [x] Tune parallax strength to 0.012 (sweet spot before double-image)
- [x] Fix dark overlay on hero image (disable Three.js ACESFilmic tone mapping, remove bg tint)
- [x] Reduce parallax depth strength from 0.012 to 0.010
- [x] Fix double-image ghost edge artifact when cursor is at edge of hero container
- [x] Fix persistent double-image lines at hero edges (depth map blur + strength 0.008)
- [x] Pre-blur depth map offline (8px Gaussian) and remove shader-side blur for better performance
- [x] Performance audit: hero WebGL on mid-range devices, mobile fallback verification
- [x] Add frameloop="demand" to Canvas — only re-render on mouse interaction
- [x] Add touch parallax support for tablets (768–1024px)
- [x] Add WebGL capability detection fallback for broken/missing GPU drivers
- [ ] Add shimmer skeleton loading state to hero container while WebGL textures load
- [ ] Add subtle shimmer animation to the loading skeleton
- [x] Redesign login page: two-column layout (form left, testimonial + social proof right)
- [x] Style login page consistently with homepage design language
- [x] Mobile-responsive login page (stacks to single column on mobile)
- [x] Fix login page style inconsistencies: colors, buttons, animations, background must match homepage exactly
- [x] Add "Back to home" link on mobile login view (lg:hidden, below card)
- [x] Dashboard redesign Step 1: Update sidebar to Forma design system (#0A0A0A, #EBEBEB, #757575, #D4D4D4)
- [x] Dashboard redesign Step 2: Update main content area (banner, cards, Quick Actions) to Forma design system
- [x] Dashboard redesign Step 3: Update ProfileSettingsModal to Forma design system
- [x] Dashboard redesign Step 4: Update BillingModal and CreditTopupModal to Forma design system
- [x] Dashboard redesign Step 5: Update LowBalanceBanner to Forma design system (already clean)
- [x] Fix usage tab layout/formatting in ProfileSettingsModal (stats cards, chart, transaction table)
- [x] Move Upgrade Plan button next to Add Credits and rename to "Manage" in billing tab
- [x] Redesign billing tab: Manus-style layout (plan card with Manage + Add credits buttons, credits breakdown, recent activity with download links)
- [x] Redesign BillingModal as manage subscription page (plan comparison cards, upgrade/downgrade, monthly/annual toggle, add credits section)
- [x] Credits system: adding credits upgrades to next tier (same as Manus model)
- [x] Redesign BillingModal as "Manage your subscription" (plan comparison cards, monthly/annual toggle, Expand credit limit section, footer links)
- [x] Transform CreditTopupModal into "Add more credits" (Manus-style tier-based credit expansion)
- [x] Ensure dashboard Add Credits button opens the new CreditTopupModal

## Router Refactor — server/routers.ts (4,209 lines → feature-based modules)

### Step 1: Extract adminActions helper + create directory structure
- [x] Create server/routes/ directory
- [x] Create server/lib/ directory
- [x] Extract executeApprovedAdminAction (lines 62-654) to server/lib/adminActions.ts
- [x] Update routers.ts to import from server/lib/adminActions.ts
- [x] Verify: TypeScript 0 errors, 589 tests pass

### Step 2: Extract auth, credits, waitlist, newsletter (small, low-risk)
- [x] Extract auth router (lines 659-691, 33 lines) to server/routes/auth.ts
- [x] Extract credits + points routers (lines 692-827, 136 lines) to server/routes/credits.ts
- [x] Extract waitlist router (lines 828-885, 58 lines) to server/routes/waitlist.ts
- [x] Extract newsletter router (lines 2633-2678, 46 lines) to server/routes/newsletter.ts
- [x] Update routers.ts to import from new route files
- [x] Verify: TypeScript 0 errors, 589 tests pass (3,365 lines remaining)

### Step 3: Extract models, profile, registry (medium complexity)
- [x] Extract models router (lines 886-1063, 178 lines) to server/routes/models.ts
- [x] Extract profile router (lines 1843-2012, 170 lines) to server/routes/profile.ts
- [x] Extract registry router (lines 2013-2081, 69 lines) to server/routes/registry.ts
- [x] Update routers.ts to import from new route files
- [x] Verify: TypeScript 0 errors, 589 tests pass (2,954 lines remaining)

### Step 4: Extract generation router (large, high-dependency)
- [x] Extract generation router (lines 1064-1842, 779 lines) to server/routes/generation.ts
- [x] Update routers.ts to import from new route file
- [x] Verify: TypeScript 0 errors, 589 tests pass (2,180 lines remaining)

### Step 5: Extract billing and usage routers
- [x] Extract billing router (lines 2082-2594, 513 lines) to server/routes/billing.ts
- [x] Extract usage router (lines 2595-2632, 38 lines) to server/routes/usage.ts
- [x] Update routers.ts to import from new route files
- [x] Verify: TypeScript 0 errors, 589 tests pass (1,634 lines remaining)

### Step 6: Extract admin router (split into sub-modules)
- [ ] Create server/routes/admin/ directory
- [ ] Extract Slack Approval (lines 2680-2787, 108 lines) to server/routes/admin/slackApproval.ts
- [ ] Extract Audit Logs (lines 2788-3045, 258 lines) to server/routes/admin/auditLogs.ts
- [ ] Extract Role Management (lines 3046-3131, 86 lines) to server/routes/admin/roles.ts
- [ ] Extract IP Blocking (lines 3132-3276, 145 lines) to server/routes/admin/ipBlocking.ts
- [ ] Extract User Management (lines 3277-3435, 159 lines) to server/routes/admin/users.ts
- [ ] Extract Change Request Review (lines 3436-3801, 366 lines) to server/routes/admin/changeRequests.ts
- [x] Create server/routes/admin/index.ts to combine admin sub-routers
- [x] Update routers.ts to import adminRouter from server/routes/admin/index.ts
- [x] Verify: TypeScript 0 errors, 589 tests pass (512 lines remaining)

### Step 7: Extract moderator router + finalize routers.ts
- [x] Extract moderator router (lines 3803-4209, 407 lines) to server/routes/moderator.ts
- [x] Rewrite routers.ts as slim index (40 lines) combining all sub-routers
- [x] Verify: TypeScript 0 errors, 589 tests pass
- [ ] Save checkpoint (version: 3cb0cdee)

## Generation Router Split — server/routes/generation.ts (798 lines → sub-modules)
- [x] Create server/routes/generation/ directory
- [x] Extract castingImaging.ts (castingImage, fullBody, multiView, generateAllViews — 434 lines)
- [x] Extract castingRefinement.ts (iterate, upscale, proxyImage, enhance — 226 lines)
- [x] Extract castingExport.ts (generatePdf, mint, history, costs — 158 lines)
- [x] Create generation/index.ts to merge sub-routers (21 lines)
- [x] Update routers.ts import to point to generation/index.ts (no change needed — already imports from ./routes/generation)
- [x] Verify: TypeScript 0 errors, 589 tests pass
- [x] Save checkpoint (version: af549408)

## AdminActions Split — server/lib/adminActions.ts (608 lines → sub-modules)
- [x] Create server/lib/adminActions/ directory
- [x] Extract directActions.ts (suspendUser, unsuspendUser, blockIP, unblockIP, adjustCredits — 280 lines)
- [x] Extract changeRequestActions.ts (cr_suspendUser, cr_unsuspendUser, cr_refundCredits, cr_addCredits, cr_blockIP, cr_stripeRefund — 341 lines)
- [x] Create adminActions/index.ts dispatcher (36 lines, exports executeApprovedAdminAction + AdminActionContext type)
- [x] Remove old server/lib/adminActions.ts
- [x] Verify: TypeScript 0 errors, 589 tests pass
- [x] Save checkpoint (version: 11c5c9f5)

## P0: Split server/db.ts (2,531 lines → server/db/ domain modules)
- [x] Setup: Create server/db/ directory + connection.ts + index.ts scaffold
- [x] Step 1: Extract users domain (196 lines) to server/db/users.ts
- [x] Step 2: Extract credits domain (247 lines) to server/db/credits.ts
- [x] Step 3: Extract models domain (247 lines) to server/db/models.ts
- [x] Step 4: Extract generations domain (85 lines) to server/db/generations.ts
- [x] Step 5: Extract billing domain (303 lines) to server/db/billing.ts
- [x] Step 6: Extract waitlist domain (87 lines) to server/db/waitlist.ts
- [x] Step 7: Extract security domain (196 lines) to server/db/security.ts
- [x] Step 8: Extract ipBlocking domain (199 lines) to server/db/ipBlocking.ts
- [x] Step 9: Extract changeRequests domain (270 lines) to server/db/changeRequests.ts
- [x] Step 10: Extract admin domain to server/db/admin.ts + delete legacy db.ts
- [x] Step 10b: Split admin.ts (763 lines) into admin.ts (384) + moderatorQueries.ts (397) — both under 500
- [x] Final: Run full tests, verify all 589 pass, save checkpoint

## P1: Group server files by domain

### Step 1: server/slack/
- [x] Create server/slack/ directory
- [x] Move slackNotification.ts, slackDispatcher.ts, slackApproval.ts, slackInteractions.ts
- [x] Move 5 test files (slackThreeChannel, slackChannels, slackDispatcher, slackApproval, slackWebhook)
- [x] Update imports in: _core/index.ts, adminSecurity.ts, webhooks.ts, routes/billing.ts, routes/admin/slackApproval.ts, routes/admin/changeRequests.ts, lib/adminActions/directActions.ts, lib/adminActions/changeRequestActions.ts, lib/adminActions/index.ts
- [x] Update internal cross-refs within slack/ files + dynamic imports + vi.mock paths in 7 test files
- [x] Verify: TypeScript 0 errors, 589 tests pass

### Step 2: server/stripe/
- [x] Create server/stripe/ directory
- [x] Move stripeService.ts, stripeProducts.ts, webhooks.ts
- [x] Move 2 test files (stripeRefund, webhookSecurity)
- [x] Update imports in: _core/index.ts, deleteUserData.ts, routes/billing.ts, lib/adminActions/changeRequestActions.ts
- [x] Update internal cross-refs within stripe/ files + drizzle/schema paths + dynamic imports + vi.mock paths in 4 test files
- [x] Verify: TypeScript 0 errors, 589 tests pass

### Step 3: server/casting/
- [x] Create server/casting/ directory
- [x] Move aiService.ts, geminiService.ts, pdfService.ts, atomicCredits.ts
- [x] Move 3 test files (aiService, gemini, pdfService)
- [x] Update imports in: routes/credits.ts, routes/models.ts, routes/generation/castingImaging.ts, routes/generation/castingRefinement.ts, routes/generation/castingExport.ts
- [x] Update internal cross-refs within casting/ files + vi.mock paths in castingStudio.test.ts, models.test.ts
- [x] Verify: TypeScript 0 errors, 589 tests pass

### Step 4: server/security/
- [x] Create server/security/ directory
- [x] Move adminSecurity.ts, rateLimit.ts, securityHeaders.ts, deleteUserData.ts
- [x] Move test files (adminSecurity, rateLimit, securityHeaders, deleteUserData)
- [x] Update imports in: _core/index.ts, _core/trpc.ts, _core/oauth.ts, routes/auth.ts, routes/waitlist.ts, routes/newsletter.ts, routes/admin/*, routes/generation/castingImaging.ts, lib/adminActions/*
- [x] Verify: TypeScript 0 errors, 589 tests pass

### Final
- [x] Save checkpoint (version: 1de51a35)

## P2: Split + Move Large Client Components to features/

### Step 1: Home.tsx (1,614 lines) → features/home/
- [x] Create features/home/ directory
- [x] Extract homeData.ts (types, data, animation variants — 190 lines)
- [x] Extract SectionLabel.tsx (shared utility — 11 lines)
- [x] Extract Header.tsx (258 lines)
- [x] Extract HeroSection.tsx (109 lines)
- [x] Extract AboutSection.tsx (229 lines)
- [x] Extract WorkSection.tsx (78 lines)
- [x] Extract WhyUsSection.tsx (160 lines)
- [x] Extract ServicesSection.tsx (143 lines)
- [x] Extract ProcessSection.tsx (59 lines)
- [x] Extract FAQSection.tsx (80 lines)
- [x] Extract BlogSection.tsx (116 lines)
- [x] Extract Footer.tsx (193 lines)
- [x] Create barrel index.ts
- [x] Rewrite Home.tsx as thin shell (42 lines)
- [x] Verify: TypeScript 0 errors, build passes, 589 tests pass

### Step 2: ProfileSettingsModal.tsx → features/profile/
- [x] Create features/profile/ directory
- [x] Extract BillingTab.tsx (251 lines)
- [x] Extract UsageTab.tsx (239 lines)
- [x] Extract ProfileTab.tsx (392 lines)
- [x] Extract NotificationsTab.tsx (39 lines)
- [x] Extract SecurityTab.tsx (135 lines)
- [x] Create barrel index.ts
- [x] Rewrite ProfileSettingsModal.tsx as thin shell (158 lines)
- [x] Verify: TypeScript 0 errors, build passes, 589 tests pass

### Step 3: ModeratorDashboard.tsx → features/moderator/
- [x] Create features/moderator/ directory
- [x] Extract moderatorConstants.ts (106 lines — types, helpers, constants)
- [x] Extract AuditLogsTab.tsx (304 lines)
- [x] Extract UserInvestigationTab.tsx (417 lines — user list + detail card + sub-tab routing)
- [x] Extract ActivitySubTab.tsx (60 lines)
- [x] Extract CreditsSubTab.tsx (196 lines)
- [x] Extract GenerationsSubTab.tsx (190 lines)
- [x] Extract BlockedIPsTab.tsx (63 lines)
- [x] Extract MyRequestsTab.tsx (160 lines)
- [x] Extract LogDetailModal.tsx (124 lines)
- [x] Extract ChangeRequestModal.tsx (322 lines)
- [x] Extract DashboardHeader.tsx (82 lines)
- [x] Extract StatsCards.tsx (65 lines)
- [x] Extract TabNavigation.tsx (69 lines)
- [x] Create barrel index.ts (11 lines)
- [x] Rewrite ModeratorDashboard.tsx as thin shell (296 lines)
- [x] Verify: TypeScript 0 errors, build passes, 589 tests pass

### Step 4: CastingStudio.tsx → features/casting/
- [x] Create features/casting/ directory + hooks/ subdirectory
- [x] Extract castingHelpers.tsx (294 lines — constants, icons, CollapsibleSection, utils)
- [x] Extract hooks/useCastingGeneration.ts (363 lines — initial gen + iteration + refine + enhance)
- [x] Extract hooks/useCastingViewGeneration.ts (303 lines — full body + multi-view + nextStage)
- [x] Extract hooks/useCastingExport.ts (177 lines — export/mint/upscale/PDF/ZIP)
- [x] Extract hooks/useCastingCanvas.ts (178 lines — canvas drawing + mask overlay)
- [x] Extract ControlPanel.tsx (199 lines — left sidebar form sections)
- [x] Extract ImageViewerPanel.tsx (415 lines — right panel image viewer + tools)
- [x] Extract StageLockModal.tsx (29 lines)
- [x] Extract ExportModal.tsx (93 lines)
- [x] Extract ReferenceNode.tsx (128 lines — drag-drop image upload)
- [x] Extract ElapsedTimeDisplay.tsx (45 lines — loading tips animation)
- [x] Create barrel index.ts (10 lines)
- [x] Rewrite CastingStudio.tsx as thin shell (229 lines)
- [x] Verify: TypeScript 0 errors, build passes, 589 tests pass

### Final
- [x] Save checkpoint (version: f0ff3ba9)

## P3: Co-locate Orphaned Components + Split Oversized Modules

### Group 1: Move components/CastingStudio/ → features/casting/components/
- [x] Move BrandSelector.tsx
- [x] Move DirectorsNote.tsx
- [x] Move EyeSection.tsx
- [x] Move FaceSection.tsx
- [x] Move HairSection.tsx
- [x] Move PhysiqueSelector.tsx
- [x] Move SkinSection.tsx
- [x] Move ImageViewer/RefinePanel.tsx
- [x] Move ImageViewer/ToolsBar.tsx
- [x] Move ImageViewer/ViewTabs.tsx
- [x] Move ImageViewer/index.tsx
- [x] Update all imports (ControlPanel.tsx + ImageViewerPanel.tsx)
- [x] Remove old components/CastingStudio/ directory
- [x] Verify: build passes, 0 TS errors, 589 tests pass

### Group 4: Move billing components → features/billing/
- [x] Move BillingModal.tsx (432 lines)
- [x] Move CreditTopupModal.tsx (224 lines)
- [x] Move LowBalanceWarning.tsx (162 lines)
- [x] Create barrel index.ts
- [x] Update imports in Dashboard.tsx, CastingStudio.tsx, useCastingGeneration.ts, useCastingViewGeneration.ts
- [x] Remove old files from components/
- [x] Verify: build passes, 0 TS errors, 589 tests pass

### Group 5: Move casting globals → features/casting/
- [x] Move constants/casting.ts → features/casting/constants.ts (193 lines)
- [x] Remove types/castingStudio.ts (dead file — zero imports)
- [x] Move useCastingFormStore.ts (130 lines) → features/casting/
- [x] Move useCastingGenerationStore.ts (147 lines) → features/casting/
- [x] Move useCastingUIStore.ts (157 lines) → features/casting/
- [x] Remove hooks/useCastingForm.ts (dead file — zero external imports)
- [x] Remove hooks/useGenerationState.ts (dead file — zero external imports)
- [x] Update 30+ import sites across features/casting/ and pages/CastingStudio.tsx
- [x] Remove empty stores/, constants/, types/ directories
- [x] Verify: build passes, 0 TS errors, 589 tests pass

### Group 6: Co-locate orphaned client test files
- [x] Audit complete — no orphaned client test files found
- [x] All test files are server-side; 14 already co-located in P1, 19 router-level tests correctly in server/ root
- [x] No-op — no moves needed

### Group 2: Split oversized server modules
- [x] Split server/casting/geminiService.ts (1,036 → 6 files)
  - geminiTypes.ts (75 lines — types & enums)
  - geminiClient.ts (47 lines — client factory, safety, utilities)
  - geminiPrompts.ts (186 lines — prompt constants, brand/skin helpers)
  - geminiGeneration.ts (497 lines — master prompt, enhance, casting image)
  - geminiViews.ts (290 lines — full body, multi-view, single view, upscale)
  - geminiService.ts (38 lines — barrel re-export)
- [x] Split server/slack/slackDispatcher.ts (720 → 3 files)
  - slackCore.ts (347 lines — channel config, dedup, dispatch, routing, signature)
  - slackConvenienceHelpers.ts (333 lines — security, emergency, audit, admin, billing helpers)
  - slackDispatcher.ts (32 lines — barrel re-export)
- [x] Verify: build passes, 0 TS errors, 589 tests pass

### Group 3: Split admin pages → features/admin/
- [x] Create shared adminConstants.ts (93 lines) + barrel index.ts (29 lines)
- [x] Split AdminAuditLogs.tsx (1,025 → 357 lines)
  - AuditLogsFilters.tsx (227 lines)
  - AuditLogTable.tsx (133 lines)
  - AuditLogDetailModal.tsx (203 lines)
  - AuditActionModals.tsx (192 lines)
  - BlockedIPsTab.tsx (115 lines)
- [x] Split AdminUserManagement.tsx (947 → 224 lines)
  - UserBadges.tsx (61 lines)
  - UserStatsCards.tsx (43 lines)
  - UserFilters.tsx (102 lines)
  - UserTable.tsx (146 lines)
  - UserDetailModal.tsx (349 lines)
  - UserActionModals.tsx (221 lines)
- [x] Split AdminChangeRequests.tsx (847 → 320 lines)
  - ChangeRequestConstants.tsx (112 lines)
  - ChangeRequestList.tsx (124 lines)
  - ChangeRequestDetail.tsx (377 lines)
  - ReviewModal.tsx (119 lines)
- [x] Verify: build passes, 0 TS errors, 589 tests pass

### Final
- [x] Save checkpoint (version: 898e1620)

## P4: Final Cleanup

### Step 1: Delete dead code
- [x] Delete client/src/pages/HomeOld.tsx (dead — zero imports)
- [x] Delete client/src/pages/ComponentShowcase.tsx (dead — zero imports)
- [x] Verify: build passes, 0 TS errors, 589 tests pass

### Step 2: Move research/audit markdown files to docs/archive/
- [x] Create docs/archive/ directory
- [x] Move 16 markdown files to docs/archive/
- [x] Verify: build passes, 0 TS errors, 589 tests pass

### Step 3: Move casting stores to features/casting/stores/
- [x] Create features/casting/stores/ directory
- [x] Move useCastingFormStore.ts, useCastingGenerationStore.ts, useCastingUIStore.ts
- [x] Update 26 imports across casting feature files + fix 3 relative imports to constants
- [x] Verify: build passes, 0 TS errors, 589 tests pass

### Final
- [x] Save checkpoint

## P4 Addendum: Delete dead .txt files
- [x] Delete layout-analysis.txt, layout-check.txt, layout-observations.txt
- [x] Verify: build passes, 0 TS errors, 589 tests pass

## Bug Fix: Add Credits button opens wrong modal
- [x] Add Credits button in billing tab should open CreditTopupModal directly, not BillingModal

## Feature: Progressive Tier-Based Credit System (Manus-style)
- [ ] Investigate current billing/credit system
- [ ] Design progressive tier structure
- [ ] Redesign CreditTopupModal UI
- [ ] Update billing routes/backend for tier upgrades
- [ ] Update Stripe integration for prorated tier changes
- [ ] Verify and checkpoint

### Implementation Steps
- [x] Step 1a: Update PLAN_TIERS in drizzle/schema.ts with 12 tiers + update planTier enum
- [x] Step 1b: Update stripeProducts.ts with new subscription products + PLAN_ORDER export
- [x] Step 1c: Update billing routes to accept new tier names + canUpgrade logic
- [x] Step 1d: ALTER TABLE for enum, build passes, 0 TS errors, 591 tests pass
- [x] Step 2a: Rewrite CreditTopupModal with Manus-style design (light theme)
- [x] Step 2b: Update BillingModal to handle expanded tiers + BillingTab dynamic labels
- [x] Step 2c: Build passes, 0 TS errors, 591 tests pass
- [x] Checkpoint

## Bug Fix: CreditTopupModal pricing and dropdown display
- [x] Fix: "due today" price correct — free users see full tier price, existing subscribers see Stripe prorated amount
- [x] Fix: Dropdown now shows only "+ X monthly credits" with no plan names

## Bug Fix: Annual pricing should show full year upfront cost
- [x] Annual "due today" = monthly price × 12 × (1 - 0.17), strikethrough = monthly × 12

## Bug Fix: Toggle button in CreditTopupModal is visually broken
- [x] Fix annual/monthly toggle button — replaced custom CSS toggle with shadcn Switch component

## Bug Fix: CreditTopupModal icon should be logo mark, not Crown
- [x] Replace Crown icon with FormaStudio logo icon mark

## Feature: Update tier pricing to 2x margin (Option A)
- [x] Update PLAN_TIERS prices in drizzle/schema.ts (2x margin)
- [x] Stripe products already read from PLAN_TIERS dynamically — no changes needed
- [x] Update billing test expected values
- [x] Build passes, 0 TS errors, 591 tests pass

## Bug Fix: CreditTopupModal should overlay parent modals, not close them
- [x] Profile Settings → Billing → Add Credits: overlays on top of profile settings
- [x] BillingModal (Manage) → Add Credits: overlays on top of BillingModal

## Feature: Share/Referral System (replace Get Credits button)
- [x] DB: Create referrals table + user referralCode/referredByUserId fields
- [x] Backend: Generate unique referral codes, track referrals, award 500 credits on first generation
- [x] Frontend: Replace "Get Credits" button with "Share Forma" CTA
- [x] Frontend: ReferralModal with shareable link, copy button, how-it-works, stats
- [x] Security: Self-referral blocked, duplicate referral blocked, idempotent credit award
- [x] useReferralClaim hook: captures ?ref= param, claims after OAuth login

## Feature: Redesign ReferralModal (Manus-style)
- [x] Redesign modal layout: icon, title, share link + copy, email invite + send, stats, redeem link, history link
- [x] Add email invitation backend (sendInvite mutation, rate limit 10/day, block own email)
- [x] Add redeem code flow (redeem mutation, rate limit 5/hr, format+existence validation, one-time per user ever)
- [x] Add invitation history (getHistory query, returns only current user's referrals)
- [x] Secondary modals: RedeemCodeModal + InvitationHistoryModal
- [x] Security: log IP on referral signup, flag same IP as referrer, audit log all referral actions
- [x] Security: credits only after first generation (already implemented), multi-claim prevention
- [x] Tests for new endpoints and security checks (25 tests, 616 total passing)

## Feature: Referral Fraud Prevention (Proxy-Resistant)
- [x] Block disposable email domains on sendInvite (guerrillamail, tempmail, mailinator, etc.)
- [x] Change credit award trigger: referrer gets credits only after referee completes first PAID action (Stripe webhook)
- [x] Cap lifetime referral earnings per user (5,000 credits max)
- [x] Calibrate referral reward amount to 250 credits per party (was 500)
- [x] Change same-IP behavior: soft flag for moderator review within 24hr window (no auto-block)
- [x] Update tests for all new fraud prevention rules (43 referral tests, 634 total passing)

## Feature: Referral System Enhancements (Round 3)
- [x] Block disposable email domains from signing up an account (OAuth callback + SDK auto-sync + Login page error)
- [x] Moderator view for flagged referrals (FlaggedReferralsTab + moderator procedure + query)
- [x] Wire up Klaviyo email delivery for sendInvite flow (trackEvent + sendReferralInviteEmail)
- [x] Referral expiration job: daily setInterval expires pending referrals >30 days old
- [x] Tests for all 4 enhancements (20 new tests, 654 total passing)

## Feature: Klaviyo Flow for Referral Invite Email
- [x] Research Klaviyo Flows API for programmatic flow creation
- [x] Create branded HTML email template (Tm2PNj) with FormaStudio styling
- [x] Create Klaviyo Flow (TTqC5y) triggered by "Referral Invite Sent" metric (VKhfQH)
- [x] Flow set to LIVE — sends email with referrer name, referral link, and 250 credit reward
- [x] Setup script: server/scripts/setupKlaviyoReferralFlow.mjs (idempotent, with fallback instructions)
- [x] Cleaned up duplicate templates from failed runs
- [x] Configure email template with referrer name, referral link, reward amount (dynamic via {{ event.* }} variables)
- [x] End-to-end flow verified: sendInvite → Klaviyo event → Flow triggers → email delivery

## Feature: Remove One-Time Credit Topup System (Dead Code)
- [x] Remove CREDIT_TOPUP_PRODUCTS from stripeProducts.ts
- [x] Remove createTopupCheckout route from billing.ts
- [x] Remove createTopupCheckoutSession from stripeService.ts
- [x] Remove topup webhook handling from webhooks.ts
- [x] Remove topup-related tests from billing.test.ts, velocityLimits.test.ts, and webhookSecurity.test.ts
- [x] Clean up imports and type references across all files
- [x] All 639 tests passing, 0 TypeScript errors

## Feature: Billing Manage Modal Redesign (Manus-style)
- [x] Free users: show top 3 strategic plans (Starter, Pro, Studio) with Upgrade buttons
- [x] Paid users: show current plan + next tier up (2-column layout)
- [x] Max tier users: "You're on the highest plan" message
- [x] Add "Edit billing" link in footer (opens Stripe portal)
- [x] Add "Downgrade to Free" link in footer with loading state (cancels subscription)
- [x] Match Manus reference design: monthly/annual toggle, plan cards with features, expand credit section
- [x] All 639 tests passing, 0 TypeScript errors

## Feature: Downgrade Confirmation Modal
- [x] Add DowngradeConfirmModal with best-value plan retention offer (dark theme, matching reference)
- [x] Match Manus reference: AlertTriangle icon, title, subtitle, best-value plan card with price/savings/features, two CTAs
- [x] Smart best-value suggestion: Starter for most users, Pro if already on Starter
- [x] All hooks before early return to prevent React ordering errors
- [x] All 639 tests passing, 0 TypeScript errors

## Feature: Context-Aware Credit Expansion Options
- [x] Show only 3 relevant credit expansion tiers based on user's current plan (.slice(0, 3))
- [x] Filter out plans below current tier and limit to next 3 tiers above
- [x] All 639 tests passing, 0 TypeScript errors

## Feature: Credit Economy Rebalancing (Perceived Value Multiplier)
- [x] Apply 50x multiplier to PLAN_TIERS monthlyCredits (5,000 free → 300M ultimate)
- [x] Apply 50x multiplier to CREDIT_COSTS (casting 350, full body 300, iterate 350, upscale 300, export 1500)
- [x] Apply 50x multiplier to free tier balance (default 5,000)
- [x] Apply 50x multiplier to referral rewards (12,500) and lifetime cap (250,000)
- [x] Apply 50x multiplier to velocity limits (daily cap 1,666,650)
- [x] Update LowBalanceWarning thresholds (2,500 warning, 500 very low)
- [x] Update moderator CreditsSubTab per-credit rate
- [x] Update Klaviyo referral flow reward credits (12,500)
- [x] Update all test assertions (8 test files: aiService, billing, castingStudio, models, referral, referral-enhancements, velocityLimits)
- [x] Verify 639 tests passing, 0 TypeScript errors

## Feature: Referral Modal — Inline History View Switch
- [x] Keep "Invitation history ›" footer button in place, clicking switches to history view inline
- [x] History view: back arrow (‹) + "Invitation history" title + close X (matching reference)
- [x] Keep Redeem Code as a separate overlay modal (no change)
- [x] Remove InvitationHistoryModal separate modal usage from ReferralModal

## Bug Fix: Referral Modal History View Height
- [x] Maintain same modal height when switching between share and history views (min-h-[480px] + flex-col + flex-1)

## Feature: Add Credit Button in Dashboard
- [x] Add subtle "+" button next to credits display in dashboard profile area
- [x] Button opens CreditTopupModal (upgrade/add credits flow)

## Bug Fix: Moderator User Investigation — Show User IDs
- [x] Add user ID display to moderator user investigation tab (matching admin panel: font-mono #id prefix)

## Bug Fix: Moderator User Detail — Filters Not Working
- [x] Lift filter state (creditTypeFilter, creditPage, genStatusFilter, genTypeFilter, genPage) from UserInvestigationTab to ModeratorDashboard
- [x] Wire filter state into getUserCreditHistory and getUserGenerationHistory query inputs
- [x] Fix generation status filter: "queued" → "pending" to match backend enum
- [x] Fix generation type filter: headshot/full_body/creative/background_swap → masterPrompt/castingImage/fullBody/multiView/iteration/upscale to match backend enum
- [x] 639 tests passing, 0 TypeScript errors

## Feature: Moderator Date Range Filters
- [x] Add date range state (startDate/endDate) for credits in ModeratorDashboard
- [x] Add date range state (startDate/endDate) for generations in ModeratorDashboard
- [x] Wire date range into getUserCreditHistory query
- [x] Wire date range into getUserGenerationHistory query
- [x] Add date input UI to CreditsSubTab filter row (calendar icon, dark theme, clear button)
- [x] Add date input UI to GenerationsSubTab filter row (calendar icon, dark theme, clear button)
- [x] Pass date state + setters through UserInvestigationTab props
- [x] Reset dates when selecting a new user
- [x] 639 tests passing, 0 TypeScript errors

## Feature: Audit Logs Date Range Filters
- [x] Backend getAuditLogs already supports startDate/endDate params
- [x] Add date range state (logStartDate/logEndDate) to ModeratorDashboard
- [x] Wire date range into getAuditLogs query
- [x] Add date picker UI to AuditLogsTab (calendar icon, dark theme, clear button)
- [x] Include dates in handleResetFilters / Clear Filters button
- [x] 639 tests passing, 0 TypeScript errors

## Feature: Export Filtered Audit Logs to CSV
- [x] Add exportAuditLogsCsv tRPC procedure (up to 5000 filtered logs, CSV generation on server)
- [x] Add AUDIT_LOG_EXPORTED action to AUDIT_ACTIONS for audit trail
- [x] Add "Export CSV" button to AuditLogsTab filter row (ml-auto, outline style)
- [x] Wire frontend: refetch on click, Blob download with timestamped filename, toast notification
- [x] Write vitest test (8 tests: header, single entry, null fields, comma escaping, quote escaping, newlines, simple strings, multiple entries)
- [x] 647 tests passing, 0 TypeScript errors

## Feature: Moderator Credit History CSV Export
- [x] Add exportUserCreditHistoryCsv procedure to moderatorExports router (up to 5000 filtered entries)
- [x] Add Export CSV button to CreditsSubTab UI (same pattern as audit logs)
- [x] Wire frontend download logic (Blob download, timestamped filename, toast)

## Feature: Change Request File Attachments
- [x] Add change_request_attachments table to schema (id, changeRequestId, filename, fileKey, url, mimeType, size, uploadedById, createdAt)
- [x] Push DB migration via SQL
- [x] Create moderatorAttachments router (upload to S3, link to change request, list by change request)
- [x] Update ChangeRequestModal with file upload UI (drag/drop area, previews, remove, max 5 files, 10MB each)
- [x] Update onSubmit to pass attachmentIds and link after creation
- [x] Add AttachmentsSection to admin ChangeRequestDetail (images rendered inline, files as download links)
- [x] Extract AttachmentsSection into separate file (ChangeRequestAttachments.tsx)
- [x] Write vitest tests (12 tests: MIME validation, size limits, filename sanitization, base64 decoding, link ownership, image detection)
- [x] 659 tests passing, 0 TypeScript errors

## Feature: Context-Aware Change Request Action Labels
- [x] Add ACTION_CONFIG per type to ChangeRequestConstants.tsx (9 types, each with approve/deny labels, modal titles, descriptions, placeholders)
- [x] Add getActionConfig() helper with DEFAULT_ACTION fallback
- [x] Update ChangeRequestDetail.tsx buttons to use contextual labels per type (e.g., "Confirm Suspend", "Approve Refund")
- [x] Update ReviewModal.tsx to show contextual titles and descriptions per type (e.g., "Acknowledge Incident Report")
- [x] Informational types (flag_account, note_incident, other) show "Acknowledge / Dismiss" instead of "Approve / Deny"
- [x] 659 tests passing, 0 TypeScript errors

## Feature: Moderator Generation History CSV Export
- [x] Add exportUserGenerationHistoryCsv procedure to moderatorExports router (up to 5000 entries, includes summary stats)
- [x] Add GENERATION_HISTORY_EXPORTED audit action to schema
- [x] Add Export CSV button to GenerationsSubTab header (with spinner, download icon)
- [x] Wire frontend download logic (Blob download, timestamped filename, toast with failed count + credits used)
- [x] Pass userId prop through UserInvestigationTab to GenerationsSubTab
- [x] 659 tests passing, 0 TypeScript errors

## Feature: Credit Reconciliation View
- [x] Add backend getUserCreditReconciliation procedure (credits deducted vs successful generations)
- [x] Create ReconciliationSubTab component with side-by-side comparison
- [x] Add "Reconciliation" tab to user detail tabs in UserInvestigationTab
- [x] Show discrepancy alerts when credits deducted > successful generation costs
- [x] Support date range filtering
- [x] Fix reconciliation to compute summaries from date-filtered rows (not unfiltered summary)
- [x] Extract UserTable and UserDetailCard from UserInvestigationTab.tsx (488→235 lines)
- [x] Write 17 reconciliation unit tests (676 total tests passing)

## Fix: Reconciliation — Failed generations should not count toward credits used
- [x] Investigate credit refund behavior on generation failure
- [x] Update reconciliation logic so failed generations don't count toward credits used
- [x] Update reconciliation summary messaging
- [x] Update tests to reflect correct behavior (20 tests, 679 total passing)

## Fix: Reconciliation — Improve discrepancy messaging with likely cause
- [x] Detect failed generations without matching refunds and explain in summary
- [x] Update tests for new messaging logic (24 reconciliation tests, 683 total passing)

## Feature: Reconciliation CSV Export
- [x] Add CSV generation utility for reconciliation data (reconciliation-csv.ts, 136 lines)
- [x] Add "Download CSV" button to ReconciliationSubTab
- [x] Include user info, credit summary, generation summary, reconciliation details, and type breakdowns
- [x] Write tests for CSV generation logic (10 tests, 693 total passing)

## Feature: Auto-Flag Discrepancy Threshold on Moderator Dashboard
- [x] Create backend getUsersWithDiscrepancies query (SQL aggregation, no N+1)
- [x] Add getFlaggedUsers tRPC procedure with configurable threshold
- [x] Build FlaggedDiscrepanciesCard widget on moderator dashboard overview
- [x] Wire card into ModeratorDashboard with click-to-navigate to user reconciliation
- [x] Extract discrepancyQueries.ts from moderatorQueries.ts (file size compliance)
- [x] Write tests for discrepancy computation logic (15 tests, 708 total passing)

## Feature: Auto-Freeze Accounts with Large Credit Discrepancies
- [x] Add frozenAt, frozenReason, frozenBy fields to users table + push migration
- [x] Create freezeUser() / unfreezeUser() DB helpers in security.ts
- [x] Add freeze check in withAtomicCredits (blocks all generation)
- [x] Add freeze check in billing checkout session creation + changePlan
- [x] Auto-trigger freeze in discrepancy scan when threshold >= 200 credits
- [x] Send Slack alert on auto-freeze
- [x] Log freeze/unfreeze in audit log (ACCOUNT_AUTO_FROZEN, ACCOUNT_UNFROZEN)
- [x] Build AccountFrozenBanner component for dashboard (shown to frozen users)
- [x] Add frozenAt/frozenReason/frozenBy to moderator getUserDetails response
- [x] Add moderator direct-unfreeze button in ReconciliationSubTab (with required notes)
- [x] Write tests for freeze enforcement, auto-trigger, and unfreeze (26 tests, 734 total passing)

## Feature: Manual Freeze for Moderators + Admin Freeze/Unfreeze
- [x] Add freezeAccount moderator procedure (with required reason, audit-logged)
- [x] Add freeze/unfreeze button to moderator UserDetailCard with inline form
- [x] Add admin freezeUser/unfreezeUser procedures in admin users route (audit-logged, immutable log)
- [x] Add frozenAt/frozenReason/frozenBy to admin getUserDetails and getUserFullDetails
- [x] Block freezing admin accounts (safety guard)
- [x] Update tests for manual freeze capabilities (37 freeze tests, 745 total passing)

## Fix: Adjust discrepancy thresholds to match credit economy
- [x] Update flag threshold default from 50 to 500 credits
- [x] Update auto-freeze threshold from 200 to 2000 credits
- [x] Update FlaggedDiscrepanciesCard threshold options (100/250/500/1000/2000/5000)
- [x] Update severity tiers: critical >= 2000, warning >= 1000
- [x] Update tests for new threshold values (745 total passing)

## Feature: Freeze Notification Email via Klaviyo
- [x] Create sendAccountFrozenEmail helper using Klaviyo trackEvent pattern (consistent with referral email)
- [x] Trigger email on auto-freeze (discrepancy scan) — non-blocking
- [x] Trigger email on manual moderator freeze — non-blocking
- [x] Trigger email on admin freeze — non-blocking
- [x] Event properties: user_name, freeze_reason, frozen_by, frozen_date, support_url, app_name
- [x] Write tests for email sending logic (5 new tests, 750 total passing)

## Feature: Admin Dashboard Overview (Real-Time KPIs)
- [x] Audit schema tables for all required metrics
- [x] Create adminOverviewQueries.ts with aggregation queries (380 lines, 5 query functions)
- [x] Create admin overview tRPC procedure (adminProcedure, parallel Promise.all)
- [x] Build AdminOverview.tsx page with KPI cards (197 lines)
- [x] Real-time health: generation success rate (24h), pending/failed gens, active users (24h)
- [x] User growth: total users, new signups (7d), frozen accounts, suspended accounts, plan distribution
- [x] Credit economy: credits consumed (24h), credits purchased (7d), refunded (7d), in circulation, generation type breakdown
- [x] Alerts feed: last 15 critical audit events (auto-freezes, security, billing, abuse)
- [x] Wire into admin navigation and App.tsx routing (/admin/overview)
- [ ] Add admin freeze UI buttons to admin user detail modal
- [x] Auto-refresh with 30s interval (toggleable live/paused)
- [x] Write tests for admin overview queries (36 new tests, 786 total passing)
- [x] Fix success rate edge case: pending/processing-only gens no longer return NaN
- [x] Build 5 card components: HealthMetrics, UserGrowthCard, CreditEconomyCard, GovernanceCard, AlertsFeed
- [x] Light theme (#EBEBEB bg, #0A0A0A text) matching design requirements
- [x] Quick nav links to Users, Audit Logs, Change Requests, Moderator from header

## Feature: Server Resilience & Error Handling Hardening
- [x] Add process.on('uncaughtException') handler with logging + Slack alert
- [x] Add process.on('unhandledRejection') handler with logging + Slack alert
- [x] Add tRPC onError hook for centralized server-side error logging
- [x] Add graceful shutdown on SIGTERM/SIGINT (drain HTTP connections, close DB)
- [x] Write tests for resilience logic (21 new tests, 807 total passing)

## Feature: Deep-Check Health Endpoint (/api/health)
- [x] Create server/health.ts with DB ping + latency measurement
- [x] Register GET /api/health Express route in server/_core/index.ts
- [x] Return status, uptime, DB latency, and timestamp
- [x] Rate-limit the endpoint to prevent abuse (10 req/min per IP)
- [x] Write tests for health check logic (15 new tests, 822 total passing)

## Feature: Admin Overview Visual Redesign (Charts & Graphs)
- [x] Recharts already installed
- [x] Create adminTimeSeriesQueries.ts with 4 daily aggregation queries (183 lines)
- [x] Add getTimeSeries tRPC procedure to admin overview router
- [x] Rebuild HealthMetrics with area chart (generation success/failure trends 14d)
- [x] Rebuild UserGrowthCard with bar chart (daily signups 14d)
- [x] Rebuild CreditEconomyCard with stacked area chart (credit consumed/purchased/refunded 14d)
- [x] Rebuild GovernanceCard with donut chart (change request status distribution)
- [x] Rebuild AlertsFeed with timeline layout + severity color badges
- [x] Rebuild AdminOverview.tsx with 2-column layout (224 lines)
- [x] Fix SQL GROUP BY for MySQL only_full_group_by mode (raw SQL with aliases)
- [x] Write tests for time-series helper functions (18 new tests, 840 total passing)
- [x] Light theme preserved (#EBEBEB bg, #0A0A0A text, white cards)

## Feature: Announcement/Maintenance Banner System
- [x] Add announcements table to schema (id, title, message, type, isActive, startsAt, endsAt, createdBy, createdAt, updatedAt)
- [x] Run DB migration via direct SQL (CREATE TABLE announcements)
- [x] Create announcementQueries.ts with CRUD + getActiveBanners + getActiveBannerCount (147 lines)
- [x] Create admin announcements router (create, toggle, list, delete — 107 lines)
- [x] Create public getActiveBanners procedure (server/routes/announcements.ts)
- [x] Build admin BannerManagement component on overview page (223 lines)
- [x] Build global AnnouncementBanner component (dismissible, color-coded by type, 82 lines)
- [x] Wire AnnouncementBanner into App.tsx above all routes
- [x] Add 5 banner audit actions to AUDIT_ACTIONS constant
- [x] Write tests for announcement queries and logic (36 new tests, 876 total passing)

## Feature: System Status Card on Admin Overview
- [x] Build SystemStatusCard component (uptime, DB latency, active banners — 128 lines)
- [x] Add system status data (activeBanners, serverStartedAt) to admin overview procedure
- [x] Wire SystemStatusCard into AdminOverview page (right column, above banners)
- [x] Write tests for system status logic (formatUptime, latencyColor — included in announcements.test.ts)

## Feature: Admin Freeze/Unfreeze Buttons in UserDetailModal
- [x] Audit existing backend freeze/unfreeze procedures (admin.freezeUser, admin.unfreezeUser)
- [x] Wire freeze/unfreeze buttons into UserDetailModal UI (Snowflake icon, cyan theme)
- [x] Add confirmation dialogs with reason/notes textarea before freeze/unfreeze
- [x] Show frozen status banner on user detail (cyan, shows reason, date, frozenBy)
- [x] Add frozenAt/frozenReason/frozenBy to UserDetailData interface
- [x] Write tests for freeze/unfreeze UI logic (29 new tests, 905 total passing)

## Feature: Add "Frozen" Filter to Admin User Management Table
- [x] Update backend listAllUsers query to support "frozen" status filter (isNotNull frozenAt)
- [x] Update backend listUsers tRPC procedure to accept "frozen" in Zod enum
- [x] Add frozenAt to listAllUsers select + return type
- [x] Update frontend statusFilter type to include "frozen" (AdminUserManagement.tsx)
- [x] Update UserFilters component to show "Frozen" option in dropdown
- [x] Update UserBadges: StatusBadge + getUserStatus to support "frozen" (cyan/Snowflake)
- [x] Add frozenAt to UserTable UserRow interface
- [x] Active filter now also excludes frozen users
- [x] All 905 tests passing, 0 TypeScript errors

## Feature: Automated System Health Slack Alerts
- [x] Store system alerts webhook URL as SLACK_SYSTEM_ALERTS_WEBHOOK_URL env secret
- [x] Add "system-alerts" channel to slackCore.ts (type, getWebhook, routeEvent)
- [x] Create server/monitoring/healthMonitor.ts (290 lines) with periodic health checks
- [x] Monitor generation success rate (24h) — alert when below 80% (critical if <50%)
- [x] Monitor DB connectivity — alert on connection null, query failure, or >5s latency
- [x] Monitor critical audit event spikes — alert when >10 critical events in 1 hour
- [x] Monitor generation queue backup — alert when >20 pending+processing
- [x] Send formatted Slack messages with severity, metrics, and timestamps to system-alerts channel
- [x] Implement 15-minute cooldown per alert type to prevent spam
- [x] Register health monitor in server startup (60s delay, then every 5 min)
- [x] Stop health monitor during graceful shutdown
- [x] Fix audit_logs column name (createdAt not created_at)
- [x] Write tests for health monitor logic (23 new tests, 928 total passing)

## Feature: Admin & Moderator Pages Light Theme Redesign
- [x] Create shared AdminHeader component (light theme top nav with quick links, active state)
- [x] Redesign AdminUserManagement page (light theme, improved table/filters)
- [x] Restyle UserTable, UserFilters, UserStatsCards, UserBadges components
- [x] Restyle UserDetailModal, UserActionModals components
- [x] Redesign AdminAuditLogs page (light theme, improved layout)
- [x] Restyle AuditLogTable, AuditLogsFilters, AuditLogDetailModal components
- [x] Restyle AuditActionModals, BlockedIPsTab components
- [x] Redesign AdminChangeRequests page (light theme, improved layout)
- [x] Restyle ChangeRequestList, ChangeRequestDetail, ReviewModal components
- [x] Redesign ModeratorDashboard page (light theme)
- [x] Restyle all moderator sub-components (DashboardHeader, StatsCards, TabNavigation, etc.)
- [x] Update AdminOverview to use shared AdminHeader
- [x] Verify TypeScript compilation and all tests pass

## Feature: Admin & Moderator Pages Light Theme Redesign
- [x] Screenshot current state of all admin/moderator pages
- [x] Create shared AdminHeader component (light theme top nav with quick links, active state)
- [x] Redesign AdminUserManagement page (light theme, improved table/filters)
- [x] Restyle UserTable, UserFilters, UserStatsCards, UserBadges components
- [x] Restyle UserDetailModal, UserActionModals components
- [x] Redesign AdminAuditLogs page (light theme, improved layout)
- [x] Restyle AuditLogTable, AuditLogsFilters, AuditLogDetailModal components
- [x] Restyle AuditActionModals, BlockedIPsTab components
- [x] Redesign AdminChangeRequests page (light theme, improved layout)
- [x] Restyle ChangeRequestList, ChangeRequestDetail, ReviewModal components
- [x] Update AdminOverview to use shared AdminHeader
- [x] Redesign ModeratorDashboard page (light theme)
- [x] Restyle all moderator sub-components
- [x] Verify TypeScript compilation and all tests pass

## Bug Fix: UserDetailModal Consistent Size
- [x] Fix UserDetailModal to maintain consistent size when switching between Profile, Credits, and Activity tabs

## Bug Fix: AdminHeader Layout Inconsistency on Audit Logs
- [x] Fix AdminHeader layout on Audit Logs page to match Overview and User Management pages

## Bug Fix: AdminHeader Nav Shifting When Switching Pages
- [x] Fix AdminHeader layout so nav links stay in a fixed position regardless of per-page action buttons

## Phase 5: Moderator Dashboard Light Theme Redesign
- [x] Create ModeratorHeader component (same visual style as AdminHeader, mod-appropriate nav)
- [x] Restyle ModeratorDashboard main page with ModeratorHeader
- [x] Update moderatorConstants (SEVERITY_COLORS, CATEGORY_COLORS) to light theme
- [x] Restyle StatsCards, TabNavigation, FlaggedDiscrepanciesCard
- [x] Restyle AuditLogsTab to light theme
- [x] Restyle UserInvestigationTab, UserInvestigationWidgets to light theme
- [x] Restyle ActivitySubTab, CreditsSubTab, GenerationsSubTab, ReconciliationSubTab
- [x] Restyle LogDetailModal, ChangeRequestModal to light theme
- [x] Restyle FlaggedReferralsTab, MyRequestsTab to light theme
- [x] Remove old DashboardHeader component (replaced by ModeratorHeader)
- [x] Verify TypeScript compilation and visual rendering

## Bug Fix: Moderator User Detail Sub-Tab CSV Export Styling
- [x] Make CSV export button styling consistent across Credits, Generations, and Reconciliation sub-tabs

## Bug Fix: Admin Back-Navigation from Moderator Page
- [x] Add intuitive back-navigation for admins visiting the moderator page via admin nav bar

## Feature: Freeze Account Confirmation Modal for Moderators
- [x] Add confirmation modal before moderator freezes an account (verify this is the only direct action mods can take)

## Dashboard Admin Menu Cleanup
- [x] Remove all admin menu links except Moderator View from main dashboard (kept Admin View + Moderator View)
- [x] Rename "Overview" to "Admin View" in dashboard sidebar
- [x] Fix ModeratorHeader: always show "Dashboard" back link instead of "Admin Overview"

## Feature: Moderator SOC Loading Animation
- [x] Add polished loading skeleton animation for the main data table in Moderator SOC during data fetching

## Feature: Mobile Hamburger Menu + Moderator SOC Rename
- [x] Add mobile responsive hamburger menu for AdminHeader nav links
- [x] Add mobile responsive hamburger menu for ModeratorHeader nav links
- [x] Rename "Moderator Dashboard" title in ModeratorHeader to "Moderator SOC"

## Feature: Responsive & Mobile Optimization — Home Page + Login Page
- [x] Audit and fix home page responsive layout (typography, spacing, grid, images)
- [x] Audit and fix login page responsive layout
- [x] Ensure touch-friendly targets, readable text, and proper viewport scaling on mobile
- [x] Verify on desktop viewport (mobile breakpoints applied via Tailwind responsive classes)

## Bug Fix: Oversized Section Titles on Mobile
- [x] Scale down large section headings on mobile across all homepage sections (WhyUs, About, Services, Process, FAQ, Blog, etc.)
- [x] Convert fixed pixel font sizes in tokens.css to responsive clamp() values
- [x] Remove text-section-title class overrides from AboutSection and WhyUsSection spans
- [x] Reduce hero title clamp minimum from 3.5rem to 2.5rem
- [x] Reduce footer wordmark clamp minimum from 2rem to 1.75rem

## Bug Fix: Homepage Desktop Typography & Layout Regressions
- [x] Fine-tune section title clamp() values — currently too small on desktop after mobile fix
- [x] Fix About Us stats marquee not showing on desktop (only visible on mobile)
- [x] Fix "Get started" button in WhyUs section to use shared animated Button component
- [x] Replace all custom CSS class responsive variants (sm:w-about-text, sm:text-body-md, etc.) with inline Tailwind classes

## Bug Fix: Section Title Headers Too Small on Mobile
- [x] Increase clamp() minimums for section titles on mobile — raised to 2rem (32px) inline and 2rem token class for more impact

## Feature: Powered by Section in Footer
- [x] Add "Powered by" section to footer with Google Gemini and Nano Banana logos
- [x] Add Manus to the Powered by footer section

## Feature: Hero Section Premium Overhaul
- [x] Upload new hero images (v2) to S3 — base with "Powered by Gemini" text, styled with sunglasses
- [x] Generate depth map from new base image for parallax effect
- [x] Update heroProxy.ts S3 keys to v2 images
- [x] Implement idle "swimming" movement — layered sine waves for organic autonomous motion after 2s idle
- [x] Implement heavy cursor easing — lerp 0.07 (active) / 0.025 (idle) for premium weight
- [x] Update shader for softer reveal mask — innerRadius 0.25, outerRadius 1.3, extra Hermite smoothing
- [x] Add shimmer loading placeholder instead of static image fallback
- [x] Add entry animation — reveal mask expands from 0→1 on load
- [x] Update IMAGE_ASPECT ratio for new 5504x3072 images

## Tweak: Hero Radial Mask Size
- [x] Reduce reveal radius from 0.65 to 0.45, tighten shader inner (0.35) and outer (1.1) multipliers

## Bug Fix: Hero Section Refinements
- [x] Fix color space — added #include <colorspace_fragment> to shader for correct sRGB output
- [x] Make swimming motion feel like a fish gliding across — slow horizontal sweep + gentle vertical undulation
- [x] Reduce parallax strength from 0.008 to 0.003 — eliminates face distortion at edges

## Feature: Hero Image Swap v3
- [x] Replace hero images with new set from Poweredby(2).zip (3.png base, 4.png styled)
- [x] Use provided depth map (depthmap3.png) — 2048x1143, same aspect ratio, 8px Gaussian blur
- [x] Upload all 3 files to S3 and update heroProxy keys to v3
- [x] Apply Claude's parallax best practices: depth compressed 0.4-0.6, edge fade 12%, UV clamped 0.001-0.999, parallax strength 0.008
- [x] IMAGE_ASPECT unchanged (5504/3072 = 1.79:1, same as before)

## Feature: Background Flow Lines in Hero
- [x] Create FlowLines.tsx component with 3 animated SVG flowing curves
- [x] Integrate behind hero canvas in HeroSection.tsx as absolute-positioned z-0 layer
- [x] 6% opacity, pointer-events-none, CSS d:path() keyframe morphing (8s/10s/12s cycles)

## Feature: Dashboard Mobile Responsiveness
- [x] Audit dashboard layout — sidebar fixed 288px, no mobile collapse
- [x] Add mobile sidebar overlay with hamburger toggle (fixed positioning, translate-x animation, backdrop overlay)
- [x] Add mobile header bar with hamburger, logo, and settings button
- [x] Make banner responsive (h-36/h-56), avatar (w-16/w-28), profile text (text-lg/text-3xl)
- [x] Add mobile action bar with Share Forma, Bell, Search buttons
- [x] Hide desktop action buttons on mobile (hidden lg:flex)
- [x] Responsive content padding (p-4/p-10) and grid layouts (grid-cols-2/grid-cols-4)
- [x] Responsive section headings and button sizes
- [ ] Audit CastingStudio for mobile overflow issues (already has flex-col/flex-row responsive base)

## Feature: Smooth Scroll-to-Section Navigation
- [x] Add smooth scroll behavior when clicking homepage nav links (About, Work, Services, Blog)
- [x] Ensure section IDs match nav link targets
- [x] Add scroll offset to account for fixed header height (72px offset)
- [x] Button component handles /#contact and #section anchor links
- [x] FooterLink component handles anchor smooth scroll
- [x] Mobile menu smooth scroll with 300ms delay for close animation
- [x] Mega menu smooth scroll with 350ms delay for close animation
## Feature: Restyle Casting Studio to Match Homepage Design Language
- [x] Restyle Step 1: Core layout + ControlPanel sidebar
- [x] Restyle Step 2: Form primitives (castingHelpers, BrandSelector)
- [x] Restyle Step 3: Remaining form sections (Skin, Eye, Hair, Face, Physique)
- [x] Restyle Step 4: Image viewer + floating controls
- [x] Restyle Step 5: Input bar + bottom panels (RefinePanel, DirectorsNote)
- [x] Restyle Step 6: Modals + empty state (ExportModal, StageLockModal, DNAHelix)
## Bug: Casting Studio Restyle Missed Items
- [x] Fix orange age slider — added slider-obsidian CSS class with #0A0A0A thumb, #EBEBEB track
- [x] Restyle Tone & Energy modal (TriBlendSelector) — obsidian puck, bars, chips, borders
- [x] Restyle Tooltip component — obsidian borders and text colors
- [x] Restyle hair color selector wheel (HairColorWheel.tsx) — obsidian tabs, puck stroke, swatch borders, tone controls, tooltip pill
- [x] Fix ControlPanel scrollbar styling — transparent track, rgba(10,10,10,0.15) thumb, rounded-full
- [x] Comprehensive audit: grep ALL old design tokens and fix remaining instances
  - [x] ElapsedTimeDisplay.tsx — text-charcoal/text-subtle → #0A0A0A/#757575
  - [x] ImageViewerPanel.tsx — border-gray-200, bg-gray-100, text-obsidian → obsidian equivalents
  - [x] ReferenceNode.tsx — slate-accent, text-subtle, text-obsidian, gray borders → obsidian equivalents
  - [x] ProfileSettingsModal.tsx — gray-200 borders, gray-50 bg, gray-100 hover → obsidian equivalents
  - [x] Verified: zero remaining slate-accent/text-subtle/text-charcoal/text-obsidian/bg-canvas in casting + shared components
## Feature: Compact Studio Header for Casting Studio
- [x] Create StudioHeader component (~40px) with logo, back nav, studio name, credits, user avatar
- [x] Integrate StudioHeader into CastingStudio page layout
- [x] Remove redundant mobile header (back + credits + hamburger) from ControlPanel
- [x] Remove redundant desktop header (back + credits pill) from ControlPanel
- [x] Move mobile panel toggle into StudioHeader
- [x] Credits pill in header opens topup modal
- [x] User avatar in header opens ProfileSettingsModal
## Feature: Auto-open CreditTopupModal on Insufficient Credits
- [x] Auto-open topup modal when insufficient credits on initial generation (useCastingGeneration)
- [x] Auto-open topup modal when insufficient credits on iteration/refine (useCastingGeneration)
- [x] Auto-open topup modal when insufficient credits on full body view (useCastingViewGeneration)
- [x] Auto-open topup modal when insufficient credits on multi-view (useCastingViewGeneration)
- [x] Auto-open topup modal when insufficient credits on all views (useCastingViewGeneration)
- [x] Fix "points" → "credits" in all insufficient credit error messages (4 instances fixed)
## Bug: ProfileSettingsModal not responsive on mobile
- [x] Fix ProfileSettingsModal layout for mobile screens
  - [x] Full-screen sheet on mobile (no max-w/max-h constraints)
  - [x] Horizontal scrollable pill tab bar replacing sidebar on mobile
  - [x] Active tab uses obsidian pill (bg-[#0A0A0A] text-white)
  - [x] Responsive padding/font sizes (px-4/text-lg on mobile, px-6/text-xl on md+)
  - [x] Content area scrolls independently below tab bar
## Bug: Usage Analytics stat cards formatting untidy
- [x] Fix stat card alignment — centered layout, single-line labels, consistent min-height, tabular-nums, proper decimal formatting
## Bug: ProfileSettingsModal height jumps when switching tabs
- [x] Fix modal to maintain consistent fixed height across all tabs — changed md:max-h-[85vh] to md:h-[85vh] so content scrolls within fixed container

## Feature: Homepage & Login Copywriting Overhaul (Waitlist Launch)
- [x] Update homeData.ts — stats marquee (4 Studios/Zero Prompts/1 Identity/Studio-grade), services, process (Cast/Refine/Produce/Own), FAQ, blog
- [x] Rewrite HeroSection — tagline "Studio-grade AI creation. No prompts. Just create.", trust badge → "Trusted by top creatives working for"
- [x] Rewrite AboutSection — "We build reusable model identities...", copyright 2026
- [x] Rewrite WhyUsSection — replaced fake testimonial/4.9 rating with waitlist CTA card + brand differentiators
- [x] Update ServicesSection — "Coming Soon" badges on services 2-4, CTA → "Join waitlist"
- [x] Update ProcessSection — "From brief to final asset in four steps", CTA → "Join waitlist"
- [x] Update Footer — newsletter → "Get launch updates and early access", removed phone, copyright 2026
- [x] Rewrite Login.tsx — "Welcome" dual-purpose sign-in, replaced fake testimonial with AspirationPanel

## Feature: Pre-Launch Access Gating (Invite Code System)
- [x] Change header button "Start a project" → "Join waitlist" (desktop + mobile)
- [x] Login page: inline waitlist email form + restructured as waitlist-first with "Already have access? Sign in" secondary
- [x] DB schema: added approved (boolean), accessCode (varchar), approvedAt (timestamp) to users table + invite_codes table
- [x] Server: invite code validation endpoint (access.redeem) with rate limiting + audit logging
- [x] Server: post-OAuth gating — unapproved users redirected to /login?error=not_approved
- [x] Server: access.status endpoint reads from ctx.user for testability
- [x] Frontend: WaitlistPending interstitial page with invite code input form + sign out
- [x] Frontend: Dashboard + CastingStudio approval gates (redirect unapproved non-admin users to /waitlist-pending)
- [x] Admin auto-approved in DB; admins bypass all gates
- [x] Tests: 6 tests for access.status (approved/unapproved/admin) + access.redeem (validation, rate limit, code trimming)

## Feature: Admin Invite Code Management UI
- [x] Create admin tRPC routes (createInviteCode, listInviteCodes, deactivateInviteCode)
- [x] Create AdminInviteCodes.tsx page with table + generate form
- [x] Add nav link to AdminHeader
- [x] Register route in App.tsx

## Feature: Floating Waitlist Modal with Two-Step Signup
- [x] Create WaitlistModal.tsx — floating bottom-right card, two-step flow
- [x] Step 1: Email + name capture (highest priority)
- [x] Step 2: Optional pill-chip questionnaire (role + source) with Skip
- [x] Wire Header, Services, Process buttons to trigger modal
- [x] Keep FAQ button scrolling to footer, keep WhyUs inline form, keep footer form
- [x] Tests: 10 tests for admin invite code routes (auth, validation, admin access)

## Bug: No beta key prompt after sign-in for unapproved users
- [x] Investigate current login → access gate flow
- [x] Add "Have an access code?" section directly on the sign-in card (Option C)
- [x] Ensure code redemption works without requiring OAuth first (note: redeem endpoint still requires auth session, but the UI now surfaces the input prominently)

## Feature: Beta key required BEFORE OAuth — no account without valid code
- [x] Create public endpoint to validate beta key (no auth required)
- [x] Redesign Login.tsx: step 1 = enter beta key, step 2 = OAuth (only after valid key)
- [x] Store validated code in cookie, pass to OAuth callback
- [x] Update OAuth callback to auto-redeem beta code from cookie
- [x] Remove /waitlist-pending page and route
- [x] Remove waitlist-pending references from Dashboard, CastingStudio, App.tsx
- [x] Write tests for access.validate endpoint (8 tests, 952 total passing)

## Fix: Login flow — no junk accounts, returning users skip code
- [x] OAuth callback: block account creation if no valid beta code (don't create user record)
- [x] OAuth callback: allow existing approved users to sign in without code
- [x] Login.tsx: three views — waitlist (default), "I have an access code" (new users), "I already have an account" (returning)
- [x] Server bounces unapproved users without code back to /login?error=no_code (no account created)
- [x] All 952 tests passing
- [x] Replace hero 3D JPG with transparent SVG/CSS embossed "drape" wordmark
- [x] Revert hero wordmark back to flat text, provide image specs for custom hero asset

## Casting Studio Redesign
- [x] Audit new design files from zip
- [x] Audit current Casting Studio codebase and backend connections
- [x] Compare old vs new, map backend dependencies
- [x] Propose migration strategy with Zustand state layer

### Phase 1: Server Prompts & Constants
- [x] Create MIGRATION.md manifest
- [x] Phase 1a: Update constants + brand profiles in geminiPrompts.ts
- [x] Phase 1b: Update studio settings, identity anchor, retry logic in geminiGeneration.ts
- [x] Phase 1c: Update prompt assembly functions (skin, iris, hair, suggestions)
- [x] Run tests and checkpoint
- [x] Add Design Rationale & Patch History section to MIGRATION.md
- [x] Phase 2a: Schema reconciliation + identity drift (schemaUpdater)
- [x] Phase 2b: Suggestion generation + reference analysis
- [x] Phase 2c: Prompt compaction
- [x] Phase 2d: tRPC route wiring for new procedures
- [x] Phase 2 tests and checkpoint
- [x] Phase 3a: Update shared types (ModelPreferences, Amendment, etc.)
- [x] Phase 3b: Update Zustand stores (form, generation)
- [x] Phase 3c: Update client hooks to call new tRPC procedures
- [x] Phase 3 tests and checkpoint
- [x] Phase 4a: Ethnicity Blend UI in ControlPanel
- [x] Phase 4b: Suggestion Chips UI
- [x] Phase 4c: MasterPrompt panel + Compact button
- [x] Phase 4 tests and checkpoint
- [x] Phase 5: Integration tests
- [x] Phase 5: Polish checks (imports, dead code, line counts, console warnings)
- [x] Phase 5: Checkpoint
- [ ] (Deferred) Split geminiGeneration.ts (682 lines) — extract prompt builders + iteration image prompt to get under 500

## Phase 6: Casting Studio Visual Overhaul (v3 Reference Design)
- [x] Step 1: Create TriBlendSelector + HairColorWheel components
- [x] Step 2: Update castingHelpers (ChipRow, CollapsibleSection warm restyle)
- [x] Step 3: Rewrite ControlPanel with warm sidebar, ChipRow, hair builder, resolution toggle
- [x] Step 4: Create MaskCanvas, ViewStrip, EmptyState sub-components
- [x] Step 5: Rewrite RefineBar, ExportModal, StageLockModal
- [x] Step 6: Rewrite ImageViewerPanel (warm canvas, floating ref, compare, loading overlay)
- [x] Step 7: Rewrite MasterPrompt panel + CastingStudio 3-panel layout wiring

## Backend Compatibility Audit (Phase 6 Post-Migration)
- [x] Audit all client-side casting files for tRPC calls, store usage, imports
- [x] Audit all server-side casting files (routers, db, gemini, prompts)
- [x] Cross-reference client calls vs server procedures, verify contracts
- [x] Identify dead code, redundant code, missing procedures
- [x] Verify prompt engineering patches 10-17 preservation
- [x] Compile structured audit report

## Dead Code Cleanup Sprint
- [x] Delete BrandSelector.tsx (144 lines, replaced by inline brand chips)
- [x] Delete EyeSection.tsx (127 lines, replaced by inline WarmPrimitives.EyeGrid)
- [x] Delete FaceSection.tsx (168 lines, replaced by inline face chips)
- [x] Delete SkinSection.tsx (127 lines, replaced by inline skin controls)
- [x] Delete PhysiqueSelector.tsx (70 lines, replaced by inline physique chips)
- [x] Delete HairSection.tsx (149 lines, replaced by inline hair builder)
- [x] Delete EthnicityBlender.tsx (185 lines, replaced by WarmPrimitives)
- [x] Delete DirectorsNote.tsx (~80 lines, replaced by MasterPromptPanel)
- [x] Delete ElapsedTimeDisplay.tsx (~45 lines, replaced by LoadingOverlay)
- [x] Remove dead exports from castingHelpers.tsx (ConnectorLine, BODY_ICONS, FACE_ICONS, LOADING_TIPS, CollapsibleSection, SelectControl, VisualOptionGrid)
- [x] Verify zero TypeScript errors after cleanup
- [x] Verify all tests pass after cleanup (1035/1035)

## Naming Collision Fix
- [x] Rename components/MasterPromptPanel.tsx to CompactPromptButton.tsx
- [x] Update all imports referencing the old name
- [x] Verify zero TypeScript errors and all tests pass (1035/1035)

## Comprehensive State Flow & Security Audit
- [x] 1. State flow verification (new cast, iterate, expand body, side profile, export, undo/redo, ref upload, suggestion click)
- [x] 2. Credit and rate limit coverage for all generation paths
- [x] 3. Error handling parity (cooldown UI, safety refusals, retry buttons)
- [x] 4. Cascade invalidation integrity (frontClose→frontFull→sideClose deletions)
- [x] 5. Export fidelity (ZIP builder view keys, PDF builder labels)
- [x] 6. Prompt injection safety (user text containment)
- [x] 7. Session lifecycle (undo/redo/new cast state mutations)
- [x] 8. Concurrent user isolation — WARNING W-1: module-level session variable
- [x] 9. Prompt engineering preservation (Patches 10-17) — all intact
- [x] 10. Compile structured audit report (COMPREHENSIVE_AUDIT_REPORT.md)

## W-1 Fix: Concurrent Session Isolation
- [x] Replace module-level `activeSession` with `Map<string, CastingSession>` keyed by userId
- [x] Update all activeSession read/write sites to use the map with userId
- [x] Update clearCastingSession to accept userId and clear only that user's session
- [x] Thread userId through all callers (castingImaging, castingRefinement routers)
- [x] Verify zero TypeScript errors and all tests pass (1035/1035)

## C-1 Cleanup: Remove Deprecated Aliases from geminiPrompts.ts
- [x] Verify getBrandDescriptors, getBrandDirectives, getNegativeConstraints have zero callers
- [x] Delete the 3 deprecated functions + re-exports + test assertions (4 files)
- [x] Verify zero TypeScript errors and all tests pass (1031/1031, 4 tests removed)

## Production Readiness Audit: Multi-User Scale (14 Dimensions)
- [x] 1. Gemini API Rate Limits & Quotas analysis
- [x] 2. Server Memory Management analysis
- [x] 3. Cost Controls & Billing Protection analysis
- [x] 4. Image Storage & Retention analysis
- [x] 5. Database Write Pressure analysis
- [x] 6. Concurrent Generation Queuing analysis
- [x] 7. Error Recovery & Resilience analysis
- [x] 8. Autoscaling & Infrastructure analysis
- [x] 9. WebSocket / Real-time Considerations analysis
- [x] 10. Security at Scale analysis
- [x] 11. Monitoring & Observability analysis
- [x] 12. Graceful Degradation analysis
- [x] 13. Data Privacy & Multi-tenancy analysis
- [x] 14. Load Testing Plan analysis
- [x] Compile PRODUCTION_READINESS_AUDIT.md report

## Audit Report Corrections (Mike's feedback)
- [x] Verify generateAllViews current state post-Patch 15 (walking/back views removed)
- [x] Verify proxyImage is behind protectedProcedure and update SSRF severity to P0
- [x] Verify Gemini safety refusal handling in credit refund path (new gap)
- [x] Update PRODUCTION_READINESS_AUDIT.md with corrections

## Batch 1: P0 Security & Database Fixes
- [x] Fix 1: Add 8 database indexes to drizzle schema
- [x] Fix 2: Add helmet security headers middleware
- [x] Fix 3: Restrict proxyImage to S3 domain + block private IPs
- [x] Fix 4: Rate limit fullBody, multiView, iterate, upscale
- [x] Fix 5: Rate limit free Gemini endpoints (suggestions, enhance, etc.)
- [x] Fix 6: Make addCredits() atomic
- [x] Write vitest tests for Batch 1 fixes
- [x] Run all tests and verify dev server

## Resilient Dynamic Imports
- [x] Create lazyWithRetry utility (client/src/lib/lazyWithRetry.ts)
- [x] Update HeroSection.tsx to use lazyWithRetry
- [x] Write vitest test for lazyWithRetry

## Batch 2: Gemini Queue & Hardening
- [x] Fix 7: Gemini request queue with p-limit concurrency control
- [x] Fix 8: Session eviction timer + 200-session cap
- [x] Fix 9: JSON body limit (10MB) + base64 Zod .max()
- [x] Fix 10: DB connection pool configuration (20 connections)
- [x] Write vitest tests for Batch 2 fixes
- [x] Run all tests and verify dev server

## Batch 3: Circuit Breaker, Placeholder Detection, Dead Code, GDPR
- [x] Fix 11: Circuit breaker for Gemini API
- [x] Fix 12: Post-generation placeholder image detection
- [x] Fix 13: Remove stale generateAllViews dead code
- [x] Fix 14: Account deletion endpoint (GDPR)
- [x] Write vitest tests for Batch 3 fixes
- [x] Run all tests and verify dev server

## Load Test Script
- [x] Create load test script simulating 20 concurrent generation requests
- [x] Verify queue concurrency limits, overflow rejection, and circuit breaker behavior

## Phase A: Optimize for Current Gemini Quotas
- [x] Make IMAGE_CONCURRENCY configurable via env var (default 5)
- [x] Make TEXT_CONCURRENCY configurable via env var (default 5)
- [x] Make MAX_QUEUE_DEPTH configurable via env var (default 50)
- [x] Add daily generation quota tracking per user
- [x] Add queue position feedback endpoint (tRPC)
- [x] Add queue position UI on frontend generation pages
- [x] Write vitest tests for Phase A changes
- [x] Run all tests and verify dev server

## Path B: Production Hardening (9/10 → 10/10)
- [x] Fix B1: Add database transactions to multi-step operations
- [x] Fix B2: Add GDPR data export endpoint
- [x] Fix B3: Add request correlation IDs middleware
- [x] Write vitest tests for Path B changes
- [x] Run all tests and verify dev server
## Path B Completion: Final 3 Hardening Items
- [x] Wire GDPR export to UI — "Download My Data" button in profile settings modal
- [x] Structured logging — replace console.error with pino (correlationId, userId, timestamp)
- [x] Webhook idempotency — add idempotency keys to Stripe webhook handlers
- [x] Write vitest tests for all 3 changes
- [x] Run all tests and verify dev server

## Bug Fixes: Usage Tab in Settings Modal
- [x] Fix Credits display showing 717 (period usage) instead of actual account balance
- [x] Fix Daily Usage bar chart not rendering (empty chart area)

## Branding Cleanup: Forma → Drape
- [x] Fix Navigation.tsx logo text: FormaStudio → drape
- [x] Fix ImageViewerPanel.tsx download filename: FORMASTUDIO → DRAPE
- [x] Fix homeData.ts portfolio item name: Forma → Drape
- [x] Fix SecurityTab.tsx GDPR export filename: forma-studio → drape
- [x] Fix useReferralClaim.ts localStorage key: forma_referral_code → drape_referral_code
- [x] Fix index.css CSS comment: FORMA STUDIO → DRAPE
- [x] Fix Dashboard.tsx share button text: Share Forma → Share Drape
- [x] Fix tokens.css class + comment: container-forma → container-drape / FORMA STUDIO → DRAPE
- [x] Fix access.test.ts test string: forma-test → drape-test
- [x] Fix DB: update existing FORMA- referral codes to DRAPE-
- [x] Fix pdfService.ts casting sheet header: forma studio → drape

## Dead Code Audit
- [x] Audit server-side for stale/dead functions, unused exports, orphaned modules
- [x] Audit client-side for dead components, hooks, unused imports
- [x] Remove ~35 confirmed dead symbols across 15+ files
- [x] Clean up tests referencing removed code (deleted load-test-queue.test.ts, fixed 5 other test files)
- [x] Run all tests and verify dev server (1,118 passing, 0 failures)

## Bug Fixes: Casting Studio Issues
- [x] Face structure should default to "auto" (guided by casting direction)
- [x] Quality should default to 2K not 1K resolution
- [x] Generate button blocked even when all required fields are filled
- [x] Admin tools are broken — fixed CollapsibleSection infinite loop

## Critical Bug Fixes — Production Launch Blockers
- [x] Fix CollapsibleSection infinite loop (useEffect depends on children ref, causes crash)
- [x] Fix face structure default: faceShape should default to "Auto" not "Oval"
- [x] Fix quality default: resolution should default to 2K not 1K (both init and reset)
- [x] Verify generate button works after CollapsibleSection fix (ethnicity is required field — correct behavior)
- [x] Fix generate button still showing "Fill Required Fields" when all fields are filled — stale closure bug in ControlPanel.tsx + missing ethnicityBlend fallback in isFormValid
- [x] Fix 'Unknown column user_id' error in credits deduction query (server/db/credits.ts) blocking all casting generations
- [x] Scan entire codebase for raw SQL using snake_case column names instead of Drizzle column refs
- [x] Write vitest tests verifying deductCredits and addCredits execute correct SQL after column name fix (6 tests pass)
- [x] Verify dashboard credit balance updates after generation (deducted 200 credits, balance correct)
- [x] Verify Stripe top-up / purchase flow through addCredits (added 500 purchase + 100 bonus, creditsPurchased correct)

## Casting Studio UI Regression Audit

### ImageViewerPanel.tsx — CRITICAL (22 differences)
- [x] Add RotatingSuggestions + SlotChip components (SOT lines 20-79)
- [x] Add StageLockModal component (already exists in StageLockModal.tsx)
- [x] Add contextual tips system (already in LoadingOverlay.tsx)
- [x] Replace LoadingOverlay — already matches SOT (scan lines, step indicators, rotating tips)
- [x] Add identity drift warning (SOT lines 628-640)
- [x] Add floating resizable reference image (draggable + resize handle)
- [x] Add image comparison on hold (press-and-hold to compare with previous)
- [x] Add regenerate/retry button on hover
- [x] Add contextual help text for new models
- [x] Add keyboard shortcuts (Z undo, shift-Z redo, / focus refine, F toggle ref)
- [x] Replaced NextStageCTA with SOT-style next stage CTA
- [x] Removed stale DownloadButton (export handled via ExportModal)
- [x] Replaced modal error overlay with inline error banner
- [x] Integrated view label into StatusPill (Headshot · v1)
- [x] Fixed StatusPill — chevron undo/redo with comparing state indicator
- [x] Fixed ToolsBar — inline with unlockMode logic

### RefinePanel.tsx — HIGH (9 differences)
- [x] Removed SuggestionChips from RefinePanel (moved to ImageViewerPanel as RotatingSuggestions)
- [x] Moved masking helper to ImageViewerPanel
- [x] Moved shortcuts bar to ImageViewerPanel
- [x] Kept enhance button hover animation (already correct)
- [x] Aligned submit logic with SOT pattern

### ViewTabs.tsx — CRITICAL (3 differences)
- [x] Kept sideFull/backFull — intentional additions for future views
- [x] Kept Zustand-based data flow (intentional architecture decision)

### ControlPanel.tsx — CRITICAL (11 differences)
- [x] Kept Admin Tools section (intentional addition)
- [x] Kept Mobile Panel wrapper (intentional addition)
- [x] Kept CompactPromptButton (intentional addition)
- [x] Generate button text already correct (Cast Model / Recast Model)

### MasterPromptPanel.tsx — HIGH (5 differences)
- [x] Add detailed reference image tooltip — updated MasterPromptPanel.tsx
- [x] Fix reference image instructions text — added F key toggle + drag/resize instructions
- [x] Fix identity card display logic — already correct in running app
- [x] Fix spec tab placeholder content — removed fallback strings

### Types/Constants — CRITICAL (9 differences)
- [x] Add GenerationMode enum — not needed, running app uses different architecture
- [x] Add AspectRatio enum — not needed, running app uses different architecture
- [x] Add ModelViews interface — not needed, uses GeneratedAsset[] with viewType
- [x] Add previousMasterPrompt field — not needed, tracked in useCastingGenerationStore

### Missing Components
- [x] Add Tooltip.tsx component — already exists at client/src/components/Tooltip.tsx

## Full SOT Cross-Check Audit (Round 2)
- [ ] Extract and catalog SOT codebase structure
- [ ] Audit Types & Constants — every type, interface, enum in SOT must exist in running app
- [ ] Audit Prompt Logic — diff every prompt string character by character
- [ ] Audit Service Functions — signatures, bodies, new functions
- [ ] Audit Component Logic — props, state, handlers, effects
- [ ] Audit Wiring — App/context passes all required props, imports correct
- [ ] Compile findings and propose fixes

## SOT Prompt Assembly Fixes (buildNewPromptContent)
- [x] Add formatEthnicityBlend() with qualitative dominance bands
- [x] Add describeWeight() vibe blend system (3 intensity tiers per axis)
- [x] Add skin texture age reconciliation (effectiveSkinTexture)
- [x] Separate features into explicitFeatures[] and unsetFeatures[] with isExplicit()
- [x] Add P1 enforcement language for skin tone, eye color, hair color
- [x] Add bodyTypeHeadshotHint() for visible headshot effects
- [x] Add hair detail filtering for buzz/shaved styles
- [x] Restructure prompt with section headers
- [x] Add 3rd fallback model (gemini-2.5-flash) + withSingleRetry503 to generateMasterPrompt
- [x] Add maxOutputTokens: 4096 to generateMasterPrompt config

## enhanceUserPrompt Audit
- [x] Audit enhanceUserPrompt against SOT — matches (2-model chain, prompt text, config all identical; temperature removed)

## Gemini Temperature Audit
- [x] Remove temperature: 0.2 from enhanceUserPrompt
- [x] Audit all other Gemini calls for non-default temperature and remove (only 1 found — enhanceUserPrompt; voiceTranscription.ts is Whisper API type def, not Gemini)

## Dead Code Cleanup
- [x] P1: Delete SuggestionChips.tsx (unused component)
- [x] P1: Delete ReferenceNode.tsx (unused component)
- [x] P1: Delete ToolsBar.tsx (unused component)
- [x] P1: Remove generateExportId from castingHelpers.tsx
- [x] P1: Un-export isPlaceholderImage in placeholderDetection.ts (reverted — tests import it directly)
- [x] P1: Clean barrel files (index.ts, ImageViewer/index.tsx)
- [x] P2: Remove 15 unused hooks from useCastingGenerationStore.ts (kept 5 that are imported)
- [x] P2: Remove 7 unused hooks from useCastingFormStore.ts (all removed, none imported)
- [x] P3: Clean dead imports across 8 files (ControlPanel types are used in props, MaskCanvas EditTool is used, UIStore EditTool is used — only cleaned useCastingViewGeneration and castingRefinement)
- [x] P4: Un-export internal types (EyePreset, SkinTone, BrandOption, HairStyleConfig, AtomicCreditOptions, AtomicCreditResult, ReqDot)
- [x] P4: Extract fetchAsBase64 helper in aiService.ts (replaced 4 duplicate URL-to-base64 patterns)

## Bug Fixes
- [x] Fix infinite loop in HairColorWheel.tsx (Maximum update depth exceeded on /casting-studio)
- [x] Fix ethnicity chips not visually selected after Admin Tools Random Fill / Auto Generate

## Casting Studio Bug Batch (Feb 20)
- [x] BUG-1: Removed CompactPromptButton from ControlPanel, auto-compact threshold adjusted 3→5 to match SOT
- [x] BUG-2: Added failedAction tracking to store, handleRetry now replays exact failed action
- [x] BUG-3: Navy iris descriptor matches SOT character-for-character — Gemini model behavior, not code issue
- [x] BUG-4: P1 enforcement language matches SOT exactly — Gemini model behavior, not code issue
- [x] BUG-5: Fixed erase tool — client now composites base image + mask strokes (matches SOT), removed redundant server-side compositing
- [x] BUG-6: Restyled next stage CTA to match SOT (white-on-dark, glow shadow, ping animation, slide-in)
- [x] BUG-7: Fixed hold-to-compare — changed history[length-1] to history[historyIndex-1]


## Deep Quality Audit (Feb 20 - Batch 2)
- [x] QUAL-1: Hair descriptors match SOT exactly — issue was missing ethnicityHint to image model causing prompt to be ignored. Fixed via CASTING OVERRIDES + ethLock reinforcement
- [x] QUAL-2: Fixed chatbox sizing — imageAreaHovered was initialized to true (always visible). Changed to false (hidden until hover)
- [x] QUAL-3: Audited reference image workflow — flow matches SOT. Reference images passed correctly on NEW generation. Iterate uses currentImageUrl as reference.
- [x] QUAL-4: Audited full pipeline — fixed missing ethnicityHint + CASTING OVERRIDES in both castingImaging and castingRefinement routes
- [x] QUAL-5: Fixed ethnicityBlend silently stripped by Zod schema in models.create. Added to schema. Created shared promptReinforcement.ts with dominance bands matching SOT
- [x] QUAL-6: Fixed race drift — caused by missing ethnicityHint to image model. Added ethLock heritage-specific markers (East Asian eye markers, African nose/lip markers, platinum blonde example)
- [x] QUAL-7: Simplified QueueStatusBar (queue position only when queued). LoadingOverlay now uses warm palette for first gen (no charcoal), dark overlay for iterations
- [x] QUAL-8: Removed 'Mixed' from ETHNICITIES array — matches SOT. Blend UI handles mixed heritage via 2-ethnicity selector

## SOT Comparison Round 2 — Remaining Discrepancies
- [x] DISC-1: Changed iterate to FREEZE-AND-APPEND — appends amendment to existing prompt, compacts every 5, uses updateSchemaForIteration for surgical schema updates
- [x] DISC-2: Added server-side image compression via sharp (imageCompression.ts) — 1.5MB budget, cascading JPEG quality, integrated into fetchAsBase64
- [x] DISC-3: Wired technicalSchema + bodyType through aiService.ts and castingImaging.ts routes to geminiViews.ts functions
- [x] DISC-4: Added fire-and-forget reconcile call after iteration success. Changed route to accept imageUrl (fetches base64 server-side)

## Reference Image Bug (Mar 24)
- [x] BUG-REF-1: Fixed reference image not passed during iteration — added referenceImage to iterate Zod schema, client sends prefs.referenceImage, server passes as additionalReference to iterateModel. Also added post-iteration reference re-analysis for better suggestions (matches SOT)

## Tainted Canvas Bug (Mar 24)
- [x] BUG-CANVAS-1: Fixed tainted canvas — load fresh Image() with crossOrigin='anonymous' + cache-buster before drawing to canvas. Also fixed RefAnalysis sending S3 URL instead of base64 to Gemini

## Body Type / Face Shape Investigation (Mar 24)
- [x] INV-1: CONFIRMED SOT BEHAVIOR — "Slim" body type returns empty hint (no face shape guidance) in BOTH codebases. Face Shape was set to "Auto" so AI picks freely. East Asian heritage naturally tends toward rounder face shapes. Miu Miu brand descriptor says "casts eclectically, do NOT default to severe or angular". Not a bug — user should set Face Shape to "Oval" or "Diamond" for a slimmer face.

## Body Type Hint Enhancement (Mar 24)
- [x] ENH-1: Added headshot hint for "Slim" — "defined jawline, lean face with visible bone structure, slender neck, and narrow shoulders"
- [x] ENH-2: Added fallback hint for "Model Standard" (not a selectable option, just the fallback when bodyType is undefined) — "lean proportions, defined bone structure, slender neck"

## RefAnalysis INVALID_ARGUMENT Bug (Mar 24)
- [x] BUG-REFANALYSIS-1: analyzeReferenceForTransfer receives S3 URL where Gemini expects base64 — causes INVALID_ARGUMENT error on post-iteration reference analysis
- [x] BUG-REFANALYSIS-2: generateCastingSuggestions receives S3 URL where Gemini expects base64 — same root cause, silent fallback hid the issue
- [x] FIX: Added ensureBase64() helper in geminiSuggestions.ts — detects URLs vs base64 data URLs, fetches and converts URLs server-side before passing to Gemini API

## Reference Image Transfer Bug (Mar 24)
- [x] BUG-REFTRANSFER-1: Reference image hairstyle transfer not working during iteration — stale closure in performIteration captured prefs without prefs in deps, so referenceImage was always null at call time. Fixed by reading fresh from store via useCastingFormStore.getState()
- [x] BUG-REFTRANSFER-2: Existing features (scar) partially disappearing during iteration — Gemini model behavior, not a code bug (same in SOT). With reference image now properly attached, IDENTITY LOCK + FREEZE-AND-APPEND should better preserve features

## Reference Image Transfer — Color Bleed Bug (Mar 24)
- [x] BUG-REFTRANSFER-3: Hairstyle transfer from reference image also copies hair COLOR — ROOT CAUSE: client called handleClearSession() after NEW generation, destroying chat session. Iterations fell to stateless mode with weaker identity anchoring. Fixed by removing the redundant client-side session clear.
- [x] BUG-REFTRANSFER-4: Poor quality of hairstyle transfer — same root cause as BUG-REFTRANSFER-3. Chat-based iteration provides conversation context for better attribute isolation and transfer fidelity.

## Edit Log Undo/Redo Bug (Mar 24)
- [x] BUG-EDITLOG-1: Edit log in right profile panel stays static when user undoes/redoes or jumps to a previous version — Fixed: added parallel historyAmendments array that tracks amendments per history entry. setHistoryIndex now derives amendments from historyAmendments[newIndex]. pushHistory snapshots amendments. addAmendment updates both amendments and historyAmendments[current].

## Low-Fidelity Reference Hairstyle Transfer (Mar 24)
- [x] BUG-REFTRANSFER-5: Reference image hairstyle transfer is low fidelity — Fixed: rewrote ATTRIBUTE TRANSFER prompt with TRANSFER FIDELITY block leading, reordered prompt structure, added per-attribute ALLOWED/BLOCKED rules, partial transfer support, and expression transfer.

## Enhanced Reference Transfer (Beyond SOT)
- [x] ENH-REFTRANSFER-1: Rewrite ATTRIBUTE TRANSFER prompt — add TRANSFER FIDELITY block, reorder prompt (transfer first, identity second), add partial/multi-attribute support
- [x] ENH-REFTRANSFER-2: Add BLOCKED list for makeup/accessories/pose — scoped to Casting Studio
- [x] ENH-REFTRANSFER-3: Add ALLOWED TRANSFERS enumeration with per-attribute protection rules
- [x] ENH-REFTRANSFER-4: Allow expression transfer (facial muscles only, no pose/head angle)
- [x] ENH-REFTRANSFER-5: Add skin finish as transferable attribute
- [x] ENH-REFTRANSFER-6: Add missing SOT lines for eye shape and eyebrow clarification
- [x] Fix iris descriptions: Amber (HIGH - gemstone metaphor causing glowing eyes), Ice (translucency), Honey (sun-lit), Steel (metallic)
- [x] Redesign loading overlay to Option B: line loader + cycling tips only, remove dot pattern, status text, timer
- [x] Expand loading overlay contextual tips from 3-5 to 8-10 per category
- [x] Fix #1: Pass current model image to handleAnalyzeReference after iteration
- [x] Improvement #2: Trigger reference analysis immediately on reference upload
- [x] Improvement #3: Increase suggestion prompt context from 500 to 1500 chars
- [x] Improvement #4: Even out RotatingSuggestions slot distribution for <6 items
- [x] Improvement #5: Deduplicate suggestion fallback arrays into shared constant
- [x] Remove quality selector from export modal, default all exports to 2K
- [x] Investigate and fix export errors from logs
- [x] Remove non-functional 1K/2K quality toggle from ControlPanel sidebar
