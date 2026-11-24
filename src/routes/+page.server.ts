import { folded, models } from '$lib/models';
import { fitStep, restFrame } from '$lib/paper/render';

/**
 * Runs at build time (prerender): folds every model with full validation, so
 * a physically impossible step fails the build, and ships only the finished
 * frames to the gallery.
 */
export const load = () => ({
  cards: models.map((m) => {
    const c = folded(m.slug, true);
    const last = c.steps[c.steps.length - 1];
    return {
      slug: m.slug,
      name: m.name,
      level: m.level,
      minutes: m.minutes,
      steps: c.steps.length,
      frame: restFrame(last),
      vb: fitStep(last, 0.12, false)
    };
  })
});
