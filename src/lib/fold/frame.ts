import {
  allPts,
  bbox,
  center,
  mul,
  sdist,
  sub,
  add,
  norm,
  len,
  rotatePt,
  type Mark,
  type Plan,
  type Pt,
  type Side
} from './engine';

export interface DrawPoly {
  pts: Pt[];
  side: Side;
  /** 0 = flat, 1 = edge-on (darkest) */
  shade: number;
}

export interface Overlay {
  /** crease lines, drawn on progressively */
  creases: { a: Pt; b: Pt; kind: 'valley' | 'mountain' | 'axis' }[];
  /** curved arrows as SVG path data */
  arrows: { d: string; head: Pt[]; kind: 'fold' | 'flip' | 'rotate' | 'push' }[];
  /** 0..1 draw-on progress */
  draw: number;
  /** 0..1 opacity */
  alpha: number;
  repeat?: Pt;
}

export interface Frame {
  polys: DrawPoly[];
  marks: { at: Pt; r: number }[];
  overlay: Overlay;
}

/* ---- timing inside one step (u ∈ [0,1]) ---- */
export const T_SHOW = 0.28; // overlays draw on
export const T_MOVE = 0.86; // motion ends

export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

export function motionT(u: number) {
  return ease(clamp01((u - T_SHOW) / (T_MOVE - T_SHOW)));
}

/* ---- arrows ---- */
function arrowHead(tip: Pt, from: Pt, size: number): Pt[] {
  const d = norm(sub(tip, from));
  const n: Pt = [-d[1], d[0]];
  const back = sub(tip, mul(d, size));
  return [add(back, mul(n, size * 0.55)), tip, sub(back, mul(n, size * 0.55))];
}

function curved(a: Pt, b: Pt, bend: Pt, size: number) {
  const c = add(mul(add(a, b), 0.5), bend);
  // shorten so the head doesn't overlap the target
  const d: string = `M${a[0]},${a[1]} Q${c[0]},${c[1]} ${b[0]},${b[1]}`;
  return { d, head: arrowHead(b, c, size) };
}

function overlayFor(plan: Plan, size: number): Overlay {
  const ov: Overlay = { creases: [], arrows: [], draw: 1, alpha: 1 };
  const s = plan.step;
  const head = size * 0.07;
  if (s.op === 'fold') {
    plan.segments.forEach(([a, b], i) => {
      ov.creases.push({ a, b, kind: s.folds[i]?.behind ? 'mountain' : 'valley' });
    });
    plan.arrows.forEach(([a, b], i) => {
      const L = plan.lines[i];
      const dist = len(sub(b, a));
      // bow the arrow sideways along the fold line, away from the paper's centre
      const c = center(plan.before);
      const mid = mul(add(a, b), 0.5);
      let bendDir = L.dir;
      if (sdist({ p: c, dir: [0, 0], n: L.dir }, mid) < 0) bendDir = mul(L.dir, -1);
      const arr = curved(a, b, mul(bendDir, dist * 0.35 + size * 0.03), head);
      ov.arrows.push({ ...arr, kind: 'fold' });
    });
  } else if (s.op === 'reshape') {
    plan.segments.forEach(([a, b]) => ov.creases.push({ a, b, kind: 'axis' }));
    plan.arrows.forEach(([a, b]) => {
      const dist = len(sub(b, a));
      if (dist < size * 0.08) {
        // nearly in place: draw a little "open up" arrow perpendicular to the axis
        const n = plan.lines[0].n;
        const p0 = add(a, mul(n, size * 0.18));
        const p1 = sub(a, mul(n, size * 0.18));
        ov.arrows.push({ ...curved(p0, p1, mul(plan.lines[0].dir, size * 0.2), head), kind: 'push' });
      } else {
        ov.arrows.push({ ...curved(a, b, mul(plan.lines[0].dir, dist * 0.3), head), kind: 'push' });
      }
    });
    if (s.repeat) {
      const b = bbox(allPts(plan.after));
      ov.repeat = [b.x1 + size * 0.06, b.y0 - size * 0.02];
    }
  } else if (s.op === 'flip') {
    const b = bbox(allPts(plan.before));
    const y = b.y1 + size * 0.12;
    const w = (b.x1 - b.x0) * 0.32 + size * 0.05;
    const cx = (b.x0 + b.x1) / 2;
    // looped "turn over" arrow
    const a: Pt = [cx - w, y];
    const e: Pt = [cx + w, y];
    const d = `M${a[0]},${a[1]} C${cx - w * 0.2},${y + w * 0.9} ${cx + w * 0.3},${y - w * 0.7} ${cx},${y} S${cx + w * 0.6},${y + w * 0.5} ${e[0]},${e[1]}`;
    ov.arrows.push({ d, head: arrowHead(e, [cx + w * 0.6, y + w * 0.5], head), kind: 'flip' });
  } else if (s.op === 'rotate') {
    const c = center(plan.before);
    const b = bbox(allPts(plan.before));
    const r = Math.max(b.x1 - b.x0, b.y1 - b.y0) * 0.62;
    const a0 = -Math.PI * 0.85;
    const a1 = a0 + (s.deg * Math.PI) / 180 * 0.9;
    const p0: Pt = [c[0] + r * Math.cos(a0), c[1] + r * Math.sin(a0)];
    const p1: Pt = [c[0] + r * Math.cos(a1), c[1] + r * Math.sin(a1)];
    const sweep = s.deg > 0 ? 1 : 0;
    const d = `M${p0[0]},${p0[1]} A${r},${r} 0 0 ${sweep} ${p1[0]},${p1[1]}`;
    const tangent: Pt = [-Math.sin(a1) * (sweep ? 1 : -1), Math.cos(a1) * (sweep ? 1 : -1)];
    ov.arrows.push({ d, head: arrowHead(p1, sub(p1, tangent), head), kind: 'rotate' });
  }
  return ov;
}

/* ---- the frame ---- */

export function stepSize(plan: Plan) {
  const b = bbox([...allPts(plan.before), ...allPts(plan.after)]);
  return Math.max(b.x1 - b.x0, b.y1 - b.y0);
}

function marksAt(marks: Mark[], k = 1) {
  return marks.map((m) => ({ at: m.at, r: 4.2 * k }));
}

/**
 * Geometry for `plan` at step-time u ∈ [0,1].
 * `withOverlay` false → no arrows/creases (used by tiny previews).
 */
export function frameAt(plan: Plan, u: number, withOverlay = true): Frame {
  const size = stepSize(plan);
  const s = plan.step;
  let t = motionT(u);
  const polys: DrawPoly[] = [];
  let marks = marksAt(plan.before.marks);

  if (s.op === 'fold') {
    if (s.unfold) t = (1 - Math.cos(2 * Math.PI * t)) / 2;
    const c = Math.cos(Math.PI * t);
    const shade = (1 - Math.abs(c)) * (t > 0 && t < 1 ? 1 : 0);
    const stat: DrawPoly[] = [];
    const front: DrawPoly[][] = [];
    const back: DrawPoly[][] = [];
    plan.lines.forEach(() => {
      front.push([]);
      back.push([]);
    });
    for (const pc of plan.pieces) {
      if (pc.motion < 0) {
        stat.push({ pts: pc.pts, side: pc.side, shade: pc.shade ?? 0 });
        continue;
      }
      const L = plan.lines[pc.motion];
      const pts = pc.pts.map((q) => sub(q, mul(L.n, sdist(L, q) * (1 - c))));
      const dp: DrawPoly = { pts, side: (c >= 0 ? pc.side : 1 - pc.side) as Side, shade: Math.min(1, shade + (pc.shade ?? 0)) };
      (pc.behind ? back : front)[pc.motion].push(dp);
    }
    const ordered = (g: DrawPoly[]) => (c >= 0 ? g : [...g].reverse());
    polys.push(...back.flatMap((g) => ordered(g)), ...stat, ...front.flatMap((g) => ordered(g)));
  } else if (s.op === 'reshape') {
    const L = plan.lines[0];
    for (const pc of plan.pieces) {
      if (pc.motion < 0) {
        polys.push({ pts: pc.pts, side: pc.side, shade: pc.shade ?? 0 });
        continue;
      }
      const goingOut = pc.phase === 'out';
      if (goingOut && t >= 0.5) continue;
      if (!goingOut && t < 0.5) continue;
      const k = goingOut ? Math.cos(Math.PI * t) : -Math.cos(Math.PI * t);
      const pts = pc.pts.map((q) => sub(q, mul(L.n, sdist(L, q) * (1 - k))));
      polys.push({ pts, side: pc.side, shade: Math.min(1, (1 - k) * (t > 0 && t < 1 ? 1 : 0) + (pc.shade ?? 0)) });
    }
  } else if (s.op === 'flip') {
    const cx = center(plan.before)[0];
    const c = Math.cos(Math.PI * t);
    const src = c >= 0 ? plan.pieces : [...plan.pieces].reverse();
    for (const pc of src) {
      polys.push({
        pts: pc.pts.map((q) => [cx + (q[0] - cx) * c, q[1]] as Pt),
        side: (c >= 0 ? pc.side : 1 - pc.side) as Side,
        shade: Math.min(1, (1 - Math.abs(c)) * 0.8 + (pc.shade ?? 0))
      });
    }
    marks = c >= 0 ? marks.map((m) => ({ ...m, at: [cx + (m.at[0] - cx) * c, m.at[1]] as Pt })) : [];
  } else if (s.op === 'rotate') {
    const c = center(plan.before);
    const r = ((s.deg * Math.PI) / 180) * t;
    for (const pc of plan.pieces) {
      polys.push({ pts: pc.pts.map((q) => rotatePt(q, c, r)), side: pc.side, shade: pc.shade ?? 0 });
    }
    marks = marks.map((m) => ({ ...m, at: rotatePt(m.at, c, r) }));
  } else if (s.op === 'mark') {
    for (const pc of plan.pieces) polys.push({ pts: pc.pts, side: pc.side, shade: pc.shade ?? 0 });
    // pop in with a little overshoot
    const pop = t <= 0 ? 0 : t >= 1 ? 1 : Math.sin(t * Math.PI * 0.75) / Math.sin(Math.PI * 0.75);
    marks = [...marks, ...marksAt(s.marks, pop)];
  }

  const overlay = withOverlay ? overlayFor(plan, size) : { creases: [], arrows: [], draw: 0, alpha: 0 };
  overlay.draw = clamp01(u / T_SHOW);
  overlay.alpha = u <= T_MOVE ? 1 : clamp01(1 - (u - T_MOVE) / (1 - T_MOVE) * 1.4);
  // for previews of the finished state we don't want overlays at all
  return { polys, marks, overlay };
}

/** Rest frame: the finished state of `plan`, no overlay. */
export function restFrame(plan: Plan): Frame {
  return {
    polys: plan.after.faces.map((f) => ({ pts: f.pts, side: f.side, shade: f.shade ?? 0 })),
    marks: marksAt(plan.after.marks),
    overlay: { creases: [], arrows: [], draw: 0, alpha: 0 }
  };
}

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Square viewBox that fits a step (before + after + overlays). */
export function fitStep(plan: Plan, pad = 0.2): ViewBox {
  const pts = [...allPts(plan.before), ...allPts(plan.after)];
  const ov = overlayFor(plan, stepSize(plan));
  for (const c of ov.creases) pts.push(c.a, c.b);
  for (const a of ov.arrows) pts.push(...a.head);
  return fitPts(pts, pad);
}

export function fitPts(pts: Pt[], pad = 0.2): ViewBox {
  const b = bbox(pts);
  const w = b.x1 - b.x0;
  const h = b.y1 - b.y0;
  const s = Math.max(w, h) * (1 + pad * 2);
  return { x: (b.x0 + b.x1) / 2 - s / 2, y: (b.y0 + b.y1) / 2 - s / 2, w: s, h: s };
}
