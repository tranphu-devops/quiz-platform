import { writable, derived } from 'svelte/store'
import { browser } from '$app/environment'
import { vi } from './locales/vi.js'
import { en } from './locales/en.js'
import { ja } from './locales/ja.js'

const dictionaries = { vi, en, ja }

export const locales = ['vi', 'en', 'ja']

function getInitialLocale() {
  if (!browser) return 'vi'
  const saved = localStorage.getItem('quiz-lang')
  if (saved && dictionaries[saved]) return saved
  const browserLang = navigator.language?.toLowerCase() ?? ''
  if (browserLang.startsWith('ja')) return 'ja'
  if (browserLang.startsWith('en')) return 'en'
  return 'vi'
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
  locale.update((l) => locales[(locales.indexOf(l) + 1) % locales.length])
}

const LOCALE_CODES = { vi: 'vi-VN', en: 'en-US', ja: 'ja-JP' }

export function localeCode(l) {
  return LOCALE_CODES[l] ?? 'vi-VN'
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
