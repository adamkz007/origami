import { diamond, type ModelDef } from '$lib/paper/model';
import { foldUnfold, mountain, petal, reverseFold, say, squash, turnOver, valley, view } from '$lib/paper/ops';
import { along, atAngle, bisect, bring, meet, mid, pointOn, through, type LineSpec } from '$lib/paper/refs';

const paper = diamond(200, 'front');
// the four paper points that become the bird base's side points
const k = 100 - 50 * Math.SQRT2;
Object.assign(paper.marks, { k1: [k, k], k2: [-k, k], k3: [-k, -k], k4: [k, -k] });

// Square base landmarks (world): O apex, all corners at the bottom (B),
// left/right points carry an edge midpoint of the sheet.
const base = (left: string, right: string) => {
  const centre = through('B', 'O');
  const kiteL: LineSpec = bisect(through('B', left), centre, left);
  const kiteR: LineSpec = bisect(through('B', right), centre, right);
  const top: LineSpec = through(meet(kiteL, through('O', left)), meet(kiteR, through('O', right)));
  return { kiteL, kiteR, top, left, right };
};
const front = base('mTR', 'mBR');
const back = base('mBL', 'mTL');
/** narrow the legs: lower edge from side point k to the centre line */
const narrow = (kp: string, fold: typeof valley, layers: 'top' | 'bottom') => {
  const line = bisect(through('B', kp), through('B', 'O'), kp);
  const at = along(kp, mid('O', 'B'), 0.1);
  return fold(line, { side: kp, layers: layers === 'top' ? { top: 1, at } : { bottom: 1, at } });
};
const kites = (b: ReturnType<typeof base>) => [
  foldUnfold(b.kiteL, { side: b.left, layers: { top: 1, at: along(b.left, b.right, 0.1) } }),
  foldUnfold(b.kiteR, { side: b.right, layers: { top: 1, at: along(b.right, b.left, 0.1) } }),
  say('Fold the lower edges of the top flap to the centre line, then unfold.')
];

export const crane: ModelDef = {
  slug: 'crane',
  name: 'Crane',
  level: 4,
  minutes: 15,
  paper,
  names: { T: 'the top corner', B: 'the bottom corner', L: 'the left corner', R: 'the right corner', O: 'the centre' },
  steps: [
    valley(bring('T').to('B')),
    valley(bring('L').to('R')),
    squash({ flap: 'L', hinge: through('O', 'B') }),
    turnOver(),
    squash({ flap: 'R', hinge: through('O', 'B') }),
    kites(front),
    [foldUnfold(front.top, { side: 'O', layers: { top: 1, at: along('O', 'B', 0.12) } }), say('Fold the top triangle down along the kite creases, then unfold.')],
    petal({ flap: 'R', hinge: front.top, left: front.kiteL, right: front.kiteR }),
    turnOver(),
    kites(back),
    [petal({ flap: 'L', hinge: back.top, left: back.kiteL, right: back.kiteR }), say('Petal fold this side too. This is the bird base.')],
    [
      narrow('k2', valley, 'top'),
      narrow('k3', valley, 'top'),
      narrow('k1', mountain, 'bottom'),
      narrow('k4', mountain, 'bottom'),
      say('Fold the lower edges of the legs to the centre line, on the front and on the back.')
    ],
    // a leg pointing straight down, reflected over a line at 165°, points up-left at 60°
    [
      reverseFold(atAngle(along('O', 'B', 0.45), 15), { flap: 'T' }),
      reverseFold(atAngle(along('O', 'B', 0.45), 165), { flap: 'B' }),
      say('Inside-reverse fold both legs up between the layers: one becomes the neck, the other the tail.')
    ],
    // neck runs 60° up-left; a line at 197° turns the last fifth down into a head
    [
      // the neck runs from its tip at 60° back to the body; 11 units down it,
      // a line at 197° turns the tip down into a head
      reverseFold(atAngle(pointOn(atAngle('B', 60), 11), 197), { flap: 'B' }),
      say('Inside-reverse fold the tip of the neck down to make the head.')
    ],
    [
      // after the second petal fold, petal L is in front and petal R behind;
      // each wing swings out about a hinge level with the top of the body
      valley(atAngle('O', 0), { side: 'L', angle: 80, layers: { top: 1, at: along('L', 'O', 0.3) } }),
      mountain(atAngle('O', 0), { side: 'R', angle: 80, layers: { bottom: 1, at: along('R', 'O', 0.3) } }),
      view({ tilt: -15, turn: -40 }),
      say('Spread the wings out to the sides. Your crane is done!')
    ]
  ]
};
