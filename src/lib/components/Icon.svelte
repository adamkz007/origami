<script lang="ts">
  type Name =
    | 'back' | 'prev' | 'next' | 'play' | 'pause' | 'share' | 'sound' | 'mute'
    | 'help' | 'clock' | 'steps' | 'stamp' | 'arrow-right';
  let { name }: { name: Name } = $props();
</script>

<svg viewBox="0 0 24 24" aria-hidden="true">
  {#if name === 'back'}
    <path d="M15 5 C11 8 9 10 8 12 C9 14 11 16 15 19" /><path d="M8.5 12 H20" />
  {:else if name === 'prev'}
    <path d="M16 5 L8 12 L16 19" />
  {:else if name === 'next'}
    <path d="M8 5 L16 12 L8 19" />
  {:else if name === 'play'}
    <path d="M7 4.5 L19 12 L7 19.5 Z" />
  {:else if name === 'pause'}
    <path d="M8 5 V19 M16 5 V19" />
  {:else if name === 'share'}
    <path d="M12 15 V3.5 M7.5 7.5 L12 3 L16.5 7.5" /><path d="M6 11 H4.5 V20.5 H19.5 V11 H18" />
  {:else if name === 'sound'}
    <path d="M4 9.5 H8 L13 5 V19 L8 14.5 H4 Z" /><path d="M16.5 9 C18 10.5 18 13.5 16.5 15" /><path d="M19 6.5 C22 9.5 22 14.5 19 17.5" />
  {:else if name === 'mute'}
    <path d="M4 9.5 H8 L13 5 V19 L8 14.5 H4 Z" /><path d="M16.5 9.5 L21 14.5 M21 9.5 L16.5 14.5" />
  {:else if name === 'help'}
    <path d="M9 9 C9 6 15 5.5 15 9 C15 11.5 12 11.5 12 14.5" /><circle cx="12" cy="18.5" r=".6" />
  {:else if name === 'clock'}
    <circle cx="12" cy="12" r="8.5" /><path d="M12 7 V12 L15 14" />
  {:else if name === 'steps'}
    <path d="M4 18 L9 13 L13 16 L20 7" /><path d="M16 7 H20 V11" />
  {:else if name === 'stamp'}
    <circle cx="12" cy="12" r="9" /><path d="M7.5 12.5 L10.5 15.5 L16.5 8.5" />
  {:else if name === 'arrow-right'}
    <path d="M4 12 H19 M14 7 L19 12 L14 17" />
  {/if}
</svg>
