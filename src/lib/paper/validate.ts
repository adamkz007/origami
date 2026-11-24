/**
 * Physical validity of a paper state. Every step of every model must pass.
 */
import {
  absArea,
  apply2,
  centroid,
  collinearOverlap,
  dist3,
  frontNormal,
  isFlat,
  orthoError,
  overlapArea,
  segmentCrossesInterior,
  side,
  sub,
  type Line,
  type V2
} from './geom';
import { creases, worldPoly2, type Crease, type Face, type State } from './sheet';

export interface Problem {
  rule: string;
  detail: string;
}

const TOL = 1e-6;

export function validate(s: State, opts: { flat?: boolean } = {}): Problem[] {
  const out: Problem[] = [];
  const push = (rule: string, detail: string) => out.push({ rule, detail });

  // 1. rigid placements only
  for (const f of s.faces) {
    const e = orthoError(f.M);
    if (e > 1e-9) push('rigid', `face ${f.id} is stretched (${e.toExponential(2)})`);
    for (const p of f.poly) if (!p.every(Number.isFinite)) push('finite', `face ${f.id} has a bad vertex`);
  }

  // 2. faces partition each sheet exactly
  for (const sh of s.sheets) {
    const faces = s.faces.filter((f) => f.sheet === sh.id);
    const total = faces.reduce((a, f) => a + absArea(f.poly), 0);
    if (Math.abs(total - sh.area) > sh.area * 1e-9 + 1e-6)
      push('area', `sheet ${sh.id}: faces cover ${total.toFixed(6)} of ${sh.area.toFixed(6)}`);
    for (let i = 0; i < faces.length; i++)
      for (let j = i + 1; j < faces.length; j++) {
        const ov = overlapArea(faces[i].poly, faces[j].poly);
        if (ov > 1e-6) push('overlap', `faces ${faces[i].id} and ${faces[j].id} overlap on the sheet (${ov.toFixed(6)})`);
      }
  }

  // 3. no tears: shared paper edges land in the same place
  const cs = creases(s);
  for (const c of cs) {
    for (const p of [c.a, c.b]) {
      const d = dist3(apply2(c.f.M, p), apply2(c.g.M, p));
      if (d > 1e-6) push('tear', `faces ${c.f.id}/${c.g.id} come apart by ${d.toExponential(2)}`);
    }
  }

  const flat = s.faces.every((f) => isFlat(f.M));
  if (opts.flat && !flat) push('flat', 'expected a flat state');
  if (flat) {
    out.push(...layerProblems(s, cs));
    out.push(...vertexProblems(s, cs));
  }

  // 4. landing checks recorded by operations
  for (const ck of s.checks) {
    const d = dist3(ck.a, ck.b);
    if (d > 1e-6) push('landing', `${ck.label}: off by ${d.toExponential(2)}`);
  }
  return out;
}

/* ---------- crease assignment ---------- */

export type Assignment = 'M' | 'V' | 'F';

/** Valley/mountain as seen from the paper's front side. */
export function assignment(c: Crease): Assignment {
  const nf = frontNormal(c.f.M);
  const ng = frontNormal(c.g.M);
  const dotn = nf[0] * ng[0] + nf[1] * ng[1] + nf[2] * ng[2];
  if (dotn > 0.5) return 'F';
  const up = nf[2] > 0 ? c.f : c.g;
  const other = up === c.f ? c.g : c.f;
  return up.z < other.z ? 'V' : 'M';
}

/* ---------- layers: taco–tortilla, taco–taco ---------- */

export function layerProblems(s: State, cs: Crease[] = creases(s)): Problem[] {
  const out: Problem[] = [];
  const zs = s.faces.map((f) => f.z);
  if (new Set(zs).size !== zs.length) out.push({ rule: 'layers', detail: 'two faces share a layer index' });

  interface Fold {
    c: Crease;
    a: V2;
    b: V2;
    L: Line;
    sideSign: number;
    lo: number;
    hi: number;
  }
  const folds: Fold[] = [];
  for (const c of cs) {
    if (assignment(c) === 'F') continue;
    const wa = apply2(c.f.M, c.a);
    const wb = apply2(c.f.M, c.b);
    const a: V2 = [wa[0], wa[1]];
    const b: V2 = [wb[0], wb[1]];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-6) continue;
    const L: Line = { p: a, d: [(b[0] - a[0]) / len, (b[1] - a[1]) / len] };
    const sideSign = Math.sign(side(L, centroid(worldPoly2(c.f))));
    folds.push({ c, a, b, L, sideSign, lo: Math.min(c.f.z, c.g.z), hi: Math.max(c.f.z, c.g.z) });
  }

  // taco–tortilla: a face sandwiched inside a fold may not be crossed by it
  const polys = new Map<Face, V2[]>(s.faces.map((f) => [f, worldPoly2(f)]));
  for (const F of folds) {
    for (const h of s.faces) {
      if (h === F.c.f || h === F.c.g) continue;
      if (h.z <= F.lo || h.z >= F.hi) continue;
      if (segmentCrossesInterior(polys.get(h)!, F.a, F.b))
        out.push({ rule: 'taco-tortilla', detail: `face ${h.id} is pierced by the fold between ${F.c.f.id}/${F.c.g.id}` });
    }
  }

  // taco–taco: two folds on the same line, same side, may nest but not interleave
  for (let i = 0; i < folds.length; i++)
    for (let j = i + 1; j < folds.length; j++) {
      const A = folds[i];
      const B = folds[j];
      if (A.sideSign !== B.sideSign) continue;
      if (!collinearOverlap(A.a, A.b, B.a, B.b, 1e-5)) continue;
      const inter = (A.lo < B.lo && B.lo < A.hi && A.hi < B.hi) || (B.lo < A.lo && A.lo < B.hi && B.hi < A.hi);
      if (inter)
        out.push({
          rule: 'taco-taco',
          detail: `folds ${A.c.f.id}/${A.c.g.id} and ${B.c.f.id}/${B.c.g.id} cross each other`
        });
    }
  return out;
}

/* ---------- vertices: Kawasaki & Maekawa ---------- */

function onOutline(s: State, sheet: number, p: V2) {
  const o = s.sheets[sheet].outline;
  for (let i = 0; i < o.length; i++) {
    const a = o[i];
    const b = o[(i + 1) % o.length];
    const ab = sub(b, a);
    const l = Math.hypot(ab[0], ab[1]);
    const t = ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / (l * l);
    if (t < -1e-9 || t > 1 + 1e-9) continue;
    const cr = Math.abs(ab[0] * (p[1] - a[1]) - ab[1] * (p[0] - a[0])) / l;
    if (cr < 1e-6) return true;
  }
  return false;
}

export function vertexProblems(s: State, cs: Crease[]): Problem[] {
  const out: Problem[] = [];
  const key = (sheet: number, p: V2) => `${sheet}:${Math.round(p[0] * 1e5)},${Math.round(p[1] * 1e5)}`;
  const rays = new Map<string, { sheet: number; p: V2; list: { ang: number; as: Assignment }[] }>();
  for (const c of cs) {
    const as = assignment(c);
    for (const [p, q] of [
      [c.a, c.b],
      [c.b, c.a]
    ] as [V2, V2][]) {
      const k = key(c.f.sheet, p);
      if (!rays.has(k)) rays.set(k, { sheet: c.f.sheet, p, list: [] });
      rays.get(k)!.list.push({ ang: Math.atan2(q[1] - p[1], q[0] - p[0]), as });
    }
  }
  for (const v of rays.values()) {
    if (onOutline(s, v.sheet, v.p)) continue;
    const folded = v.list.filter((r) => r.as !== 'F');
    // merge duplicate directions
    const uniq: typeof folded = [];
    for (const r of folded.sort((a, b) => a.ang - b.ang))
      if (!uniq.some((u) => Math.abs(Math.atan2(Math.sin(u.ang - r.ang), Math.cos(u.ang - r.ang))) < 1e-6)) uniq.push(r);
    if (uniq.length === 0) continue;
    if (uniq.length % 2 === 1) {
      out.push({ rule: 'kawasaki', detail: `vertex ${v.p.map((x) => x.toFixed(2))} has an odd number of folds` });
      continue;
    }
    let alt = 0;
    for (let i = 0; i < uniq.length; i++) {
      let gap = uniq[(i + 1) % uniq.length].ang - uniq[i].ang;
      if (gap <= 0) gap += 2 * Math.PI;
      alt += i % 2 === 0 ? gap : -gap;
    }
    if (Math.abs(alt) > 1e-6)
      out.push({ rule: 'kawasaki', detail: `vertex ${v.p.map((x) => x.toFixed(2))} angles off by ${alt.toExponential(2)}` });
    const M = uniq.filter((r) => r.as === 'M').length;
    const V = uniq.length - M;
    if (Math.abs(M - V) !== 2)
      out.push({ rule: 'maekawa', detail: `vertex ${v.p.map((x) => x.toFixed(2))} has M=${M}, V=${V}` });
  }
  return out;
}

export { absArea, dist3 };
