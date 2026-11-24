<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { prefs } from '$lib/prefs.svelte';
  import { toast } from '$lib/toast.svelte';
  import { ui } from '$lib/ui.svelte';
  import NotationKey from '$lib/components/NotationKey.svelte';

  let { children } = $props();
  onMount(() => {
    prefs.load();
    ui.watchMotion();
  });
</script>

<!-- shared SVG filters: hand-drawn wobble + paper grain -->
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <filter id="wobble" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" result="w" />
      <feDisplacementMap in="SourceGraphic" in2="w" scale="1.8" xChannelSelector="R" yChannelSelector="G" result="d" />
      <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="9" result="g" />
      <feColorMatrix in="g" type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.18  0 0 0 0 0.12  0 0 0 0.55 -0.12" result="g2" />
      <feComposite in="g2" in2="d" operator="in" result="g3" />
      <feMerge><feMergeNode in="d" /><feMergeNode in="g3" /></feMerge>
    </filter>
    <filter id="wobble-ink" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="2" result="w" />
      <feDisplacementMap in="SourceGraphic" in2="w" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </defs>
</svg>

{@render children()}

<NotationKey bind:open={ui.keyOpen} />

<div class="toast" class:show={!!toast.msg} role="status" aria-live="polite">{toast.msg}</div>

<style>
  .toast {
    position: fixed;
    left: 50%;
    bottom: 96px;
    transform: translate(-50%, 20px) rotate(-1deg);
    background: var(--ink);
    color: var(--bg);
    padding: 6px 16px 8px;
    border-radius: 999px;
    font-size: 18px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s, transform 0.25s;
    z-index: 20;
  }
  .toast.show {
    opacity: 1;
    transform: translate(-50%, 0) rotate(-1deg);
  }
</style>
