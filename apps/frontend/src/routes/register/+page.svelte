<script>
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  onMount(() => {
    // Referral links point here (/register?ref=CODE). Capture the code before
    // redirecting, so it survives to the eventual profile-creation call even
    // after the OAuth round-trip discards URL params.
    const ref = new URLSearchParams(window.location.search).get('ref')
    if (ref) localStorage.setItem('quiz_referral_code', ref)
    goto('/login')
  })
</script>
