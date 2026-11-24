<script lang="ts">
  import { onMount } from 'svelte';
  import type { Compiled } from '$lib/paper/model';
  import { fitEnds, fitStep, frameAt, lerpBox, motionT, restFrame, T_MOVE, type Frame, type ViewBox } from '$lib/paper/render';
  import PaperView from './PaperView.svelte';

  /**
   * finished – the folded model, still
   * rewind   – plays every step backwards to a blank sheet, then calls onrewound
   * scrub    – `pos` (0…steps) drives the folding, e.g. from scroll position
   */
  interface Props {
    model: Compiled;
    mode?: 'finished' | 'rewind' | 'scrub';
    pos?: number;
    label?: string;
    oncrease?: () => void;
    onrewound?: () => void;
  }

  let { model, mode = 'finished', pos = 0, label = '', oncrease, onrewound }: Props = $props();

  const steps = $derived(model.steps);
  const n = $derived(steps.length);
  let rewindPos = $state(0);
  let lastPos = 0;

  const clampPos = (p: number) => Math.max(0, Math.min(n, p));
  const split = (p: number) => {
    const c = clampPos(p);
    const i = Math.min(n - 1, Math.floor(c));
    return { i, u: c - i };
  };
  const cur = $derived(mode === 'rewind' ? split(rewindPos) : split(pos));

  const frame: Frame = $derived.by(() => {
    if (mode === 'finished') return restFrame(steps[n - 1]);
    if (mode === 'rewind') return frameAt(steps[cur.i], cur.u, { overlay: false, t: cur.u });
    return frameAt(steps[cur.i], cur.u);
  });

  // framing is expensive: compute once per step, then glide from the step's
  // start framing to its end framing as the fold plays
  const fits = new Map<number, { start: ViewBox; end: ViewBox }>();
  let finishedFit: ViewBox | null = null;
  function ends(i: number) {
    let v = fits.get(i);
    if (!v) {
      v = fitEnds(steps[i], 0.16);
      fits.set(i, v);
    }
    return v;
  }
  function target(): ViewBox {
    if (mode === 'finished') return (finishedFit ??= fitStep(steps[n - 1], 0.12, false));
    const e = ends(cur.i);
    const t = mode === 'rewind' ? cur.u : motionT(cur.u);
    return lerpBox(e.start, e.end, t);
  }

  let vb = $state<ViewBox>({ x: -120, y: -120, w: 240, h: 240 });
  vb = target();

  // crease sound when a fold lands while scrubbing forwards
  $effect(() => {
    if (mode !== 'scrub') return;
    const p = clampPos(pos);
    if (p > lastPos) {
      for (let i = Math.floor(lastPos); i <= Math.floor(p) && i < n; i++) {
        const at = i + T_MOVE;
        if (lastPos < at && p >= at && steps[i].pieces.some((pc) => pc.path.length)) {
          oncrease?.();
          break;
        }
      }
    }
    lastPos = p;
  });

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
      const tgt = target();
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
</script>

<PaperView {frame} {vb} label={label || steps[cur.i].text} />
