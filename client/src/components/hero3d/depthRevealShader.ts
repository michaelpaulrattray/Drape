/**
 * Radial reveal shader with depth parallax.
 *
 * Artifact prevention (per Claude's guide):
 *   1. Depth range compressed [0,1] → [0.4, 0.6] (medium compression)
 *   2. Edge fade prevents boundary sampling artifacts
 *   3. UV clamped to 0.001–0.999 (safety net for GPU edge cases)
 *   4. Both textures sample from SAME parallax UV (no seam at reveal edge)
 *   5. Depth map pre-blurred 8px Gaussian (provided by user)
 *
 * Reveal mask:
 *   - Soft inner/outer radius with Hermite smoothing
 *   - Aspect-ratio corrected for circular appearance
 */

export const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const fragmentShader = /* glsl */ `
  uniform sampler2D uBaseTexture;
  uniform sampler2D uStyledTexture;
  uniform sampler2D uDepthMap;
  uniform vec2 uMouse;
  uniform float uRevealProgress;
  uniform float uRevealRadius;
  uniform float uParallaxStrength;

  varying vec2 vUv;

  void main() {
    // ── 1. Sample and compress depth ─────────────────────────
    // Depth map is pre-blurred 8px Gaussian for smooth transitions
    float rawDepth = texture2D(uDepthMap, vUv).r;
    // Compress range [0,1] → [0.4, 0.6] — medium compression for subtle depth
    float depth = mix(0.4, 0.6, rawDepth);

    // ── 2. Calculate parallax offset ─────────────────────────
    vec2 mouseOffset = (uMouse - 0.5) * 2.0;
    float parallaxDepth = (depth - 0.5) * 2.0;
    vec2 parallaxOffset = mouseOffset * parallaxDepth * uParallaxStrength;

    // ── 3. Edge fade (prevent boundary sampling) ─────────────
    float edgeMargin = 0.12;
    float edgeFadeX = smoothstep(0.0, edgeMargin, vUv.x)
                    * smoothstep(0.0, edgeMargin, 1.0 - vUv.x);
    float edgeFadeY = smoothstep(0.0, edgeMargin, vUv.y)
                    * smoothstep(0.0, edgeMargin, 1.0 - vUv.y);
    parallaxOffset *= edgeFadeX * edgeFadeY;

    // ── 4. Clamp final UV (safety net) ───────────────────────
    vec2 finalUv = clamp(vUv + parallaxOffset, 0.001, 0.999);

    // ── 5. Radial reveal mask ────────────────────────────────
    // Aspect ratio correction (image is ~1.79:1)
    vec2 aspect = vec2(1.79, 1.0);
    vec2 diff = (vUv - uMouse) * aspect;
    float dist = length(diff);

    // Soft edges with Hermite smoothing
    float innerRadius = uRevealRadius * 0.25;
    float outerRadius = uRevealRadius * 1.3;
    float revealMask = 1.0 - smoothstep(innerRadius, outerRadius, dist);
    revealMask = revealMask * revealMask * (3.0 - 2.0 * revealMask);
    revealMask *= clamp(uRevealProgress, 0.0, 1.0);

    // ── 6. Sample BOTH textures with SAME UV ─────────────────
    vec4 baseColor = texture2D(uBaseTexture, finalUv);
    vec4 styledColor = texture2D(uStyledTexture, finalUv);

    // ── 7. Final blend ───────────────────────────────────────
    gl_FragColor = mix(baseColor, styledColor, revealMask);

    // Ensure correct sRGB output (Canvas uses flat mode)
    #include <colorspace_fragment>
  }
`;
