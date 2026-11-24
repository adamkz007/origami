<script lang="ts">
  let { open = $bindable(false) }: { open?: boolean } = $props();
  let dlg: HTMLDialogElement | undefined = $state();

  $effect(() => {
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  });
</script>

<dialog
  bind:this={dlg}
  onclose={() => (open = false)}
  onclick={(e) => e.target === dlg && (open = false)}
  aria-label="Symbol key"
>
  <div class="sheet">
    <button class="icon-btn close" onclick={() => (open = false)} aria-label="Close">
      <svg viewBox="0 0 24 24"><path d="M6 6 L18 18 M18 6 L6 18" /></svg>
    </button>
    <ul>
      <li>
        <svg viewBox="0 0 80 50"><line x1="8" y1="25" x2="72" y2="25" class="valley" /></svg>
        <span>valley</span>
      </li>
      <li>
        <svg viewBox="0 0 80 50"><line x1="8" y1="25" x2="72" y2="25" class="mountain" /></svg>
        <span>mountain</span>
      </li>
      <li>
        <svg viewBox="0 0 80 50">
          <path d="M14 38 Q40 0 66 34" class="ink" /><polyline points="58,31 66,34 66,26" class="ink" />
        </svg>
        <span>fold</span>
      </li>
      <li>
        <svg viewBox="0 0 80 50">
          <path d="M10 28 C26 48 34 6 40 28 S58 40 70 28" class="ink" /><polyline points="62,26 70,28 66,35" class="ink" />
        </svg>
        <span>turn over</span>
      </li>
      <li>
        <svg viewBox="0 0 80 50">
          <path d="M28 12 A16 16 0 1 1 26 38" class="ink" /><polyline points="32,40 26,38 30,32" class="ink" />
        </svg>
        <span>rotate</span>
      </li>
      <li>
        <svg viewBox="0 0 80 50">
          <line x1="8" y1="25" x2="72" y2="25" class="axis" />
          <path d="M40 44 Q56 25 40 6" class="push" /><polyline points="35,10 40,6 44,11" class="push" />
        </svg>
        <span>open &amp; squash</span>
      </li>
      <li>
        <svg viewBox="0 0 80 50">
          <g transform="translate(40 25) scale(1.6)">
            <path d="M-8,-2 A8,8 0 1 1 -2,7" class="ink" /><polyline points="-6,3 -2,7 -6,10" class="ink" />
          </g>
        </svg>
        <span>repeat behind</span>
      </li>
    </ul>
  </div>
</dialog>

<style>
  dialog {
    border: 0;
    padding: 0;
    background: transparent;
    max-width: min(560px, calc(100vw - 32px));
    width: 100%;
  }
  dialog::backdrop {
    background: rgba(46, 37, 29, 0.35);
    backdrop-filter: blur(2px);
  }
  .sheet {
    position: relative;
    background: var(--bg);
    border-radius: var(--radius);
    padding: 28px 22px 22px;
    box-shadow: 0 12px 40px var(--shadow);
    color: var(--ink);
  }
  .close {
    position: absolute;
    top: 6px;
    right: 6px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 14px 10px;
  }
  li {
    display: grid;
    justify-items: center;
    gap: 2px;
    font-size: 17px;
    color: var(--ink-soft);
  }
  li svg {
    width: 100%;
    max-width: 120px;
    height: 60px;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .valley,
  .mountain,
  .ink {
    stroke: var(--ink);
    stroke-width: 2.4;
  }
  .valley {
    stroke-dasharray: 9 6;
  }
  .mountain {
    stroke-dasharray: 12 4 2 4;
  }
  .axis {
    stroke: var(--kraft-deep);
    stroke-width: 2.4;
    stroke-dasharray: 2 5;
  }
  .push {
    stroke: var(--kraft-deep);
    stroke-width: 2.4;
  }
</style>
