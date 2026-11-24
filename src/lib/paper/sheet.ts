/**
 * Paper state.
 *
 * Every face is a convex region of a flat sheet (paper coordinates) plus a
 * rigid placement M that carries it into the world. Flat folded states keep
 * every face in the z = 0 plane and order overlapping faces by `z` (higher =
 * nearer the viewer). The crease pattern is implied: wherever two faces of
 * the same sheet share an edge, there is a crease.
 */
import {
  apply2,
  absArea,
  ccw,
  centroid,
  collinearOverlap,
  dedupe,
  dist,
  frontNormal,
  IDENTITY,
  insideConvex,
  isFlat,
  onSegment,
  type V2,
  type V3,
  type Xf
} from './geom';

/** One rotation (or rigid move) in a step's motion, about a world axis. */
export type PathEl =
  | { kind: 'rot'; p: V3; d: V3; angle: number; back?: boolean }
  | { kind: 'rigid'; p: V3; d: V3; angle: number; shift: V3 };

export interface Face {
  id: number;
  sheet: number;
  /** convex polygon in paper coordinates, CCW */
  poly: V2[];
  /** paper → world */
  M: Xf;
  /** stacking order in flat states */
  z: number;
  tags: string[];
  /* step-local motion bookkeeping */
  start: Xf;
  zStart: number;
  path: PathEl[];
}

export interface Sheet {
  id: number;
  outline: V2[];
  area: number;
}

export interface Mark {
  sheet: number;
  p: V2;
}

export type DiagramItem =
  | { kind: 'crease'; a: V3; b: V3; style: 'valley' | 'mountain' | 'xray' | 'axis' }
  | {
      kind: 'arrow';
      from: V3;
      to: V3;
      style: 'valley' | 'mountain' | 'unfold' | 'push' | 'lift';
      /** world-space direction the arc bows toward */
      bow: V3;
    }
  | { kind: 'flip'; at: V3; width: number }
  | { kind: 'rotate'; at: V3; r: number; deg: number }
  | { kind: 'dot'; at: V3 }
  | { kind: 'repeat'; at: V3; n: number };

export interface View {
  /** tilt the scene away from the viewer, degrees */
  tilt: number;
  /** turn about the vertical screen axis, degrees */
  turn: number;
}

export interface Check {
  label: string;
  a: V3;
  b: V3;
}

export interface State {
  sheets: Sheet[];
  faces: Face[];
  marks: Record<string, Mark>;
  decorations: { kind: 'eye'; mark: string }[];
  view: View;
  /* step-local */
  diagram: DiagramItem[];
  text: string[];
  checks: Check[];
  nextId: number;
}

export function newState(outline: V2[], backUp: boolean, marks: Record<string, V2>): State {
  const poly = ccw(outline);
  const M = backUp ? { R: [1, 0, 0, 0, 1, 0, 0, 0, -1] as Xf['R'], t: [0, 0, 0] as V3 } : IDENTITY;
  const s: State = {
    sheets: [{ id: 0, outline: poly, area: absArea(poly) }],
    faces: [{ id: 0, sheet: 0, poly, M, z: 0, tags: ['sheet'], start: M, zStart: 0, path: [] }],
    marks: {},
    decorations: [],
    view: { tilt: 0, turn: 0 },
    diagram: [],
    text: [],
    checks: [],
    nextId: 1
  };
  for (const [k, p] of Object.entries(marks)) s.marks[k] = { sheet: 0, p };
  return s;
}

export function cloneState(s: State): State {
  return {
    sheets: s.sheets.map((sh) => ({ ...sh, outline: sh.outline.map((p) => [...p] as V2) })),
    faces: s.faces.map(cloneFace),
    marks: Object.fromEntries(Object.entries(s.marks).map(([k, m]) => [k, { sheet: m.sheet, p: [...m.p] as V2 }])),
    decorations: s.decorations.map((d) => ({ ...d })),
    view: { ...s.view },
    diagram: [...s.diagram],
    text: [...s.text],
    checks: [...s.checks],
    nextId: s.nextId
  };
}

export function cloneFace(f: Face): Face {
  return {
    ...f,
    poly: f.poly.map((p) => [...p] as V2),
    tags: [...f.tags],
    path: [...f.path]
  };
}

/** Reset step-local bookkeeping at the start of a step. */
export function beginStep(s: State): State {
  const n = cloneState(s);
  n.diagram = [];
  n.text = [];
  n.checks = [];
  for (const f of n.faces) {
    f.start = f.M;
    f.zStart = f.z;
    f.path = [];
  }
  return n;
}

/* ---------- queries ---------- */

export const worldPoly = (f: Face): V3[] => f.poly.map((p) => apply2(f.M, p));
export const worldPoly2 = (f: Face): V2[] => f.poly.map((p) => {
  const w = apply2(f.M, p);
  return [w[0], w[1]] as V2;
});

export const allFlat = (s: State) => s.faces.every((f) => isFlat(f.M));

/** Is the paper's front side facing the viewer (+z)? */
export const frontUp = (f: Face) => frontNormal(f.M)[2] > 0;

function containsPaper(f: Face, p: V2) {
  if (insideConvex(f.poly, p, -1e-7)) return true;
  for (let i = 0; i < f.poly.length; i++) if (onSegment(f.poly[i], f.poly[(i + 1) % f.poly.length], p, 1e-6)) return true;
  return false;
}

/** The face holding a paper point (the first one if it sits on a crease). */
export function faceAtPaper(s: State, sheet: number, p: V2): Face | undefined {
  return s.faces.find((f) => f.sheet === sheet && containsPaper(f, p));
}

/** World position of a named landmark. */
export function markWorld(s: State, name: string): V3 {
  const m = s.marks[name];
  if (!m) throw new Error(`unknown landmark "${name}"`);
  const f = faceAtPaper(s, m.sheet, m.p);
  if (!f) throw new Error(`landmark "${name}" is not on the paper`);
  return apply2(f.M, m.p);
}

/** Faces covering a world point (flat states), top first. */
export function facesAtWorld(s: State, q: V2): Face[] {
  return s.faces
    .filter((f) => isFlat(f.M) && insideConvex(worldPoly2(f), q, -1e-6))
    .sort((a, b) => b.z - a.z);
}

export function bounds(s: State) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const f of s.faces)
    for (const w of worldPoly(f)) {
      x0 = Math.min(x0, w[0]);
      y0 = Math.min(y0, w[1]);
      x1 = Math.max(x1, w[0]);
      y1 = Math.max(y1, w[1]);
    }
  return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, size: Math.max(x1 - x0, y1 - y0) };
}

/* ---------- housekeeping ---------- */

/**
 * After an operation: drop slivers, renumber z to ranks, and insert any
 * vertex of a neighbouring face that sits on an edge (no T-junctions), so
 * shared edges match vertex for vertex.
 */
export function normalize(s: State) {
  s.faces = s.faces.filter((f) => f.poly.length >= 3 && absArea(f.poly) > 1e-8);
  const order = [...s.faces].sort((a, b) => a.z - b.z || a.id - b.id);
  order.forEach((f, i) => (f.z = i));
  for (const sheet of s.sheets) {
    const faces = s.faces.filter((f) => f.sheet === sheet.id);
    const verts: V2[] = [];
    for (const f of faces)
      for (const p of f.poly) if (!verts.some((v) => dist(v, p) < 1e-7)) verts.push(p);
    for (const f of faces) {
      const out: V2[] = [];
      for (let i = 0; i < f.poly.length; i++) {
        const a = f.poly[i];
        const b = f.poly[(i + 1) % f.poly.length];
        out.push(a);
        const mids = verts
          .filter((v) => dist(v, a) > 1e-7 && dist(v, b) > 1e-7 && onSegment(a, b, v, 1e-7))
          .sort((u, v) => dist(a, u) - dist(a, v));
        out.push(...mids);
      }
      f.poly = dedupe(out, 1e-9);
    }
  }
}

/** Paper-space segments shared by two faces of the same sheet (the creases). */
export interface Crease {
  f: Face;
  g: Face;
  a: V2;
  b: V2;
}

export function creases(s: State): Crease[] {
  const out: Crease[] = [];
  const faces = s.faces;
  for (let i = 0; i < faces.length; i++)
    for (let j = i + 1; j < faces.length; j++) {
      const f = faces[i];
      const g = faces[j];
      if (f.sheet !== g.sheet) continue;
      for (let a = 0; a < f.poly.length; a++)
        for (let b = 0; b < g.poly.length; b++) {
          const ov = collinearOverlap(
            f.poly[a],
            f.poly[(a + 1) % f.poly.length],
            g.poly[b],
            g.poly[(b + 1) % g.poly.length]
          );
          if (ov) out.push({ f, g, a: ov[0], b: ov[1] });
        }
    }
  return out;
}

export const faceCentroidWorld = (f: Face): V3 => apply2(f.M, centroid(f.poly));
