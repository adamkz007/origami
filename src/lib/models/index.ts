import type { Face, Model, Pt } from '$lib/fold/engine';

/** side 0 = green (front), side 1 = white (back) */
const face = (pts: Pt[], side: 0 | 1, ...tags: string[]): Face => ({ pts, side, tags });
const toned = (f: Face, shade: number): Face => ({ ...f, shade });

/* ---------------- Fish · level 1 ---------------- */
// Square on its corner: T(0,-100) R(100,0) B(0,100) L(-100,0)
const fish: Model = {
  slug: 'fish',
  name: 'Fish',
  level: 1,
  minutes: 3,
  start: [face([[0, -100], [100, 0], [0, 100], [-100, 0]], 1, 'sheet')],
  steps: [
    {
      op: 'fold',
      folds: [{ line: [[-100, 0], [100, 0]], from: [0, -50] }],
      alt: 'Fold the top corner down to the bottom corner to make a triangle.'
    },
    {
      op: 'fold',
      folds: [{ line: [[0, 0], [-41.2, 58.8]], from: [-80, 5] }],
      alt: 'Fold the left corner down so it crosses past the bottom point.'
    },
    {
      op: 'fold',
      folds: [{ line: [[0, 0], [41.2, 58.8]], from: [80, 5] }],
      alt: 'Fold the right corner down the same way. The two corners cross to form the tail.'
    },
    { op: 'flip', alt: 'Turn the paper over.' },
    { op: 'mark', marks: [{ kind: 'eye', at: [0, 24] }], alt: 'Draw an eye near the top point.' },
    { op: 'rotate', deg: 90, alt: 'Turn it sideways. Your fish is done!' }
  ]
};

/* ---------------- Boat · level 2 ---------------- */
// Portrait sheet, x ∈ [-70,70], y ∈ [-99,99] (A4 proportions)
const boat: Model = {
  slug: 'boat',
  name: 'Boat',
  level: 2,
  minutes: 6,
  start: [face([[-70, -99], [70, -99], [70, 99], [-70, 99]], 1, 'sheet')],
  steps: [
    {
      op: 'fold',
      folds: [{ line: [[-70, 0], [70, 0]], from: [0, -50], tag: 'top' }],
      alt: 'Fold the sheet in half, top edge down to the bottom edge.'
    },
    {
      op: 'fold',
      unfold: true,
      folds: [{ line: [[0, 0], [0, 99]], from: [-35, 40] }],
      alt: 'Fold in half left to right, then unfold to leave a center crease.'
    },
    {
      op: 'fold',
      folds: [
        { line: [[0, 0], [-70, 70]], from: [-60, 8] },
        { line: [[0, 0], [70, 70]], from: [60, 8] }
      ],
      alt: 'Fold both top corners down to meet at the center crease.'
    },
    {
      op: 'fold',
      folds: [{ line: [[-70, 70], [70, 70]], from: [0, 90], pick: ['top'] }],
      alt: 'Fold the front strip at the bottom up over the triangles.'
    },
    { op: 'flip', alt: 'Turn the paper over.' },
    {
      op: 'fold',
      folds: [{ line: [[-70, 70], [70, 70]], from: [0, 90], skip: ['top'] }],
      alt: 'Fold the other strip up too. You have a paper hat.'
    },
    {
      op: 'reshape',
      axis: [[-70, 40], [70, 40]],
      to: [
        face([[0, -20], [-70, 50], [0, 120], [70, 50]], 0, 'dB'),
        face([[0, -20], [-70, 50], [0, 120]], 0, 'dF'),
        toned(face([[0, -20], [0, 120], [70, 50]], 0, 'dF'), 0.12),
        face([[0, 120], [-24, 96], [24, 96]], 1, 'dF')
      ],
      alt: 'Open the hat from the bottom and flatten it into a diamond.'
    },
    {
      op: 'fold',
      folds: [
        { line: [[-70, 50], [70, 50]], from: [0, 100], pick: ['dF'] },
        { line: [[-70, 50], [70, 50]], from: [0, 100], pick: ['dB'], behind: true }
      ],
      alt: 'Fold the bottom corner up to the top, on the front and on the back.'
    },
    {
      op: 'reshape',
      axis: [[-70, 25], [70, 25]],
      to: [
        face([[0, -20], [-50, 30], [0, 80], [50, 30]], 0, 'eB'),
        face([[0, -20], [-50, 30], [0, 80]], 0, 'eF'),
        toned(face([[0, -20], [0, 80], [50, 30]], 0, 'eF'), 0.12)
      ],
      alt: 'Open it from the bottom again and flatten it into a smaller diamond.'
    },
    {
      op: 'reshape',
      axis: [[-75, 30], [75, 30]],
      to: [
        face([[0, -48], [-40, 30], [0, 30]], 0, 'sail'),
        toned(face([[0, -48], [0, 30], [40, 30]], 0, 'sail'), 0.16),
        face([[-80, 30], [80, 30], [50, 62], [-50, 62]], 0, 'hull'),
        toned(face([[-80, 30], [-50, 62], [-58, 30]], 0, 'hull'), 0.22),
        toned(face([[80, 30], [50, 62], [58, 30]], 0, 'hull'), 0.22)
      ],
      alt: 'Gently pull the two top flaps apart. Your boat is done!'
    }
  ]
};

/* ---------------- Crane · level 4 ---------------- */
const k = { x: 29.29, y: -20.71 }; // where the kite folds meet the edges
const petalTip: Pt = [0, -91.42];
const petal = (tag: string): Face[] => [
  face([petalTip, [-k.x, k.y], [0, 50]], 0, tag),
  face([petalTip, [0, 50], [k.x, k.y]], 0, tag)
];
const wing = (tag: string, side: 0 | 1): Face =>
  face([petalTip, [-19, -45.5], [0, -26.5], [19, -45.5]], side, tag);
const neck = face([[-14, -38], [-86, -72], [0, -12]], 0, 'N');
const tail = face([[14, -38], [86, -72], [0, -12]], 0, 'T');

const crane: Model = {
  slug: 'crane',
  name: 'Crane',
  level: 4,
  minutes: 15,
  start: [face([[0, -100], [100, 0], [0, 100], [-100, 0]], 0, 'sheet')],
  steps: [
    {
      op: 'fold',
      folds: [{ line: [[-100, 0], [100, 0]], from: [0, -50] }],
      alt: 'Fold in half, top corner to bottom corner.'
    },
    {
      op: 'fold',
      folds: [{ line: [[0, 0], [0, 100]], from: [-50, 20] }],
      alt: 'Fold in half again, left corner to right corner.'
    },
    {
      op: 'reshape',
      axis: [[0, -60], [0, 100]],
      repeat: true,
      to: [
        face([[0, -50], [-50, 0], [0, 50]], 1, 'bk'),
        face([[0, -50], [0, 50], [50, 0]], 1, 'bk'),
        face([[0, -50], [-50, 0], [0, 50]], 0, 'F'),
        face([[0, -50], [0, 50], [50, 0]], 0, 'F')
      ],
      alt: 'Open the top flap and squash it flat into a square. Turn over and repeat. This is the square base.'
    },
    {
      op: 'fold',
      folds: [
        { line: [[0, 50], [-38.27, -42.39]], from: [-45, 0], pick: ['F'], tag: 'kL' },
        { line: [[0, 50], [38.27, -42.39]], from: [45, 0], pick: ['F'], tag: 'kR' }
      ],
      alt: 'Fold the lower edges of the top layer in to the center line.'
    },
    {
      op: 'fold',
      unfold: true,
      folds: [{ line: [[-k.x, k.y], [k.x, k.y]], from: [0, -45], pick: ['F'] }],
      alt: 'Fold the top triangle down over the flaps, then unfold.'
    },
    {
      op: 'fold',
      folds: [
        { line: [[0, 50], [-38.27, -42.39]], from: [-5, 10], pick: ['kL'] },
        { line: [[0, 50], [38.27, -42.39]], from: [5, 10], pick: ['kR'] }
      ],
      alt: 'Unfold the two side flaps.'
    },
    {
      op: 'reshape',
      axis: [[-k.x, k.y], [k.x, k.y]],
      out: ['F'],
      to: petal('P'),
      alt: 'Petal fold: lift the bottom corner of the top layer up along the crease, letting the sides fold in.'
    },
    { op: 'flip', alt: 'Turn the paper over.' },
    {
      op: 'reshape',
      axis: [[-k.x, k.y], [k.x, k.y]],
      out: ['bk'],
      to: petal('P2'),
      repeat: true,
      alt: 'Repeat the side folds and the petal fold on this side. This is the bird base.'
    },
    {
      op: 'fold',
      folds: [
        { line: [[0, 50], [-19.51, -48.08]], from: [-25, -20], pick: ['P2'], tag: 'n' },
        { line: [[0, 50], [19.51, -48.08]], from: [25, -20], pick: ['P2'], tag: 'n' },
        { line: [[0, 50], [-19.51, -48.08]], from: [-25, -20], pick: ['P'], behind: true },
        { line: [[0, 50], [19.51, -48.08]], from: [25, -20], pick: ['P'], behind: true }
      ],
      alt: 'Fold the lower edges in to the center line, on the front and on the back.'
    },
    {
      op: 'reshape',
      axis: [[-30, -26], [30, -26]],
      to: [wing('P', 0), neck, tail, toned(face([[-19, -45.5], [0, -12], [19, -45.5]], 0, 'B'), 0.2), wing('P2', 0)],
      alt: 'Inside-reverse fold the two lower points up between the layers: one neck, one tail.'
    },
    {
      op: 'reshape',
      axis: [[-84, -60], [-74, -82]],
      out: ['N'],
      to: [
        face([[-14, -38], [-78, -71], [0, -12]], 0, 'N'),
        toned(face([[-72, -68], [-84, -75], [-96, -56]], 0, 'N'), 0.25)
      ],
      alt: 'Reverse fold the tip of the neck down to make the head.'
    },
    {
      op: 'fold',
      folds: [
        { line: [[-19, -45.5], [19, -45.5]], from: [0, -70], pick: ['P2'] },
        { line: [[-19, -45.5], [19, -45.5]], from: [0, -70], pick: ['P'], behind: true }
      ],
      alt: 'Fold both wings down.'
    },
    {
      op: 'reshape',
      axis: [[-40, -38], [40, -38]],
      out: ['P', 'P2', 'B'],
      to: [
        toned(face([[2, -44], [104, -20], [60, -4], [4, -22]], 0, 'W'), 0.22),
        toned(face([[-12, -44], [12, -44], [0, -16]], 0, 'B'), 0.3),
        face([[-2, -44], [-104, -20], [-60, -4], [-4, -22]], 0, 'W')
      ],
      alt: 'Gently pull the wings apart and puff out the body. Your crane is done!'
    }
  ]
};


/* ---------------- Penguin · level 3 ---------------- */
// Square on its corner, white side up. Side folds hinge at the top corner
// at 28° so a white belly stays visible down the middle.
const pen = { x: 0.4695 * 160, y: -100 + 0.8829 * 160 }; // a far point on each side line
const penguin: Model = {
  slug: 'penguin',
  name: 'Penguin',
  level: 3,
  minutes: 6,
  start: [face([[0, -100], [100, 0], [0, 100], [-100, 0]], 1, 'sheet')],
  steps: [
    {
      op: 'fold',
      unfold: true,
      folds: [{ line: [[0, -100], [0, 100]], from: [-50, 0] }],
      alt: 'Fold in half left to right, then unfold to leave a center crease.'
    },
    {
      op: 'fold',
      folds: [
        { line: [[0, -100], [-pen.x, pen.y]], from: [-90, 0] },
        { line: [[0, -100], [pen.x, pen.y]], from: [90, 0] }
      ],
      alt: 'Fold the left and right corners in from the top point, leaving a white gap down the middle.'
    },
    {
      op: 'fold',
      folds: [{ line: [[-60, -50], [60, -50]], from: [0, -80], tag: 'head' }],
      alt: 'Fold the top point down to make the head.'
    },
    {
      op: 'fold',
      folds: [{ line: [[-30, -12], [30, -12]], from: [0, -4], pick: ['head'] }],
      alt: 'Fold the tip back up to make the beak.'
    },
    {
      op: 'fold',
      folds: [{ line: [[-60, 58], [60, 58]], from: [0, 80], behind: true }],
      alt: 'Fold the bottom point behind so the penguin can stand.'
    },
    {
      op: 'mark',
      marks: [
        { kind: 'eye', at: [-11, -36] },
        { kind: 'eye', at: [11, -36] }
      ],
      alt: 'Draw two eyes. Your penguin is done!'
    }
  ]
};

/* ---------------- Butterfly · level 3 ---------------- */
// Square, x,y ∈ [-100,100], white side up.
const butterfly: Model = {
  slug: 'butterfly',
  name: 'Butterfly',
  level: 3,
  minutes: 8,
  start: [face([[-100, -100], [100, -100], [100, 100], [-100, 100]], 1, 'sheet')],
  steps: [
    {
      op: 'fold',
      unfold: true,
      folds: [{ line: [[-100, -100], [100, 100]], from: [-50, 50] }],
      alt: 'Fold in half along one diagonal, then unfold.'
    },
    {
      op: 'fold',
      unfold: true,
      folds: [{ line: [[100, -100], [-100, 100]], from: [50, 50] }],
      alt: 'Fold along the other diagonal, then unfold.'
    },
    {
      op: 'fold',
      unfold: true,
      folds: [{ line: [[-100, 0], [100, 0]], from: [0, -50], behind: true }],
      alt: 'Turn over, fold in half top to bottom, then unfold.'
    },
    {
      op: 'reshape',
      axis: [[-100, 0], [100, 0]],
      to: [
        face([[0, -50], [-100, 50], [100, 50]], 1, 'bk'),
        face([[0, -50], [-100, 50], [0, 50]], 0, 'fL'),
        toned(face([[0, -50], [0, 50], [100, 50]], 0, 'fR'), 0.1)
      ],
      alt: 'Collapse along the creases into a triangle: the waterbomb base.'
    },
    {
      op: 'fold',
      folds: [
        { line: [[-50, 0], [0, 50]], from: [-90, 45], pick: ['fL'] },
        { line: [[50, 0], [0, 50]], from: [90, 45], pick: ['fR'] }
      ],
      alt: 'Fold the two bottom corners of the top layer up to the top point.'
    },
    { op: 'flip', alt: 'Turn the paper over.' },
    {
      op: 'fold',
      folds: [{ line: [[-100, 10], [100, 10]], from: [0, -30], tag: 'tip' }],
      alt: 'Fold the top point down so it sticks out past the bottom edge.'
    },
    {
      op: 'fold',
      folds: [{ line: [[-100, 50], [100, 50]], from: [0, 65], pick: ['tip'] }],
      alt: 'Fold the little tip up over the edge to lock it.'
    },
    {
      op: 'reshape',
      axis: [[-100, 10], [100, 10]],
      to: [
        face([[-4, 6], [-72, 20], [-60, 66], [-6, 26]], 1, 'wing'),
        toned(face([[4, 6], [72, 20], [60, 66], [6, 26]], 1, 'wing'), 0.12),
        face([[0, -6], [-90, -60], [-106, 4], [-6, 10]], 0, 'wing'),
        toned(face([[0, -6], [90, -60], [106, 4], [6, 10]], 0, 'wing'), 0.14),
        toned(face([[-5, -16], [5, -16], [4, 32], [-4, 32]], 0, 'body'), 0.35)
      ],
      alt: 'Fold in half, then open the wings back out and shape them. Your butterfly is done!'
    }
  ]
};

/* ---------------- Lotus · level 5 ---------------- */
// Blintz (corners to centre) three times, turn over, blintz again,
// then pull the hidden corners out layer by layer.
const blintzSquare = (a: number) => [
  { line: [[-a, 0], [0, -a]] as [Pt, Pt], from: [-a, -a] as Pt },
  { line: [[a, 0], [0, -a]] as [Pt, Pt], from: [a, -a] as Pt },
  { line: [[a, 0], [0, a]] as [Pt, Pt], from: [a, a] as Pt },
  { line: [[-a, 0], [0, a]] as [Pt, Pt], from: [-a, a] as Pt }
];
const blintzDiamond = (h: number) => [
  { line: [[h, -h], [h, h]] as [Pt, Pt], from: [2 * h, 0] as Pt },
  { line: [[-h, -h], [-h, h]] as [Pt, Pt], from: [-2 * h, 0] as Pt },
  { line: [[-h, h], [h, h]] as [Pt, Pt], from: [0, 2 * h] as Pt },
  { line: [[-h, -h], [h, -h]] as [Pt, Pt], from: [0, -2 * h] as Pt }
];
/** a kite-shaped petal pointing `deg` (0 = up) from the centre */
const petalAt = (deg: number, L: number, W: number, side: 0 | 1, shade = 0): Face => {
  const r = (deg * Math.PI) / 180;
  const u: Pt = [Math.sin(r), -Math.cos(r)];
  const p: Pt = [Math.cos(r), Math.sin(r)];
  const at = (a: number, b: number): Pt => [u[0] * a + p[0] * b, u[1] * a + p[1] * b];
  return toned(face([at(6, 0), at(L * 0.48, W), at(L, 0), at(L * 0.48, -W)], side, 'petal'), shade);
};
const lotus: Model = {
  slug: 'lotus',
  name: 'Lotus',
  level: 5,
  minutes: 20,
  start: [face([[-100, -100], [100, -100], [100, 100], [-100, 100]], 1, 'sheet')],
  steps: [
    { op: 'fold', folds: blintzSquare(100), alt: 'Fold all four corners to the center.' },
    { op: 'fold', folds: blintzDiamond(50), alt: 'Fold the four new corners to the center again.' },
    { op: 'fold', folds: blintzSquare(50), alt: 'And a third time: all four corners to the center.' },
    { op: 'flip', alt: 'Turn the paper over.' },
    { op: 'fold', folds: blintzDiamond(25), alt: 'Fold the four corners to the center one last time.' },
    {
      op: 'reshape',
      axis: [[-60, 0], [60, 0]],
      out: [],
      under: true,
      to: [45, 135, 225, 315].map((d) => petalAt(d, 62, 18, 1, 0.08)),
      alt: 'Hold the center. From behind, pull the first layer of corners out and up into petals.'
    },
    {
      op: 'reshape',
      axis: [[-80, 0], [80, 0]],
      out: [],
      under: true,
      to: [0, 90, 180, 270].map((d) => petalAt(d, 78, 26, 0, 0.12)),
      alt: 'Pull out the next layer of corners between the first petals.'
    },
    {
      op: 'reshape',
      axis: [[-100, 0], [100, 0]],
      out: [],
      under: true,
      repeat: true,
      to: [45, 135, 225, 315].map((d) => petalAt(d, 104, 34, 0)),
      alt: 'Pull out the last layer from underneath to make the outer leaves. Your lotus is done!'
    }
  ]
};

/* ---------------- Sonobe cube · level 5 ---------------- */
// Six identical units lock together into a cube.
const s3 = 0.866;
const cs = 62; // cube size
const sonobe: Model = {
  slug: 'sonobe',
  name: 'Sonobe cube',
  level: 5,
  minutes: 30,
  start: [face([[-100, -100], [100, -100], [100, 100], [-100, 100]], 1, 'sheet')],
  steps: [
    {
      op: 'fold',
      unfold: true,
      folds: [{ line: [[-100, 0], [100, 0]], from: [0, -50] }],
      alt: 'Fold in half top to bottom, then unfold.'
    },
    {
      op: 'fold',
      folds: [
        { line: [[-100, -50], [100, -50]], from: [0, -80] },
        { line: [[-100, 50], [100, 50]], from: [0, 80] }
      ],
      alt: 'Fold the top and bottom edges to the center crease.'
    },
    {
      op: 'fold',
      folds: [
        { line: [[-100, 0], [-50, 50]], from: [-95, 45], tag: 'cL' },
        { line: [[100, 0], [50, -50]], from: [95, -45], tag: 'cR' }
      ],
      alt: 'Fold the bottom-left and top-right corners in to the center line.'
    },
    {
      op: 'reshape',
      axis: [[-100, 0], [100, 0]],
      to: [
        face([[-100, -50], [50, -50], [100, 0], [100, 50], [-50, 50], [-100, 0]], 1, 'base'),
        face([[-100, -50], [50, -50], [100, 0], [-100, 0]], 0, 'flap'),
        toned(face([[-100, 0], [100, 0], [100, 50], [-50, 50]], 0, 'flap'), 0.08)
      ],
      alt: 'Unfold those corners and tuck them inside the flaps instead.'
    },
    { op: 'flip', alt: 'Turn the paper over.' },
    {
      op: 'fold',
      folds: [
        { line: [[50, -50], [50, 50]], from: [90, 0], tag: 'pR' },
        { line: [[-50, -50], [-50, 50]], from: [-90, 20], tag: 'pL' }
      ],
      alt: 'Fold the two points in to make a square.'
    },
    {
      op: 'fold',
      folds: [
        { line: [[50, -50], [50, 50]], from: [25, 0], pick: ['pR'] },
        { line: [[-50, -50], [-50, 50]], from: [-25, 10], pick: ['pL'] }
      ],
      alt: 'Unfold the points. They are the tabs; one unit is done.'
    },
    {
      op: 'reshape',
      axis: [[-100, 0], [100, 0]],
      repeat: true,
      to: [
        face([[0, -cs], [s3 * cs, -cs / 2], [0, 0]], 0, 'cube'),
        face([[0, -cs], [0, 0], [-s3 * cs, -cs / 2]], 1, 'cube'),
        toned(face([[-s3 * cs, -cs / 2], [0, 0], [-s3 * cs, cs / 2]], 1, 'cube'), 0.15),
        toned(face([[0, 0], [0, cs], [-s3 * cs, cs / 2]], 0, 'cube'), 0.15),
        toned(face([[0, 0], [s3 * cs, -cs / 2], [0, cs]], 0, 'cube'), 0.28),
        toned(face([[s3 * cs, -cs / 2], [s3 * cs, cs / 2], [0, cs]], 1, 'cube'), 0.28)
      ],
      alt: 'Make six units. Slide each tab into another unit’s pocket until they lock into a cube. Done!'
    }
  ]
};

/** Ordered simple → hard. */
export const models: Model[] = [fish, boat, penguin, butterfly, crane, lotus, sonobe].sort(
  (a, b) => a.level - b.level
);

export const getModel = (slug: string) => models.find((m) => m.slug === slug);

export const nextModel = (slug: string) => {
  const i = models.findIndex((m) => m.slug === slug);
  return i >= 0 && i < models.length - 1 ? models[i + 1] : undefined;
};
