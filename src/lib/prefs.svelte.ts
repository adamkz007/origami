/**
 * Per-browser preferences. Everything lives in localStorage for now;
 * "Connect with Google" will sync `completed` to an account later.
 */
const KEY_DONE = 'origami.completed';
const KEY_SOUND = 'origami.sound';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / blocked storage: keep in memory only */
  }
}

class Prefs {
  completed = $state<string[]>([]);
  sound = $state(false);
  loaded = $state(false);

  load() {
    if (this.loaded) return;
    this.completed = read<string[]>(KEY_DONE, []);
    this.sound = read<boolean>(KEY_SOUND, false);
    this.loaded = true;
  }

  isDone(slug: string) {
    return this.completed.includes(slug);
  }

  toggleDone(slug: string) {
    this.completed = this.isDone(slug)
      ? this.completed.filter((s) => s !== slug)
      : [...this.completed, slug];
    write(KEY_DONE, this.completed);
  }

  toggleSound() {
    this.sound = !this.sound;
    write(KEY_SOUND, this.sound);
  }
}

export const prefs = new Prefs();
