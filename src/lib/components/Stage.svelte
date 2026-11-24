<script lang="ts">
  import { onMount } from 'svelte';
  import type { Plan, Pt } from '$lib/fold/engine';
  import { frameAt, fitStep, restFrame, T_MOVE, T_SHOW, type Frame, type ViewBox } from '$lib/fold/frame';

  interface Props {
    plans: Plan[];
    /** current step (bindable) */
    index?: number;
    /** 'step' loops the current step; 'tour' plays all steps, then restarts */
    mode?: 'step' | 'tour';
    playing?: boolean;
    /** speed multiplier */
    speed?: number;
    /** hold still and show the diagram (prefers-reduced-motion) */
    still?: boolean;
    /** show only the finished model */
    finished?: boolean;
    label?: string;
    oncrease?: () => void;
  }

  let {
    plans,
    index = $bindable(0),
    mode = 'step',
    playing = true,
    speed = 1,
    still = false,
    finished = false,
    label = '',
    oncrease
  }: Props = $props();

  const STEP_MS = 2900;
  const HOLD_MS = 1100;
  const TOUR_STEP_MS = 1500;
  const TOUR_HOLD_MS = 2600;

  let u = $state(0);
  let vb = $state<ViewBox>({ x: -120, y: -120, w: 240, h: 240 });
  let elapsed = 0;
  let lastIndex = -1;
  let creased = false;

  const plan = $derived(plans[Math.min(index, plans.length - 1)]);

  const frame: Frame = $derived.by(() => {
    if (finished) return restFrame(plans[plans.length - 1]);
    if (still) return frameAt(plan, T_SHOW);
    return frameAt(plan, u, mode === 'step');
  });

  function targetVB(): ViewBox {
    if (finished) return fitStep(plans[plans.length - 1], 0.16);
    return fitStep(plan, mode === 'tour' ? 0.14 : 0.2);
  }

  // snap the camera on first paint
  vb = targetVB();

  onMount(() => {
    let raf = 0;
    let prev = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(64, now - prev);
      prev = now;

      if (index !== lastIndex) {
        lastIndex = index;
        elapsed = 0;
        creased = false;
      }

      if (playing && !still && !finished) {
        elapsed += dt * speed;
        const dur = mode === 'tour' ? TOUR_STEP_MS : STEP_MS;
        const hold = mode === 'tour' ? (index === plans.length - 1 ? TOUR_HOLD_MS : 250) : HOLD_MS;
        u = Math.min(1, elapsed / dur);
        if (!creased && u >= T_MOVE && (plan.step.op === 'fold' || plan.step.op === 'reshape')) {
          creased = true;
          oncrease?.();
        }
        if (elapsed > dur + hold) {
          elapsed = 0;
          creased = false;
          if (mode === 'tour') {
            index = (index + 1) % plans.length;
            lastIndex = index;
          }
        }
      }

      // camera glides toward its target
      const tgt = targetVB();
      const k = 1 - Math.exp(-dt / 180);
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
  const dash = $derived(
    (kind: string) =>
      kind === 'valley'
        ? `${sw * 5} ${sw * 3.5}`
        : kind === 'mountain'
          ? `${sw * 7} ${sw * 2.5} ${sw * 1.2} ${sw * 2.5}`
          : `${sw * 1.4} ${sw * 3}`
  );
  const arrowDraw = $derived(Math.max(0, (frame.overlay.draw - 0.25) / 0.75));
</script>

<svg
  class="stage"
  viewBox="{vb.x} {vb.y} {vb.w} {vb.h}"
  role="img"
  aria-label={label || plan.step.alt}
>
  <!-- soft cast shadow -->
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

  {#if frame.overlay.alpha > 0}
    <g class="overlay" style="opacity:{frame.overlay.alpha}" filter="url(#wobble-ink)">
      {#each frame.overlay.creases as c}
        {@const e = lerp(c.a, c.b, frame.overlay.draw)}
        <line
          class="crease {c.kind}"
          x1={c.a[0]}
          y1={c.a[1]}
          x2={e[0]}
          y2={e[1]}
          stroke-width={sw * 1.5}
          stroke-dasharray={dash(c.kind)}
        />
      {/each}
      {#each frame.overlay.arrows as a}
        <path
          class="arrow {a.kind}"
          d={a.d}
          pathLength="1"
          stroke-dasharray="1"
          stroke-dashoffset={1 - arrowDraw}
          stroke-width={sw * 1.6}
        />
        {#if arrowDraw > 0.92}
          <polyline class="arrow-head" points={P(a.head)} stroke-width={sw * 1.6} />
        {/if}
      {/each}
      {#if frame.overlay.repeat}
        {@const r = frame.overlay.repeat}
        <g class="repeat" transform="translate({r[0]} {r[1]}) scale({vb.w / 240})">
          <path d="M-8,-2 A8,8 0 1 1 -2,7" stroke-width="1.6" />
          <polyline points="-6,3 -2,7 -6,10" stroke-width="1.6" />
        </g>
      {/if}
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
    stroke: var(--ink);
    stroke-linejoin: round;
  }
  .side-0 {
    fill: var(--paper-a);
  }
  .side-1 {
    fill: var(--paper-b);
  }
  .shade {
    fill: var(--ink);
    stroke: none !important;
  }
  .eye {
    fill: var(--ink);
  }
  .crease,
  .arrow,
  .arrow-head,
  .repeat path,
  .repeat polyline {
    fill: none;
    stroke: var(--ink);
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .crease.axis {
    stroke: var(--kraft-deep);
  }
  .arrow.push {
    stroke: var(--kraft-deep);
  }
</style>
