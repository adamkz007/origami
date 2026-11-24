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

/** Ordered simple → hard. */
export const models: Model[] = [fish, boat, crane].sort((a, b) => a.level - b.level);

export const getModel = (slug: string) => models.find((m) => m.slug === slug);

export const nextModel = (slug: string) => {
  const i = models.findIndex((m) => m.slug === slug);
  return i >= 0 && i < models.length - 1 ? models[i + 1] : undefined;
};
