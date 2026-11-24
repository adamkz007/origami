import { diamond, type ModelDef } from '$lib/paper/model';
import { drawEye, rotate, turnOver, valley } from '$lib/paper/ops';
import { along, bring, through } from '$lib/paper/refs';

const paper = diamond(200, 'back');
paper.marks.eye = [0, 24];

/** Easy fish: a triangle whose two corners cross below to make the tail. */
export const fish: ModelDef = {
  slug: 'fish',
  name: 'Fish',
  level: 1,
  minutes: 3,
  paper,
  names: { T: 'the top corner', B: 'the bottom corner', L: 'the left corner', R: 'the right corner', O: 'the middle of the top edge' },
  steps: [
    valley(bring('T').to('B')),
    // through the middle of the top edge and the point 3/5 of the way down the side
    valley(through('O', along('L', 'B', 0.6)), { side: 'L' }),
    valley(through('O', along('R', 'B', 0.6)), { side: 'R' }),
    turnOver(),
    drawEye('eye'),
    rotate(90)
  ]
};
