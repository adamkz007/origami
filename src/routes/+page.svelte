<script lang="ts">
  import { models } from '$lib/models';
  import { plan } from '$lib/fold/engine';
  import { prefs } from '$lib/prefs.svelte';
  import Stage from '$lib/components/Stage.svelte';
  import Level from '$lib/components/Level.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import Stamp from '$lib/components/Stamp.svelte';
  import Tools from '$lib/components/Tools.svelte';

  // ordered simple → hard
  const cards = models.map((m) => ({ model: m, plans: plan(m) }));
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
  <div class="right">
    {#if prefs.loaded && doneCount > 0}
      <span class="progress" aria-label="{doneCount} of {models.length} folded">
        <Stamp size={24} />{doneCount}/{models.length}
      </span>
    {/if}
    <Tools />
  </div>
</header>

<main>
  <ol class="gallery">
    {#each cards as { model, plans }, i (model.slug)}
      <li style="--tilt:{[-1.4, 1.1, -0.7, 1.5, -1.1][i % 5]}deg; --delay:{i * 70}ms">
        <a href="/m/{model.slug}" class="card" aria-label="{model.name}, difficulty {model.level} of 5">
          <div class="preview" style="view-transition-name: model-{model.slug}">
            <Stage {plans} mode="finished" label={model.name} />
          </div>
          <div class="meta">
            <h2>{model.name}</h2>
            <Level level={model.level} size={14} />
          </div>
          <div class="facts" aria-hidden="true">
            <span><Icon name="steps" />{plans.length}</span>
            <span><Icon name="clock" />{model.minutes}′</span>
          </div>
          {#if prefs.isDone(model.slug)}
            <span class="done" aria-label="completed"><Stamp size={54} /></span>
          {/if}
        </a>
      </li>
    {/each}
    <li class="soon" aria-label="more models coming" style="--tilt:1deg">
      <div class="blank"></div>
    </li>
  </ol>
</main>

<style>
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    max-width: 1080px;
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
  .logo .a,
  .logo .b {
    stroke: var(--ink);
    stroke-width: 2.4;
    stroke-linejoin: round;
  }
  .logo .a {
    fill: var(--paper-a);
  }
  .logo .b {
    fill: var(--paper-b);
  }
  h1 {
    font-size: 46px;
  }
  h1 span {
    color: var(--kraft-deep);
  }
  .right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .progress {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--ink-soft);
    font-size: 19px;
  }

  main {
    max-width: 1080px;
    margin: 0 auto;
    padding: 22px 16px 80px;
  }

  .gallery {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr));
    gap: 28px 24px;
  }
  .gallery li {
    animation: drop 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
    animation-delay: var(--delay, 0ms);
  }
  @keyframes drop {
    from {
      opacity: 0;
      transform: translateY(18px) rotate(calc(var(--tilt) * 3));
    }
  }

  .card {
    position: relative;
    display: block;
    background: var(--card);
    border-radius: var(--radius);
    padding: 10px 10px 12px;
    box-shadow:
      0 1px 0 var(--kraft) inset,
      0 6px 18px var(--shadow);
    transform: rotate(var(--tilt));
    transition:
      transform 0.25s,
      box-shadow 0.25s;
  }
  .card:hover,
  .card:focus-visible {
    transform: rotate(0) translateY(-4px);
    box-shadow: 0 14px 30px var(--shadow);
  }
  .preview {
    aspect-ratio: 1;
    border-radius: 10px;
    background: var(--bg);
    padding: 10%;
    transition: transform 0.4s;
  }
  .card:hover .preview :global(.stage) {
    animation: bob 2.4s ease-in-out infinite;
  }
  @keyframes bob {
    50% {
      transform: translateY(-4px) rotate(-1.5deg);
    }
  }
  .meta {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 4px 0;
  }
  h2 {
    font-size: 34px;
  }
  .facts {
    display: flex;
    gap: 12px;
    padding: 0 4px;
    color: var(--ink-soft);
    font-size: 16px;
  }
  .facts span {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
  .facts :global(svg) {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: var(--ink-soft);
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .done {
    position: absolute;
    top: 2px;
    right: 4px;
  }

  .soon {
    transform: rotate(var(--tilt));
    border: 2px dashed var(--kraft);
    border-radius: var(--radius);
    padding: 10px;
    opacity: 0.7;
  }
  .soon .blank {
    aspect-ratio: 1;
    margin: 12%;
    background: var(--paper-b);
    border: 1.5px solid var(--kraft);
    transform: rotate(45deg) scale(0.62);
    box-shadow: 4px 6px 0 var(--shadow);
  }

  @media (max-width: 560px) {
    h1 {
      font-size: 40px;
    }
    .gallery {
      grid-template-columns: repeat(2, 1fr);
      gap: 18px 14px;
    }
    h2 {
      font-size: 26px;
    }
    .meta {
      flex-direction: column;
      gap: 2px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .gallery li,
    .card:hover .preview :global(.stage) {
      animation: none;
    }
  }
</style>
