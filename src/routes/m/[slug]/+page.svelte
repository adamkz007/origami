<script lang="ts">
  import { page } from '$app/state';
  import { getModel, nextModel } from '$lib/models';
  import { plan } from '$lib/fold/engine';
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

  let index = $state(0);
  let playing = $state(true);
  const last = $derived(index === plans.length - 1);
  const done = $derived(prefs.isDone(model.slug));

  // reset when navigating between models
  $effect(() => {
    void data.slug;
    index = 0;
    playing = true;
  });

  const go = (i: number) => {
    index = Math.max(0, Math.min(plans.length - 1, i));
    playing = true;
  };

  function onkey(e: KeyboardEvent) {
    if (ui.keyOpen || (e.target as HTMLElement)?.closest('input,textarea')) return;
    if (e.key === 'ArrowRight') go(index + 1);
    else if (e.key === 'ArrowLeft') go(index - 1);
    else if (e.key === ' ') {
      e.preventDefault();
      playing = !playing;
    }
  }

  // swipe between steps
  let sx = 0;
  let sy = 0;
  const down = (e: PointerEvent) => {
    sx = e.clientX;
    sy = e.clientY;
  };
  const up = (e: PointerEvent) => {
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) go(index + (dx < 0 ? 1 : -1));
  };

  const share = () => shareModel(model.name, `${page.url.origin}/m/${model.slug}`);
  const toggleDone = () => {
    prefs.toggleDone(model.slug);
    if (prefs.isDone(model.slug) && prefs.sound) crease();
  };
</script>

<svelte:window onkeydown={onkey} />

<svelte:head>
  <title>{model.name} · origa.mi</title>
  <meta name="description" content="Fold a {model.name.toLowerCase()} in {plans.length} animated steps." />
  <meta property="og:title" content="{model.name} · origa.mi" />
  <meta property="og:description" content="Fold a {model.name.toLowerCase()} in {plans.length} animated steps." />
</svelte:head>

<div class="screen">
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

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <section class="stage-wrap" onpointerdown={down} onpointerup={up}>
    <div class="stage-box">
      <Stage
        {plans}
        bind:index
        {playing}
        still={ui.reducedMotion}
        oncrease={() => prefs.sound && crease()}
      />
      {#if done && last}
        <span class="done-stamp"><Stamp size={86} /></span>
      {/if}
    </div>
    <p class="sr-only" aria-live="polite">Step {index + 1} of {plans.length}. {plans[index].step.alt}</p>
  </section>

  <div class="step-no" aria-hidden="true">
    <span class="n">{index + 1}</span><span class="of">/{plans.length}</span>
  </div>

  {#if last}
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
  {/if}

  <nav class="controls" aria-label="Steps">
    <div class="buttons">
    <button class="icon-btn" onclick={() => go(index - 1)} disabled={index === 0} aria-label="Previous step">
      <Icon name="prev" />
    </button>
    <button class="icon-btn play" onclick={() => (playing = !playing)} aria-label={playing ? 'Pause' : 'Play'}>
      <Icon name={playing ? 'pause' : 'play'} />
    </button>
    <button class="icon-btn" onclick={() => go(index + 1)} disabled={last} aria-label="Next step">
      <Icon name="next" />
    </button>
    </div>

    <ol class="dots">
      {#each plans as p, i}
        <li>
          <button
            class:on={i === index}
            class:past={i < index}
            onclick={() => go(i)}
            aria-label="Step {i + 1}"
            aria-current={i === index ? 'step' : undefined}
            title={p.step.alt}
          ></button>
        </li>
      {/each}
    </ol>
  </nav>
</div>

<style>
  .screen {
    min-height: 100dvh;
    display: grid;
    grid-template-rows: auto 1fr auto auto auto;
    max-width: 880px;
    margin: 0 auto;
    padding: 10px 16px 14px;
  }
  header {
    display: flex;
    align-items: center;
    gap: 6px;
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

  .stage-wrap {
    position: relative;
    display: grid;
    place-items: center;
    min-height: 0;
    touch-action: pan-y;
    user-select: none;
  }
  .stage-box {
    position: relative;
    width: min(100%, 62dvh, 620px);
    aspect-ratio: 1;
  }
  .done-stamp {
    position: absolute;
    right: 2%;
    top: 2%;
    animation: thunk 0.35s cubic-bezier(0.3, 1.6, 0.5, 1);
  }
  @keyframes thunk {
    from {
      transform: scale(1.8);
      opacity: 0;
    }
  }

  .step-no {
    text-align: center;
    font-family: var(--font-hand);
    color: var(--ink-soft);
    line-height: 1;
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
    padding: 8px 0 2px;
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
    background: transparent;
    color: var(--ink);
    border: 2px dashed var(--kraft);
    padding-left: 16px;
    padding-right: 12px;
  }

  .controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding-top: 8px;
    flex-wrap: wrap;
  }
  .buttons {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .controls .play {
    width: 54px;
    height: 54px;
    background: var(--card);
  }
  .controls button:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .dots {
    list-style: none;
    display: flex;
    gap: 0;
    margin: 0 0 0 10px;
    padding: 0;
    flex-wrap: wrap;
    justify-content: center;
  }
  .dots button {
    width: 22px;
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
    .controls {
      flex-direction: column;
      gap: 2px;
    }
    .dots {
      margin: 0;
    }
    h1 {
      font-size: 32px;
    }
  }
</style>
