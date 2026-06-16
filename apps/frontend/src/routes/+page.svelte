<script>
  import { user } from '$lib/stores/auth'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'

  onMount(() => {
    if ($user) goto('/dashboard')
    else goto('/login')
  })
</script>
