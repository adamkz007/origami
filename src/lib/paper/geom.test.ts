import { describe, expect, it } from 'vitest';
import {
  apply,
  apply2,
  clipHalf,
  collinearOverlap,
  compose,
  det,
  intersectConvex,
  intersectLines,
  invert,
  isFlat,
  lineThrough,
  orthoError,
  overlapArea,
  reflectPt,
  rotation,
  absArea,
  type V2
} from './geom';

const sq: V2[] = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10]
];

describe('geometry kernel', () => {
  it('a half-turn about an in-plane line is a reflection across it', () => {
    const L = lineThrough([0, 0], [1, 1]);
    const R = rotation([0, 0, 0], [Math.SQRT1_2, Math.SQRT1_2, 0], Math.PI);
    for (const p of [[3, -2], [5, 7], [-4, 1]] as V2[]) {
      const w = apply2(R, p);
      const r = reflectPt(L, p);
      expect(w[0]).toBeCloseTo(r[0], 12);
      expect(w[1]).toBeCloseTo(r[1], 12);
      expect(w[2]).toBeCloseTo(0, 12);
    }
    expect(isFlat(R)).toBe(true);
  });

  it('rotations stay rigid and compose/invert exactly', () => {
    const A = rotation([1, 2, 0], [0.3, -0.4, 0.5], 1.1);
    const B = rotation([-3, 0, 2], [0, 1, 0], -0.7);
    const C = compose(A, B);
    expect(orthoError(C)).toBeLessThan(1e-12);
    expect(det(C)).toBeCloseTo(1, 12);
    const I = compose(C, invert(C));
    const p = apply(I, [4, -5, 6]);
    expect(p[0]).toBeCloseTo(4, 10);
    expect(p[1]).toBeCloseTo(-5, 10);
    expect(p[2]).toBeCloseTo(6, 10);
  });

  it('clips convex polygons and measures overlap', () => {
    const half = clipHalf(sq, lineThrough([5, -1], [5, 11]), 1);
    expect(absArea(half)).toBeCloseTo(50, 9);
    const other: V2[] = [
      [5, 5],
      [15, 5],
      [15, 15],
      [5, 15]
    ];
    expect(absArea(intersectConvex(sq, other))).toBeCloseTo(25, 9);
    expect(overlapArea(sq, [[20, 20], [30, 20], [30, 30]])).toBe(0);
  });

  it('finds collinear overlaps and line intersections', () => {
    const ov = collinearOverlap([0, 0], [10, 0], [4, 0], [20, 0])!;
    expect(ov[0][0]).toBeCloseTo(4);
    expect(ov[1][0]).toBeCloseTo(10);
    expect(collinearOverlap([0, 0], [10, 0], [0, 1], [10, 1])).toBeNull();
    const x = intersectLines(lineThrough([0, 0], [1, 1]), lineThrough([0, 4], [4, 0]))!;
    expect(x[0]).toBeCloseTo(2);
    expect(x[1]).toBeCloseTo(2);
  });
});
