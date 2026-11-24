import { square, type ModelDef } from '$lib/paper/model';
import { say, shape, turnOver, valley, view, type Op } from '$lib/paper/ops';
import { bring } from '$lib/paper/refs';

const paper = square(200, 'back');
Object.assign(paper.marks, {
  // third-round corners (on the first-round creases)
  q1: [50, -50], q2: [50, 50], q3: [-50, 50], q4: [-50, -50],
  // fourth-round corners (on the second-round creases)
  e1: [50, 0], e2: [0, 50], e3: [-50, 0], e4: [0, -50],
  // fourth-round hinges (the creases x = ±25, y = ±25 on the base sheet)
  g1a: [25, -25], g1b: [25, 25], g2a: [25, 25], g2b: [-25, 25],
  g3a: [-25, 25], g3b: [-25, -25], g4a: [-25, -25], g4b: [25, -25],
});

const blintz = (corners: string[], tag: string, text: string): Op[] => [
  ...corners.map((c) => valley(bring(c).to('O'), { tag: `${tag}${c}` })),
  say(text)
];

export const lotus: ModelDef = {
  slug: 'lotus',
  name: 'Lotus',
  level: 5,
  minutes: 20,
  paper,
  names: { O: 'the centre' },
  steps: [
    blintz(['TL', 'TR', 'BR', 'BL'], 'b1', 'Fold all four corners to the centre.'),
    blintz(['mT', 'mR', 'mB', 'mL'], 'b2', 'Fold the four new corners to the centre again.'),
    blintz(['q1', 'q2', 'q3', 'q4'], 'b3', 'And a third time: all four corners to the centre.'),
    turnOver(),
    blintz(['e1', 'e2', 'e3', 'e4'], 'b4', 'Fold the four corners to the centre one last time.'),
    [
      ...(['1', '2', '3', '4'] as const).map((k) =>
        shape({ tags: [`b4e${k}`], hinge: [`g${k}a`, `g${k}b`], angle: 145 })
      ),
      view({ tilt: -35, turn: 15 }),
      say('Hold the centre and lift the four corner flaps up into petals. Your lotus is done!')
    ]
  ]
};
