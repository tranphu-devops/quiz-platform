<script>
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { user } from '$lib/stores/auth'
  import { generatorApi } from '$lib/api'
  import { t, locale, localeCode } from '$lib/i18n'
  import PageHeader from '$lib/components/ui/PageHeader.svelte'
  import Card from '$lib/components/ui/Card.svelte'
  import Button from '$lib/components/ui/Button.svelte'
  import Input from '$lib/components/ui/Input.svelte'

  let isAdmin = $derived($user?.role === 'admin')

  let loading = $state(true)

  let ownKeys = $state([])
  let newOwnKey = $state('')
  let ownKeyError = $state('')
  let ownKeySaving = $state(false)

  let platformKey = $state(null) // { id, key_prefix, created_at, last_used_at } | null
  let newPlatformKey = $state('')
  let platformKeyError = $state('')
  let platformKeySaving = $state(false)

  function fmtDate(s) {
    return s ? new Date(s).toLocaleString(localeCode($locale)) : '—'
  }

  onMount(async () => {
    if (!$user || $user.role === 'student') { goto('/exams'); return }
    await loadOwnKeys()
    if ($user.role === 'admin') await loadPlatformKey()
    loading = false
  })

  async function loadOwnKeys() {
    try {
      const res = await generatorApi.listKeys()
      if (res.ok) ownKeys = await res.json()
    } catch {
      // non-fatal — list just stays empty
    }
  }

  async function loadPlatformKey() {
    try {
      const res = await generatorApi.getPlatformKey()
      if (res.ok) platformKey = await res.json()
    } catch {
      // non-fatal
    }
  }

  async function createOwnKey() {
    ownKeyError = ''
    if (!newOwnKey.trim()) { ownKeyError = $t('generatorKeys.keyRequired'); return }
    ownKeySaving = true
    try {
      const res = await generatorApi.saveKey(newOwnKey.trim())
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        ownKeyError = d.error ?? $t('generatorKeys.errorGeneric')
        return
      }
      newOwnKey = ''
      await loadOwnKeys()
    } catch {
      ownKeyError = $t('generatorKeys.errorGeneric')
    } finally {
      ownKeySaving = false
    }
  }

  async function revokeOwnKey(id) {
    try {
      const res = await generatorApi.deleteKey(id)
      if (res.ok) await loadOwnKeys()
    } catch {
      // non-fatal — row just stays as-is, user can retry
    }
  }

  async function savePlatformKeyAction() {
    platformKeyError = ''
    if (!newPlatformKey.trim()) { platformKeyError = $t('generatorKeys.keyRequired'); return }
    platformKeySaving = true
    try {
      const res = await generatorApi.savePlatformKey(newPlatformKey.trim())
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        platformKeyError = d.error ?? $t('generatorKeys.errorGeneric')
        return
      }
      newPlatformKey = ''
      await loadPlatformKey()
    } catch {
      platformKeyError = $t('generatorKeys.errorGeneric')
    } finally {
      platformKeySaving = false
    }
  }

  async function revokePlatformKeyAction() {
    try {
      const res = await generatorApi.deletePlatformKey()
      if (res.ok) platformKey = null
    } catch {
      // non-fatal
    }
  }
</script>

<PageHeader title={$t('generatorKeys.pageTitle')} subtitle={$t('generatorKeys.pageSubtitle')} />

{#if loading}
  <p class="ix-loading">{$t('common.loading')}</p>
{:else}
  <div class="keys-wrap">
    <Card title={$t('generatorKeys.ownTitle')} subtitle={$t('generatorKeys.ownSubtitle')}>
      <div class="key-create">
        <Input bind:value={newOwnKey} type="password" placeholder={$t('generator.ownKeyPlaceholder')} />
        <Button variant="primary" onclick={createOwnKey} disabled={ownKeySaving}>
          {ownKeySaving ? $t('generatorKeys.saving') : $t('generatorKeys.addKey')}
        </Button>
      </div>
      {#if ownKeyError}<p class="ix-error">{ownKeyError}</p>{/if}

      {#if ownKeys.length === 0}
        <p class="keys-empty">{$t('generatorKeys.noOwnKeys')}</p>
      {:else}
        <div class="key-list">
          {#each ownKeys as k (k.id)}
            <div class="key-row">
              <code class="key-prefix">{k.key_prefix}…</code>
              <div class="key-sub">
                {$t('generatorKeys.createdAt')}: {fmtDate(k.created_at)} · {$t('generatorKeys.lastUsedAt')}: {fmtDate(k.last_used_at)}
              </div>
              <div class="key-row-actions">
                <Button variant="secondary" onclick={() => revokeOwnKey(k.id)}>{$t('generatorKeys.revoke')}</Button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </Card>

    {#if isAdmin}
      <Card title={$t('generatorKeys.platformTitle')} subtitle={$t('generatorKeys.platformSubtitle')}>
        {#if platformKey}
          <div class="key-row">
            <code class="key-prefix">{platformKey.key_prefix}…</code>
            <div class="key-sub">
              {$t('generatorKeys.createdAt')}: {fmtDate(platformKey.created_at)} · {$t('generatorKeys.lastUsedAt')}: {fmtDate(platformKey.last_used_at)}
            </div>
            <div class="key-row-actions">
              <Button variant="secondary" onclick={revokePlatformKeyAction}>{$t('generatorKeys.revoke')}</Button>
            </div>
          </div>
          <p class="ix-hint replace-hint">{$t('generatorKeys.replaceHint')}</p>
        {:else}
          <p class="keys-empty">{$t('generatorKeys.noPlatformKey')}</p>
        {/if}
        <div class="key-create platform-create">
          <Input bind:value={newPlatformKey} type="password" placeholder={$t('generator.ownKeyPlaceholder')} />
          <Button variant="primary" onclick={savePlatformKeyAction} disabled={platformKeySaving}>
            {platformKeySaving ? $t('generatorKeys.saving') : (platformKey ? $t('generatorKeys.replaceKey') : $t('generatorKeys.addKey'))}
          </Button>
        </div>
        {#if platformKeyError}<p class="ix-error">{platformKeyError}</p>{/if}
      </Card>
    {/if}
  </div>
{/if}

<style>
  .keys-wrap { display: flex; flex-direction: column; gap: 20px; max-width: 560px; }
  .ix-loading { font-size: 14px; color: var(--ix-text-muted); }
  .ix-error { color: var(--danger); font-size: 14px; }
  .ix-hint { font-size: 12px; color: var(--ix-text-muted); margin: 0; line-height: 1.4; }
  .replace-hint { margin-top: 10px; }

  .key-create { display: flex; gap: 10px; align-items: flex-start; }
  .key-create :global(.ix-field) { flex: 1; }
  .platform-create { margin-top: 12px; }

  .keys-empty { font-size: 0.9rem; color: var(--text-muted, #6b6a80); margin: 8px 0; }

  .key-list { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
  .key-row { border: 1px solid var(--border); border-radius: var(--radius-btn, 10px); padding: 12px 14px; }
  .key-prefix { font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: var(--text-muted, #6b6a80); }
  .key-sub { font-size: 0.8rem; color: var(--text-muted, #6b6a80); margin-top: 4px; }
  .key-row-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
</style>
