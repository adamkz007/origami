/**
 * Tiny flat-fold engine for origa.mi.
 *
 * Paper is a stack of convex polygons ("faces"), bottom → top.
 * A `fold` step splits selected faces along a line and reflects the
 * piece on the moving side — that's a real, computed simple fold.
 * Moves that a flat engine can't compute (squash, petal, reverse folds)
 * are authored as `reshape` steps: the old faces swing onto an axis and
 * the authored new faces swing out of it. (Phase 1 replaces these with
 * computed geometry.)
 */

export type Pt = [number, number];
export type Side = 0 | 1; // 0 = front colour, 1 = back colour

export interface Face {
  pts: Pt[];
  side: Side;
  tags: string[];
  /** static tone 0..1, for authored faces that sit at an angle */
  shade?: number;
}

export interface Mark {
  kind: 'eye';
  at: Pt;
}

export interface PaperState {
  faces: Face[];
  marks: Mark[];
}

export interface FoldSpec {
  /** two points on the fold line */
  line: [Pt, Pt];
  /** any point on the side that moves */
  from: Pt;
  /** only faces carrying one of these tags (default: all) */
  pick?: string[];
  /** skip faces carrying one of these tags */
  skip?: string[];
  /** tag added to moved pieces */
  tag?: string;
  /** mountain fold: moved pieces go behind everything */
  behind?: boolean;
}

export type Step =
  | { op: 'fold'; folds: FoldSpec[]; alt: string; unfold?: boolean }
  | { op: 'flip'; alt: string }
  | { op: 'rotate'; deg: number; alt: string }
  | {
      op: 'reshape';
      axis: [Pt, Pt];
      /** tags of faces that leave (default: all) */
      out?: string[];
      to: Face[];
      alt: string;
      repeat?: boolean;
    }
  | { op: 'mark'; marks: Mark[]; alt: string };

export interface Model {
  slug: string;
  name: string;
  level: 1 | 2 | 3 | 4 | 5;
  minutes: number;
  start: Face[];
  steps: Step[];
}

/* ---------- geometry ---------- */

const EPS = 1e-6;

export const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
export const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
export const mul = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k];
export const dot = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1];
export const len = (a: Pt) => Math.hypot(a[0], a[1]);
export const norm = (a: Pt): Pt => mul(a, 1 / (len(a) || 1));

export interface Line {
  p: Pt;
  dir: Pt;
  /** unit normal pointing to the moving side */
  n: Pt;
}

export function makeLine([a, b]: [Pt, Pt], from?: Pt): Line {
  const dir = norm(sub(b, a));
  let n: Pt = [-dir[1], dir[0]];
  if (from && dot(sub(from, a), n) < 0) n = mul(n, -1);
  return { p: a, dir, n };
}

export const sdist = (L: Line, q: Pt) => dot(sub(q, L.p), L.n);

export function area(pts: Pt[]) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
}

export function centroid(pts: Pt[]): Pt {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p[0];
    y += p[1];
  }
  return [x / pts.length, y / pts.length];
}

/** Keep the part of a convex polygon where sign * sdist >= 0. */
function clip(pts: Pt[], L: Line, sign: 1 | -1): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const da = sign * sdist(L, a);
    const db = sign * sdist(L, b);
    if (da >= -EPS) out.push(a);
    if ((da > EPS && db < -EPS) || (da < -EPS && db > EPS)) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

export const reflect = (L: Line, q: Pt): Pt => sub(q, mul(L.n, 2 * sdist(L, q)));

export function bbox(pts: Pt[]) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return { x0, y0, x1, y1 };
}

export const allPts = (s: PaperState) => s.faces.flatMap((f) => f.pts);

/* ---------- step planning ---------- */

const has = (f: Face, tags?: string[]) => !!tags && f.tags.some((t) => tags.includes(t));

/** A piece of paper as it travels through one step. */
export interface Piece {
  pts: Pt[];
  side: Side;
  tags: string[];
  shade?: number;
  /** index into plan.lines; -1 = static */
  motion: number;
  behind?: boolean;
  /** reshape: 'out' pieces leave, 'in' pieces arrive */
  phase?: 'out' | 'in';
}

export interface Plan {
  step: Step;
  before: PaperState;
  after: PaperState;
  pieces: Piece[];
  lines: Line[];
  /** drawn crease segments, one per fold line */
  segments: [Pt, Pt][];
  /** centroid of what moves → where it lands, per line */
  arrows: [Pt, Pt][];
}

function cloneFace(f: Face): Face {
  return { pts: f.pts.map((p) => [p[0], p[1]] as Pt), side: f.side, tags: [...f.tags], shade: f.shade };
}

function planFold(state: PaperState, step: Extract<Step, { op: 'fold' }>): Plan {
  let pieces: Piece[] = state.faces.map((f) => ({ ...cloneFace(f), motion: -1 }));
  const lines: Line[] = [];
  const segments: [Pt, Pt][] = [];
  const arrows: [Pt, Pt][] = [];

  step.folds.forEach((spec, li) => {
    const L = makeLine(spec.line, spec.from);
    lines.push(L);
    const next: Piece[] = [];
    let tMin = Infinity;
    let tMax = -Infinity;
    const moved: Pt[] = [];
    for (const pc of pieces) {
      const selected =
        pc.motion === -1 && (!spec.pick || has(pc, spec.pick)) && !has(pc, spec.skip);
      if (!selected) {
        next.push(pc);
        continue;
      }
      const mv = clip(pc.pts, L, 1);
      const st = clip(pc.pts, L, -1);
      const mvOk = mv.length >= 3 && area(mv) > 0.01;
      const stOk = st.length >= 3 && area(st) > 0.01;
      if (mvOk && stOk) {
        for (const q of mv) {
          if (Math.abs(sdist(L, q)) < 1e-4) {
            const t = dot(sub(q, L.p), L.dir);
            tMin = Math.min(tMin, t);
            tMax = Math.max(tMax, t);
          }
        }
      }
      if (stOk) next.push({ ...pc, pts: st, motion: -1 });
      if (mvOk) {
        next.push({
          pts: mv,
          side: pc.side,
          shade: pc.shade,
          tags: spec.tag ? [...pc.tags, spec.tag] : [...pc.tags],
          motion: li,
          behind: spec.behind
        });
        moved.push(...mv);
      }
    }
    pieces = next;
    if (!isFinite(tMin)) {
      // flap hinged on an existing edge: use moved points lying on the line
      for (const q of moved) {
        if (Math.abs(sdist(L, q)) < 1e-3) {
          const t = dot(sub(q, L.p), L.dir);
          tMin = Math.min(tMin, t);
          tMax = Math.max(tMax, t);
        }
      }
    }
    if (isFinite(tMin)) {
      const pad = (tMax - tMin) * 0.12 + 4;
      segments.push([add(L.p, mul(L.dir, tMin - pad)), add(L.p, mul(L.dir, tMax + pad))]);
    }
    if (moved.length) {
      const c = centroid(moved);
      arrows.push([c, reflect(L, c)]);
    }
  });

  // end state
  const stat = pieces.filter((p) => p.motion === -1);
  const front: Face[] = [];
  const back: Face[] = [];
  step.folds.forEach((_, li) => {
    const L = lines[li];
    const mv = pieces.filter((p) => p.motion === li);
    const flipped = mv.reverse().map((p) => ({
      pts: p.pts.map((q) => reflect(L, q)).reverse(),
      side: (1 - p.side) as Side,
      tags: p.tags,
      shade: p.shade
    }));
    if (step.folds[li].behind) back.unshift(...flipped);
    else front.push(...flipped);
  });
  const after: PaperState = step.unfold
    ? // fold-and-unfold: same paper, now with a crease (split edge)
      { faces: pieces.map(cloneFace), marks: state.marks }
    : { faces: [...back, ...stat.map(cloneFace), ...front], marks: state.marks };
  return { step, before: state, after, pieces, lines, segments, arrows };
}

function planReshape(state: PaperState, step: Extract<Step, { op: 'reshape' }>): Plan {
  const L = makeLine(step.axis);
  const leaving = (f: Face) => !step.out || has(f, step.out);
  const pieces: Piece[] = [
    ...state.faces.map((f) => ({
      ...cloneFace(f),
      motion: leaving(f) ? 0 : -1,
      phase: leaving(f) ? ('out' as const) : undefined
    })),
    ...step.to.map((f) => ({ ...cloneFace(f), motion: 0, phase: 'in' as const }))
  ];
  const after: PaperState = {
    faces: [...state.faces.filter((f) => !leaving(f)).map(cloneFace), ...step.to.map(cloneFace)],
    marks: state.marks
  };
  const from = centroid(state.faces.filter(leaving).flatMap((f) => f.pts));
  const to = centroid(step.to.flatMap((f) => f.pts));
  const ext = bbox([...state.faces.flatMap((f) => f.pts), ...step.to.flatMap((f) => f.pts)]);
  const span = Math.max(ext.x1 - ext.x0, ext.y1 - ext.y0) * 0.35;
  const mid = centroid([from, to]);
  return {
    step,
    before: state,
    after,
    pieces,
    lines: [L],
    segments: [[add(mid, mul(L.dir, -span)), add(mid, mul(L.dir, span))]],
    arrows: [[from, to]]
  };
}

export function center(s: PaperState): Pt {
  const b = bbox(allPts(s));
  return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
}

export function rotatePt(p: Pt, c: Pt, rad: number): Pt {
  const d = sub(p, c);
  const cs = Math.cos(rad);
  const sn = Math.sin(rad);
  return [c[0] + d[0] * cs - d[1] * sn, c[1] + d[0] * sn + d[1] * cs];
}

function planSimple(state: PaperState, step: Step): Plan {
  const c = center(state);
  let after: PaperState;
  if (step.op === 'flip') {
    after = {
      faces: [...state.faces].reverse().map((f) => ({
        pts: f.pts.map((p) => [2 * c[0] - p[0], p[1]] as Pt).reverse(),
        side: (1 - f.side) as Side,
        tags: [...f.tags],
        shade: f.shade
      })),
      marks: []
    };
  } else if (step.op === 'rotate') {
    const r = (step.deg * Math.PI) / 180;
    after = {
      faces: state.faces.map((f) => ({ ...cloneFace(f), pts: f.pts.map((p) => rotatePt(p, c, r)) })),
      marks: state.marks.map((m) => ({ ...m, at: rotatePt(m.at, c, r) }))
    };
  } else if (step.op === 'mark') {
    after = { faces: state.faces.map(cloneFace), marks: [...state.marks, ...step.marks] };
  } else throw new Error('bad step');
  return {
    step,
    before: state,
    after,
    pieces: state.faces.map((f) => ({ ...cloneFace(f), motion: -1 })),
    lines: [],
    segments: [],
    arrows: []
  };
}

export function plan(model: Model): Plan[] {
  let state: PaperState = { faces: model.start.map(cloneFace), marks: [] };
  return model.steps.map((step) => {
    const p =
      step.op === 'fold'
        ? planFold(state, step)
        : step.op === 'reshape'
          ? planReshape(state, step)
          : planSimple(state, step);
    state = p.after;
    return p;
  });
}

export function initialState(model: Model): PaperState {
  return { faces: model.start.map(cloneFace), marks: [] };
}
