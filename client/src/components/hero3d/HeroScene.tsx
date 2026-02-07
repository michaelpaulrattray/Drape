/**
 * HeroScene — Interactive hero with depth parallax + radial crossfade reveal.
 *
 * Renders a Three.js plane inside a React Three Fiber canvas.
 * The plane uses a custom shader that:
 *   1. Applies subtle depth-based parallax to the base image on mouse move
 *   2. Crossfades to the styled image via a soft-edged circular mask
 *
 * Mouse/touch tracking uses the DOM container (not R3F raycasting) for reliability.
 * Mobile (<768px): renders a static <img> fallback (no WebGL).
 * Tablets (768–1024px): WebGL with touch parallax support.
 * frameloop="demand" — only re-renders when interaction occurs (saves GPU/battery).
 */
import { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree, invalidate } from "@react-three/fiber";
import * as THREE from "three";
import { vertexShader, fragmentShader } from "./depthRevealShader";

// ─── Proxy URLs (bypass CloudFront CORS caching) ──────────────────────────
const HERO_BASE_URL = "/api/hero/base";
const HERO_STYLED_URL = "/api/hero/styled";
const HERO_DEPTH_URL = "/api/hero/depth";

const IMAGE_ASPECT = 2048 / 1143;

/** Reveal circle radius in UV space (0–1). */
const REVEAL_RADIUS = 0.5;
/** Parallax strength — very subtle to avoid warping. */
const PARALLAX_STRENGTH = 0.008;
/** Threshold below which we stop requesting frames (settled state). */
const SETTLE_THRESHOLD = 0.0005;

// ─── Shared mouse state (set by DOM, read by R3F) ─────────────────────────
const sharedMouse = { x: 0.5, y: 0.5, hovering: false, needsRender: false };

// ─── WebGL capability detection ───────────────────────────────────────────
function checkWebGLSupport(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) return false;
    // Verify it can actually create a shader program (not just a stub)
    const vs = gl.createShader(gl.VERTEX_SHADER);
    if (!vs) return false;
    gl.deleteShader(vs);
    return true;
  } catch {
    return false;
  }
}

// ─── Custom hook: load textures ────────────────────────────────────────────
function useHeroTextures() {
  const [textures, setTextures] = useState<{
    base: THREE.Texture;
    styled: THREE.Texture;
    depth: THREE.Texture;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");

    const loadTex = (url: string, isSRGB: boolean) =>
      new Promise<THREE.Texture>((resolve, reject) => {
        loader.load(
          url,
          (tex) => {
            tex.colorSpace = isSRGB
              ? THREE.SRGBColorSpace
              : THREE.LinearSRGBColorSpace;
            // Sharper rendering with mipmaps and anisotropic filtering
            tex.generateMipmaps = true;
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.anisotropy = 16;
            tex.wrapS = THREE.ClampToEdgeWrapping;
            tex.wrapT = THREE.ClampToEdgeWrapping;
            resolve(tex);
          },
          undefined,
          () => reject(new Error(`Failed to load texture: ${url}`))
        );
      });

    Promise.all([
      loadTex(HERO_BASE_URL, true),
      loadTex(HERO_STYLED_URL, true),
      loadTex(HERO_DEPTH_URL, false), // Depth map = data texture, linear
    ])
      .then(([base, styled, depth]) => setTextures({ base, styled, depth }))
      .catch((err) => setError(err.message));
  }, []);

  return { textures, error };
}

// ─── Inner mesh rendered inside the Canvas ─────────────────────────────────
function RevealPlane({
  baseTexture,
  styledTexture,
  depthTexture,
}: {
  baseTexture: THREE.Texture;
  styledTexture: THREE.Texture;
  depthTexture: THREE.Texture;
}) {
  const { viewport } = useThree();

  const smoothMouse = useRef(new THREE.Vector2(0.5, 0.5));
  const revealProgress = useRef(0);

  const uniforms = useMemo(
    () => ({
      uBaseTexture: { value: baseTexture },
      uStyledTexture: { value: styledTexture },
      uDepthMap: { value: depthTexture },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uRevealProgress: { value: 0 },
      uRevealRadius: { value: REVEAL_RADIUS },
      uParallaxStrength: { value: PARALLAX_STRENGTH },
    }),
    [baseTexture, styledTexture, depthTexture]
  );

  // Animation loop — only runs when invalidate() is called (demand mode)
  useFrame((_state, delta) => {
    const lerpFactor = 1 - Math.pow(0.001, delta);

    // Smooth mouse position
    const prevX = smoothMouse.current.x;
    const prevY = smoothMouse.current.y;
    smoothMouse.current.x +=
      (sharedMouse.x - smoothMouse.current.x) * lerpFactor * 3;
    smoothMouse.current.y +=
      (sharedMouse.y - smoothMouse.current.y) * lerpFactor * 3;
    uniforms.uMouse.value.copy(smoothMouse.current);

    // Smooth reveal progress (fade in/out)
    const prevReveal = revealProgress.current;
    const targetReveal = sharedMouse.hovering ? 1 : 0;
    revealProgress.current +=
      (targetReveal - revealProgress.current) * lerpFactor * 2;
    uniforms.uRevealProgress.value = revealProgress.current;

    // Keep requesting frames while values are still settling
    const mouseDelta =
      Math.abs(smoothMouse.current.x - prevX) +
      Math.abs(smoothMouse.current.y - prevY);
    const revealDelta = Math.abs(revealProgress.current - prevReveal);

    if (mouseDelta > SETTLE_THRESHOLD || revealDelta > SETTLE_THRESHOLD) {
      invalidate();
    }
  });

  // Calculate plane dimensions to fill the viewport
  const viewportAspect = viewport.width / viewport.height;
  let planeWidth: number;
  let planeHeight: number;

  if (viewportAspect > IMAGE_ASPECT) {
    planeWidth = viewport.width;
    planeHeight = viewport.width / IMAGE_ASPECT;
  } else {
    planeHeight = viewport.height;
    planeWidth = viewport.height * IMAGE_ASPECT;
  }

  return (
    <mesh>
      <planeGeometry args={[planeWidth, planeHeight, 1, 1]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        toneMapped={false}
      />
    </mesh>
  );
}

// ─── Scene wrapper that loads textures ─────────────────────────────────────
function Scene() {
  const { textures, error } = useHeroTextures();

  if (error || !textures) return null;

  return (
    <RevealPlane
      baseTexture={textures.base}
      styledTexture={textures.styled}
      depthTexture={textures.depth}
    />
  );
}

// ─── Device detection hook ────────────────────────────────────────────────
type DeviceType = "mobile" | "tablet" | "desktop";

function useDeviceType(): DeviceType {
  const [device, setDevice] = useState<DeviceType>("desktop");

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      if (w < 768) setDevice("mobile");
      else setDevice("desktop"); // tablets (768+) get WebGL too
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return device;
}

// ─── Public component ──────────────────────────────────────────────────────
export default function HeroScene() {
  const device = useDeviceType();
  const [loaded, setLoaded] = useState(false);
  const [webglSupported, setWebglSupported] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Check WebGL support on mount
  useEffect(() => {
    setWebglSupported(checkWebGLSupport());
  }, []);

  // Trigger R3F invalidate on interaction
  const triggerRender = useCallback(() => {
    sharedMouse.needsRender = true;
    invalidate();
  }, []);

  // DOM-level mouse tracking — more reliable than R3F raycasting
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      sharedMouse.x = (e.clientX - rect.left) / rect.width;
      sharedMouse.y = 1 - (e.clientY - rect.top) / rect.height;
      sharedMouse.hovering = true;
      triggerRender();
    };

    const handleMouseLeave = () => {
      sharedMouse.hovering = false;
      triggerRender();
    };

    // Touch support for tablets — parallax follows finger
    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      const rect = el.getBoundingClientRect();
      sharedMouse.x = (touch.clientX - rect.left) / rect.width;
      sharedMouse.y = 1 - (touch.clientY - rect.top) / rect.height;
      sharedMouse.hovering = true;
      triggerRender();
    };

    const handleTouchEnd = () => {
      sharedMouse.hovering = false;
      triggerRender();
    };

    el.addEventListener("mousemove", handleMouseMove);
    el.addEventListener("mouseleave", handleMouseLeave);
    el.addEventListener("touchmove", handleTouchMove, { passive: true });
    el.addEventListener("touchend", handleTouchEnd);
    el.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      el.removeEventListener("mousemove", handleMouseMove);
      el.removeEventListener("mouseleave", handleMouseLeave);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
      el.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [triggerRender]);

  // Mobile or broken WebGL → static image
  if (device === "mobile" || !webglSupported) {
    return (
      <img
        src={HERO_BASE_URL}
        alt="AI Generated Model"
        className="w-full h-full object-cover"
        loading="eager"
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full cursor-none"
      style={{ touchAction: "pan-y" }}
    >
      {/* Static fallback visible until Canvas is ready */}
      {!loaded && (
        <img
          src={HERO_BASE_URL}
          alt="AI Generated Model"
          className="w-full h-full object-cover"
          loading="eager"
        />
      )}
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        dpr={[1, 2]}
        flat
        frameloop="demand"
        gl={{ antialias: true, alpha: true }}
        style={{
          width: "100%",
          height: "100%",
          position: loaded ? "relative" : "absolute",
          top: 0,
          left: 0,
        }}
        onCreated={() => {
          setLoaded(true);
          // Render initial frame
          invalidate();
        }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
