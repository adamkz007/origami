# origami: origa.mi

Paper-like, animated origami guides, ordered simple → hard. Every fold is
computed by a real paper engine: exact lines, angles and layers, with
before/after states that physically follow from each other.

## Run

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # type check + engine/model unit tests + browser tests
npm run build        # unit tests, then static site → build/ (folds + validates every model)
```

Netlify picks up `netlify.toml` (build `npm run build`, publish `build`). A model
with a physically impossible step fails the build.

## The paper engine (`src/lib/paper`)

| File | What |
|---|---|
| `geom.ts` | Vectors, lines, convex polygons, rigid 3D motions. |
| `sheet.ts` | Paper state: each face is a region of the flat sheet + an exact placement; overlapping faces are ordered by layer. Creases are wherever faces meet. |
| `refs.ts` | Precise references: landmarks and the Huzita–Hatori constructions (`through`, `bring(a).to(b)`, `bisect`, `perpendicular`, `throughBringing`, `bringOntoSquareTo`, `atAngle`, `meet`, `along`). |
| `ops.ts` | Folds: `valley`, `mountain`, `foldUnfold`, `turnOver`, `rotate`, `reverseFold` (inside/outside), `squash`, `petal`, partial folds (`angle`), `shape`, `copies`, `assemble`, `drawEye`, `view`. |
| `validate.ts` | Rigid faces, no tears, sheet fully covered, layer order (taco–taco / taco–tortilla), Kawasaki and Maekawa at every vertex, landing checks. |
| `model.ts` | Compiles a model: runs each step, validates, records each face's motion. |
| `render.ts` | Replays motion in 3D (welding shared paper points), projects through a camera, draws the diagram. |

Layer selection is physical: you pick paper with `layers: { flap }`, `{ top, at }` or `{ bottom, at }`.
Everything attached to that paper on the moving side comes along, and for a valley fold anything
resting on top is carried too.

## Writing a model (`src/lib/models`)

```ts
valley(bring('T').to('B'))                                   // fold in half
valley(through('O', along('L', 'B', 0.6)), { side: 'L' })    // exact line from landmarks
squash({ flap: 'L', hinge: through('O', 'B') })
petal({ flap: 'R', hinge: top, left: kiteL, right: kiteR })
reverseFold(atAngle(point, 165), { flap: 'B' })
valley(hinge, { side: 'L', angle: 80, layers: { top: 1, at } })  // stop part-way, in 3D
```

Paper: side 0 = green (front), side 1 = white (back). Step text is generated from the operations
(override with `say(...)`); `names` turns landmark letters into words.
