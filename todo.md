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
