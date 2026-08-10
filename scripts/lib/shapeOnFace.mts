/**
 * SHAPE AGREEMENT IN THE FACE'S OWN FRAME — the instrument, in one place.
 *
 * Lifted out of `measure-shape-on-face-disposable.mts` when the accessory cell
 * needed the same arithmetic per instance. A second copy of a measuring
 * instrument is law 4's parallel list: it drifts, and the day it drifts the two
 * reports disagree about the same frames and nobody can say which is right.
 *
 * The reasoning that produced it is preserved verbatim below, because it was
 * bought with a control that failed.
 */
import { existsSync, readFileSync } from "node:fs";

import sharp from "sharp";

export type FaceMask = {
  data: Buffer;
  width: number;
  height: number;
  pixels: number;
  cx: number;
  cy: number;
};

/** A single-channel PNG on disk, with its own centroid and area. */
export async function loadMaskFile(path: string): Promise<FaceMask | null> {
  if (!existsSync(path)) return null;
  return maskOf(await sharp(readFileSync(path)).greyscale().raw().toBuffer({ resolveWithObject: true }));
}

export function maskOf(raw: { data: Buffer; info: { width: number; height: number } }): FaceMask | null {
  const { data, info } = raw;
  let pixels = 0; let sumX = 0; let sumY = 0;
  for (let index = 0; index < data.length; index += 1) {
    if (data[index] === 0) continue;
    pixels += 1;
    sumX += index % info.width;
    sumY += Math.floor(index / info.width);
  }
  if (pixels === 0) return null;
  return { data, width: info.width, height: info.height, pixels, cx: sumX / pixels, cy: sumY / pixels };
}

/**
 * B's mask, redrawn where it would sit if B's head were A's head.
 *
 * # WHY THIS MAPS BACKWARDS
 *
 * The obvious direction — walk B's set pixels, scatter each into A's grid — is
 * what the first version did, and it PERFORATES: when the scale factor is above
 * 1 the mapped points no longer tile the plane, so a solid mask arrives full of
 * holes and reads as disagreement. Dilating to close them then costs the
 * identity case its own points, which is exactly what the control caught: a
 * mask remapped onto its own face scored 0.953 when it must score 1.000.
 *
 * Walking A's grid and sampling B instead cannot perforate — every destination
 * pixel is visited exactly once, by construction. Nearest-neighbour sampling is
 * deliberate: this is a binary mask, and interpolating one invents partial
 * membership that the overlap count would then need a threshold to resolve.
 */
export function ontoFaceOf(b: FaceMask, faceB: FaceMask, faceA: FaceMask, a: FaceMask): Uint8Array {
  /* A's pixels are expressed in B's frame, so this is the inverse of the scale
     that would carry B forward into A. */
  const scale = Math.sqrt(faceB.pixels) / Math.sqrt(faceA.pixels);
  const out = new Uint8Array(a.width * a.height);
  for (let y = 0; y < a.height; y += 1) {
    for (let x = 0; x < a.width; x += 1) {
      const sourceX = Math.round(faceB.cx + (x - faceA.cx) * scale);
      const sourceY = Math.round(faceB.cy + (y - faceA.cy) * scale);
      if (sourceX < 0 || sourceY < 0 || sourceX >= b.width || sourceY >= b.height) continue;
      if (b.data[sourceY * b.width + sourceX]! > 0) out[y * a.width + x] = 1;
    }
  }
  return out;
}

export function iouWithMapped(a: FaceMask, mapped: Uint8Array): number {
  let both = 0; let either = 0;
  for (let index = 0; index < mapped.length; index += 1) {
    const inA = a.data[index]! > 0;
    const inB = mapped[index] === 1;
    if (!inA && !inB) continue;
    either += 1;
    if (inA && inB) both += 1;
  }
  return either === 0 ? 0 : both / either;
}

/**
 * The connected components of a mask, largest first, with each component's own
 * centroid — the per-instance split fable-162 made the accessory unit.
 *
 * `floor` exists because SAM 3 leaves specks, and a speck counted as an
 * instance turns a single into a pair — the exact direction of error the pair
 * work is trying to detect. Every size is returned so the floor stays visible
 * rather than trusted.
 */
export function componentsOf(mask: FaceMask, floor: number): {
  kept: FaceMask[];
  sizes: number[];
} {
  const seen = new Uint8Array(mask.data.length);
  const sizes: number[] = [];
  const kept: FaceMask[] = [];
  for (let start = 0; start < mask.data.length; start += 1) {
    if (mask.data[start] === 0 || seen[start] === 1) continue;
    const stack = [start];
    seen[start] = 1;
    const members: number[] = [];
    while (stack.length > 0) {
      const at = stack.pop()!;
      members.push(at);
      const x = at % mask.width;
      const y = Math.floor(at / mask.width);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx; const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= mask.width || ny >= mask.height) continue;
        const next = ny * mask.width + nx;
        if (mask.data[next] === 0 || seen[next] === 1) continue;
        seen[next] = 1;
        stack.push(next);
      }
    }
    sizes.push(members.length);
    if (members.length < floor) continue;
    const data = Buffer.alloc(mask.data.length);
    for (const index of members) data[index] = 255;
    const component = maskOf({ data, info: { width: mask.width, height: mask.height } });
    if (component) kept.push(component);
  }
  sizes.sort((a, b) => b - a);
  kept.sort((a, b) => b.pixels - a.pixels);
  return { kept, sizes };
}

/** The tight box around a mask's set pixels, grown by `margin` and clamped. */
export function boxOf(mask: FaceMask, margin: number): { x: number; y: number; w: number; h: number } {
  let minX = Infinity; let minY = Infinity; let maxX = -1; let maxY = -1;
  for (let index = 0; index < mask.data.length; index += 1) {
    if (mask.data[index] === 0) continue;
    const x = index % mask.width;
    const y = Math.floor(index / mask.width);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const x = Math.max(0, minX - margin);
  const y = Math.max(0, minY - margin);
  return {
    x,
    y,
    w: Math.min(mask.width, maxX + margin + 1) - x,
    h: Math.min(mask.height, maxY + margin + 1) - y,
  };
}
