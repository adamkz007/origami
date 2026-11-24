import { describe, expect, it } from 'vitest';
import { apply2, centroid, dist3, insideConvex, isFlat } from '$lib/paper/geom';
import { fitStep, frameAt, placeAt, restFrame } from '$lib/paper/render';
import { folded, models } from './index';

describe('catalogue', () => {
  it('is ordered simple → hard and slugs are unique', () => {
    const levels = models.map((m) => m.level);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    expect(new Set(models.map((m) => m.slug)).size).toBe(models.length);
    expect(models.map((m) => m.slug)).toEqual(['fish', 'boat', 'penguin', 'butterfly', 'crane', 'lotus', 'sonobe']);
  });
});

describe.each(models.map((m) => m.slug))('%s', (slug) => {
  const c = folded(slug, true); // throws on any physical problem in any step

  it('every step is physically valid and every step has words', () => {
    expect(c.steps.length).toBeGreaterThan(2);
    for (const st of c.steps) {
      expect(st.text.length).toBeGreaterThan(8);
      expect(st.text).not.toMatch(/«|»|undefined|NaN/);
    }
  });

  it('each step starts exactly where the previous one ended', () => {
    for (let i = 1; i < c.steps.length; i++) {
      expect(c.steps[i].before).toBe(c.steps[i - 1].after);
      const prev = c.steps[i - 1].pieces;
      for (const p of c.steps[i].pieces) {
        const q = centroid(p.poly);
        const src = prev.find((o) => o.sheet === p.sheet && insideConvex(o.poly, q, -1e-7));
        if (!src) continue; // new sheets appear in modular steps
        expect(dist3(apply2(p.start, q), apply2(src.end, q))).toBeLessThan(1e-6);
      }
    }
  });

  it('motion starts at the before-state and ends at the after-state', () => {
    for (const st of c.steps) {
      for (const p of st.pieces) {
        const back = p.path.some((e) => e.kind === 'rot' && e.back);
        expect(placeAt(p, 0)).toBe(p.start);
        const end = placeAt(p, 1 - 1e-12);
        const q = centroid(p.poly);
        if (!back) expect(dist3(apply2(end, q), apply2(p.end, q))).toBeLessThan(1e-6);
      }
    }
  });

  it('frames are finite throughout every step', () => {
    for (const st of c.steps)
      for (const u of [0, 0.2, 0.4, 0.55, 0.7, 0.86, 1]) {
        const f = frameAt(st, u);
        for (const p of f.polys) for (const q of p.pts) expect(Number.isFinite(q[0]) && Number.isFinite(q[1])).toBe(true);
      }
  });

  it('single-hinge folds stay in one piece mid-motion (before welding)', () => {
    for (const st of c.steps) {
      const axes = new Set(st.pieces.flatMap((p) => p.path.map((e) => `${e.p.map((v) => v.toFixed(6))}|${e.d.map((v) => v.toFixed(6))}`)));
      const simple = st.pieces.every((p) => p.path.length <= 1) && axes.size <= 1;
      if (!simple) continue;
      const pos = new Map<string, number[]>();
      for (const p of st.pieces) {
        const M = placeAt(p, 0.43);
        for (const q of p.poly) {
          const k = `${p.sheet}:${q.map((v) => Math.round(v * 1e4)).join(',')}`;
          const w = apply2(M, q);
          const seen = pos.get(k);
          if (seen) expect(dist3(seen as never, w)).toBeLessThan(1e-6);
          else pos.set(k, w);
        }
      }
    }
  });

  it('the finished model frames inside its view box', () => {
    const lastStep = c.steps[c.steps.length - 1];
    const f = restFrame(lastStep);
    const vb = fitStep(lastStep, 0.12, false);
    for (const p of f.polys)
      for (const [x, y] of p.pts) {
        expect(x).toBeGreaterThanOrEqual(vb.x - 1e-6);
        expect(y).toBeGreaterThanOrEqual(vb.y - 1e-6);
        expect(x).toBeLessThanOrEqual(vb.x + vb.w + 1e-6);
        expect(y).toBeLessThanOrEqual(vb.y + vb.h + 1e-6);
      }
  });

  it('flat steps stay flat until the shaping step', () => {
    const firstShaped = c.steps.findIndex((st) => !st.after.faces.every((f) => isFlat(f.M)));
    const flatAfter = firstShaped < 0 ? c.steps : c.steps.slice(0, firstShaped);
    for (const st of flatAfter) expect(st.after.faces.every((f) => isFlat(f.M))).toBe(true);
  });
});
