class UI {
  keyOpen = $state(false);
  reducedMotion = $state(false);

  watchMotion() {
    try {
      const mq = matchMedia('(prefers-reduced-motion: reduce)');
      this.reducedMotion = mq.matches;
      mq.addEventListener('change', (e) => (this.reducedMotion = e.matches));
    } catch {
      /* no matchMedia */
    }
  }
}
export const ui = new UI();
