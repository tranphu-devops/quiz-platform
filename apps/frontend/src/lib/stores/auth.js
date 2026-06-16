import { writable } from 'svelte/store'
import { browser } from '$app/environment'

export const user = writable(browser ? JSON.parse(localStorage.getItem('user') ?? 'null') : null)
export const token = writable(browser ? (localStorage.getItem('token') ?? null) : null)

export function setAuth(userData, authToken) {
  user.set(userData)
  token.set(authToken)
  if (browser) {
    localStorage.setItem('user', JSON.stringify(userData))
    localStorage.setItem('token', authToken)
  }
}

export function clearAuth() {
  user.set(null)
  token.set(null)
  if (browser) {
    localStorage.removeItem('user')
    localStorage.removeItem('token')
  }
}
