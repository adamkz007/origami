<script lang="ts">
  import { onMount } from 'svelte';
  import { models } from '$lib/models';
  import { plan } from '$lib/fold/engine';
  import { prefs } from '$lib/prefs.svelte';
  import { ui } from '$lib/ui.svelte';
  import Stage from '$lib/components/Stage.svelte';
  import Level from '$lib/components/Level.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import Stamp from '$lib/components/Stamp.svelte';
  import Tools from '$lib/components/Tools.svelte';

  const cards = models.map((m) => ({ model: m, plans: plan(m) }));

  // only animate cards that are on screen
  let visible = $state<Record<string, boolean>>({});
  let mounted = $state(false);

  function inView(node: HTMLElement, slug: string) {
    const io = new IntersectionObserver(([e]) => (visible[slug] = e.isIntersecting), {
      rootMargin: '80px'
    });
    io.observe(node);
    return { destroy: () => io.disconnect() };
  }

  onMount(() => (mounted = true));

  const doneCount = $derived(models.filter((m) => prefs.isDone(m.slug)).length);
</script>

<svelte:head>
  <title>origa.mi</title>
  <meta name="description" content="Animated origami guides, from simple to hard." />
  <meta property="og:title" content="origa.mi" />
  <meta property="og:description" content="Animated origami guides, from simple to hard." />
</svelte:head>

<header>
  <a href="/" class="logo" aria-label="origa.mi home">
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M8 40 L30 30 L22 12 L36 30 L56 20 L40 38 L28 52 Z" class="a" />
      <path d="M30 30 L40 38 L28 52 Z" class="b" />
    </svg>
    <h1>origa<span>.</span>mi</h1>
  </a>
  <Tools />
</header>

<main>
  {#if prefs.loaded && doneCount > 0}
    <p class="progress" aria-label="{doneCount} of {models.length} folded">
      <Stamp size={26} />
      {doneCount}/{models.length}
    </p>
  {/if}

  <ol class="path">
    <svg class="trail" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path d="M50 0 C 15 18, 85 32, 50 50 S 15 82, 50 100" vector-effect="non-scaling-stroke" />
    </svg>

    {#each cards as { model, plans }, i (model.slug)}
      {@const prevLevel = i > 0 ? cards[i - 1].model.level : 0}
      {#if model.level !== prevLevel}
        <li class="milestone" aria-hidden="true">
          <span><Level level={model.level} size={18} /></span>
        </li>
      {/if}
      <li class="stop" class:right={i % 2 === 1}>
        <a
          href="/m/{model.slug}"
          class="card"
          style="--tilt:{[-1.2, 1, -0.6, 1.3][i % 4]}deg"
          use:inView={model.slug}
        >
          <div class="preview">
            {#if mounted}
              <Stage
                {plans}
                mode="tour"
                playing={!!visible[model.slug] && !ui.reducedMotion}
                finished={ui.reducedMotion}
                label="{model.name}: {plans.length} steps"
              />
            {/if}
          </div>
          <div class="meta">
            <h2>{model.name}</h2>
            <div class="facts">
              <Level level={model.level} />
              <span class="fact" aria-label="{plans.length} steps"><Icon name="steps" />{plans.length}</span>
              <span class="fact" aria-label="{model.minutes} minutes"><Icon name="clock" />{model.minutes}′</span>
            </div>
          </div>
          {#if prefs.isDone(model.slug)}
            <span class="done" aria-label="completed"><Stamp size={58} /></span>
          {/if}
        </a>
      </li>
    {/each}

    <li class="milestone soon" aria-label="more models coming">
      <span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12 h.01 M12 12 h.01 M19 12 h.01" /></svg>
      </span>
    </li>
  </ol>
</main>

<style>
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    max-width: 880px;
    margin: 0 auto;
    padding: 18px 16px 0;
  }
  .logo {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .logo svg {
    width: 46px;
    height: 46px;
    filter: url(#wobble-ink);
  }
  .logo .a {
    fill: var(--paper-a);
    stroke: var(--ink);
    stroke-width: 2.4;
    stroke-linejoin: round;
  }
  .logo .b {
    fill: var(--paper-b);
    stroke: var(--ink);
    stroke-width: 2.4;
    stroke-linejoin: round;
  }
  h1 {
    font-size: 46px;
    letter-spacing: 0.5px;
  }
  h1 span {
    color: var(--kraft-deep);
  }

  main {
    max-width: 880px;
    margin: 0 auto;
    padding: 8px 16px 80px;
  }

  .progress {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin: 4px 0 0;
    font-size: 20px;
    color: var(--ink-soft);
  }

  .path {
    position: relative;
    list-style: none;
    margin: 0;
    padding: 24px 0 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .trail {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
  }
  .trail path {
    fill: none;
    stroke: var(--kraft);
    stroke-width: 2.5;
    stroke-dasharray: 10 8;
    stroke-linecap: round;
  }

  .milestone {
    position: relative;
    z-index: 1;
    display: flex;
    justify-content: center;
    padding: 6px 0;
  }
  .milestone span {
    background: var(--bg);
    border: 2px solid var(--kraft);
    border-radius: 999px;
    padding: 6px 12px 4px;
  }
  .soon svg {
    width: 28px;
    height: 18px;
    fill: none;
    stroke: var(--kraft-deep);
    stroke-width: 3.5;
    stroke-linecap: round;
    display: block;
  }

  .stop {
    position: relative;
    z-index: 1;
    display: flex;
    justify-content: flex-start;
  }
  .stop.right {
    justify-content: flex-end;
  }

  .card {
    position: relative;
    width: min(100%, 380px);
    background: var(--card);
    border-radius: var(--radius);
    padding: 12px 12px 14px;
    box-shadow:
      0 1px 0 var(--kraft) inset,
      0 6px 18px var(--shadow);
    transform: rotate(var(--tilt));
    transition:
      transform 0.25s,
      box-shadow 0.25s;
    display: block;
  }
  .card:hover {
    transform: rotate(0deg) translateY(-3px);
    box-shadow: 0 12px 28px var(--shadow);
  }
  .preview {
    aspect-ratio: 1;
    border-radius: 10px;
    background: var(--bg);
    padding: 6%;
  }
  .meta {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 4px 0;
    flex-wrap: wrap;
  }
  h2 {
    font-size: 38px;
  }
  .facts {
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--ink-soft);
  }
  .fact {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
  .fact :global(svg) {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: var(--ink-soft);
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .done {
    position: absolute;
    top: 4px;
    right: 6px;
  }

  @media (max-width: 560px) {
    .stop,
    .stop.right {
      justify-content: center;
    }
    h1 {
      font-size: 40px;
    }
  }
</style>
