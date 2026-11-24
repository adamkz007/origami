import { describe, expect, it } from 'vitest';
import { dot, intersectLines, reflectPt, side, sub, type V2 } from './geom';
import { square } from './model';
import { along, atAngle, bisect, bring, bringOntoSquareTo, meet, mid, nameOf, parallel, perpendicular, pt, through, throughBringing } from './refs';
import { newState } from './sheet';

const paper = square(200);
const s = newState(paper.outline, true, paper.marks);
const P = (r: Parameters<typeof pt>[1]) => pt(s, r);
const near = (a: V2, b: V2, d = 9) => {
  expect(a[0]).toBeCloseTo(b[0], d);
  expect(a[1]).toBeCloseTo(b[1], d);
};

describe('reference constructions (Huzita–Hatori)', () => {
  it('axiom 1: through two points', () => {
    const L = through('TL', 'BR').line(s);
    expect(Math.abs(side(L, P('O')))).toBeLessThan(1e-12);
  });

  it('axiom 2: bring a point onto a point (perpendicular bisector)', () => {
    const L = bring('TL').to('BR').line(s);
    near(reflectPt(L, P('TL')), P('BR'));
  });

  it('axiom 3: lay one line onto another (angle bisector, chosen side)', () => {
    const L = bisect(through('BL', 'TL'), through('BL', 'TR'), 'mL').line(s);
    // 22.5° from the left edge: reflecting the edge direction lands on the diagonal
    const edgeDir = sub(P('TL'), P('BL'));
    const img = sub(reflectPt(L, P('TL')), P('BL'));
    const diag = sub(P('TR'), P('BL'));
    const cos = (a: V2, b: V2) => dot(a, b) / Math.hypot(...a) / Math.hypot(...b);
    expect(cos(img, diag)).toBeCloseTo(1, 9);
    expect(cos(edgeDir, L.d)).toBeCloseTo(Math.cos(Math.PI / 8), 9);
  });

  it('axiom 4 and parallels', () => {
    const base = through('BL', 'BR');
    const p4 = perpendicular(base, 'O').line(s);
    expect(dot(p4.d, base.line(s).d)).toBeCloseTo(0, 12);
    const par = parallel(base, 'O').line(s);
    expect(Math.abs(dot(par.d, base.line(s).d))).toBeCloseTo(1, 12);
  });

  it('axiom 5: through p, bring q onto a line', () => {
    const spec = throughBringing('mL', 'TR', through('BL', 'BR'), 'BR');
    const L = spec.line(s);
    const land = reflectPt(L, P('TR'));
    // TR lands on the bottom edge (at BR), and the line passes through mL
    near(land, [100, 100]);
    expect(Math.abs(side(L, P('mL')))).toBeLessThan(1e-9);
    near(P(spec.bring!.to), [100, 100]);
  });

  it('axiom 7: bring p onto l1, square to l2', () => {
    const l2 = through('TL', 'TR');
    const L = bringOntoSquareTo('BL', through('O', 'TR'), l2).line(s);
    const land = reflectPt(L, P('BL'));
    expect(Math.abs(side(through('O', 'TR').line(s), land))).toBeLessThan(1e-9);
    expect(dot(L.d, l2.line(s).d)).toBeCloseTo(0, 12);
  });

  it('points: midpoints, fractions, intersections, angles', () => {
    near(P(mid('TL', 'TR')), [0, -100]);
    near(P(along('BL', 'BR', 0.25)), [-50, 100]);
    near(P(meet(through('TL', 'BR'), through('TR', 'BL'))), [0, 0]);
    const L = atAngle('O', 30).line(s);
    expect(Math.atan2(L.d[1], L.d[0])).toBeCloseTo(Math.PI / 6, 12);
    expect(intersectLines(L, through('BL', 'BR').line(s))).not.toBeNull();
    expect(nameOf(along('BL', 'BR', 0.25))).toContain('1/4 of the way');
  });
});
