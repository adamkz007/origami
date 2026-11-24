import { apply2, centroid, insideConvex, onSegment, type V2, type Xf } from './geom';
import type { Op } from './ops';
import {
  beginStep,
  newState,
  normalize,
  type DiagramItem,
  type PathEl,
  type State,
  type View
} from './sheet';
import { validate, type Problem } from './validate';

export interface PaperDef {
  outline: V2[];
  /** which side faces up at the start */
  up: 'front' | 'back';
  marks: Record<string, V2>;
}

export interface ModelDef {
  slug: string;
  name: string;
  level: 1 | 2 | 3 | 4 | 5;
  minutes: number;
  paper: PaperDef;
  /** friendly names for landmarks in step text */
  names?: Record<string, string>;
  steps: (Op | Op[])[];
}

/** One face as it travels through one step. */
export interface Piece {
  id: number;
  sheet: number;
  poly: V2[];
  start: Xf;
  end: Xf;
  path: PathEl[];
  zStart: number;
  zEnd: number;
}

export interface StepPlan {
  text: string;
  pieces: Piece[];
  diagram: DiagramItem[];
  viewFrom: View;
  viewTo: View;
  /** eyes etc.: paper points on a given sheet */
  decorations: { sheet: number; p: V2; piece: number }[];
  /** the folded paper after this step (for tests and the gallery) */
  after: State;
  before: State;
}

export interface Compiled {
  def: ModelDef;
  steps: StepPlan[];
  start: State;
}

export class ModelError extends Error {
  constructor(
    public model: string,
    public step: number,
    public problems: Problem[] | string
  ) {
    super(
      `${model} step ${step + 1}: ` +
        (typeof problems === 'string' ? problems : problems.map((p) => `[${p.rule}] ${p.detail}`).join('; '))
    );
  }
}

/* ---------- paper shapes ---------- */

/** Square on its corner: T top, R right, B bottom, L left, O centre. */
export function diamond(d = 200, up: 'front' | 'back' = 'back'): PaperDef {
  const h = d / 2;
  return {
    outline: [
      [0, -h],
      [h, 0],
      [0, h],
      [-h, 0]
    ],
    up,
    marks: {
      T: [0, -h],
      R: [h, 0],
      B: [0, h],
      L: [-h, 0],
      O: [0, 0],
      mTR: [h / 2, -h / 2],
      mBR: [h / 2, h / 2],
      mBL: [-h / 2, h / 2],
      mTL: [-h / 2, -h / 2]
    }
  };
}

/** Axis-aligned rectangle: corners TL TR BR BL, edge midpoints mT mR mB mL, centre O. */
export function rect(w: number, h: number, up: 'front' | 'back' = 'back'): PaperDef {
  const x = w / 2;
  const y = h / 2;
  return {
    outline: [
      [-x, -y],
      [x, -y],
      [x, y],
      [-x, y]
    ],
    up,
    marks: {
      TL: [-x, -y],
      TR: [x, -y],
      BR: [x, y],
      BL: [-x, y],
      mT: [0, -y],
      mR: [x, 0],
      mB: [0, y],
      mL: [-x, 0],
      O: [0, 0]
    }
  };
}

export const square = (size = 200, up: 'front' | 'back' = 'back') => rect(size, size, up);

/* ---------- compile ---------- */

function friendly(text: string, names: Record<string, string> = {}) {
  return text.replace(/«([^»]+)»/g, (_, n: string) => names[n] ?? `point ${n}`);
}

export function compile(def: ModelDef, opts: { validate?: boolean } = {}): Compiled {
  let state = newState(def.paper.outline, def.paper.up === 'back', def.paper.marks);
  normalize(state);
  const start = state;
  const steps: StepPlan[] = [];
  def.steps.forEach((step, i) => {
    const ops = Array.isArray(step) ? step : [step];
    const before = state;
    const s = beginStep(before);
    const viewFrom = { ...before.view };
    try {
      for (const op of ops) op.apply(s);
    } catch (e) {
      throw new ModelError(def.slug, i, (e as Error).message);
    }
    normalize(s);
    if (opts.validate) {
      const problems = validate(s);
      if (problems.length) throw new ModelError(def.slug, i, problems);
    }
    const pieces: Piece[] = s.faces.map((f) => ({
      id: f.id,
      sheet: f.sheet,
      poly: f.poly,
      start: f.start,
      end: f.M,
      path: f.path,
      zStart: f.zStart,
      zEnd: f.z
    }));
    // z ranks at the start of the step, re-ranked over these pieces
    const startOrder = [...pieces].sort((a, b) => a.zStart - b.zStart || a.id - b.id);
    startOrder.forEach((p, k) => (p.zStart = k));
    const decorations = s.decorations.map((d) => {
      const m = s.marks[d.mark];
      const idx = pieces.findIndex(
        (p) =>
          p.sheet === m.sheet &&
          (insideConvex(p.poly, m.p, -1e-7) || p.poly.some((a, k) => onSegment(a, p.poly[(k + 1) % p.poly.length], m.p)))
      );
      return { sheet: m.sheet, p: m.p, piece: idx };
    });
    const said = ops.filter((o) => (o as { said?: boolean }).said).map((o) => o.describe);
    steps.push({
      text: friendly(said.length ? said.join(' ') : s.text.join(' '), def.names),
      pieces,
      diagram: s.diagram,
      viewFrom,
      viewTo: { ...s.view },
      decorations,
      after: s,
      before
    });
    state = s;
  });
  return { def, steps, start };
}

/** World centroid of a piece at the end of its step (handy in tests). */
export const pieceCentre = (p: Piece) => apply2(p.end, centroid(p.poly));
