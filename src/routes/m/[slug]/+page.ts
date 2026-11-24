import { error } from '@sveltejs/kit';
import { getModel, models } from '$lib/models';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => models.map((m) => ({ slug: m.slug }));

export const load: PageLoad = ({ params }) => {
  const model = getModel(params.slug);
  if (!model) error(404, 'Not found');
  return { slug: model.slug };
};
