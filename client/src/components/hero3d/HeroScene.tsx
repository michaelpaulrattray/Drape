/**
 * HeroScene — Interactive hero with depth parallax + radial crossfade reveal.
 *
 * Premium behaviors:
 *   1. Idle "swimming" — layered sine waves create organic autonomous motion
 *   2. Heavy cursor easing — lerp-based follow for premium weight
 *   3. Soft radial reveal mask — gentle gradient crossfade
 *   4. Entry animation — reveal mask expands on load
 *
 * Mouse/touch tracking uses the DOM container (not R3F raycasting) for reliability.
 * Mobile (<768px): renders a static <img> fallback (no WebGL).
 * frameloop="demand" — only re-renders when invalidate() is called.
 */
import { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree, invalidate } from "@react-three/fiber";
import * as THREE from "three";
import { vertexShader, fragmentShader } from "./depthRevealShader";

// ─── Proxy URLs (bypass CloudFront CORS caching) ──────────────────────────
const HERO_BASE_URL = "/api/hero/base?v=2";
const HERO_STYLED_URL = "/api/hero/styled?v=2";
const HERO_DEPTH_URL = "/api/hero/depth?v=2";

// ─── Constants ────────────────────────────────────────────────────────────
/** Image aspect ratio (5504 / 3072) */
const IMAGE_ASPECT = 5504 / 3072;

/** Reveal circle radius in UV space (0–1). Larger = more generous reveal */
const REVEAL_RADIUS = 0.65;

/** Parallax strength — subtle to avoid warping */
const PARALLAX_STRENGTH = 0.008;

/** Threshold below which we stop requesting frames (settled state) */
const SETTLE_THRESHOLD = 0.0001;

/** Idle threshold in seconds before swimming starts */
const IDLE_THRESHOLD = 2.0;

/** Lerp factor when following cursor (higher = snappier) */
const LERP_ACTIVE = 0.07;

/** Lerp factor when swimming autonomously (lower = smoother) */
const LERP_IDLE = 0.025;

// ─── Shared mouse state (set by DOM, read by R3F) ─────────────────────────
const sharedMouse = {
  /** Current interpolated position (sent to shader) */
  x: 0.5,
  y: 0.5,
  /** Target position (mouse or autonomous) */
  targetX: 0.5,
  targetY: 0.5,
  /** Interaction state */
  hovering: false,
  needsRender: false,
  /** Idle/swimming state */
  idle: false,
  idleTimer: 0,
  lastMoveTime: 0,
};

// ─── WebGL capability detection ───────────────────────────────────────────
function checkWebGLSupport(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) return false;
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
      loadTex(HERO_DEPTH_URL, false),
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
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const timeRef = useRef(0);
  const revealedRef = useRef(false);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Entry animation: reveal after a short delay
  useEffect(() => {
    revealTimerRef.current = setTimeout(() => {
      revealedRef.current = true;
      invalidate();
    }, 300);
    return () => {
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    };
  }, []);

  // Main animation loop
  useFrame((_state, delta) => {
    if (!materialRef.current) return;

    timeRef.current += delta;
    const now = performance.now();

    // ─── Idle Detection ───────────────────────────────────────
    if (sharedMouse.hovering) {
      const timeSinceMove = (now - sharedMouse.lastMoveTime) / 1000;
      if (timeSinceMove > IDLE_THRESHOLD) {
        sharedMouse.idle = true;
      }
    } else {
      sharedMouse.idleTimer += delta;
      if (sharedMouse.idleTimer > IDLE_THRESHOLD) {
        sharedMouse.idle = true;
      }
    }

    // ─── Calculate Target Position ────────────────────────────
    if (sharedMouse.idle) {
      const t = timeRef.current;

      sharedMouse.targetX =
        0.5 +
        Math.sin(t * 0.4) * 0.25 +
        Math.sin(t * 0.7) * 0.1 +
        Math.sin(t * 1.1) * 0.05;

      sharedMouse.targetY =
        0.5 +
        Math.cos(t * 0.3) * 0.2 +
        Math.cos(t * 0.6) * 0.08 +
        Math.cos(t * 0.9) * 0.04;

      // Clamp to valid range with padding
      sharedMouse.targetX = Math.max(
        0.15,
        Math.min(0.85, sharedMouse.targetX)
      );
      sharedMouse.targetY = Math.max(
        0.15,
        Math.min(0.85, sharedMouse.targetY)
      );
    }

    // ─── Smooth Interpolation (ALWAYS runs) ───────────────────
    const lerpFactor = sharedMouse.idle ? LERP_IDLE : LERP_ACTIVE;

    const prevX = sharedMouse.x;
    const prevY = sharedMouse.y;

    sharedMouse.x += (sharedMouse.targetX - sharedMouse.x) * lerpFactor;
    sharedMouse.y += (sharedMouse.targetY - sharedMouse.y) * lerpFactor;

    // ─── Update Shader Uniforms ───────────────────────────────
    uniforms.uMouse.value.set(sharedMouse.x, sharedMouse.y);

    // Entry animation: smoothly animate reveal progress
    const targetProgress = revealedRef.current ? 1.0 : 0.0;
    const currentProgress = uniforms.uRevealProgress.value;
    uniforms.uRevealProgress.value +=
      (targetProgress - currentProgress) * 0.05;

    // ─── Determine if we need to keep rendering ───────────────
    const deltaX = Math.abs(sharedMouse.x - prevX);
    const deltaY = Math.abs(sharedMouse.y - prevY);
    const revealDelta = Math.abs(uniforms.uRevealProgress.value - targetProgress);
    const isMoving = deltaX > SETTLE_THRESHOLD || deltaY > SETTLE_THRESHOLD;

    if (isMoving || sharedMouse.idle || sharedMouse.hovering || revealDelta > 0.001) {
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
        ref={materialRef}
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
type DeviceType = "mobile" | "desktop";

function useDeviceType(): DeviceType {
  const [device, setDevice] = useState<DeviceType>("desktop");

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      setDevice(w < 768 ? "mobile" : "desktop");
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

  // DOM-level mouse tracking — updates TARGET position (not current)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      sharedMouse.targetX = (e.clientX - rect.left) / rect.width;
      sharedMouse.targetY = 1 - (e.clientY - rect.top) / rect.height;
      sharedMouse.hovering = true;
      sharedMouse.idle = false;
      sharedMouse.idleTimer = 0;
      sharedMouse.lastMoveTime = performance.now();
      sharedMouse.needsRender = true;
      invalidate();
    };

    const handleMouseLeave = () => {
      sharedMouse.hovering = false;
      // Don't reset target — let idle timer kick in and start swimming
      invalidate();
    };

    // Touch support for tablets
    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      const rect = el.getBoundingClientRect();
      sharedMouse.targetX = (touch.clientX - rect.left) / rect.width;
      sharedMouse.targetY = 1 - (touch.clientY - rect.top) / rect.height;
      sharedMouse.hovering = true;
      sharedMouse.idle = false;
      sharedMouse.idleTimer = 0;
      sharedMouse.lastMoveTime = performance.now();
      sharedMouse.needsRender = true;
      invalidate();
    };

    const handleTouchEnd = () => {
      sharedMouse.hovering = false;
      invalidate();
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
  }, []);

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
      {/* Shimmer loading placeholder visible until Canvas is ready */}
      {!loaded && (
        <div
          className="w-full h-full rounded-xl sm:rounded-2xl overflow-hidden"
          style={{
            background:
              "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.5s ease-in-out infinite",
          }}
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
          invalidate();
        }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
