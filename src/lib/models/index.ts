import { compile, type Compiled, type ModelDef } from '$lib/paper/model';
import { boat } from './boat';
import { butterfly } from './butterfly';
import { crane } from './crane';
import { fish } from './fish';
import { lotus } from './lotus';
import { penguin } from './penguin';
import { sonobe } from './sonobe';

/** Every model, simple → hard. */
export const models: ModelDef[] = [fish, boat, penguin, butterfly, crane, lotus, sonobe].sort(
  (a, b) => a.level - b.level
);

export const getModel = (slug: string) => models.find((m) => m.slug === slug);

export const nextModel = (slug: string) => {
  const i = models.findIndex((m) => m.slug === slug);
  return i >= 0 && i < models.length - 1 ? models[i + 1] : undefined;
};

const cache = new Map<string, Compiled>();

/** Fold a model (memoised). Validation runs in tests and at build time. */
export function folded(slug: string, validate = false): Compiled {
  const key = `${slug}:${validate}`;
  let c = cache.get(key);
  if (!c) {
    const def = getModel(slug);
    if (!def) throw new Error(`no model "${slug}"`);
    c = compile(def, { validate });
    cache.set(key, c);
  }
  return c;
}
