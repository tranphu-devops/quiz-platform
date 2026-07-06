import { writable, derived } from 'svelte/store'
import { browser } from '$app/environment'
import { vi } from './locales/vi.js'
import { en } from './locales/en.js'

const dictionaries = { vi, en }

export const locales = ['vi', 'en']

function getInitialLocale() {
  if (!browser) return 'vi'
  const saved = localStorage.getItem('quiz-lang')
  if (saved && dictionaries[saved]) return saved
  return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'vi'
}

export const locale = writable(getInitialLocale())

if (browser) {
  locale.subscribe(($locale) => {
    localStorage.setItem('quiz-lang', $locale)
    document.documentElement.lang = $locale
  })
}

export function setLocale(next) {
  if (dictionaries[next]) locale.set(next)
}

export function toggleLocale() {
  locale.update((l) => (l === 'vi' ? 'en' : 'vi'))
}

export function localeCode(l) {
  return l === 'en' ? 'en-US' : 'vi-VN'
}

function resolve(dict, key) {
  return key.split('.').reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), dict)
}

function format(str, params) {
  if (!params) return str
  return str.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? String(params[k]) : `{${k}}`))
}

export const t = derived(locale, ($locale) => {
  const dict = dictionaries[$locale] ?? dictionaries.vi
  return (key, params) => {
    let val = resolve(dict, key)
    if (val === undefined) val = resolve(dictionaries.vi, key)
    if (val === undefined) return key
    return format(val, params)
  }
})
