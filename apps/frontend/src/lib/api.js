import { token } from '$lib/stores/auth'
import { get } from 'svelte/store'

const AUTH_URL = import.meta.env.PUBLIC_AUTH_URL ?? '/api/auth'
const EXAM_URL = import.meta.env.PUBLIC_EXAM_URL ?? '/api/exams'
const SUB_URL = import.meta.env.PUBLIC_SUBMISSION_URL ?? '/api/submissions'

function authHeaders(json = true) {
  const t = get(token)
  const headers = {}
  if (json) headers['Content-Type'] = 'application/json'
  if (t) headers['Authorization'] = `Bearer ${t}`
  return headers
}

export const authApi = {
  register: (data) =>
    fetch(`${AUTH_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }),
  login: (data) =>
    fetch(`${AUTH_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
}

export const examApi = {
  list: () => fetch(`${EXAM_URL}/exams`, { headers: authHeaders(false) }),
  get: (id) => fetch(`${EXAM_URL}/exams/${id}`, { headers: authHeaders(false) }),
  create: (data) =>
    fetch(`${EXAM_URL}/exams`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data)
    }),
  update: (id, data) =>
    fetch(`${EXAM_URL}/exams/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(data)
    }),
  remove: (id) =>
    fetch(`${EXAM_URL}/exams/${id}`, { method: 'DELETE', headers: authHeaders(false) }),
  addQuestion: (examId, data) =>
    fetch(`${EXAM_URL}/exams/${examId}/questions`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data)
    }),
  updateQuestion: (examId, qid, data) =>
    fetch(`${EXAM_URL}/exams/${examId}/questions/${qid}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(data)
    }),
  removeQuestion: (examId, qid) =>
    fetch(`${EXAM_URL}/exams/${examId}/questions/${qid}`, {
      method: 'DELETE',
      headers: authHeaders(false)
    })
}

export const submissionApi = {
  submit: (data) =>
    fetch(`${SUB_URL}/submissions`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data)
    }),
  get: (id) => fetch(`${SUB_URL}/submissions/${id}`, { headers: authHeaders(false) }),
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return fetch(`${SUB_URL}/submissions?${qs}`, { headers: authHeaders(false) })
  }
}
