# Interactive 3D Hero Image — Technical Proposal

**FormaStudio** | February 2026 | Prepared by Manus AI

---

## Executive Summary

The Lando Norris website ([landonorris.com](https://landonorris.com/)) features a hero section that transforms a flat 2D photograph into an interactive pseudo-3D scene using **Three.js r174** and a multi-layered texture map approach. As the user moves their cursor, the image subtly shifts in 3D space, creating depth and parallax that feels premium and immersive. A 3D helmet model is revealed on hover through a fluid blob-mask shader, adding an additional layer of interactivity.

This proposal evaluates how to adapt a similar depth-map parallax effect for FormaStudio's hero image, considering our React + Vite stack, performance constraints, mobile behaviour, and asset requirements.

---

## How the Lando Norris Hero Works

The hero is not a 3D model of a person — it is a **2D photograph rendered on a Three.js plane**, enhanced with multiple texture maps that create the illusion of depth. The technique is sometimes called "2.5D" or "fake 3D."

### Texture Map Layers

The following table summarises the six texture maps loaded for the hero "head" scene, all served as WebP files from the agency's CDN (`lando.itsoffbrand.io`):

| Map | Purpose | Visual Description |
|---|---|---|
| **Diffuse** | The main photograph of Lando | Full-colour portrait image |
| **Depth** | Encodes distance from camera per pixel | Greyscale — white pixels are "closer," dark pixels are "further away" |
| **Alpha** | Cutout mask to isolate the figure from background | Binary black/white silhouette |
| **Normal** | Adds subtle surface detail for light interaction | Purple/blue-tinted map encoding surface normals |
| **Shadow** | Darkens areas beneath the 3D helmet overlay | Soft gradient shadow positioned at head level |
| **Shadow (softer)** | Alternative softer shadow for different states | Lighter variant of the above |

### Rendering Pipeline

The Three.js scene operates as follows. A `PlaneGeometry` is created with sufficient vertex subdivisions (likely 128×128 or higher). The diffuse texture is applied as the colour map. A **custom vertex shader** reads the depth map and displaces each vertex along the Z-axis proportionally to its depth value — brighter pixels are pushed forward, darker pixels recede. The displacement amount is kept subtle (a few percent of the plane size) to avoid distortion.

As the user moves their mouse, the camera position (or the plane's rotation) is updated via `requestAnimationFrame`, smoothly interpolated with damping. The depth displacement combined with the slight camera shift produces a convincing parallax effect where foreground elements (face, shoulders) appear to move independently of background elements (hair, environment). The alpha map is used in the fragment shader to discard background pixels, allowing the figure to float over the page content. The normal map adds subtle specular highlights that shift with the virtual light direction tied to mouse position.

### The Helmet Reveal

On top of the depth-mapped photo, a separate 3D GLB model of a helmet is rendered. A custom shader generates a "fluid blob" mask based on cursor position and velocity — as the user hovers, organic blob shapes expand to reveal the helmet underneath. This uses a noise-based metaball shader, not a simple circular reveal. The helmet itself has full PBR materials (BaseColor, Normal, Roughness, Metallic maps) and is lit by an HDRI environment map for realistic reflections.

### Additional Technologies on the Page

The broader site uses **Rive** for animated icons and page transitions (8 `.riv` files), **Lenis** for smooth scroll, **jQuery 3.5.1** with **Tram** for CSS animation orchestration, and **Draco** compression for 3D model files. The site is built on **Webflow** with custom vanilla JavaScript — no React or component framework.

---

## Proposed Options for FormaStudio

### Option A: Depth-Map Parallax via React Three Fiber (Recommended)

This option replicates the core depth-map parallax effect from the Lando site, adapted for our React + Vite stack using **React Three Fiber** (R3F) — the standard React binding for Three.js.

**What the user sees:** The current hero image gains subtle 3D depth. Moving the cursor causes the model's face and body to shift slightly relative to the background, creating an engaging parallax effect. On scroll, the existing zoom-out animation is preserved. The effect feels premium without being distracting.

**Technical approach:**

The implementation requires a single `<Canvas>` component from R3F containing a subdivided plane mesh. A custom shader material reads the depth map to displace vertices and applies the diffuse texture with alpha cutout. Mouse position is tracked via R3F's built-in `useFrame` and pointer events, smoothly interpolating camera offset with spring physics. The entire component would be approximately 150–200 lines of code, split across a `HeroScene.tsx` component and a `depthShader.ts` file containing the GLSL vertex/fragment shaders.

**Dependencies to add:**

| Package | Gzipped Size | Purpose |
|---|---|---|
| `three` | ~150 KB | Core 3D engine (peer dependency) |
| `@react-three/fiber` | ~45 KB | React renderer for Three.js |
| `@react-three/drei` | ~30 KB (tree-shaken) | Utility hooks (useTexture, useFrame helpers) |
| **Total added** | **~225 KB gzipped** | — |

**Effort estimate:** 2–3 days of development, plus 0.5–1 day for asset preparation (generating the depth map and alpha map from the hero image).

**Pros:** Integrates naturally with our React component tree. R3F has zero performance overhead vs vanilla Three.js [1]. Declarative API makes the scene easy to maintain. Tree-shaking with Vite keeps the bundle lean. Large community and ecosystem.

**Cons:** Adds ~225 KB to the initial bundle (can be mitigated with lazy loading). Requires learning GLSL shader basics for the depth displacement. Three.js is a large dependency even tree-shaken.

---

### Option B: Vanilla Three.js with Lazy Loading

This option uses **raw Three.js** (no R3F wrapper) loaded dynamically only when the hero section enters the viewport. This mirrors the Lando site's approach more closely.

**What the user sees:** Identical visual result to Option A — the same depth-map parallax effect.

**Technical approach:**

A vanilla Three.js scene is initialised inside a `useEffect` hook, with the Three.js module imported dynamically via `import('three')`. The scene, camera, renderer, and shader material are created imperatively. Mouse tracking and animation loop are managed outside React's render cycle. The component mounts a `<canvas>` element and Three.js renders directly to it.

**Effort estimate:** 3–4 days. More boilerplate code for scene setup, cleanup, and resize handling that R3F handles automatically.

**Pros:** Slightly smaller bundle if only core Three.js modules are imported. No R3F abstraction layer. Closer to the reference implementation's architecture.

**Cons:** More imperative code to maintain. Manual cleanup of WebGL resources on unmount. No React integration for state/props changes. Harder to extend later (e.g., adding interactive elements to the 3D scene).

---

### Option C: CSS-Only Parallax with `perspective` and `translateZ`

This option avoids WebGL entirely and uses **pure CSS 3D transforms** to create a layered parallax effect. The hero image is split into 2–3 layers (foreground figure, mid-ground, background) and each layer is positioned at a different `translateZ` depth within a `perspective` container. Mouse movement is tracked with a lightweight JS handler that updates CSS custom properties.

**What the user sees:** A simpler parallax effect where the figure appears to float slightly above the background. Less convincing than the depth-map approach — the separation is between discrete layers rather than per-pixel depth. Still noticeably more engaging than a static image.

**Effort estimate:** 1 day. Requires manually masking the figure from the background in an image editor to create 2–3 separate PNG layers.

**Pros:** Zero additional dependencies. No WebGL context. Works on all devices including low-end mobile. Tiny performance footprint. Simple to maintain.

**Cons:** Visually inferior — the effect is "layered cardboard cutout" rather than smooth per-pixel depth. Cannot replicate the Lando site's quality. Limited to 2–4 discrete depth layers. No light/normal map interaction.

---

## Recommendation

**Option A (React Three Fiber)** is the recommended approach. It delivers the closest visual fidelity to the Lando Norris reference while integrating cleanly with our existing React + Vite + Tailwind stack. The ~225 KB bundle addition is acceptable given that the hero is the first thing users see and the 3D effect directly supports FormaStudio's premium brand positioning. The bundle impact can be further mitigated by lazy-loading the Three.js canvas component so it only initialises after the critical above-the-fold content has rendered.

---

## Performance Considerations

**Desktop performance** will be excellent. The depth-map parallax technique renders a single textured plane — far lighter than a full 3D scene with models and physics. The Lando site maintains 60 FPS on an M1 Mac even with multiple 3D models, helmet PBR materials, and 20 canvas elements. Our implementation would use a single canvas with one plane, making it significantly lighter.

**Mobile behaviour** requires a deliberate strategy. The Lando site disables the 3D hero on mobile and shows a static image instead — this is the industry-standard approach. Touch-based parallax (using device gyroscope or touch-drag) is possible but adds complexity and can feel gimmicky. The recommended approach is to **render the static hero image on mobile** (screens below 768px) and only initialise the Three.js canvas on desktop. This keeps mobile performance pristine and avoids draining battery with a WebGL context.

**Bundle impact** can be managed through code splitting. Using `React.lazy()` and `Suspense`, the Three.js modules are only downloaded when the hero component mounts. The static image serves as the fallback during loading, so there is no visible delay. On a typical broadband connection, the additional ~225 KB loads in under 200ms.

**GPU memory** usage is modest. The depth-map approach requires loading 3–4 textures (diffuse, depth, alpha, optionally normal) at the hero image's resolution. At 1600×900 in WebP format, this totals approximately 2–4 MB of texture data in GPU memory — well within the budget of any modern GPU, including integrated graphics.

---

## Asset Requirements

The current hero image (`unsplash.com/photo-1534528741775-53994a69daeb`) is a stock photograph of a model. To create the 3D effect, the following derivative assets must be generated:

| Asset | How to Generate | Notes |
|---|---|---|
| **Diffuse texture** | Use the existing hero image (or a higher-res version) | Should be at least 1600×900, WebP format |
| **Depth map** | AI depth estimation (MiDaS, Depth Anything V2, or Marigold) | Greyscale image, same dimensions as diffuse. Can be generated in seconds using free online tools or a Python script with the `transformers` library |
| **Alpha map** | AI background removal (rembg, remove.bg, or Photoshop) | Binary mask isolating the figure. Only needed if we want the figure to float over the page background |
| **Normal map** (optional) | Generated from the depth map using a normal-map converter | Adds subtle light interaction on mouse move. Nice-to-have, not essential |

**Does the current hero image work?** Yes — any high-quality photograph can be converted into a depth-mapped 3D scene. The Unsplash portrait currently used is well-suited because it has a clear foreground subject (face/shoulders) with distinct depth separation from the background. However, if FormaStudio plans to use AI-generated model imagery (which aligns with the product's purpose), the same pipeline applies — generate the model image, then run it through depth estimation.

**Asset generation effort:** Approximately 30 minutes using AI tools. The depth map and alpha map can be generated programmatically with a short Python script, or manually using free web tools like [Depth Anything](https://huggingface.co/spaces/depth-anything/Depth-Anything-V2) and [remove.bg](https://www.remove.bg/).

---

## Comparison Summary

| Criterion | Option A: R3F | Option B: Vanilla Three.js | Option C: CSS Parallax |
|---|---|---|---|
| **Visual fidelity** | High — per-pixel depth | High — per-pixel depth | Medium — layered cutouts |
| **Bundle size added** | ~225 KB gzipped | ~150 KB gzipped | 0 KB |
| **Development effort** | 2–3 days | 3–4 days | 1 day |
| **React integration** | Native (declarative) | Manual (imperative) | Native (CSS + state) |
| **Mobile strategy** | Static fallback | Static fallback | Works natively |
| **Maintainability** | High (component-based) | Medium (imperative cleanup) | High (CSS only) |
| **Extensibility** | Easy to add 3D elements later | Possible but more work | Limited to 2D layers |
| **Matches Lando reference** | 90% fidelity | 95% fidelity | 40% fidelity |

---

## What We Would NOT Replicate

The Lando site includes several features that are either unnecessary or disproportionately complex for FormaStudio's use case. The **3D helmet reveal with fluid blob shader** is tightly coupled to the Lando brand narrative (F1 helmets) and would require a custom 3D model asset plus advanced shader programming — estimated 5+ additional days. The **Rive animations** throughout the page are a separate animation system unrelated to the hero 3D effect. The **Lenis smooth scroll** (scrolljacking) is a controversial UX pattern that the transcript itself acknowledges is divisive. The **page transition curtain effect** is a navigation pattern, not a hero feature.

The proposal focuses exclusively on the **depth-map parallax on the hero image** — the single most impactful visual element that creates the "premium and engaging" feeling you described.

---

## Next Steps

Upon approval, the implementation would proceed in two incremental steps:

**Step 1 — Asset preparation and R3F scaffold (Day 1):** Install `three`, `@react-three/fiber`, and `@react-three/drei`. Generate depth map and alpha map from the hero image. Create the `HeroScene.tsx` component with a basic textured plane and mouse tracking. Verify the 3D canvas renders correctly alongside existing page content.

**Step 2 — Shader refinement and polish (Days 2–3):** Implement the custom depth-displacement shader. Add normal map for light interaction. Tune parallax intensity, damping, and easing to feel natural. Implement mobile detection with static image fallback. Integrate with the existing scroll-based zoom-out animation. Performance test on multiple devices.

---

## References

[1]: https://github.com/pmndrs/react-three-fiber/issues/4 "R3F vs vanilla Three.js performance — pmndrs/react-three-fiber GitHub Issue #4"

- [1] R3F vs vanilla Three.js performance — pmndrs/react-three-fiber GitHub Issue #4
- Lando Norris website: [landonorris.com](https://landonorris.com/)
- Video transcript analysis: Provided by user (pasted_content_3.txt)
- Three.js depth/displacement examples: [threejs.org/examples](https://threejs.org/examples/)
- Depth Anything V2: [huggingface.co/spaces/depth-anything](https://huggingface.co/spaces/depth-anything/Depth-Anything-V2)
