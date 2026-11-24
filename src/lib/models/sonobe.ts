import { compose, rotation, type Xf } from '$lib/paper/geom';
import { square, type ModelDef } from '$lib/paper/model';
import { assemble, copies, foldUnfold, reverseFold, say, shape, turnOver, valley, view } from '$lib/paper/ops';
import { bring, through } from '$lib/paper/refs';

const paper = square(200, 'back');
Object.assign(paper.marks, {
  p1: [-100, 50], q1: [-50, 0], // bottom-left corner of the strip → centre line
  p2: [100, -50], q2: [50, 0], // top-right corner of the strip → centre line
  r1: [50, -50], r2: [50, 50], r3: [-50, -50], r4: [-50, 50] // where the points fold over
});

const deg = Math.PI / 180;
const R = (axis: [number, number, number], a: number): Xf => rotation([0, 0, 0], axis, a * deg);
const T = (x: number, y: number, z: number): Xf => ({ R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [x, y, z] });
const h = 50; // half the cube: the unit's middle square is 100 across
// six faces; opposite faces share a tab direction, the three pairs use three axes
const faces: Xf[] = [
  T(0, 0, h),
  compose(T(0, 0, -h), R([0, 1, 0], 180)),
  compose(T(h, 0, 0), compose(R([0, 1, 0], 90), R([0, 0, 1], 90))),
  compose(T(-h, 0, 0), compose(R([0, 1, 0], -90), R([0, 0, 1], 90))),
  compose(T(0, -h, 0), compose(R([1, 0, 0], 90), R([0, 0, 1], 90))),
  compose(T(0, h, 0), compose(R([1, 0, 0], -90), R([0, 0, 1], 90)))
];

export const sonobe: ModelDef = {
  slug: 'sonobe',
  name: 'Sonobe cube',
  level: 5,
  minutes: 30,
  paper,
  names: { mT: 'the top edge', mB: 'the bottom edge', O: 'the centre crease' },
  steps: [
    foldUnfold(bring('mT').to('mB')),
    [valley(bring('mT').to('O')), valley(bring('mB').to('O')), say('Fold the top and bottom edges to the centre crease.')],
    [
      foldUnfold(bring('p1').to('q1')),
      foldUnfold(bring('p2').to('q2')),
      say('Fold the bottom-left and top-right corners to the centre line, then unfold.')
    ],
    [
      reverseFold(bring('p1').to('q1'), { flap: 'p1' }),
      reverseFold(bring('p2').to('q2'), { flap: 'p2' }),
      say('Tuck those corners inside the flaps along the same creases.')
    ],
    turnOver(),
    [
      foldUnfold(through('r1', 'r2'), { side: 'mR' }),
      foldUnfold(through('r3', 'r4'), { side: 'mL' }),
      say('Fold the two points over to make a square, then unfold. One unit is done.')
    ],
    copies(6),
    [
      shape({ region: { line: ['r1', 'r2'], side: 'mR' }, hinge: ['r1', 'r2'], angle: -90, perSheet: true }),
      shape({ region: { line: ['r3', 'r4'], side: 'mL' }, hinge: ['r3', 'r4'], angle: -90, perSheet: true }),
      say('Bend both tabs of every unit back along their creases.')
    ],
    [
      assemble(faces, 'Slide each tab into the pocket of the next unit until all six lock into a cube. Done!'),
      view({ tilt: -30, turn: 40 })
    ]
  ]
};
