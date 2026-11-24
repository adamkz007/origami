import { describe, expect, it } from 'vitest';
import { folded } from '$lib/models';
import { camera, frameAt, motionT, restFrame, T_MOVE, T_SHOW } from './render';
import { apply } from './geom';

const fish = folded('fish', true);

describe('render', () => {
  it('timing: diagram first, then motion, then rest', () => {
    expect(motionT(0)).toBe(0);
    expect(motionT(T_SHOW)).toBe(0);
    expect(motionT(T_MOVE)).toBe(1);
    expect(motionT(1)).toBe(1);
  });

  it('draws the fold diagram before the paper moves and hides it at rest', () => {
    const f = frameAt(fish.steps[0], T_SHOW);
    expect(f.overlay.creases.length).toBeGreaterThan(0);
    expect(f.overlay.arrows.length).toBeGreaterThan(0);
    expect(f.overlay.draw).toBe(1);
    expect(restFrame(fish.steps[0]).overlay.arrows).toHaveLength(0);
  });

  it('a step’s first frame is the previous step’s last frame', () => {
    for (let i = 1; i < fish.steps.length; i++) {
      const a = restFrame(fish.steps[i - 1]).polys.flatMap((p) => p.pts).map((q) => q.map((v) => v.toFixed(6)).join(',')).sort();
      const b = frameAt(fish.steps[i], 0, { overlay: false, t: 0 }).polys.flatMap((p) => p.pts).map((q) => q.map((v) => v.toFixed(6)).join(',')).sort();
      // splitting adds vertices along edges, but every earlier corner is still there
      const bs = new Set(b);
      for (const q of a) expect(bs.has(q)).toBe(true);
    }
  });

  it('shows the green front and white back on the right faces', () => {
    const first = frameAt(fish.steps[0], 0, { overlay: false, t: 0 });
    expect(first.polys.every((p) => p.side === 1)).toBe(true); // fish starts white side up
    const done = restFrame(fish.steps.at(-1)!);
    expect(done.polys.some((p) => p.side === 0)).toBe(true);
    expect(done.eyes).toHaveLength(1);
  });

  it('camera tilt foreshortens and turns', () => {
    const p = apply(camera({ tilt: 60, turn: 0 }), [0, -10, 0]);
    expect(p[1]).toBeCloseTo(-5, 9);
    expect(p[2]).toBeLessThan(0);
  });
});
