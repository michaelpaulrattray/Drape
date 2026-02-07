/**
 * Radial reveal shader with subtle depth parallax.
 *
 * Fragment shader:
 *   1. Applies subtle depth-based parallax to the BASE image only
 *      (compressed depth range to avoid harsh boundary artifacts)
 *   2. Crossfades to the STYLED image via a soft-edged circular mask
 *      that follows the cursor (styled image sampled at original UV)
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
  uniform vec2 uTexelSize;

  varying vec2 vUv;

  // 5-tap box blur on depth map to smooth silhouette discontinuities
  float sampleDepthBlurred(vec2 uv) {
    float center = texture2D(uDepthMap, uv).r;
    float left   = texture2D(uDepthMap, uv + vec2(-uTexelSize.x, 0.0)).r;
    float right  = texture2D(uDepthMap, uv + vec2( uTexelSize.x, 0.0)).r;
    float up     = texture2D(uDepthMap, uv + vec2(0.0,  uTexelSize.y)).r;
    float down   = texture2D(uDepthMap, uv + vec2(0.0, -uTexelSize.y)).r;
    return (center + left + right + up + down) / 5.0;
  }

  void main() {
    // ── Depth-based parallax (base image only) ──────────────
    float rawDepth = sampleDepthBlurred(vUv);
    // Compress depth range [0,1] → [0.35, 0.65] to reduce boundary artifacts
    float depth = mix(0.35, 0.65, rawDepth);
    vec2 mouseOffset = (uMouse - 0.5) * 2.0;
    float parallaxDepth = (depth - 0.5) * 2.0;
    vec2 parallaxOffset = mouseOffset * parallaxDepth * uParallaxStrength;

    // ── Fade parallax to zero near edges to prevent ghost/double-image ──
    float edgeMargin = 0.12; // fade zone width in UV space
    float edgeFadeX = smoothstep(0.0, edgeMargin, vUv.x) * smoothstep(0.0, edgeMargin, 1.0 - vUv.x);
    float edgeFadeY = smoothstep(0.0, edgeMargin, vUv.y) * smoothstep(0.0, edgeMargin, 1.0 - vUv.y);
    parallaxOffset *= edgeFadeX * edgeFadeY;

    vec2 baseUv = clamp(vUv + parallaxOffset, 0.0, 1.0);

    // ── Radial reveal mask ──────────────────────────────────
    // Aspect ratio correction (image is ~1.79:1)
    vec2 aspect = vec2(1.79, 1.0);
    vec2 diff = (vUv - uMouse) * aspect;
    float dist = length(diff);

    // Soft-edged circular mask
    float innerRadius = uRevealRadius * 0.6;
    float outerRadius = uRevealRadius;
    float revealMask = 1.0 - smoothstep(innerRadius, outerRadius, dist);
    revealMask *= clamp(uRevealProgress, 0.0, 1.0);

    // ── Sample textures ─────────────────────────────────────
    // Base: parallax-shifted UV for depth feel
    vec4 baseColor = texture2D(uBaseTexture, baseUv);
    // Styled: same parallax UV so crossfade boundary is seamless (no shadow)
    vec4 styledColor = texture2D(uStyledTexture, baseUv);

    // Blend between base and styled
    gl_FragColor = mix(baseColor, styledColor, revealMask);
  }
`;
