/** Geometry kernel: 2D/3D vectors, lines, convex polygons, rigid motions. */

export type V2 = [number, number];
export type V3 = [number, number, number];

export const EPS = 1e-7;
export const LEN_EPS = 1e-5;

/* ---------- 2D ---------- */
export const add = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: V2, b: V2): V2 => [a[0] - b[0], a[1] - b[1]];
export const mul = (a: V2, k: number): V2 => [a[0] * k, a[1] * k];
export const dot = (a: V2, b: V2) => a[0] * b[0] + a[1] * b[1];
export const cross = (a: V2, b: V2) => a[0] * b[1] - a[1] * b[0];
export const len = (a: V2) => Math.hypot(a[0], a[1]);
export const dist = (a: V2, b: V2) => len(sub(a, b));
export const norm = (a: V2): V2 => {
  const l = len(a);
  if (l < EPS) throw new Error('normalize: zero vector');
  return [a[0] / l, a[1] / l];
};
export const lerp = (a: V2, b: V2, t: number): V2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const perp = (a: V2): V2 => [-a[1], a[0]];
export const near = (a: V2, b: V2, tol = LEN_EPS) => dist(a, b) <= tol;

/** An infinite line: point + unit direction. */
export interface Line {
  p: V2;
  d: V2;
}

export const lineThrough = (a: V2, b: V2): Line => ({ p: a, d: norm(sub(b, a)) });
/** signed distance; positive on the left of d (perp(d) side) */
export const side = (L: Line, q: V2) => cross(L.d, sub(q, L.p));
export const reflectPt = (L: Line, q: V2): V2 => {
  const n = perp(L.d);
  return sub(q, mul(n, 2 * dot(sub(q, L.p), n)));
};
export const projectT = (L: Line, q: V2) => dot(sub(q, L.p), L.d);
export const pointAt = (L: Line, t: number): V2 => add(L.p, mul(L.d, t));

export function intersectLines(a: Line, b: Line): V2 | null {
  const den = cross(a.d, b.d);
  if (Math.abs(den) < EPS) return null;
  const t = cross(sub(b.p, a.p), b.d) / den;
  return pointAt(a, t);
}

export const sameLine = (a: Line, b: Line, tol = 1e-6) =>
  Math.abs(cross(a.d, b.d)) < tol && Math.abs(side(a, b.p)) < tol * 100;

/* ---------- convex polygons (CCW or CW, consistent) ---------- */
export function area(poly: V2[]) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) s += cross(poly[i], poly[(i + 1) % poly.length]);
  return s / 2;
}
export const absArea = (poly: V2[]) => Math.abs(area(poly));

export function centroid(poly: V2[]): V2 {
  const A = area(poly);
  if (Math.abs(A) < EPS) {
    const s = poly.reduce((acc, p) => add(acc, p), [0, 0] as V2);
    return mul(s, 1 / poly.length);
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const c = cross(a, b);
    cx += (a[0] + b[0]) * c;
    cy += (a[1] + b[1]) * c;
  }
  return [cx / (6 * A), cy / (6 * A)];
}

export const ccw = (poly: V2[]) => (area(poly) < 0 ? [...poly].reverse() : poly);

/** Keep the part of a convex polygon where sign·side(L) ≥ 0. */
export function clipHalf(poly: V2[], L: Line, sign: 1 | -1): V2[] {
  const out: V2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = sign * side(L, a);
    const db = sign * side(L, b);
    if (da >= -1e-9) out.push(a);
    if ((da > 1e-9 && db < -1e-9) || (da < -1e-9 && db > 1e-9)) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return dedupe(out);
}

export function dedupe(poly: V2[], tol = 1e-9): V2[] {
  const out: V2[] = [];
  for (const p of poly) {
    if (!out.length || dist(out[out.length - 1], p) > tol) out.push(p);
  }
  while (out.length > 1 && dist(out[0], out[out.length - 1]) <= tol) out.pop();
  return out;
}

/** Remove vertices lying on the straight line between their neighbours. */
export function simplify(poly: V2[], tol = 1e-7): V2[] {
  let pts = dedupe(poly);
  let changed = true;
  while (changed && pts.length > 3) {
    changed = false;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i - 1 + pts.length) % pts.length];
      const b = pts[i];
      const c = pts[(i + 1) % pts.length];
      if (Math.abs(cross(sub(b, a), sub(c, b))) < tol * Math.max(1, dist(a, c))) {
        pts = pts.filter((_, j) => j !== i);
        changed = true;
        break;
      }
    }
  }
  return pts;
}

/** Intersection of two convex polygons. */
export function intersectConvex(a: V2[], b: V2[]): V2[] {
  const B = ccw(b);
  let out = ccw(a);
  for (let i = 0; i < B.length && out.length; i++) {
    const L = lineThrough(B[i], B[(i + 1) % B.length]);
    out = clipHalf(out, L, 1);
  }
  return out;
}

export function overlapArea(a: V2[], b: V2[]) {
  const p = intersectConvex(a, b);
  return p.length >= 3 ? absArea(p) : 0;
}

/** Point strictly inside a convex polygon (margin > 0 shrinks it). */
export function insideConvex(poly: V2[], q: V2, margin = 1e-7) {
  const P = ccw(poly);
  for (let i = 0; i < P.length; i++) {
    const L = lineThrough(P[i], P[(i + 1) % P.length]);
    if (side(L, q) < margin) return false;
  }
  return true;
}

export function onSegment(a: V2, b: V2, q: V2, tol = 1e-6) {
  const ab = sub(b, a);
  const l = len(ab);
  if (l < EPS) return dist(a, q) < tol;
  const t = dot(sub(q, a), ab) / (l * l);
  if (t < -tol / l || t > 1 + tol / l) return false;
  return Math.abs(cross(ab, sub(q, a))) / l < tol;
}

/**
 * Overlap of two segments lying on a common line, as a sub-segment,
 * or null when they are not collinear / overlap is shorter than minLen.
 */
export function collinearOverlap(a0: V2, a1: V2, b0: V2, b1: V2, minLen = 1e-5): [V2, V2] | null {
  const da = sub(a1, a0);
  const la = len(da);
  if (la < EPS) return null;
  const u = mul(da, 1 / la);
  const off0 = Math.abs(cross(u, sub(b0, a0)));
  const off1 = Math.abs(cross(u, sub(b1, a0)));
  if (off0 > 1e-6 || off1 > 1e-6) return null;
  const t0 = dot(sub(b0, a0), u);
  const t1 = dot(sub(b1, a0), u);
  const lo = Math.max(0, Math.min(t0, t1));
  const hi = Math.min(la, Math.max(t0, t1));
  if (hi - lo < minLen) return null;
  return [add(a0, mul(u, lo)), add(a0, mul(u, hi))];
}

/** Does the open segment (a,b) pass through the interior of convex poly? */
export function segmentCrossesInterior(poly: V2[], a: V2, b: V2) {
  // sample a few interior points of the segment
  for (const t of [0.25, 0.5, 0.75]) {
    if (insideConvex(poly, lerp(a, b, t), 1e-5)) return true;
  }
  return false;
}

/* ---------- 3D ---------- */
export const add3 = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul3 = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross3 = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
];
export const len3 = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const norm3 = (a: V3): V3 => mul3(a, 1 / (len3(a) || 1));
export const dist3 = (a: V3, b: V3) => len3(sub3(a, b));

/** Rigid (or improper) affine map: x ↦ R·x + t. R row-major 3×3. */
export interface Xf {
  R: [number, number, number, number, number, number, number, number, number];
  t: V3;
}

export const IDENTITY: Xf = { R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] };
/** paper face-down: mirror z so the back of the sheet faces the viewer */
export const FLIP_Z: Xf = { R: [1, 0, 0, 0, 1, 0, 0, 0, -1], t: [0, 0, 0] };

export function apply(m: Xf, p: V3): V3 {
  const R = m.R;
  return [
    R[0] * p[0] + R[1] * p[1] + R[2] * p[2] + m.t[0],
    R[3] * p[0] + R[4] * p[1] + R[5] * p[2] + m.t[1],
    R[6] * p[0] + R[7] * p[1] + R[8] * p[2] + m.t[2]
  ];
}
export const apply2 = (m: Xf, p: V2): V3 => apply(m, [p[0], p[1], 0]);
export const applyDir = (m: Xf, v: V3): V3 => {
  const R = m.R;
  return [
    R[0] * v[0] + R[1] * v[1] + R[2] * v[2],
    R[3] * v[0] + R[4] * v[1] + R[5] * v[2],
    R[6] * v[0] + R[7] * v[1] + R[8] * v[2]
  ];
};

/** a ∘ b  (apply b first) */
export function compose(a: Xf, b: Xf): Xf {
  const A = a.R;
  const B = b.R;
  const R: Xf['R'] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) R[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
  return { R, t: add3(applyDir(a, b.t), a.t) };
}

export function invert(m: Xf): Xf {
  const R = m.R;
  // orthonormal: inverse = transpose
  const Rt: Xf['R'] = [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];
  const t = applyDir({ R: Rt, t: [0, 0, 0] }, m.t);
  return { R: Rt, t: [-t[0], -t[1], -t[2]] };
}

/** Rotation by `angle` about the axis through `p` with direction `d` (right-hand rule). */
export function rotation(p: V3, d: V3, angle: number): Xf {
  const [x, y, z] = norm3(d);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const C = 1 - c;
  const R: Xf['R'] = [
    c + x * x * C, x * y * C - z * s, x * z * C + y * s,
    y * x * C + z * s, c + y * y * C, y * z * C - x * s,
    z * x * C - y * s, z * y * C + x * s, c + z * z * C
  ];
  const rot: Xf = { R, t: [0, 0, 0] };
  const rp = applyDir(rot, p);
  return { R, t: sub3(p, rp) };
}

export const det = (m: Xf) => {
  const R = m.R;
  return (
    R[0] * (R[4] * R[8] - R[5] * R[7]) - R[1] * (R[3] * R[8] - R[5] * R[6]) + R[2] * (R[3] * R[7] - R[4] * R[6])
  );
};

/** Orthonormality error of R. */
export function orthoError(m: Xf) {
  const R = m.R;
  let e = 0;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      const d = R[i * 3] * R[j * 3] + R[i * 3 + 1] * R[j * 3 + 1] + R[i * 3 + 2] * R[j * 3 + 2];
      e = Math.max(e, Math.abs(d - (i === j ? 1 : 0)));
    }
  return e;
}

/** World normal of the paper's front side under m. */
export const frontNormal = (m: Xf): V3 => applyDir(m, [0, 0, 1]);

/** Is the placement flat in the z = 0 plane? */
export const isFlat = (m: Xf, tol = 1e-6) =>
  Math.abs(Math.abs(m.R[8]) - 1) < tol && Math.abs(m.t[2]) < tol * 100;

export const xfNear = (a: Xf, b: Xf, tol = 1e-6) =>
  a.R.every((v, i) => Math.abs(v - b.R[i]) < tol) && dist3(a.t, b.t) < tol * 100;
