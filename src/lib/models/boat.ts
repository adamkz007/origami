import { diamond, type ModelDef } from '$lib/paper/model';
import { mountain, valley } from '$lib/paper/ops';
import { along, bring } from '$lib/paper/refs';

/** Sailboat: one fold for the hull, the front corner up for the sail. */
export const boat: ModelDef = {
  slug: 'boat',
  name: 'Boat',
  level: 2,
  minutes: 4,
  paper: diamond(200, 'front'),
  names: { T: 'the top corner', B: 'the bottom corner', L: 'the left corner', R: 'the right corner', O: 'the centre' },
  steps: [
    valley(bring('T').to('B')),
    // the front corner rises 60 above the folded edge: the sail
    valley(bring('T').to(along('B', 'O', 1.6)), { layers: { flap: 'T' } }),
    // the back corner goes behind, flattening the hull
    mountain(bring('B').to(along('B', 'O', 0.8)), { layers: { flap: 'B' } }),
    [
      mountain(bring('L').to(along('L', 'R', 0.15))),
      mountain(bring('R').to(along('R', 'L', 0.15)))
    ]
  ]
};
