import { toast } from './toast.svelte';

export async function shareModel(name: string, url: string) {
  const data = { title: `${name} · origa.mi`, text: `Fold a ${name.toLowerCase()} with me`, url };
  try {
    if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
      await navigator.share(data);
      return;
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast.show('link copied');
  } catch {
    window.prompt('Copy this link', url);
  }
}
