import { describe, expect, it } from 'vitest';
import { compile, square, type ModelDef } from './model';
import { valley, type Op } from './ops';
import { bring } from './refs';
import { cloneState, type Face, type State } from './sheet';
import { validate, vertexProblems } from './validate';
import { folded } from '$lib/models';

const run = (steps: (Op | Op[])[], validateIt = true) =>
  compile({ slug: 't', name: 't', level: 1, minutes: 1, paper: square(200, 'front'), steps } as ModelDef, { validate: validateIt });

const rules = (s: State) => new Set(validate(s).map((p) => p.rule));

describe('validation catches impossible paper', () => {
  const good = run([valley(bring('mT').to('mB'))]).steps[0].after;

  it('accepts a real fold', () => expect(validate(good)).toEqual([]));

  it('detects a tear', () => {
    const s = cloneState(good);
    s.faces[0].M = { ...s.faces[0].M, t: [s.faces[0].M.t[0] + 3, s.faces[0].M.t[1], 0] };
    expect(rules(s)).toContain('tear');
  });

  it('detects stretching', () => {
    const s = cloneState(good);
    const R = [...s.faces[0].M.R] as Face['M']['R'];
    R[0] *= 1.01;
    s.faces[0].M = { ...s.faces[0].M, R };
    expect(rules(s)).toContain('rigid');
  });

  it('detects missing or overlapping paper', () => {
    const s = cloneState(good);
    s.faces.pop();
    expect(rules(s)).toContain('area');
    const t = cloneState(good);
    t.faces.push({ ...t.faces[0], id: 99 });
    expect(rules(t)).toContain('overlap');
  });

  it('detects layer orders paper cannot have (taco rules)', () => {
    const base = folded('crane', true).steps[1].after; // folded in half twice: two nested wraps
    expect(validate(base)).toEqual([]);
    const faces = [...base.faces].sort((a, b) => a.z - b.z);
    const perms = (a: number[]): number[][] => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
    let bad = 0;
    for (const p of perms([0, 1, 2, 3])) {
      const s = cloneState(base);
      s.faces.forEach((f) => (f.z = p[faces.findIndex((g) => g.id === f.id)]));
      const r = rules(s);
      if (r.has('taco-taco') || r.has('taco-tortilla') || r.has('maekawa')) bad++;
    }
    expect(bad).toBeGreaterThan(0);
    expect(bad).toBeLessThan(24);
  });

  it('detects a fold that does not land where it says', () => {
    // the right half moves instead of TL, so TL never reaches TR
    expect(() => run([valley(bring('TL').to('TR'), { side: [50, 50] })])).toThrow(/landing/);
  });

  it('Kawasaki flags a vertex whose alternate angles do not sum to 180°', () => {
    // four folded creases at 0°, 60°, 180°, 270°: sectors 60/120/90/90
    const flip = { R: [1, 0, 0, 0, -1, 0, 0, 0, -1] as Face['M']['R'], t: [0, 0, 0] as [number, number, number] };
    const id = { R: [1, 0, 0, 0, 1, 0, 0, 0, 1] as Face['M']['R'], t: [0, 0, 0] as [number, number, number] };
    const mk = (i: number, poly: [number, number][], M: Face['M']): Face => ({ id: i, sheet: 0, poly, M, z: i, tags: [], start: M, zStart: i, path: [] });
    const x = 10 / Math.tan(Math.PI / 3);
    const s: State = {
      sheets: [{ id: 0, outline: [[-10, -10], [10, -10], [10, 10], [-10, 10]], area: 400 }],
      faces: [
        mk(0, [[0, 0], [10, 0], [10, 10], [x, 10]], id),
        mk(1, [[0, 0], [x, 10], [-10, 10], [-10, 0]], flip),
        mk(2, [[0, 0], [-10, 0], [-10, -10], [0, -10]], id),
        mk(3, [[0, 0], [0, -10], [10, -10], [10, 0]], flip)
      ],
      marks: {}, decorations: [], view: { tilt: 0, turn: 0 }, diagram: [], text: [], checks: [], nextId: 4
    };
    const probs = vertexProblems(s, require_creases(s));
    expect(probs.some((p) => p.rule === 'kawasaki')).toBe(true);
  });
});

import { creases } from './sheet';
function require_creases(s: State) {
  return creases(s);
}
