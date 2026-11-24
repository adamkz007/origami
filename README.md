# origami — origa.mi

Paper-like, animated origami guides, ordered simple → hard.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site → build/
```

Netlify picks up `netlify.toml` (build `npm run build`, publish `build`).

## Layout

| Path | What |
|---|---|
| `src/lib/fold/engine.ts` | Flat-fold engine: split faces along a line, reflect, re-stack. Also `flip`, `rotate`, `mark`, `reshape`. |
| `src/lib/fold/frame.ts` | Turns a step + time into polygons, shading, crease lines and arrows. |
| `src/lib/components/Stage.svelte` | SVG renderer + timeline + gliding camera. |
| `src/lib/models/index.ts` | Model data (fish ◸, boat ◸◸, crane ◸◸◸◸). |
| `src/lib/prefs.svelte.ts` | "Mark completed" + sound setting, stored in `localStorage`. |
| `src/routes/+page.svelte` | Home: the simple → hard path. |
| `src/routes/m/[slug]` | Step player. |

## Authoring a step

```ts
{ op: 'fold', folds: [{ line: [[x1,y1],[x2,y2]], from: [x,y], pick: ['tag'], behind: false }], alt: '…' }
```

`from` is any point on the side that moves. `pick` / `skip` choose layers by tag, and `tag` labels the moved pieces. `unfold: true` folds the paper and then opens it again, which leaves a crease. `alt` is never shown on screen. Screen readers read it, and it appears as a tooltip on the step dots.

## Phase 0 notes

- Simple valley/mountain folds are **computed**.
- Squash, petal and reverse folds are **authored** `reshape` steps: the old layers swing onto an axis and the new ones swing out. Phase 1 replaces these with computed geometry (Rabbit Ear).
- Accounts ("Connect with Google") come later. Completion state lives in the browser only.
