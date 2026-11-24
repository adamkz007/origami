<script lang="ts">
  import { onMount } from 'svelte';
  import type { Plan, Pt } from '$lib/fold/engine';
  import { frameAt, fitStep, restFrame, T_MOVE, type Frame, type ViewBox } from '$lib/fold/frame';

  /**
   * finished – the folded model, still
   * rewind   – plays every step backwards to a blank sheet, then calls onrewound
   * scrub    – `pos` (0…steps) drives the folding, e.g. from scroll position
   */
  interface Props {
    plans: Plan[];
    mode?: 'finished' | 'rewind' | 'scrub';
    pos?: number;
    label?: string;
    oncrease?: () => void;
    onrewound?: () => void;
  }

  let { plans, mode = 'finished', pos = 0, label = '', oncrease, onrewound }: Props = $props();

  const n = $derived(plans.length);
  let rewindPos = $state(0);
  let lastPos = 0;

  const clampPos = (p: number) => Math.max(0, Math.min(n, p));
  /** split a position into a step index and time within that step */
  const split = (p: number) => {
    const c = clampPos(p);
    const i = Math.min(n - 1, Math.floor(c));
    return { i, u: c - i };
  };

  const cur = $derived(mode === 'rewind' ? split(rewindPos) : split(pos));

  const frame: Frame = $derived.by(() => {
    if (mode === 'finished') return restFrame(plans[n - 1]);
    return frameAt(plans[cur.i], cur.u, mode === 'scrub');
  });

  function targetVB(): ViewBox {
    if (mode === 'finished') return fitStep(plans[n - 1], 0.14);
    return fitStep(plans[cur.i], 0.2);
  }

  let vb = $state<ViewBox>({ x: -120, y: -120, w: 240, h: 240 });
  vb = targetVB();

  // crease sound when a fold lands while scrubbing forwards
  $effect(() => {
    if (mode !== 'scrub') return;
    const p = clampPos(pos);
    if (p > lastPos) {
      for (let i = Math.floor(lastPos); i <= Math.floor(p) && i < n; i++) {
        const at = i + T_MOVE;
        const op = plans[i].step.op;
        if (lastPos < at && p >= at && (op === 'fold' || op === 'reshape')) {
          oncrease?.();
          break;
        }
      }
    }
    lastPos = p;
  });

  // start a rewind from the finished model whenever we enter rewind mode
  $effect(() => {
    if (mode === 'rewind') rewindPos = n;
  });

  onMount(() => {
    let raf = 0;
    let prev = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(64, now - prev);
      prev = now;

      if (mode === 'rewind' && rewindPos > 0) {
        const perStep = Math.max(150, Math.min(360, 2600 / n));
        rewindPos = Math.max(0, rewindPos - dt / perStep);
        if (rewindPos === 0) onrewound?.();
      }

      const tgt = targetVB();
      const k = 1 - Math.exp(-dt / (mode === 'rewind' ? 120 : 200));
      vb = {
        x: vb.x + (tgt.x - vb.x) * k,
        y: vb.y + (tgt.y - vb.y) * k,
        w: vb.w + (tgt.w - vb.w) * k,
        h: vb.h + (tgt.h - vb.h) * k
      };
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  const P = (pts: Pt[]) => pts.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
  const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

  const sw = $derived(vb.w / 230);
  const dash = (kind: string) =>
    kind === 'valley'
      ? `${sw * 5} ${sw * 3.5}`
      : kind === 'mountain'
        ? `${sw * 7} ${sw * 2.5} ${sw * 1.2} ${sw * 2.5}`
        : `${sw * 1.4} ${sw * 3}`;
  const arrowDraw = $derived(Math.max(0, (frame.overlay.draw - 0.25) / 0.75));
</script>

{#snippet overlay(halo: boolean)}
  {@const k = halo ? 2.8 : 1}
  <g class:halo>
    {#each frame.overlay.creases as c}
      {@const e = lerp(c.a, c.b, frame.overlay.draw)}
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
    {#each frame.overlay.arrows as a}
      <path
        class="arrow {a.kind}"
        d={a.d}
        pathLength="1"
        stroke-dasharray="1"
        stroke-dashoffset={1 - arrowDraw}
        stroke-width={sw * 1.6 * k}
      />
      {#if arrowDraw > 0.92}
        <polyline class="arrow-head" points={P(a.head)} stroke-width={sw * 1.6 * k} />
      {/if}
    {/each}
    {#if frame.overlay.repeat}
      {@const r = frame.overlay.repeat}
      <g class="repeat" transform="translate({r[0]} {r[1]}) scale({vb.w / 240})">
        <path d="M-8,-2 A8,8 0 1 1 -2,7" stroke-width={1.6 * k} />
        <polyline points="-6,3 -2,7 -6,10" stroke-width={1.6 * k} />
      </g>
    {/if}
  </g>
{/snippet}

<svg class="stage" viewBox="{vb.x} {vb.y} {vb.w} {vb.h}" role="img" aria-label={label || plans[cur.i].step.alt}>
  <g class="shadow" transform="translate({sw * 2.2} {sw * 3})">
    {#each frame.polys as p}
      <polygon points={P(p.pts)} />
    {/each}
  </g>

  <g class="paper" filter="url(#wobble)" stroke-width={sw * 1.1}>
    {#each frame.polys as p}
      <polygon class="side-{p.side}" points={P(p.pts)} />
      {#if p.shade > 0.02}
        <polygon class="shade" points={P(p.pts)} style="opacity:{p.shade * 0.38}" />
      {/if}
    {/each}
  </g>

  {#each frame.marks as m}
    <circle class="eye" cx={m.at[0]} cy={m.at[1]} r={m.r * (vb.w / 260)} />
  {/each}

  {#if frame.overlay.alpha > 0 && frame.overlay.draw > 0.02}
    <g class="overlay" style="opacity:{frame.overlay.alpha}" filter="url(#wobble-ink)">
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
  .crease.axis,
  .arrow.push {
    stroke: var(--kraft-deep);
  }
  .halo * {
    stroke: var(--halo) !important;
  }
</style>
