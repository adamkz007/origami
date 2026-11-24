<script lang="ts">
  /** Difficulty as folded corners: filled = level, outline = remaining. */
  let { level, size = 16 }: { level: number; size?: number } = $props();
</script>

<span class="level" role="img" aria-label="Difficulty {level} of 5">
  {#each [1, 2, 3, 4, 5] as i}
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
      <path d="M2 2 H14 L2 14 Z" class:on={i <= level} />
      <path d="M2 2 L8 8" class="crease" />
    </svg>
  {/each}
</span>

<style>
  .level {
    display: inline-flex;
    gap: 2px;
    vertical-align: middle;
  }
  path {
    fill: transparent;
    stroke: var(--ink-soft);
    stroke-width: 1.3;
    stroke-linejoin: round;
  }
  path.on {
    fill: var(--kraft-deep);
    stroke: var(--ink);
  }
  .crease {
    stroke-dasharray: 1.5 1.5;
    stroke-width: 1;
  }
</style>
