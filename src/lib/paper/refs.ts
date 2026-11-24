/**
 * Precise references. Fold lines are never typed as coordinates: they are
 * built from named landmarks with the Huzita–Hatori constructions, evaluated
 * against the paper's current folded state.
 */
import {
  add,
  dot,
  intersectLines,
  lerp,
  lineThrough,
  mul,
  norm,
  perp,
  reflectPt,
  side,
  sub,
  type Line,
  type V2
} from './geom';
import { markWorld, type State } from './sheet';

/** A point: landmark name, fixed world point, or computed. */
export type PointRef = string | V2 | ((s: State) => V2);

export function pt(s: State, r: PointRef): V2 {
  if (typeof r === 'string') {
    const w = markWorld(s, r);
    return [w[0], w[1]];
  }
  if (typeof r === 'function') return r(s);
  return r;
}

export const nameOf = (r: PointRef) =>
  typeof r === 'string' ? `«${r}»` : typeof r === 'function' && (r as Labelled).label ? (r as Labelled).label! : 'a point';

type Labelled = ((s: State) => V2) & { label?: string };
const labelled = (f: (s: State) => V2, label: string): PointRef => Object.assign(f, { label });
const frac = (t: number) => {
  for (const d of [2, 3, 4, 5, 6, 8, 10, 20, 25, 50, 100]) {
    const n = Math.round(t * d);
    if (Math.abs(n / d - t) < 1e-9) return d === 2 && n === 1 ? 'halfway' : `${n}/${d} of the way`;
  }
  return `${Math.round(t * 100)}% of the way`;
};

export const mid = (a: PointRef, b: PointRef): PointRef =>
  labelled((s) => lerp(pt(s, a), pt(s, b), 0.5), `the midpoint of ${nameOf(a)} and ${nameOf(b)}`);
export const along = (a: PointRef, b: PointRef, t: number): PointRef =>
  labelled((s) => lerp(pt(s, a), pt(s, b), t), `the point ${frac(t)} from ${nameOf(a)} toward ${nameOf(b)}`);

export interface LineSpec {
  line: (s: State) => Line;
  /** P→Q pair when the fold brings one point onto another */
  bring?: { from: PointRef; to: PointRef };
  describe: string;
}

export const meet = (l1: LineSpec, l2: LineSpec): PointRef =>
  labelled((s) => {
    const p = intersectLines(l1.line(s), l2.line(s));
    if (!p) throw new Error(`lines do not meet: ${l1.describe} / ${l2.describe}`);
    return p;
  }, 'where the creases meet');

/** Axiom 1: the line through two points. */
export const through = (a: PointRef, b: PointRef): LineSpec => ({
  line: (s) => lineThrough(pt(s, a), pt(s, b)),
  describe: `through ${nameOf(a)} and ${nameOf(b)}`
});
export const edge = through;

/** Axiom 2: the fold that brings point a onto point b. */
export const bring = (a: PointRef) => ({
  to: (b: PointRef): LineSpec => ({
    line: (s) => {
      const A = pt(s, a);
      const B = pt(s, b);
      return { p: lerp(A, B, 0.5), d: norm(perp(sub(B, A))) };
    },
    bring: { from: a, to: b },
    describe: `bring ${nameOf(a)} to ${nameOf(b)}`
  })
});

/** Axiom 3: fold line l1 onto line l2 (the bisector on the side of `toward`). */
export const bisect = (l1: LineSpec, l2: LineSpec, toward: PointRef): LineSpec => ({
  line: (s) => {
    const A = l1.line(s);
    const B = l2.line(s);
    const T = pt(s, toward);
    const X = intersectLines(A, B);
    if (!X) {
      // parallel: midline
      const off = side(A, B.p) / 2;
      return { p: add(A.p, mul(perp(A.d), off)), d: A.d };
    }
    const c1 = norm(add(A.d, B.d));
    const c2 = norm(sub(A.d, B.d));
    // pick the bisector whose direction from X points most toward `toward`
    const v = sub(T, X);
    const pick = Math.abs(dot(c1, v)) >= Math.abs(dot(c2, v)) ? c1 : c2;
    return { p: X, d: pick };
  },
  describe: `lay ${l1.describe} onto ${l2.describe}`
});

/** Axiom 4: the line through p perpendicular to l. */
export const perpendicular = (l: LineSpec, p: PointRef): LineSpec => ({
  line: (s) => ({ p: pt(s, p), d: perp(l.line(s).d) }),
  describe: `through ${nameOf(p)}, square to ${l.describe}`
});

export const parallel = (l: LineSpec, p: PointRef): LineSpec => ({
  line: (s) => ({ p: pt(s, p), d: l.line(s).d }),
  describe: `through ${nameOf(p)}, parallel to ${l.describe}`
});

/**
 * Axiom 5: a line through p that brings q onto line l.
 * Two solutions in general; `near` picks the one whose landing point is closer.
 */
export const throughBringing = (p: PointRef, q: PointRef, l: LineSpec, near: PointRef): LineSpec => {
  const solve = (s: State) => {
    const P = pt(s, p);
    const Q = pt(s, q);
    const L = l.line(s);
    const r = Math.hypot(Q[0] - P[0], Q[1] - P[1]);
    // circle(P, r) ∩ L
    const f = sub(L.p, P);
    const b = dot(f, L.d);
    const c = dot(f, f) - r * r;
    const disc = b * b - c;
    if (disc < -1e-9) throw new Error('axiom 5 has no solution');
    const sq = Math.sqrt(Math.max(0, disc));
    const cands = [-b - sq, -b + sq].map((t) => add(L.p, mul(L.d, t)));
    const N = pt(s, near);
    const land = cands.sort(
      (u, v) => Math.hypot(u[0] - N[0], u[1] - N[1]) - Math.hypot(v[0] - N[0], v[1] - N[1])
    )[0];
    return { line: { p: P, d: norm(perp(sub(land, Q))) } as Line, land };
  };
  return {
    line: (s) => solve(s).line,
    bring: { from: q, to: (s) => solve(s).land },
    describe: `through ${nameOf(p)}, bringing ${nameOf(q)} onto ${l.describe}`
  };
};

/** Axiom 7: bring p onto l1 with a fold square to l2. */
export const bringOntoSquareTo = (p: PointRef, l1: LineSpec, l2: LineSpec): LineSpec => ({
  line: (s) => {
    const P = pt(s, p);
    const A = l1.line(s);
    const B = l2.line(s);
    // fold line is perpendicular to B; P moves parallel to B.d
    const land = intersectLines({ p: P, d: B.d }, A);
    if (!land) throw new Error('axiom 7 has no solution');
    return { p: lerp(P, land, 0.5), d: perp(B.d) };
  },
  describe: `bring ${nameOf(p)} onto ${l1.describe}, square to ${l2.describe}`
});

/** A line through p at an exact angle (degrees, 0 = rightward, clockwise on screen). */
export const atAngle = (p: PointRef, deg: number): LineSpec => ({
  line: (s) => {
    const r = (deg * Math.PI) / 180;
    return { p: pt(s, p), d: [Math.cos(r), Math.sin(r)] };
  },
  describe: `through ${nameOf(p)} at ${deg}°`
});

/** Where a point lands when folded over a line (for checks). */
export const mirror = (l: LineSpec, a: PointRef): PointRef => (s) => reflectPt(l.line(s), pt(s, a));

export { lineThrough };

/** A point on a line, `t` units from its anchor (handy for hinges). */
export const pointOn = (l: LineSpec, t: number): PointRef =>
  labelled((s) => {
    const L = l.line(s);
    return [L.p[0] + L.d[0] * t, L.p[1] + L.d[1] * t];
  }, `a point on the line ${l.describe}`);
