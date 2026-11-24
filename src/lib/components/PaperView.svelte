<script lang="ts">
  import type { V2 } from '$lib/paper/geom';
  import type { Frame, ViewBox } from '$lib/paper/render';

  let { frame, vb, label = '' }: { frame: Frame; vb: ViewBox; label?: string } = $props();

  const P = (pts: V2[]) => pts.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
  const lerp = (a: V2, b: V2, t: number): V2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

  const sw = $derived(vb.w / 230);
  const dash = (kind: string) =>
    kind === 'valley'
      ? `${sw * 5} ${sw * 3.5}`
      : kind === 'mountain'
        ? `${sw * 7} ${sw * 2.5} ${sw * 1.2} ${sw * 2.5}`
        : kind === 'xray'
          ? `${sw * 1.2} ${sw * 2.2}`
          : `${sw * 1.4} ${sw * 3}`;
  const ov = $derived(frame.overlay);
  const arrowDraw = $derived(Math.max(0, (ov.draw - 0.25) / 0.75));
</script>

{#snippet overlay(halo: boolean)}
  {@const k = halo ? 2.8 : 1}
  <g class:halo>
    {#each ov.creases as c}
      {@const e = lerp(c.a, c.b, ov.draw)}
      <line
        class="crease {c.kind}"
        x1={c.a[0]}
        y1={c.a[1]}
        x2={e[0]}
        y2={e[1]}
        stroke-width={sw * 1.5 * k}
        stroke-dasharray={halo ? undefined : dash(c.kind)}
      />
    {/each}
    {#each ov.arrows as a}
      <path
        class="arrow {a.style}"
        d={a.d}
        pathLength="1"
        stroke-dasharray="1"
        stroke-dashoffset={1 - arrowDraw}
        stroke-width={sw * (a.style === 'push' ? 3.2 : 1.6) * k}
      />
      {#if a.style === 'push' && !halo}
        <path class="arrow push-core" d={a.d} pathLength="1" stroke-dasharray="1" stroke-dashoffset={1 - arrowDraw} stroke-width={sw * 1.4} />
      {/if}
      {#if arrowDraw > 0.92}
        <polyline
          class="arrow-head {a.style}"
          class:filled={a.style === 'valley' || a.style === 'unfold' || a.style === 'flip' || a.style === 'rotate' || a.style === 'lift'}
          points={P(a.head)}
          stroke-width={sw * 1.6 * k}
        />
      {/if}
      {#if a.tail && arrowDraw > 0.05}
        <polyline class="arrow-head hollow" points={P(a.tail)} stroke-width={sw * 1.6 * k} />
      {/if}
    {/each}
    {#each ov.dots as d}
      <circle class="dot" cx={d[0]} cy={d[1]} r={sw * (halo ? 4.2 : 2.6)} />
    {/each}
    {#if ov.repeat && !halo}
      <g class="repeat" transform="translate({ov.repeat.at[0]} {ov.repeat.at[1]}) scale({vb.w / 240})">
        <path d="M-8,-2 A8,8 0 1 1 -2,7" stroke-width="1.6" />
        <polyline points="-6,3 -2,7 -6,10" stroke-width="1.6" />
        <text x="12" y="6">×{ov.repeat.n}</text>
      </g>
    {/if}
  </g>
{/snippet}

<svg class="stage" viewBox="{vb.x} {vb.y} {vb.w} {vb.h}" role="img" aria-label={label}>
  <g class="shadow" transform="translate({sw * 2.2} {sw * 3})">
    {#each frame.polys as p}
      <polygon points={P(p.pts)} />
    {/each}
  </g>

  <g class="paper" filter="url(#wobble)" stroke-width={sw * 1.1}>
    {#each frame.polys as p}
      <polygon class="side-{p.side}" points={P(p.pts)} />
      {#if p.shade > 0.02}
        <polygon class="shade" points={P(p.pts)} style="opacity:{p.shade * 0.4}" />
      {/if}
    {/each}
  </g>

  {#each frame.eyes as e}
    <circle class="eye" cx={e.at[0]} cy={e.at[1]} r={e.r} />
  {/each}

  {#if ov.alpha > 0 && ov.draw > 0.02}
    <g class="overlay" style="opacity:{ov.alpha}" filter="url(#wobble-ink)">
      {@render overlay(true)}
      {@render overlay(false)}
    </g>
  {/if}
</svg>

<style>
  .stage {
    width: 100%;
    height: 100%;
    display: block;
    overflow: visible;
  }
  .shadow polygon {
    fill: var(--shadow);
    stroke: none;
  }
  .paper polygon {
    stroke: var(--paper-edge);
    stroke-linejoin: round;
  }
  .side-0 {
    fill: var(--paper-a);
  }
  .side-1 {
    fill: var(--paper-b);
  }
  .shade {
    fill: var(--paper-edge);
    stroke: none !important;
  }
  .eye {
    fill: var(--paper-edge);
  }
  .crease,
  .arrow,
  .arrow-head,
  .repeat path,
  .repeat polyline {
    fill: none;
    stroke: var(--paper-edge);
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .arrow-head.filled {
    fill: var(--paper-edge);
  }
  .arrow-head.hollow {
    fill: var(--paper-b);
  }
  .arrow.push-core {
    stroke: var(--paper-b);
  }
  .crease.axis,
  .arrow.lift {
    stroke: var(--kraft-deep);
  }
  .dot {
    fill: var(--blue);
    stroke: var(--paper-edge);
    stroke-width: 0.6;
  }
  .repeat text {
    font-family: var(--font-hand);
    font-size: 16px;
    fill: var(--paper-edge);
  }
  .halo * {
    stroke: var(--halo) !important;
  }
  .halo .dot,
  .halo .arrow-head.filled,
  .halo .arrow-head.hollow {
    fill: var(--halo) !important;
  }
</style>
