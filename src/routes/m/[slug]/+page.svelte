<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { getModel, nextModel } from '$lib/models';
  import { plan } from '$lib/fold/engine';
  import { T_SHOW } from '$lib/fold/frame';
  import { prefs } from '$lib/prefs.svelte';
  import { ui } from '$lib/ui.svelte';
  import { crease } from '$lib/sound';
  import { shareModel } from '$lib/share';
  import Stage from '$lib/components/Stage.svelte';
  import Level from '$lib/components/Level.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import Stamp from '$lib/components/Stamp.svelte';
  import Tools from '$lib/components/Tools.svelte';

  let { data } = $props();

  const model = $derived(getModel(data.slug)!);
  const plans = $derived(plan(model));
  const next = $derived(nextModel(model.slug));
  const n = $derived(plans.length);
  const done = $derived(prefs.isDone(model.slug));

  /**
   * Scroll ↔ fold mapping. `pos` runs 0…n (step index + time in step).
   * Resting points ("snaps") sit where the next fold's lines and arrow are drawn
   * but nothing has moved yet, plus one at the very end (finished model).
   */
  let stepPx = $state(600);
  let viewH = $state(800);
  let scrollY = $state(0);
  const snaps = $derived([...plans.map((_, i) => i + T_SHOW), n]);
  const yFor = (p: number) => (p - T_SHOW) * stepPx;
  const trackH = $derived(yFor(n) + viewH);
  const scrollPos = $derived(Math.max(0, Math.min(n, T_SHOW + scrollY / stepPx)));

  // intro: finished → rewind to blank → draw the first fold lines
  let phase = $state<'finished' | 'rewind' | 'scrub'>('finished');
  let introCap = $state(Infinity);
  const pos = $derived(Math.min(scrollPos, introCap));

  const k = $derived.by(() => {
    let best = 0;
    snaps.forEach((s, i) => {
      if (Math.abs(s - pos) < Math.abs(snaps[best] - pos)) best = i;
    });
    return best;
  });
  const atEnd = $derived(pos > n - 0.12);
  const stepIdx = $derived(Math.min(n - 1, k));

  function startScrub(drawIn: boolean) {
    phase = 'scrub';
    if (!drawIn) {
      introCap = Infinity;
      return;
    }
    introCap = 0;
    const t0 = performance.now();
    const grow = (now: number) => {
      introCap = ((now - t0) / 650) * T_SHOW;
      if (introCap < T_SHOW) requestAnimationFrame(grow);
      else introCap = Infinity;
    };
    requestAnimationFrame(grow);
  }

  function measure() {
    viewH = window.innerHeight;
    stepPx = Math.round(Math.max(320, viewH * 0.7));
  }

  const go = (i: number) => {
    const s = snaps[Math.max(0, Math.min(snaps.length - 1, i))];
    if (phase !== 'scrub') startScrub(false);
    window.scrollTo({ top: yFor(s), behavior: ui.reducedMotion ? 'auto' : 'smooth' });
  };

  onMount(() => {
    measure();
    const html = document.documentElement;
    html.classList.add('snap');
    const onScroll = () => {
      scrollY = window.scrollY;
      if (phase !== 'scrub' && scrollY > 4) startScrub(false);
    };
    onScroll();
    // one wheel / trackpad gesture = one step (touch + keys use native snapping)
    let wheelLock = false;
    let quiet: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || ui.keyOpen || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      e.preventDefault();
      clearTimeout(quiet);
      quiet = setTimeout(() => (wheelLock = false), 220);
      if (wheelLock || Math.abs(e.deltaY) < 4) return;
      wheelLock = true;
      go(k + (e.deltaY > 0 ? 1 : -1));
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure);

    // arriving mid-page (back/forward) or reduced motion: skip the intro
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (window.scrollY > 4 || ui.reducedMotion) startScrub(false);
    else timer = setTimeout(() => phase === 'finished' && (phase = 'rewind'), 650);

    return () => {
      clearTimeout(timer);
      clearTimeout(quiet);
      window.removeEventListener('wheel', onWheel);
      html.classList.remove('snap');
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measure);
    };
  });

  function onkey(e: KeyboardEvent) {
    if (ui.keyOpen) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(k + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(k - 1);
    }
  }

  const share = () => shareModel(model.name, `${page.url.origin}/m/${model.slug}`);
  const toggleDone = () => {
    prefs.toggleDone(model.slug);
    if (prefs.isDone(model.slug) && prefs.sound) crease();
  };
</script>

<svelte:window onkeydown={onkey} />

<svelte:head>
  <title>{model.name} · origa.mi</title>
  <meta name="description" content="Fold a {model.name.toLowerCase()} in {n} animated steps." />
  <meta property="og:title" content="{model.name} · origa.mi" />
  <meta property="og:description" content="Fold a {model.name.toLowerCase()} in {n} animated steps." />
</svelte:head>

<!-- the scroll track: one snap point per step -->
<div class="track" style="height:{trackH}px" aria-hidden="true">
  {#each snaps as s}
    <span class="snap-pt" style="top:{yFor(s)}px"></span>
  {/each}
</div>

<header>
  <a href="/" class="icon-btn" aria-label="All models"><Icon name="back" /></a>
  <div class="title">
    <h1>{model.name}</h1>
    <Level level={model.level} size={14} />
  </div>
  <div class="actions">
    <button class="icon-btn" onclick={share} aria-label="Share this guide" title="share">
      <Icon name="share" />
    </button>
    <button
      class="icon-btn mark"
      class:on={done}
      onclick={toggleDone}
      aria-pressed={done}
      aria-label={done ? 'Completed — tap to undo' : 'Mark completed'}
      title={done ? 'completed' : 'mark completed'}
    >
      <Icon name="stamp" />
    </button>
    <Tools />
  </div>
</header>

<section class="stage-box" style="view-transition-name: model-{model.slug}">
  <Stage
    {plans}
    mode={phase === 'scrub' ? 'scrub' : phase}
    {pos}
    oncrease={() => prefs.sound && crease()}
    onrewound={() => startScrub(true)}
  />
  {#if done && atEnd}
    <span class="done-stamp"><Stamp size={86} /></span>
  {/if}
  <p class="sr-only" aria-live="polite">
    {#if atEnd}
      Finished: {model.name}.
    {:else}
      Step {stepIdx + 1} of {n}. {plans[stepIdx].step.alt}
    {/if}
  </p>
</section>

<footer>
  {#if phase === 'scrub' && k === 0 && pos <= T_SHOW + 0.02}
    <button class="hint" onclick={() => go(1)} aria-label="Scroll to fold">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9 L12 15 L18 9" /></svg>
    </button>
  {/if}

  {#if atEnd}
    <div class="finale">
      <button class="pill" class:on={done} onclick={toggleDone} aria-pressed={done}>
        <Icon name="stamp" />
        {done ? 'Completed' : 'Mark completed'}
      </button>
      {#if next}
        <a class="pill ghost" href="/m/{next.slug}" aria-label="Next model: {next.name}">
          {next.name}
          <Icon name="arrow-right" />
        </a>
      {/if}
    </div>
  {:else}
    <div class="step-no" aria-hidden="true">
      <span class="n">{stepIdx + 1}</span><span class="of">/{n}</span>
    </div>
  {/if}

  <nav class="controls" aria-label="Steps">
    <button class="icon-btn" onclick={() => go(k - 1)} disabled={k === 0} aria-label="Previous step">
      <Icon name="prev" />
    </button>
    <ol class="dots">
      {#each plans as p, i}
        <li>
          <button
            class:on={i === stepIdx}
            class:past={i < stepIdx || atEnd}
            onclick={() => go(i)}
            aria-label="Step {i + 1}"
            aria-current={i === stepIdx ? 'step' : undefined}
            title={p.step.alt}
          ></button>
        </li>
      {/each}
    </ol>
    <button class="icon-btn" onclick={() => go(k + 1)} disabled={k >= snaps.length - 1} aria-label="Next step">
      <Icon name="next" />
    </button>
  </nav>
</footer>

<style>
  :global(html.snap) {
    scroll-snap-type: y mandatory;
  }
  .track {
    position: relative;
    width: 1px;
  }
  .snap-pt {
    position: absolute;
    left: 0;
    width: 1px;
    height: 1px;
    scroll-snap-align: start;
    scroll-snap-stop: always;
  }

  header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 3;
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: 880px;
    margin: 0 auto;
    padding: 10px 16px;
  }
  .title {
    flex: 1;
    display: flex;
    align-items: baseline;
    gap: 10px;
    min-width: 0;
  }
  h1 {
    font-size: 38px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .actions {
    display: flex;
    align-items: center;
  }
  .mark.on :global(svg) {
    stroke: var(--stamp);
    stroke-width: 2.4;
  }

  .stage-box {
    position: fixed;
    z-index: 1;
    left: 50%;
    top: calc(68px + (100dvh - 68px - 170px) / 2);
    transform: translate(-50%, -50%);
    width: min(calc(100vw - 32px), calc(100dvh - 250px), 620px);
    aspect-ratio: 1;
  }
  .done-stamp {
    position: absolute;
    right: 0;
    top: 0;
    animation: thunk 0.35s cubic-bezier(0.3, 1.6, 0.5, 1);
  }
  @keyframes thunk {
    from {
      transform: scale(1.8);
      opacity: 0;
    }
  }

  footer {
    position: fixed;
    z-index: 2;
    left: 0;
    right: 0;
    bottom: 0;
    display: grid;
    justify-items: center;
    gap: 4px;
    padding: 0 16px 14px;
    pointer-events: none;
  }
  footer > * {
    pointer-events: auto;
  }

  .hint {
    position: absolute;
    bottom: 170px;
    width: 48px;
    height: 48px;
    display: grid;
    place-items: center;
    animation: nudge 1.6s ease-in-out infinite;
  }
  .hint svg {
    width: 34px;
    height: 34px;
    fill: none;
    stroke: var(--blue);
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  @keyframes nudge {
    50% {
      transform: translateY(8px);
      opacity: 0.6;
    }
  }

  .step-no {
    font-family: var(--font-hand);
    color: var(--ink-soft);
    line-height: 1;
    min-height: 46px;
  }
  .step-no .n {
    font-size: 44px;
    color: var(--ink);
    font-weight: 700;
  }
  .step-no .of {
    font-size: 26px;
  }

  .finale {
    display: flex;
    justify-content: center;
    gap: 10px;
    flex-wrap: wrap;
    min-height: 46px;
    animation: rise 0.35s ease-out;
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 16px 8px 12px;
    border-radius: 999px;
    background: var(--ink);
    color: var(--bg);
    font-size: 20px;
    transition: transform 0.15s;
  }
  .pill:active {
    transform: scale(0.96);
  }
  .pill :global(svg) {
    width: 22px;
    height: 22px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .pill.on {
    background: var(--stamp);
    color: #fff;
  }
  .pill.ghost {
    background: var(--bg);
    color: var(--ink);
    border: 2px dashed var(--kraft);
    padding-left: 16px;
    padding-right: 12px;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .controls button:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .dots {
    list-style: none;
    display: flex;
    margin: 0;
    padding: 0;
    flex-wrap: wrap;
    justify-content: center;
    max-width: calc(100vw - 120px);
  }
  .dots button {
    width: 20px;
    height: 34px;
    display: grid;
    place-items: center;
  }
  .dots button::after {
    content: '';
    width: 9px;
    height: 9px;
    border-radius: 50%;
    border: 1.6px solid var(--kraft-deep);
    transition:
      transform 0.2s,
      background 0.2s;
  }
  .dots button.past::after {
    background: var(--kraft);
  }
  .dots button.on::after {
    background: var(--ink);
    border-color: var(--ink);
    transform: scale(1.35);
  }

  @media (max-width: 560px) {
    h1 {
      font-size: 32px;
    }
    .title :global(.level) {
      display: none;
    }
    .dots button {
      width: 17px;
    }
  }
</style>
