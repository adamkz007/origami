import { describe, expect, it } from 'vitest';
import { apply2, centroid, frontNormal } from './geom';
import { compile, diamond, square, type ModelDef } from './model';
import { foldUnfold, mountain, rotate, turnOver, valley, type Op } from './ops';
import { bring, through } from './refs';
import { creases, markWorld } from './sheet';
import { assignment, validate } from './validate';
import { folded } from '$lib/models';

const run = (steps: (Op | Op[])[], paper = square(200, 'front')) =>
  compile({ slug: 't', name: 't', level: 1, minutes: 1, paper, steps } as ModelDef, { validate: true });
const last = (c: ReturnType<typeof run>) => c.steps[c.steps.length - 1].after;
const w2 = (s: ReturnType<typeof last>, m: string) => markWorld(s, m).slice(0, 2).map((v) => +v.toFixed(9) + 0);

describe('valley and mountain folds', () => {
  it('valley: the flap turns over toward the viewer and lands on top', () => {
    const s = last(run([valley(bring('mT').to('mB'))]));
    expect(s.faces).toHaveLength(2);
    const moved = s.faces.find((f) => frontNormal(f.M)[2] < 0)!;
    const still = s.faces.find((f) => frontNormal(f.M)[2] > 0)!;
    expect(moved.z).toBeGreaterThan(still.z);
    expect(w2(s, 'TL')).toEqual([-100, 100]);
    const cs = creases(s);
    expect(cs).toHaveLength(1);
    expect(assignment(cs[0])).toBe('V');
    expect(validate(s)).toEqual([]);
  });

  it('mountain: the flap goes behind', () => {
    const s = last(run([mountain(bring('mT').to('mB'))]));
    const moved = s.faces.find((f) => frontNormal(f.M)[2] < 0)!;
    const still = s.faces.find((f) => frontNormal(f.M)[2] > 0)!;
    expect(moved.z).toBeLessThan(still.z);
    expect(assignment(creases(s)[0])).toBe('M');
  });

  it('fold-and-unfold leaves a flat crease and moves nothing', () => {
    const c = run([foldUnfold(bring('mL').to('mR'))]);
    const s = last(c);
    expect(s.faces).toHaveLength(2);
    expect(s.faces.every((f) => frontNormal(f.M)[2] > 0)).toBe(true);
    expect(assignment(creases(s)[0])).toBe('F');
    expect(c.steps[0].pieces.some((p) => p.path.some((e) => e.kind === 'rot' && e.back))).toBe(true);
    expect(w2(s, 'TL')).toEqual([-100, -100]);
  });

  it('top-layer folds take only paper that is physically attached', () => {
    // folded in half: the layers meet only along the top fold
    const s1 = last(run([valley(bring('mT').to('mB')), valley(through([-100, 50], [100, 50]), { layers: { top: 1, at: [0, 90] }, side: [0, 90] })]));
    expect(s1.faces).toHaveLength(3); // the top layer alone splits
    // a fold that crosses the shared folded edge must take both layers with it
    const s2 = last(run([valley(bring('mT').to('mB')), valley(bring('mL').to('mR'), { layers: { top: 1, at: [-50, 50] } })]));
    expect(s2.faces).toHaveLength(4);
  });
});

describe('turn over and rotate', () => {
  it('turning over mirrors the paper and reverses the stack', () => {
    const c = run([valley(bring('mT').to('mB')), turnOver()]);
    const before = c.steps[0].after;
    const after = last(c);
    for (const f of after.faces) {
      const g = before.faces.find((h) => h.id === f.id)!;
      expect(Math.sign(frontNormal(f.M)[2])).toBe(-Math.sign(frontNormal(g.M)[2]));
    }
    const order = (s: typeof before) => [...s.faces].sort((a, b) => a.z - b.z).map((f) => f.id);
    expect(order(after)).toEqual(order(before).reverse());
  });

  it('rotates exactly', () => {
    const s = last(run([rotate(90)]));
    expect(w2(s, 'TR')).toEqual([100, 100]);
  });
});

describe('compound folds (on the real models)', () => {
  const crane = folded('crane', true);
  it('squash folds make a square base: apex at the centre, all corners at the open end', () => {
    const s = crane.steps[4].after;
    const O = markWorld(s, 'O');
    for (const k of ['T', 'R', 'B', 'L']) {
      const p = markWorld(s, k);
      expect(p[1] - O[1]).toBeCloseTo(100, 9);
      expect(p[0]).toBeCloseTo(O[0], 9);
    }
    expect(s.faces).toHaveLength(8);
  });

  it('a petal fold lifts the tip exactly 100·(√2 − 1) above the apex', () => {
    const s = crane.steps[7].after;
    const O = markWorld(s, 'O');
    const R = markWorld(s, 'R');
    expect(O[1] - R[1]).toBeCloseTo(100 * (Math.SQRT2 - 1), 9);
  });

  it('inside reverse folds point the neck and tail 60° up', () => {
    const s = crane.steps[12].after;
    const hip = [50, 45];
    const neck = markWorld(s, 'B');
    const tail = markWorld(s, 'T');
    expect((Math.atan2(hip[1] - neck[1], hip[0] - neck[0]) * 180) / Math.PI).toBeCloseTo(60, 6);
    expect((Math.atan2(hip[1] - tail[1], tail[0] - hip[0]) * 180) / Math.PI).toBeCloseTo(60, 6);
  });

  it('partial folds swing the wings out by the exact angle', () => {
    const st = crane.steps[crane.steps.length - 1];
    const moved = st.after.faces.filter((f) => st.pieces.find((p) => p.id === f.id)!.path.length);
    expect(moved.length).toBeGreaterThan(0);
    for (const f of moved) {
      const n = frontNormal(f.M);
      expect((Math.acos(Math.abs(n[2])) * 180) / Math.PI).toBeCloseTo(80, 6);
    }
  });

  it('modular units assemble onto the six faces of a cube', () => {
    const s = folded('sonobe', true).steps.at(-1)!.after;
    const centres = s.sheets
      .map((sh) => markWorld(s, sh.id ? `O#${sh.id}` : 'O').map((v) => Math.round(v) + 0).join(','))
      .sort();
    expect(centres).toEqual(['-50,0,0', '0,-50,0', '0,0,-50', '0,0,50', '0,50,0', '50,0,0'].sort());
  });
});

describe('diagram records', () => {
  it('a fold draws its crease, an arrow from the brought point, and both reference dots', () => {
    const st = run([valley(bring('TL').to('BR'))]).steps[0];
    expect(st.diagram.filter((d) => d.kind === 'crease')).toHaveLength(1);
    const arrow = st.diagram.find((d) => d.kind === 'arrow')!;
    expect(arrow.kind === 'arrow' && arrow.from.slice(0, 2)).toEqual([-100, -100]);
    expect(st.diagram.filter((d) => d.kind === 'dot')).toHaveLength(2);
    expect(st.text).toBe('Valley fold: bring point TL to point BR.');
  });

  it('friendly names replace landmark letters', () => {
    const c = compile(
      { slug: 't', name: 't', level: 1, minutes: 1, paper: diamond(), names: { T: 'the top corner', B: 'the bottom corner' }, steps: [valley(bring('T').to('B'))] },
      { validate: true }
    );
    expect(c.steps[0].text).toBe('Valley fold: bring the top corner to the bottom corner.');
  });
});

export { apply2, centroid };
