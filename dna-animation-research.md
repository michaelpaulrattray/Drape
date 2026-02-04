# DNA Animation Research for Casting Studio

## Reference Examples Found

### 1. CSS-Only DNA Double Helix (CodePen by Josetxu)
- Pure CSS implementation with 3D transforms
- Uses CSS custom properties for customization
- Colorful spheres connected by bars
- Continuous rotation animation
- Stretchable/configurable dimensions

### 2. Neon 3D DNA with GSAP + ScrollTrigger (CodePen by Gajera-Aman)
- Uses GSAP for smooth animations
- ScrollTrigger integration for progress-based animation
- Neon/glowing aesthetic
- 50 rungs with bases and connectors
- 3D perspective with preserve-3d

## Implementation Approach for FormaStudio

### Concept
Replace the current "CASTING STUDIO" hero section with an animated DNA helix that:
1. Starts in a "dormant" state (greyed out, minimal animation)
2. Progressively "lights up" and animates as user completes form fields
3. Each DNA rung/base pair represents a category of selections
4. Full animation/glow when all required fields are complete

### Technical Approach
- **Pure CSS/React**: Use CSS transforms and animations with React state
- **Progress Integration**: Map form completion percentage to DNA animation state
- **Categories to DNA Rungs**:
  - Casting Basics (brand, vibe, gender)
  - Demographics (age, ethnicity, body type)
  - Face Structure (shape, eyebrows)
  - Skin & Complexion (tone, texture, finish)
  - Eyes (color)
  - Hair (color, style, length, texture, etc.)

### Visual Style Options
1. **Minimalist/Scientific**: Clean white/gray with subtle blue accents
2. **Neon/Tech**: Glowing cyan/magenta on dark background
3. **Organic/Biological**: Soft gradients, natural colors

### Feasibility Assessment
**High fidelity is achievable** using:
- CSS 3D transforms for the helix structure
- CSS animations for rotation and glow effects
- React state to control animation progress based on form completion
- Smooth transitions between states

### Estimated Complexity
- Medium-High complexity
- ~200-300 lines of CSS for the DNA structure
- ~100-150 lines of React component logic
- Integration with existing form state management
