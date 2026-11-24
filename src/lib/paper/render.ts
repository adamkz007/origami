/**
 * Motion + projection. A step is replayed by re-applying each face's recorded
 * rotations at a fraction of their angle; shared paper points are welded so
 * compound folds stay in one piece mid-motion. Output is 2D polygons for SVG.
 */
import {
  add,
  apply,
  apply2,
  applyDir,
  centroid,
  compose,
  dist,
  len,
  mul,
  norm,
  rotation,
  sub,
  type V2,
  type V3,
  type Xf
} from './geom';
import type { Piece, StepPlan } from './model';
import type { DiagramItem, View } from './sheet';

/* ---------- timing inside one step (u ∈ [0,1]) ---------- */
export const T_SHOW = 0.28; // diagram draws on
export const T_MOVE = 0.86; // motion ends

export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
export const motionT = (u: number) => ease(clamp01((u - T_SHOW) / (T_MOVE - T_SHOW)));

/* ---------- placement at time t ---------- */

export function placeAt(p: Piece, t: number): Xf {
  if (t <= 0) return p.start;
  const hasBack = p.path.some((e) => e.kind === 'rot' && e.back);
  if (t >= 1 && !hasBack) return p.end;
  let M = p.start;
  for (const e of p.path) {
    if (e.kind === 'rot') {
      const a = e.back ? e.angle * Math.sin(Math.PI * t) * 0.92 : e.angle * t;
      M = compose(rotation(e.p, e.d, a), M);
    } else {
      const R = rotation(e.p, e.d, e.angle * t);
      const moved = compose(R, M);
      M = { R: moved.R, t: add3(moved.t, mul3(e.shift, t)) };
    }
  }
  return M;
}
const add3 = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul3 = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];

/* ---------- camera ---------- */

export function camera(v: View): Xf {
  const tilt = (v.tilt * Math.PI) / 180;
  const turn = (v.turn * Math.PI) / 180;
  return compose(rotation([0, 0, 0], [0, 1, 0], turn), rotation([0, 0, 0], [1, 0, 0], tilt));
}
const lerpView = (a: View, b: View, t: number): View => ({
  tilt: a.tilt + (b.tilt - a.tilt) * t,
  turn: a.turn + (b.turn - a.turn) * t
});

/* ---------- frame ---------- */

export interface DrawPoly {
  pts: V2[];
  side: 0 | 1;
  shade: number;
}

export interface Overlay {
  creases: { a: V2; b: V2; kind: 'valley' | 'mountain' | 'xray' | 'axis' }[];
  arrows: { d: string; head: V2[]; tail?: V2[]; style: 'valley' | 'mountain' | 'unfold' | 'push' | 'lift' | 'flip' | 'rotate' }[];
  dots: V2[];
  repeat?: { at: V2; n: number };
  draw: number;
  alpha: number;
}

export interface Frame {
  polys: DrawPoly[];
  eyes: { at: V2; r: number }[];
  overlay: Overlay;
}

const LIGHT = norm3([-0.35, -0.55, 0.76]);
function norm3(v: V3): V3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

interface Placed {
  pts: V3[];
  M: Xf;
  layer: number;
  sheet: number;
}

function place(step: StepPlan, t: number): Placed[] {
  const out: Placed[] = step.pieces.map((p) => {
    const M = placeAt(p, t);
    return {
      pts: p.poly.map((q) => apply2(M, q)),
      M,
      layer: p.zStart + (p.zEnd - p.zStart) * t,
      sheet: p.sheet
    };
  });
  if (t > 0 && t < 1) weld(step, out);
  return out;
}

/** Average the positions of each paper point shared by several faces. */
function weld(step: StepPlan, placed: Placed[]) {
  const acc = new Map<string, { s: V3; n: number }>();
  const key = (sheet: number, q: V2) => `${sheet}:${Math.round(q[0] * 1e4)},${Math.round(q[1] * 1e4)}`;
  step.pieces.forEach((p, i) =>
    p.poly.forEach((q, j) => {
      const k = key(p.sheet, q);
      const a = acc.get(k) ?? { s: [0, 0, 0] as V3, n: 0 };
      const w = placed[i].pts[j];
      a.s = [a.s[0] + w[0], a.s[1] + w[1], a.s[2] + w[2]];
      a.n++;
      acc.set(k, a);
    })
  );
  step.pieces.forEach((p, i) =>
    p.poly.forEach((q, j) => {
      const a = acc.get(key(p.sheet, q))!;
      if (a.n > 1) placed[i].pts[j] = [a.s[0] / a.n, a.s[1] / a.n, a.s[2] / a.n];
    })
  );
}

/** Painter's order: faces grouped by plane; groups far→near, layers inside a group. */
function order(placed: Placed[], C: Xf, eps: number): number[] {
  const groups = new Map<string, { idx: number[]; depth: number }>();
  placed.forEach((p, i) => {
    let n = applyDir(p.M, [0, 0, 1]);
    if (n[2] < -1e-6 || (Math.abs(n[2]) <= 1e-6 && (n[0] < 0 || (Math.abs(n[0]) < 1e-6 && n[1] < 0))))
      n = [-n[0], -n[1], -n[2]];
    const d = n[0] * p.pts[0][0] + n[1] * p.pts[0][1] + n[2] * p.pts[0][2];
    const k = `${Math.round(n[0] * 200)},${Math.round(n[1] * 200)},${Math.round(n[2] * 200)},${Math.round(d / eps / 4)}`;
    const g = groups.get(k) ?? { idx: [], depth: 0 };
    g.idx.push(i);
    groups.set(k, g);
  });
  for (const g of groups.values()) {
    let s = 0;
    for (const i of g.idx) {
      const c = placed[i].pts.reduce((a, b) => add3(a, b), [0, 0, 0] as V3);
      s += apply(C, mul3(c, 1 / placed[i].pts.length))[2];
    }
    g.depth = s / g.idx.length;
  }
  return [...groups.values()]
    .sort((a, b) => a.depth - b.depth)
    .flatMap((g) => g.idx.sort((a, b) => placed[a].layer - placed[b].layer));
}

export function frameAt(step: StepPlan, u: number, opts: { overlay?: boolean; t?: number } = {}): Frame {
  const t = opts.t ?? motionT(u);
  const v = lerpView(step.viewFrom, step.viewTo, t);
  const C = camera(v);
  const placed = place(step, t);
  const size = stepSize(step);
  const polys: DrawPoly[] = [];
  for (const i of order(placed, C, size * 0.002)) {
    const p = placed[i];
    const n = applyDir(C, applyDir(p.M, [0, 0, 1]));
    const lambert = Math.abs(n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
    polys.push({
      pts: p.pts.map((q) => {
        const c = apply(C, q);
        return [c[0], c[1]] as V2;
      }),
      side: n[2] >= 0 ? 0 : 1,
      shade: Math.max(0, Math.min(0.8, (LIGHT[2] - lambert) * 0.7 + (1 - Math.abs(n[2])) * 0.12))
    });
  }
  const eyes = step.decorations
    .filter((d) => d.piece >= 0)
    .map((d) => {
      const w = apply2(placed[d.piece].M, d.p);
      const c = apply(C, w);
      return { at: [c[0], c[1]] as V2, r: size * 0.018 };
    });
  const overlay =
    opts.overlay === false
      ? emptyOverlay()
      : projectDiagram(step.diagram, C, size, clamp01(u / T_SHOW), u <= T_MOVE ? 1 : clamp01(1 - ((u - T_MOVE) / (1 - T_MOVE)) * 1.4));
  return { polys, eyes, overlay };
}

export const restFrame = (step: StepPlan) => frameAt(step, 1, { overlay: false, t: 1 });

const emptyOverlay = (): Overlay => ({ creases: [], arrows: [], dots: [], draw: 0, alpha: 0 });

/* ---------- diagram ---------- */

function head(tip: V2, from: V2, size: number, half = false): V2[] {
  const v = sub(tip, from);
  const d: V2 = len(v) < 1e-9 ? [0, 1] : norm(v);
  const n: V2 = [-d[1], d[0]];
  const back = sub(tip, mul(d, size));
  return half ? [add(back, mul(n, size * 0.6)), tip] : [add(back, mul(n, size * 0.55)), tip, sub(back, mul(n, size * 0.55))];
}

function projectDiagram(items: DiagramItem[], C: Xf, size: number, draw: number, alpha: number): Overlay {
  const P = (w: V3): V2 => {
    const c = apply(C, w);
    return [c[0], c[1]];
  };
  const ov: Overlay = { creases: [], arrows: [], dots: [], draw, alpha };
  const hs = size * 0.06;
  for (const it of items) {
    if (it.kind === 'crease') ov.creases.push({ a: P(it.a), b: P(it.b), kind: it.style });
    else if (it.kind === 'dot') ov.dots.push(P(it.at));
    else if (it.kind === 'repeat') ov.repeat = { at: P(it.at), n: it.n };
    else if (it.kind === 'arrow') {
      const a = P(it.from);
      const b = P(it.to);
      const bow3 = it.bow;
      const bw = P(add3(it.from, bow3));
      let bow = sub(bw, a);
      if (len(bow) < 1e-9) bow = [0, -1];
      bow = norm(bow);
      const L = dist(a, b);
      if (L < size * 0.02) continue;
      const c = add(mul(add(a, b), 0.5), mul(bow, L * 0.32 + size * 0.03));
      const d = `M${a[0]},${a[1]} Q${c[0]},${c[1]} ${b[0]},${b[1]}`;
      const style = it.style;
      ov.arrows.push({
        d,
        head: head(b, c, hs, style === 'mountain'),
        tail: style === 'unfold' ? head(a, c, hs * 0.85) : undefined,
        style
      });
    } else if (it.kind === 'flip') {
      const at = P(it.at);
      const w = it.width;
      const [cx, y] = at;
      const a: V2 = [cx - w, y];
      const e: V2 = [cx + w, y];
      const d = `M${a[0]},${a[1]} C${cx - w * 0.2},${y + w * 0.9} ${cx + w * 0.3},${y - w * 0.7} ${cx},${y} S${cx + w * 0.6},${y + w * 0.5} ${e[0]},${e[1]}`;
      ov.arrows.push({ d, head: head(e, [cx + w * 0.6, y + w * 0.5], hs), style: 'flip' });
    } else if (it.kind === 'rotate') {
      const c = P(it.at);
      const r = it.r;
      const a0 = -Math.PI * 0.85;
      const a1 = a0 + ((it.deg * Math.PI) / 180) * 0.9;
      const p0: V2 = [c[0] + r * Math.cos(a0), c[1] + r * Math.sin(a0)];
      const p1: V2 = [c[0] + r * Math.cos(a1), c[1] + r * Math.sin(a1)];
      const sweep = it.deg > 0 ? 1 : 0;
      const tang: V2 = it.deg > 0 ? [-Math.sin(a1), Math.cos(a1)] : [Math.sin(a1), -Math.cos(a1)];
      ov.arrows.push({
        d: `M${p0[0]},${p0[1]} A${r},${r} 0 0 ${sweep} ${p1[0]},${p1[1]}`,
        head: head(p1, sub(p1, tang), hs),
        style: 'rotate'
      });
    }
  }
  return ov;
}

/* ---------- framing ---------- */

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function stepSize(step: StepPlan) {
  const pts: V2[] = [];
  for (const p of step.pieces)
    for (const M of [p.start, p.end])
      for (const q of p.poly) {
        const w = apply2(M, q);
        pts.push([w[0], w[1]]);
      }
  const b = bbox(pts);
  return Math.max(b.x1 - b.x0, b.y1 - b.y0, 1);
}

function bbox(pts: V2[]) {
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

export function fitPts(pts: V2[], pad = 0.18): ViewBox {
  const b = bbox(pts);
  const s = Math.max(b.x1 - b.x0, b.y1 - b.y0, 1) * (1 + pad * 2);
  return { x: (b.x0 + b.x1) / 2 - s / 2, y: (b.y0 + b.y1) / 2 - s / 2, w: s, h: s };
}

/** View boxes for the start (with its diagram) and the end of a step. */
export function fitEnds(step: StepPlan, pad = 0.18): { start: ViewBox; end: ViewBox } {
  const startPts: V2[] = [];
  const f0 = frameAt(step, 0, { t: 0, overlay: false });
  for (const p of f0.polys) startPts.push(...p.pts);
  const ov = frameAt(step, T_SHOW, { t: 0 }).overlay;
  for (const c of ov.creases) startPts.push(c.a, c.b);
  for (const a of ov.arrows) startPts.push(...a.head);
  for (const d of ov.dots) startPts.push(d);
  const endPts: V2[] = [];
  for (const p of frameAt(step, 1, { t: 1, overlay: false }).polys) endPts.push(...p.pts);
  return { start: fitPts(startPts, pad), end: fitPts(endPts, pad) };
}

export const lerpBox = (a: ViewBox, b: ViewBox, t: number): ViewBox => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  w: a.w + (b.w - a.w) * t,
  h: a.h + (b.h - a.h) * t
});

/** A square view box that holds the whole step: start, middle, end and its diagram. */
export function fitStep(step: StepPlan, pad = 0.18, withOverlay = true): ViewBox {
  const pts: V2[] = [];
  for (const t of withOverlay ? [0, 0.5, 1] : [1]) {
    const f = frameAt(step, 0.5, { t, overlay: false });
    for (const p of f.polys) pts.push(...p.pts);
  }
  if (withOverlay) {
    const ov = frameAt(step, T_SHOW, { t: 0 }).overlay;
    for (const c of ov.creases) pts.push(c.a, c.b);
    for (const a of ov.arrows) pts.push(...a.head);
    for (const d of ov.dots) pts.push(d);
  }
  return fitPts(pts, pad);
}

export { centroid };
