<script lang="ts">
  import Icon from './Icon.svelte';
  import { prefs } from '$lib/prefs.svelte';
  import { ui } from '$lib/ui.svelte';
  import { crease } from '$lib/sound';

  function toggleSound() {
    prefs.toggleSound();
    if (prefs.sound) crease();
  }
</script>

<div class="tools">
  <button
    class="icon-btn"
    onclick={toggleSound}
    aria-label={prefs.sound ? 'Sound on' : 'Sound off'}
    aria-pressed={prefs.sound}
    title={prefs.sound ? 'sound on' : 'sound off'}
  >
    <Icon name={prefs.sound ? 'sound' : 'mute'} />
  </button>
  <button class="icon-btn" onclick={() => (ui.keyOpen = true)} aria-label="Symbol key" title="symbols">
    <Icon name="help" />
  </button>
</div>

<style>
  .tools {
    display: flex;
    gap: 2px;
  }
</style>
