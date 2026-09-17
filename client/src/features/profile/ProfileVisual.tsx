import { useEffect, useMemo, useState, type CSSProperties } from "react";

type ProfileIdentity = {
  name?: string | null;
  email?: string | null;
};

type ProfileVisualDefaults = {
  avatar: string;
  cover: string;
};

const PALETTES = [
  { paper: "#E9E7E2", ink: "#151515", wash: "#C8C5BE" },
  { paper: "#E4E5E2", ink: "#20231F", wash: "#B8BDB6" },
  { paper: "#E8E4DF", ink: "#211D1A", wash: "#C5BBB1" },
  { paper: "#E3E4E7", ink: "#17191E", wash: "#B8BCC5" },
  { paper: "#E8E6E1", ink: "#25231F", wash: "#C4C0B5" },
  { paper: "#E5E1E2", ink: "#211B1D", wash: "#BFB5B8" },
] as const;

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function svgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function profileSeed(identity: ProfileIdentity | string): string {
  if (typeof identity === "string") return identity.trim().toLowerCase() || "drape";
  return (identity.email || identity.name || "drape").trim().toLowerCase();
}

function profileInitial(identity: ProfileIdentity | string): string {
  const source =
    typeof identity === "string" ? identity : identity.email || identity.name || "D";
  return source.trim().charAt(0).toUpperCase().replace(/[^A-Z0-9]/g, "") || "D";
}

/**
 * Stable, account-specific defaults. They are generated locally as data URIs:
 * no third-party host, storage write, migration, or broken remote URL.
 */
export function getProfileVisualDefaults(
  identity: ProfileIdentity | string,
): ProfileVisualDefaults {
  const seed = profileSeed(identity);
  const hash = stableHash(seed);
  const palette = PALETTES[hash % PALETTES.length];
  const initial = profileInitial(identity);
  const band = 24 + (hash % 28);
  const offset = 12 + ((hash >>> 8) % 34);
  const flip = (hash & 1) === 1;

  const avatar = svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
      <rect width="160" height="160" fill="${palette.paper}"/>
      <path d="${flip ? `M0 ${band} L160 ${160 - offset} L160 160 L0 160Z` : `M0 ${160 - offset} L160 ${band} L160 160 L0 160Z`}" fill="${palette.wash}"/>
      <circle cx="${flip ? 52 : 108}" cy="${flip ? 108 : 52}" r="42" fill="none" stroke="${palette.ink}" stroke-opacity=".12" stroke-width="1.5"/>
      <path d="M20 20H140M20 140H140M20 20V140M140 20V140" fill="none" stroke="${palette.ink}" stroke-opacity=".09"/>
      <text x="80" y="94" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="52" font-weight="600" fill="${palette.ink}">${initial}</text>
    </svg>
  `);

  const cover = svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 360">
      <rect width="1200" height="360" fill="${palette.paper}"/>
      <path d="${flip ? `M0 0H${520 + offset * 4}L${350 + band * 5} 360H0Z` : `M1200 0H${680 - offset * 3}L${820 - band * 4} 360H1200Z`}" fill="${palette.wash}"/>
      <g fill="none" stroke="${palette.ink}" stroke-opacity=".11">
        <path d="M48 48H1152V312H48Z"/>
        <path d="M400 48V312M800 48V312"/>
        <circle cx="${flip ? 840 : 360}" cy="180" r="${82 + (hash % 46)}"/>
      </g>
      <text x="${flip ? 72 : 1128}" y="292" text-anchor="${flip ? "start" : "end"}" font-family="Inter,Arial,sans-serif" font-size="22" letter-spacing="5" fill="${palette.ink}" fill-opacity=".72">DRAPE / ${initial}</text>
    </svg>
  `);

  return { avatar, cover };
}

interface ProfileImageProps {
  src?: string | null;
  identity: ProfileIdentity | string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
}

function ResilientProfileImage({
  src,
  fallback,
  alt = "",
  className,
  style,
}: Omit<ProfileImageProps, "identity"> & { fallback: string }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const displayedSource = src && failedSource !== src ? src : fallback;

  useEffect(() => {
    setFailedSource(null);
  }, [src]);

  return (
    <img
      src={displayedSource}
      alt={alt}
      className={className}
      style={style}
      onError={() => {
        if (displayedSource !== fallback) setFailedSource(displayedSource);
      }}
    />
  );
}

export function ProfileAvatar({
  src,
  identity,
  alt,
  className,
  style,
}: ProfileImageProps) {
  const fallback = useMemo(
    () => getProfileVisualDefaults(identity).avatar,
    [identity],
  );
  return (
    <ResilientProfileImage
      src={src}
      fallback={fallback}
      alt={alt}
      className={className}
      style={style}
    />
  );
}

export function ProfileCover({
  src,
  identity,
  alt,
  className,
  style,
}: ProfileImageProps) {
  const fallback = useMemo(
    () => getProfileVisualDefaults(identity).cover,
    [identity],
  );
  return (
    <ResilientProfileImage
      src={src}
      fallback={fallback}
      alt={alt}
      className={className}
      style={style}
    />
  );
}
