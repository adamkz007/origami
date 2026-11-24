import { square, type ModelDef } from '$lib/paper/model';
import { say, shape, squash, turnOver, valley, view } from '$lib/paper/ops';
import { along, atAngle, bring, pointOn, through } from '$lib/paper/refs';

const centre = atAngle('mB', 90); // the vertical centre line through the base midpoint

export const butterfly: ModelDef = {
  slug: 'butterfly',
  name: 'Butterfly',
  level: 3,
  minutes: 8,
  paper: square(200, 'back'),
  names: { O: 'the top point', mB: 'the middle of the bottom edge', mT: 'the middle of the top edge', mL: 'the middle of the left edge', mR: 'the middle of the right edge', BL: 'the corner', BR: 'the corner', TR: 'the corner' },
  steps: [
    valley(bring('mT').to('mB')),
    valley(bring('mL').to('mR')),
    squash({ flap: 'BL', hinge: through('O', 'mB') }),
    turnOver(),
    [squash({ flap: 'BR', hinge: through('O', 'mB') }), say('Squash the other side too. This is the waterbomb base.')],
    [
      valley(bring('TR').to('O'), { layers: { flap: 'TR' } }),
      valley(bring('BR').to('O'), { layers: { flap: 'BR' } }),
      say('Fold the two bottom corners of the top layer up to the top point.')
    ],
    turnOver(),
    // the top point drops 30% of the height past the bottom edge
    [valley(bring('O').to(along('O', 'mB', 1.3)), { tag: 'tip' }), say('Fold the top point down so it sticks out past the bottom edge.')],
    [valley(bring('O').to(along('O', 'mB', 2))), say('Fold the little tip back up over the edge to lock it.')],
    [
      shape({ region: { line: ['mB', pointOn(centre, -60)], side: pointOn(atAngle('mB', 0), -50) }, hinge: ['mB', pointOn(centre, -60)], angle: -28 }),
      shape({ region: { line: ['mB', pointOn(centre, -60)], side: pointOn(atAngle('mB', 0), 50) }, hinge: ['mB', pointOn(centre, -60)], angle: -28 }),
      view({ tilt: -18, turn: 0 }),
      say('Fold in half and open the wings into a V. Your butterfly is done!')
    ]
  ]
};
