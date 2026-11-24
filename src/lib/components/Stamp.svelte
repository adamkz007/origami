<script lang="ts">
  /** A rubber-stamp "folded!" mark for completed models. */
  let { size = 64 }: { size?: number } = $props();
</script>

<svg class="stamp" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
  <circle cx="32" cy="32" r="27" />
  <circle cx="32" cy="32" r="22" class="inner" />
  <path d="M21 33 L29 41 L44 23" class="tick" />
</svg>

<style>
  .stamp {
    transform: rotate(-14deg);
    filter: url(#wobble-ink);
    opacity: 0.85;
  }
  circle {
    fill: none;
    stroke: var(--stamp);
    stroke-width: 3;
  }
  .inner {
    stroke-width: 1.4;
    stroke-dasharray: 3 2.4;
  }
  .tick {
    fill: none;
    stroke: var(--stamp);
    stroke-width: 5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
