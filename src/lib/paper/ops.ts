/**
 * Fold operations. Each one changes the paper itself: it splits faces along
 * creases and moves them by exact rotations about world axes. The rotations
 * are recorded per face (`path`) so motion replays the same geometry.
 */
import {
  add,
  apply,
  apply2,
  centroid,
  collinearOverlap,
  compose,
  cross,
  dedupe,
  det,
  dist,
  dot,
  frontNormal,
  insideConvex,
  intersectLines,
  invert,
  isFlat,
  len,
  lerp,
  mul,
  norm,
  norm3,
  onSegment,
  overlapArea,
  perp,
  reflectPt,
  rotation,
  side,
  sub,
  sub3,
  type Line,
  type V2,
  type V3,
  type Xf
} from './geom';
import { pt, type LineSpec, type PointRef } from './refs';
import { layerProblems } from './validate';
import {
  bounds,
  cloneFace,
  facesAtWorld,
  markWorld,
  worldPoly2,
  type Face,
  type State
} from './sheet';

export interface Op {
  describe: string;
  apply(s: State): void;
}

export class FoldError extends Error {}

/* ---------- helpers ---------- */

const PI = Math.PI;
const to3 = (p: V2): V3 => [p[0], p[1], 0];

function requireFlat(faces: Face[], what: string) {
  for (const f of faces) if (!isFlat(f.M)) throw new FoldError(`${what} needs flat paper`);
}

/** world-side of each paper vertex, for a flat face */
const sideFn = (f: Face, L: Line) => (p: V2) => {
  const w = apply2(f.M, p);
  return side(L, [w[0], w[1]]);
};

/** Split a face's paper polygon by a world line. */
function splitPoly(f: Face, poly: V2[], L: Line): { pos: V2[] | null; neg: V2[] | null } {
  const sf = sideFn(f, L);
  const sv = poly.map(sf);
  const clip = (sign: 1 | -1) => {
    const out: V2[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const da = sign * sv[i];
      const db = sign * sv[(i + 1) % poly.length];
      if (da >= -1e-9) out.push(a);
      if ((da > 1e-9 && db < -1e-9) || (da < -1e-9 && db > 1e-9)) {
        const t = da / (da - db);
        out.push(lerp(a, b, t));
      }
    }
    const d = dedupe(out);
    return d.length >= 3 && Math.abs(polyArea(d)) > 1e-8 ? d : null;
  };
  return { pos: clip(1), neg: clip(-1) };
}

const polyArea = (p: V2[]) => {
  let s = 0;
  for (let i = 0; i < p.length; i++) s += cross(p[i], p[(i + 1) % p.length]);
  return s / 2;
};

interface Piece {
  face: Face;
  poly: V2[];
  sign: 1 | -1;
}

function containsPaperPt(poly: V2[], p: V2) {
  if (insideConvex(poly, p, -1e-7)) return true;
  for (let i = 0; i < poly.length; i++) if (onSegment(poly[i], poly[(i + 1) % poly.length], p, 1e-6)) return true;
  return false;
}

/** Pieces of every face on side `sign` of L (faces entirely on that side included whole). */
function piecesOnSide(s: State, L: Line, sign: 1 | -1, faces = s.faces): Piece[] {
  const out: Piece[] = [];
  for (const f of faces) {
    if (!isFlat(f.M)) continue; // paper already lifted into 3D takes no part
    const { pos, neg } = splitPoly(f, f.poly, L);
    const keep = sign > 0 ? pos : neg;
    if (keep) out.push({ face: f, poly: keep, sign });
  }
  return out;
}

/** Do two pieces share a paper edge that is not on the dividing line? */
function joined(a: Piece, b: Piece, L: Line | null): boolean {
  if (a.face.sheet !== b.face.sheet || a.face === b.face) return false;
  for (let i = 0; i < a.poly.length; i++)
    for (let j = 0; j < b.poly.length; j++) {
      const ov = collinearOverlap(
        a.poly[i],
        a.poly[(i + 1) % a.poly.length],
        b.poly[j],
        b.poly[(j + 1) % b.poly.length]
      );
      if (!ov) continue;
      if (L) {
        const w0 = apply2(a.face.M, ov[0]);
        const w1 = apply2(a.face.M, ov[1]);
        if (Math.abs(side(L, [w0[0], w0[1]])) < 1e-6 && Math.abs(side(L, [w1[0], w1[1]])) < 1e-6) continue;
      }
      return true;
    }
  return false;
}

/** Everything physically attached to the seeds on this side of the line. */
function closure(pieces: Piece[], seeds: Piece[], L: Line | null): Piece[] {
  const inSet = new Set<Piece>(seeds);
  const queue = [...seeds];
  while (queue.length) {
    const p = queue.pop()!;
    for (const q of pieces) {
      if (inSet.has(q)) continue;
      if (joined(p, q, L)) {
        inSet.add(q);
        queue.push(q);
      }
    }
  }
  return pieces.filter((p) => inSet.has(p));
}

export type Layers = 'all' | { flap: string } | { top: number; at?: PointRef } | { bottom: number; at: PointRef };

function layersText(l: Layers | undefined) {
  if (!l || l === 'all') return '';
  if ('flap' in l) return ` (the flap at «${l.flap}»)`;
  if ('bottom' in l) return l.bottom === 1 ? ' (back layer only)' : ` (back ${l.bottom} layers)`;
  return l.top === 1 ? ' (top layer only)' : ` (top ${l.top} layers)`;
}

function selectPieces(s: State, L: Line, sign: 1 | -1, layers: Layers, grab: V2 | null): Piece[] {
  const pieces = piecesOnSide(s, L, sign);
  if (layers === 'all') return pieces;
  let seeds: Piece[];
  if ('flap' in layers) {
    const m = s.marks[layers.flap];
    if (!m) throw new FoldError(`unknown landmark "${layers.flap}"`);
    seeds = pieces.filter((p) => p.face.sheet === m.sheet && containsPaperPt(p.poly, m.p));
    // a landmark on a crease touches several faces: take the top one
    seeds = seeds.sort((a, b) => b.face.z - a.face.z).slice(0, 1);
  } else if ('bottom' in layers) {
    const at = pt(s, layers.at);
    const stack = facesAtWorld(s, at);
    const bot = stack.slice(stack.length - layers.bottom);
    seeds = pieces.filter((p) => bot.includes(p.face));
  } else {
    const at = layers.at ? pt(s, layers.at) : grab;
    if (!at) throw new FoldError('layer selection needs a point');
    const top = facesAtWorld(s, at).slice(0, layers.top);
    seeds = pieces.filter((p) => top.includes(p.face));
  }
  if (!seeds.length) throw new FoldError('nothing to fold on that side');
  return closure(pieces, seeds, L);
}

/**
 * Paper resting on a moving flap goes with it: for a valley fold, anything
 * lying on top of the selection (on the moving side) is carried along; for a
 * mountain fold, anything underneath. Repeats until nothing more is picked up.
 */
function carry(s: State, L: Line, sign: 1 | -1, sel: Piece[], dir: 1 | -1): Piece[] {
  const pieces = piecesOnSide(s, L, sign);
  const keyOf = (p: Piece) => p.face;
  const chosen = new Map(sel.map((p) => [keyOf(p), p]));
  const world = new Map<Piece, V2[]>();
  const wp = (p: Piece) => {
    let w = world.get(p);
    if (!w) {
      w = p.poly.map((q) => {
        const v = apply2(p.face.M, q);
        return [v[0], v[1]] as V2;
      });
      world.set(p, w);
    }
    return w;
  };
  let grew = true;
  while (grew) {
    grew = false;
    const cur = [...chosen.values()];
    for (const q of pieces) {
      if (chosen.has(keyOf(q))) continue;
      const lies = cur.some((p) => dir * (q.face.z - p.face.z) > 0 && overlapArea(wp(p), wp(q)) > 1e-6);
      if (lies) {
        for (const r of closure(pieces, [q], L)) chosen.set(keyOf(r), r);
        grew = true;
      }
    }
  }
  return [...chosen.values()];
}

/** Replace each selected face with its static remainder + moving piece. */
function splitSelected(s: State, sel: Piece[], L: Line): { moving: Face[] } {
  const moving: Face[] = [];
  const bySel = new Map(sel.map((p) => [p.face, p]));
  const next: Face[] = [];
  for (const f of s.faces) {
    const p = bySel.get(f);
    if (!p) {
      next.push(f);
      continue;
    }
    const { pos, neg } = splitPoly(f, f.poly, L);
    const rest = p.sign > 0 ? neg : pos;
    if (rest) next.push({ ...cloneFace(f), poly: rest });
    const mv: Face = { ...cloneFace(f), id: s.nextId++, poly: p.poly };
    next.push(mv);
    moving.push(mv);
  }
  s.faces = next;
  return { moving };
}

/** Axis direction so that points on `sign` side of L rise toward the viewer (lift = +1). */
function axisFor(L: Line, sign: number, lift: number): V3 {
  const k = sign * lift;
  return [L.d[0] * k, L.d[1] * k, 0];
}

function rotateFaces(faces: Face[], L: Line, sign: number, lift: number, angle = PI, back = false) {
  const p = to3(L.p);
  const d = axisFor(L, sign, lift);
  const R = rotation(p, d, angle);
  for (const f of faces) {
    f.path.push({ kind: 'rot', p, d, angle, back });
    if (!back) f.M = compose(R, f.M);
  }
}

function creaseExtent(faces: Face[], L: Line): [V2, V2] | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (const f of faces)
    for (const w of worldPoly2(f)) {
      if (Math.abs(side(L, w)) < 1e-5) {
        const t = dot(sub(w, L.p), L.d);
        lo = Math.min(lo, t);
        hi = Math.max(hi, t);
      }
    }
  if (!isFinite(lo) || hi - lo < 1e-6) return null;
  const pad = (hi - lo) * 0.1 + 4;
  return [add(L.p, mul(L.d, lo - pad)), add(L.p, mul(L.d, hi + pad))];
}

const areaCentroid = (faces: Face[]): V2 => {
  let A = 0;
  let c: V2 = [0, 0];
  for (const f of faces) {
    const w = worldPoly2(f);
    const a = Math.abs(polyArea(w));
    c = add(c, mul(centroid(w), a));
    A += a;
  }
  return A > 0 ? mul(c, 1 / A) : [0, 0];
};

function bowFor(s: State, L: Line, from: V2, to: V2): V3 {
  const b = bounds(s);
  const m = lerp(from, to, 0.5);
  const away = dot(sub(m, [b.cx, b.cy]), L.d) >= 0 ? L.d : mul(L.d, -1);
  return to3(away);
}

/* ---------- valley / mountain / fold-and-unfold ---------- */

export interface FoldOpts {
  layers?: Layers;
  /** stop part-way (degrees, 0–180): the paper is left in 3D */
  angle?: number;
  /** a point on the side that moves (defaults to the brought point) */
  side?: PointRef;
  /** label the moved paper for later selection */
  tag?: string;
}

function foldOp(kind: 'valley' | 'mountain', l: LineSpec, o: FoldOpts = {}, unfold = false): Op {
  const name = unfold
    ? `${kind === 'valley' ? 'Valley' : 'Mountain'}-fold and unfold`
    : kind === 'valley'
      ? 'Valley fold'
      : 'Mountain fold';
  return {
    describe: `${name}: ${l.describe}${layersText(o.layers)}.`,
    apply(s) {
      if (!s.faces.some((f) => isFlat(f.M))) throw new FoldError(`${name} needs flat paper`);
      const L = l.line(s);
      const sidePt = o.side ? pt(s, o.side) : l.bring ? pt(s, l.bring.from) : null;
      if (!sidePt) throw new FoldError(`${name}: which side moves?`);
      const sg = side(L, sidePt);
      if (Math.abs(sg) < 1e-9) throw new FoldError(`${name}: the moving point is on the fold line`);
      const sign: 1 | -1 = sg > 0 ? 1 : -1;
      const target = l.bring ? pt(s, l.bring.to) : null;
      const lift = kind === 'valley' ? 1 : -1;
      const partial = o.angle !== undefined && Math.abs(o.angle - 180) > 1e-9;
      let sel = selectPieces(s, L, sign, o.layers ?? 'all', sidePt);
      if (!partial && (o.layers ?? 'all') !== 'all') sel = carry(s, L, sign, sel, lift);
      const { moving } = splitSelected(s, sel, L);
      const from = l.bring ? sidePt : areaCentroid(moving);
      const ext = creaseExtent(moving, L);
      rotateFaces(moving, L, sign, lift, partial ? ((o.angle as number) * PI) / 180 : PI, unfold);
      if (o.tag && !unfold) for (const f of moving) f.tags.push(o.tag);
      if (partial) {
        const c3 = moving.length ? to3(areaCentroid(moving)) : to3(from);
        s.diagram.push({ kind: 'arrow', from: to3(from), to: to3(reflectPt(L, from)), style: 'lift', bow: [0, 0, lift] });
        if (ext) s.diagram.push({ kind: 'crease', a: to3(ext[0]), b: to3(ext[1]), style: kind });
        void c3;
        s.text.push(this.describe);
        return;
      }
      if (!unfold) {
        const zs = moving.map((f) => f.z);
        const maxM = Math.max(...zs);
        const minM = Math.min(...zs);
        const all = s.faces.map((f) => f.z);
        if (kind === 'valley') {
          const top = Math.max(...all);
          for (const f of moving) f.z = top + 1 + (maxM - f.z);
        } else {
          const bot = Math.min(...all);
          for (const f of moving) f.z = bot - 1 - (f.z - minM);
        }
      }
      // diagram
      if (ext) s.diagram.push({ kind: 'crease', a: to3(ext[0]), b: to3(ext[1]), style: kind });
      const to = reflectPt(L, from);
      s.diagram.push({
        kind: 'arrow',
        from: to3(from),
        to: to3(to),
        style: unfold ? 'unfold' : kind,
        bow: bowFor(s, L, from, to)
      });
      if (l.bring) {
        s.diagram.push({ kind: 'dot', at: to3(sidePt) });
        if (target) s.diagram.push({ kind: 'dot', at: to3(target) });
        if (!unfold && typeof l.bring.from === 'string' && target)
          s.checks.push({ label: `${l.describe} lands`, a: markWorld(s, l.bring.from), b: to3(target) });
      }
      s.text.push(this.describe);
    }
  };
}

export const valley = (l: LineSpec, o?: FoldOpts) => foldOp('valley', l, o);
export const mountain = (l: LineSpec, o?: FoldOpts) => foldOp('mountain', l, o);
export const foldUnfold = (l: LineSpec, o?: FoldOpts & { mountain?: boolean }) =>
  foldOp(o?.mountain ? 'mountain' : 'valley', l, o, true);

/* ---------- turn over / rotate ---------- */

export const turnOver = (): Op => ({
  describe: 'Turn the paper over.',
  apply(s) {
    const b = bounds(s);
    const p: V3 = [b.cx, b.cy, 0];
    const R = rotation(p, [0, 1, 0], PI);
    for (const f of s.faces) {
      f.path.push({ kind: 'rot', p, d: [0, 1, 0], angle: PI });
      f.M = compose(R, f.M);
      f.z = -f.z;
    }
    s.diagram.push({ kind: 'flip', at: [b.cx, b.y1 + b.size * 0.14, 0], width: (b.x1 - b.x0) * 0.32 + b.size * 0.05 });
    s.text.push(this.describe);
  }
});

export const rotate = (deg: number): Op => ({
  describe: `Rotate the paper ${Math.abs(deg)}° ${deg > 0 ? 'clockwise' : 'counter-clockwise'}.`,
  apply(s) {
    const b = bounds(s);
    const p: V3 = [b.cx, b.cy, 0];
    const a = (deg * PI) / 180;
    const R = rotation(p, [0, 0, 1], a);
    for (const f of s.faces) {
      f.path.push({ kind: 'rot', p, d: [0, 0, 1], angle: a });
      f.M = compose(R, f.M);
    }
    s.diagram.push({ kind: 'rotate', at: p, r: b.size * 0.62, deg });
    s.text.push(this.describe);
  }
});

/* ---------- reverse folds ---------- */

export function reverseFold(l: LineSpec, o: { flap: string; outside?: boolean }): Op {
  const name = o.outside ? 'Outside reverse fold' : 'Inside reverse fold';
  return {
    describe: `${name}: ${l.describe} (the flap at «${o.flap}»).`,
    apply(s) {
      requireFlat(s.faces, name);
      const L = l.line(s);
      const m = markWorld(s, o.flap);
      const sg = side(L, [m[0], m[1]]);
      if (Math.abs(sg) < 1e-9) throw new FoldError(`${name}: flap point is on the line`);
      const sign: 1 | -1 = sg > 0 ? 1 : -1;
      const sel = selectPieces(s, L, sign, { flap: o.flap }, null);
      const { moving } = splitSelected(s, sel, L);
      const zs = [...new Set(moving.map((f) => f.z))].sort((a, b) => a - b);
      if (zs.length < 2) throw new FoldError(`${name}: the flap needs at least two layers`);
      const k = Math.floor(zs.length / 2);
      const lo = zs[k - 1];
      const hi = zs[k];
      const mid = (lo + hi) / 2;
      const front = moving.filter((f) => f.z > mid);
      const back = moving.filter((f) => f.z < mid);
      const ext = creaseExtent(moving, L);
      const c0 = areaCentroid(moving);
      // front half swings behind, back half swings forward (inside), or the reverse (outside)
      rotateFaces(front, L, sign, o.outside ? 1 : -1);
      rotateFaces(back, L, sign, o.outside ? -1 : 1);
      const zmax = Math.max(...s.faces.map((f) => f.z));
      const zmin = Math.min(...s.faces.map((f) => f.z));
      if (!o.outside) {
        // Tips tuck into the middle of the paper where they land (between the
        // front and back halves there), nesting like stacked tacos: the outermost
        // layer's tip goes deepest, so within each half the tips run in reverse.
        const movingSet = new Set(moving);
        const landed = moving.map((f) => worldPoly2(f));
        const under = s.faces
          .filter((g) => !movingSet.has(g) && g.z > lo && g.z < hi)
          .filter((g) => {
            const w = worldPoly2(g);
            return landed.some((p) => overlapArea(p, w) > 1e-6);
          })
          .map((g) => g.z)
          .sort((a, b) => a - b);
        const fz = new Map(front.map((f) => [f, f.z]));
        const bz = new Map(back.map((f) => [f, f.z]));
        const fTop = Math.max(...fz.values());
        const fBot = Math.min(...fz.values());
        const bTop = Math.max(...bz.values());
        const bBot = Math.min(...bz.values());
        const place = (k: number) => {
          const gLo = k > 0 ? under[k - 1] : lo;
          const gHi = k < under.length ? under[k] : hi;
          const gap = gHi - gLo;
          const midG = (gLo + gHi) / 2;
          for (const f of back) f.z = gLo + gap * (0.05 + (0.4 * (bTop - bz.get(f)!)) / (bTop - bBot + 1));
          for (const f of front) f.z = midG + gap * (0.05 + (0.4 * (fTop - fz.get(f)!)) / (fTop - fBot + 1));
        };
        // try slots nearest the middle first; keep the first the layer rules accept
        const slots = [...Array(under.length + 1).keys()].sort(
          (a, b) => Math.abs(a - under.length / 2) - Math.abs(b - under.length / 2)
        );
        const ok = slots.find((k) => {
          place(k);
          return layerProblems(s).length === 0;
        });
        place(ok ?? slots[0]);
      } else {
        for (const f of moving) f.z = f.z > mid ? zmax + 1 + (zmax - f.z) : zmin - 1 - (f.z - zmin);
      }
      if (ext) s.diagram.push({ kind: 'crease', a: to3(ext[0]), b: to3(ext[1]), style: o.outside ? 'valley' : 'mountain' });
      const c1 = reflectPt(L, c0);
      s.diagram.push({ kind: 'arrow', from: to3(c0), to: to3(c1), style: 'push', bow: bowFor(s, L, c0, c1) });
      s.text.push(this.describe);
    }
  };
}

/* ---------- squash ---------- */

/** Paper edges where faces of group A meet faces of group B, in world space. */
function seams(a: Face[], b: Face[]): [V2, V2][] {
  const out: [V2, V2][] = [];
  for (const f of a)
    for (const g of b) {
      if (f.sheet !== g.sheet) continue;
      for (let i = 0; i < f.poly.length; i++)
        for (let j = 0; j < g.poly.length; j++) {
          const ov = collinearOverlap(
            f.poly[i],
            f.poly[(i + 1) % f.poly.length],
            g.poly[j],
            g.poly[(j + 1) % g.poly.length]
          );
          if (ov) {
            const w0 = apply2(f.M, ov[0]);
            const w1 = apply2(f.M, ov[1]);
            out.push([[w0[0], w0[1]], [w1[0], w1[1]]]);
          }
        }
    }
  return out;
}

const facing = (f: Face) => frontNormal(f.M)[2] > 0;

function splitFacesBy(s: State, faces: Face[], L: Line): Face[] {
  const out: Face[] = [];
  const set = new Set(faces);
  const next: Face[] = [];
  for (const f of s.faces) {
    if (!set.has(f)) {
      next.push(f);
      continue;
    }
    const { pos, neg } = splitPoly(f, f.poly, L);
    if (pos && neg) {
      const a = { ...cloneFace(f), poly: pos };
      const b = { ...cloneFace(f), id: s.nextId++, poly: neg };
      next.push(a, b);
      out.push(a, b);
    } else {
      next.push(f);
      out.push(f);
    }
  }
  s.faces = next;
  return out;
}

const sideOfFace = (f: Face, L: Line) => side(L, centroid(worldPoly2(f)));

export function squash(o: { flap: string; hinge: LineSpec }): Op {
  return {
    describe: `Squash fold: open the flap at «${o.flap}» and flatten it, centred on ${o.hinge.describe}.`,
    apply(s) {
      requireFlat(s.faces, 'Squash');
      const H = o.hinge.line(s);
      const m = markWorld(s, o.flap);
      const sign: 1 | -1 = side(H, [m[0], m[1]]) > 0 ? 1 : -1;
      const sel = selectPieces(s, H, sign, { flap: o.flap }, null);
      let { moving } = splitSelected(s, sel, H);
      const topFace = moving.reduce((a, b) => (b.z > a.z ? b : a));
      const t = moving.filter((f) => facing(f) === facing(topFace));
      const u = moving.filter((f) => facing(f) !== facing(topFace));
      if (!t.length || !u.length) throw new FoldError('Squash: the flap must be two layers joined at a fold');
      // spine = where t meets u; hinge = where the flap meets the rest
      const spine = seams(t, u);
      if (!spine.length) throw new FoldError('Squash: could not find the flap’s folded edge');
      const S0 = spine.reduce((a, b) => (dist(b[0], b[1]) > dist(a[0], a[1]) ? b : a));
      const spineLine: Line = { p: S0[0], d: norm(sub(S0[1], S0[0])) };
      const apex = intersectLines(spineLine, H);
      if (!apex) throw new FoldError('Squash: folded edge is parallel to the hinge');
      const far = (seg: [V2, V2]) => (dist(seg[0], apex) > dist(seg[1], apex) ? seg[0] : seg[1]);
      const spineDir = norm(sub(far(S0), apex));
      // hinge ray points toward the flap's mass along H
      const cm = areaCentroid(moving);
      const hingeDir = dot(sub(cm, apex), H.d) >= 0 ? H.d : mul(H.d, -1);
      const S: Line = { p: apex, d: norm(add(spineDir, hingeDir)) };
      const spinePt = add(apex, spineDir);
      const spineSide = side(S, spinePt) > 0 ? 1 : -1;
      const parts = splitFacesBy(s, moving, S);
      moving = parts;
      const tSet = new Set(t);
      const isT = (f: Face) => facing(f) === facing(topFace);
      const ta = moving.filter((f) => isT(f) && Math.sign(sideOfFace(f, S)) === spineSide);
      const tb = moving.filter((f) => isT(f) && Math.sign(sideOfFace(f, S)) !== spineSide);
      const ua = moving.filter((f) => !isT(f) && Math.sign(sideOfFace(f, S)) === spineSide);
      const ub = moving.filter((f) => !isT(f) && Math.sign(sideOfFace(f, S)) !== spineSide);
      void tSet;
      // The flap stands up about the hinge, so its top layer (t) ends up facing
      // across the hinge and swings over; the lower layer (u) stays. Each
      // layer's spine-side half folds over along S so the spine meets the hinge.
      void ub;
      const c0 = areaCentroid(ta);
      rotateFaces(ta, S, spineSide, 1);
      rotateFaces(ua, S, spineSide, 1);
      rotateFaces(tb, H, sign, 1);
      rotateFaces(ta, H, sign, 1);
      const top = Math.max(...s.faces.map((f) => f.z));
      for (const f of tb) f.z = top + 1 + f.z / 1e6;
      for (const f of ta) f.z = top + 2 + f.z / 1e6;
      for (const f of ua) f.z = top + 3 + f.z / 1e6;
      const ext = creaseExtent([...ua, ...ub], S);
      if (ext) s.diagram.push({ kind: 'crease', a: to3(ext[0]), b: to3(ext[1]), style: 'valley' });
      const c1 = reflectPt(S, c0);
      s.diagram.push({ kind: 'arrow', from: to3(c0), to: to3(c1), style: 'push', bow: bowFor(s, S, c0, c1) });
      // check: the folded edge now lies on the hinge line
      const spineFar = far(S0);
      const landed = reflectPt(S, spineFar);
      const onH = add(H.p, mul(H.d, dot(sub(landed, H.p), H.d)));
      s.checks.push({ label: 'squash: folded edge lands on the hinge', a: to3(landed), b: to3(onH) });
      s.text.push(this.describe);
    }
  };
}

/* ---------- petal ---------- */

/**
 * A flap as paper sees it: the top layer (flat-connected to the seed) plus the
 * layer it wraps into across its folded edges (and that layer's flat neighbours).
 */
function twoLayers(s: State, L: Line, sign: 1 | -1, seedMark: string): { front: Piece[]; second: Piece[] } {
  const pieces = piecesOnSide(s, L, sign);
  const m = s.marks[seedMark];
  const seed = pieces
    .filter((p) => p.face.sheet === m.sheet && containsPaperPt(p.poly, m.p))
    .sort((a, b) => b.face.z - a.face.z)[0];
  if (!seed) throw new FoldError(`nothing at «${seedMark}» on that side`);
  const grow = (start: Piece[], ok: (p: Piece) => boolean) => {
    const set = new Set(start);
    const q = [...start];
    while (q.length) {
      const p = q.pop()!;
      for (const r of pieces)
        if (!set.has(r) && ok(r) && facing(r.face) === facing(p.face) && joined(p, r, L)) {
          set.add(r);
          q.push(r);
        }
    }
    return [...set];
  };
  const front = grow([seed], () => true);
  const fs = new Set(front);
  const wraps = pieces.filter(
    (r) => !fs.has(r) && facing(r.face) !== facing(seed.face) && front.some((p) => joined(p, r, L))
  );
  const second = grow(wraps, (r) => !fs.has(r));
  return { front, second };
}

export function petal(o: { flap: string; hinge: LineSpec; left: LineSpec; right: LineSpec }): Op {
  return {
    describe: `Petal fold: lift «${o.flap}» up along ${o.hinge.describe}, letting the sides fold in.`,
    apply(s) {
      requireFlat(s.faces, 'Petal fold');
      const H = o.hinge.line(s);
      const KL = o.left.line(s);
      const KR = o.right.line(s);
      const m = markWorld(s, o.flap);
      const m2: V2 = [m[0], m[1]];
      const sign: 1 | -1 = side(H, m2) > 0 ? 1 : -1;
      const { front: fp, second: sp } = twoLayers(s, H, sign, o.flap);
      if (!sp.length) throw new FoldError('Petal fold: the flap needs a second layer');
      let { moving } = splitSelected(s, [...fp, ...sp], H);
      const topFace = moving.reduce((a, b) => (b.z > a.z ? b : a));
      moving = splitFacesBy(s, moving, KL);
      moving = splitFacesBy(s, moving, KR);
      const a = intersectLines(KL, H);
      const b = intersectLines(KR, H);
      if (!a || !b) throw new FoldError('Petal fold: side creases must meet the hinge');
      const centre = lerp(a, b, 0.5);
      const cL = Math.sign(side(KL, centre));
      const cR = Math.sign(side(KR, centre));
      const front = (f: Face) => facing(f) === facing(topFace);
      const region = (f: Face) => {
        const sl = Math.sign(sideOfFace(f, KL));
        const sr = Math.sign(sideOfFace(f, KR));
        if (sl !== cL) return 'L';
        if (sr !== cR) return 'R';
        return 'C';
      };
      const fC = moving.filter((f) => front(f) && region(f) === 'C');
      const fL = moving.filter((f) => front(f) && region(f) === 'L');
      const fR = moving.filter((f) => front(f) && region(f) === 'R');
      const bL = moving.filter((f) => !front(f) && region(f) === 'L');
      const bR = moving.filter((f) => !front(f) && region(f) === 'R');
      rotateFaces(fL, KL, -cL, 1);
      rotateFaces(fR, KR, -cR, 1);
      rotateFaces(bL, KL, -cL, 1);
      rotateFaces(bR, KR, -cR, 1);
      rotateFaces([...fC, ...fL, ...fR], H, sign, 1);
      const top = Math.max(...s.faces.map((f) => f.z));
      // second-layer sides tuck in just beneath the second layer's centre
      const bC = moving.filter((f) => !front(f) && region(f) === 'C');
      const zc = bC.length ? Math.min(...bC.map((f) => f.z)) : top + 1;
      for (const f of [...bL, ...bR]) f.z = zc - 0.5 + f.z / 1e6;
      for (const f of [...fL, ...fR]) f.z = top + 2 + f.z / 1e6;
      for (const f of fC) f.z = top + 3 + f.z / 1e6;
      const ext = creaseExtent(fC, H);
      if (ext) s.diagram.push({ kind: 'crease', a: to3(ext[0]), b: to3(ext[1]), style: 'valley' });
      for (const K of [KL, KR]) {
        const e = creaseExtent([...fL, ...fR, ...fC], K);
        if (e) s.diagram.push({ kind: 'crease', a: to3(e[0]), b: to3(e[1]), style: 'mountain' });
      }
      const to = reflectPt(H, m2);
      s.diagram.push({ kind: 'arrow', from: to3(m2), to: to3(to), style: 'valley', bow: bowFor(s, H, m2, to) });
      s.checks.push({ label: 'petal: tip lands across the hinge', a: markWorld(s, o.flap), b: to3(to) });
      s.text.push(this.describe);
    }
  };
}

/* ---------- 3D shaping ---------- */

export interface ShapeOpts {
  /** faces carrying any of these tags move */
  tags?: string[];
  /** …unless they carry one of these */
  except?: string[];
  /** …and they also carry every one of these */
  all?: string[];
  /** faces whose centre lies on the side of `line` that holds `side` move */
  region?: { line: [string | PointRef, string | PointRef]; side: string | PointRef };
  /** two points on the hinge (landmarks, or 2D points while the paper is still flat) */
  hinge: [string | PointRef, string | PointRef];
  /** degrees; positive swings toward the viewer */
  angle: number;
  /** apply to every copy of a modular sheet (landmarks suffixed #k) */
  perSheet?: boolean;
  label?: string;
}

function point3(s: State, r: string | PointRef, suffix: string): V3 {
  if (typeof r === 'string') return markWorld(s, r + suffix);
  const p = pt(s, r);
  return [p[0], p[1], 0];
}

export function shape(o: ShapeOpts): Op {
  return {
    describe: o.label ?? `Shape: swing the paper ${Math.abs(o.angle)}° about the crease.`,
    apply(s) {
      const sheets = o.perSheet ? s.sheets.map((sh) => sh.id) : [null];
      for (const sh of sheets) {
        const suffix = sh ? `#${sh}` : '';
        const A = point3(s, o.hinge[0], suffix);
        const B = point3(s, o.hinge[1], suffix);
        let regionTest: ((f: Face) => boolean) | null = null;
        if (o.region) {
          const r0 = point3(s, o.region.line[0], suffix);
          const r1 = point3(s, o.region.line[1], suffix);
          const sp = point3(s, o.region.side, suffix);
          const L: Line = { p: [r0[0], r0[1]], d: norm([r1[0] - r0[0], r1[1] - r0[1]]) };
          const want = Math.sign(side(L, [sp[0], sp[1]]));
          regionTest = (f) => {
            const c = apply2(f.M, centroid(f.poly));
            return Math.sign(side(L, [c[0], c[1]])) === want;
          };
        }
        const sel = s.faces.filter(
          (f) =>
            (sh === null || f.sheet === sh) &&
            (!o.tags || f.tags.some((t) => o.tags!.includes(t))) &&
            !f.tags.some((t) => o.except?.includes(t)) &&
            (!o.all || o.all.every((t) => f.tags.includes(t))) &&
            (!regionTest || regionTest(f))
        );
        if (!sel.length) throw new FoldError('Shape: nothing selected');
        let d = norm3(sub3(B, A));
        const a = (o.angle * PI) / 180;
        // choose the axis sense so a positive angle swings the selection toward +z
        const c = areaCentroid3(sel);
        const test = apply(rotation(A, d, 0.05), c);
        if ((test[2] - c[2]) * Math.sign(o.angle) < 0) d = [-d[0], -d[1], -d[2]];
        const R = rotation(A, d, Math.abs(a));
        for (const f of sel) {
          f.path.push({ kind: 'rot', p: A, d, angle: Math.abs(a) });
          f.M = compose(R, f.M);
        }
        const c1 = apply(R, c);
        s.diagram.push({ kind: 'arrow', from: c, to: c1, style: 'lift', bow: [0, 0, 1] });
      }
      s.text.push(this.describe);
    }
  };
}

function areaCentroid3(faces: Face[]): V3 {
  let A = 0;
  let c: V3 = [0, 0, 0];
  for (const f of faces) {
    const a = Math.abs(polyArea(f.poly));
    const w = apply2(f.M, centroid(f.poly));
    c = [c[0] + w[0] * a, c[1] + w[1] * a, c[2] + w[2] * a];
    A += a;
  }
  return [c[0] / A, c[1] / A, c[2] / A];
}

/* ---------- decorations & camera ---------- */

export const drawEye = (mark: string): Op => ({
  describe: 'Draw an eye.',
  apply(s) {
    s.decorations.push({ kind: 'eye', mark });
    s.diagram.push({ kind: 'dot', at: markWorld(s, mark) });
    s.text.push(this.describe);
  }
});

export const view = (v: { tilt?: number; turn?: number }): Op => ({
  describe: '',
  apply(s) {
    s.view = { tilt: v.tilt ?? s.view.tilt, turn: v.turn ?? s.view.turn };
  }
});

/** Use this sentence for the whole step instead of the generated ones. */
export const say = (text: string): Op & { said: true } => ({
  said: true,
  describe: text,
  apply(s) {
    s.text.push(text);
  }
});

/* ---------- modular: copies & assembly ---------- */

export function copies(n: number, o: { cols?: number; gap?: number } = {}): Op {
  return {
    describe: `Fold ${n} identical units.`,
    apply(s) {
      const b = bounds(s);
      const cols = o.cols ?? 3;
      const gap = o.gap ?? b.size * 0.25;
      const w = b.x1 - b.x0 + gap;
      const h = b.y1 - b.y0 + gap;
      const base = s.faces.filter((f) => f.sheet === 0);
      const baseMarks = Object.entries(s.marks).filter(([, m]) => m.sheet === 0);
      const sheet0 = s.sheets[0];
      for (let k = 1; k < n; k++) {
        const shift: V3 = [(k % cols) * w, Math.floor(k / cols) * h, 0];
        s.sheets.push({ id: k, outline: sheet0.outline.map((p) => [...p] as V2), area: sheet0.area });
        for (const f of base) {
          const g = cloneFace(f);
          g.id = s.nextId++;
          g.sheet = k;
          g.M = { R: f.M.R, t: [f.M.t[0] + shift[0], f.M.t[1] + shift[1], f.M.t[2]] };
          g.start = f.M;
          g.path = [{ kind: 'rigid', p: [0, 0, 0], d: [0, 0, 1], angle: 0, shift }];
          s.faces.push(g);
        }
        for (const [name, m] of baseMarks) s.marks[`${name}#${k}`] = { sheet: k, p: m.p };
      }
      const nb = bounds(s);
      s.diagram.push({ kind: 'repeat', at: [nb.x1, nb.y0, 0], n });
      s.text.push(this.describe);
    }
  };
}

/** Axis-angle of a proper rotation matrix. */
function axisAngle(R: Xf['R']): { d: V3; angle: number } {
  const tr = R[0] + R[4] + R[8];
  const angle = Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2)));
  if (angle < 1e-9) return { d: [0, 0, 1], angle: 0 };
  if (Math.abs(angle - PI) < 1e-6) {
    // symmetric: R = 2nnᵀ − I
    const xx = Math.sqrt(Math.max(0, (R[0] + 1) / 2));
    const yy = Math.sqrt(Math.max(0, (R[4] + 1) / 2));
    const zz = Math.sqrt(Math.max(0, (R[8] + 1) / 2));
    let d: V3;
    if (xx >= yy && xx >= zz) d = [xx, R[1] / (2 * xx), R[2] / (2 * xx)];
    else if (yy >= zz) d = [R[1] / (2 * yy), yy, R[5] / (2 * yy)];
    else d = [R[2] / (2 * zz), R[5] / (2 * zz), zz];
    return { d: norm3(d), angle };
  }
  const d: V3 = [R[7] - R[5], R[2] - R[6], R[3] - R[1]];
  return { d: norm3(d), angle };
}

/**
 * Move whole sheets rigidly to final placements (modular assembly).
 * `frames[k]` maps sheet k (centred on its own middle) into the world.
 */
export function assemble(frames: Xf[], label: string, centreMark = 'O'): Op {
  return {
    describe: label,
    apply(s) {
      for (const sh of s.sheets) {
        const G = frames[sh.id];
        if (!G) continue;
        const faces = s.faces.filter((f) => f.sheet === sh.id);
        // each unit is placed by its own middle landmark
        const c = markWorld(s, sh.id ? `${centreMark}#${sh.id}` : centreMark);
        const centre: Xf = { R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [-c[0], -c[1], -c[2]] };
        const D = compose(G, centre); // world → world
        if (det(D) < 0) throw new FoldError('assemble: placements must be proper rotations');
        const { d, angle } = axisAngle(D.R);
        for (const f of faces) {
          f.path.push({ kind: 'rigid', p: [0, 0, 0], d, angle, shift: D.t });
          f.M = compose(D, f.M);
        }
      }
      s.text.push(this.describe);
    }
  };
}

export { invert, len, perp };
