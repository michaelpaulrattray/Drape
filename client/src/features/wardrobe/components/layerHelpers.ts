/**
 * layerHelpers — Style note parsing and color extraction for LayersPanel.
 *
 * Ported from the original SOT LayersPanel reference.
 */

// ── Style Note Parsing ──────────────────────────────────────────

/** Split a semicolon-separated style note into chips (matching suggestedActions) and freeform entries */
export const parseStyleNote = (
  note: string | undefined,
  actions: string[],
): { chips: string[]; freeform: string[] } => {
  if (!note) return { chips: [], freeform: [] };
  const parts = note.split("; ").filter(Boolean);
  const actionSet = new Set(actions);
  return {
    chips: parts.filter((p) => actionSet.has(p)),
    freeform: parts.filter((p) => !actionSet.has(p)),
  };
};

/** Rebuild a style note string from chips and freeform entries */
export const buildStyleNote = (chips: string[], freeform: string[]): string =>
  [...chips, ...freeform].join("; ");

// ── Color Extraction (lightweight canvas sampling with cache) ───

const colorCache = new Map<string, { hex: string; name: string }[]>();

const rgbToHex = (r: number, g: number, b: number): string =>
  "#" +
  [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

const rgbToHsl = (
  r: number,
  g: number,
  b: number,
): [number, number, number] => {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
};

const nameColor = (r: number, g: number, b: number): string => {
  const [h, s, l] = rgbToHsl(r, g, b);
  if (l < 0.12) return "black";
  if (l > 0.92) return "white";
  if (s < 0.1) {
    if (l < 0.35) return "charcoal";
    if (l < 0.65) return "grey";
    return "silver";
  }
  if (s < 0.25 && l > 0.6) return "beige";
  if (h < 15 || h >= 345)
    return l < 0.4 ? "maroon" : s > 0.5 ? "red" : "rose";
  if (h < 35) return l < 0.45 ? "brown" : s > 0.6 ? "orange" : "tan";
  if (h < 55) return s > 0.5 ? "yellow" : "khaki";
  if (h < 80) return s > 0.3 ? "olive" : "sage";
  if (h < 160)
    return l < 0.35 ? "forest" : s > 0.4 ? "green" : "mint";
  if (h < 195) return "teal";
  if (h < 240)
    return l < 0.35 ? "navy" : s > 0.5 ? "blue" : "slate";
  if (h < 280) return s > 0.4 ? "purple" : "lavender";
  if (h < 330)
    return l < 0.4 ? "plum" : s > 0.5 ? "pink" : "mauve";
  return "rose";
};

/** Extract up to 4 dominant colors from a garment image (async, returns cached) */
export const extractColors = (
  imgUrl: string,
): { hex: string; name: string }[] => {
  if (!imgUrl) return [];
  if (colorCache.has(imgUrl)) return colorCache.get(imgUrl)!;

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const size = 48;
      canvas.width = size;
      canvas.height = size;
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;

      const buckets = new Map<
        string,
        { r: number; g: number; b: number; count: number }
      >();
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i],
          g = data[i + 1],
          b = data[i + 2],
          a = data[i + 3];
        if (a < 128) continue;
        if (r < 40 && g < 40 && b < 40) continue;
        if (r > 220 && g > 215 && b > 200) continue;
        const qr = Math.round(r / 48) * 48;
        const qg = Math.round(g / 48) * 48;
        const qb = Math.round(b / 48) * 48;
        const key = `${qr},${qg},${qb}`;
        const existing = buckets.get(key);
        if (existing) {
          existing.r += r;
          existing.g += g;
          existing.b += b;
          existing.count++;
        } else buckets.set(key, { r, g, b, count: 1 });
      }

      const sorted = Array.from(buckets.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 4);
      const results: { hex: string; name: string }[] = [];
      for (const bucket of sorted) {
        const cr = Math.round(bucket.r / bucket.count);
        const cg = Math.round(bucket.g / bucket.count);
        const cb = Math.round(bucket.b / bucket.count);
        if (
          results.some((e) => {
            const [, , el] = rgbToHsl(
              parseInt(e.hex.slice(1, 3), 16),
              parseInt(e.hex.slice(3, 5), 16),
              parseInt(e.hex.slice(5, 7), 16),
            );
            const [, , nl] = rgbToHsl(cr, cg, cb);
            return Math.abs(el - nl) < 0.08;
          })
        )
          continue;
        results.push({ hex: rgbToHex(cr, cg, cb), name: nameColor(cr, cg, cb) });
      }
      colorCache.set(imgUrl, results);
    } catch {
      /* canvas tainted — ignore */
    }
  };
  img.src = imgUrl;
  return [];
};
