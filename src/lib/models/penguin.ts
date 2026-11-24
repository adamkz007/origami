import { diamond, type ModelDef } from '$lib/paper/model';
import { drawEye, foldUnfold, mountain, valley } from '$lib/paper/ops';
import { along, bring, through } from '$lib/paper/refs';

const paper = diamond(200, 'back');
paper.marks.beak = [0, -76]; // lands 24 below the head fold line
paper.marks.eyeL = [-11, -64];
paper.marks.eyeR = [11, -64];

/** Penguin: side folds hinge at the top corner, leaving a white belly. */
export const penguin: ModelDef = {
  slug: 'penguin',
  name: 'Penguin',
  level: 3,
  minutes: 6,
  paper,
  names: { T: 'the top corner', B: 'the bottom corner', L: 'the left corner', R: 'the right corner', O: 'the centre', beak: 'the head' },
  steps: [
    foldUnfold(bring('L').to('R')),
    [
      valley(through('T', along('L', 'B', 0.3)), { side: 'L' }),
      valley(through('T', along('R', 'B', 0.3)), { side: 'R' })
    ],
    valley(bring('T').to('O')),
    valley(bring('T').to('beak'), { layers: { flap: 'T' } }),
    mountain(bring('B').to(along('B', 'O', 0.84))),
    [drawEye('eyeL'), drawEye('eyeR')]
  ]
};
