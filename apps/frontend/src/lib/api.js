import { token } from '$lib/stores/auth'
import { get } from 'svelte/store'

const EXAM_URL = import.meta.env.PUBLIC_EXAM_URL ?? '/api/exams'
const SUB_URL = import.meta.env.PUBLIC_SUBMISSION_URL ?? '/api/submissions'
const USER_URL = import.meta.env.PUBLIC_USER_URL ?? '/api/users'

function authHeaders(json = true) {
  const t = get(token)
  const headers = {}
  if (json) headers['Content-Type'] = 'application/json'
  if (t) headers['Authorization'] = `Bearer ${t}`
  return headers
}

export const examApi = {
  list: () => fetch(`${EXAM_URL}/exams`, { headers: authHeaders(false) }),
  get: (id) => fetch(`${EXAM_URL}/exams/${id}`, { headers: authHeaders(false) }),
  getPreview: (id) => fetch(`${EXAM_URL}/exams/${id}?preview=true`, { headers: authHeaders(false) }),
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
  start: (exam_id) =>
    fetch(`${SUB_URL}/submissions/start`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ exam_id })
    }),
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

export const userApi = {
  getProfile: (id) => fetch(`${USER_URL}/${id}`, { headers: authHeaders(false) }),
  updateProfile: (id, data) =>
    fetch(`${USER_URL}/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(data)
    }),
  adminListUsers: () => fetch(`${USER_URL}/admin/users`, { headers: authHeaders(false) }),
  adminUpdateRole: (id, role) =>
    fetch(`${USER_URL}/admin/users/${id}/role`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ role })
    }),
  adminUpdateCredits: (id, credits) =>
    fetch(`${USER_URL}/admin/users/${id}/credits`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ credits })
    }),
  upgradeToTeacher: () =>
    fetch(`${USER_URL}/upgrade-to-teacher`, {
      method: 'POST',
      headers: authHeaders(false)
    }),
  getPublicSettings: () => fetch(`${USER_URL}/public/settings`),
  getSettings: () => fetch(`${USER_URL}/admin/settings`, { headers: authHeaders(false) }),
  updateSettings: (data) =>
    fetch(`${USER_URL}/admin/settings`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(data)
    })
}

export const collectionApi = {
  list: () => fetch(`${EXAM_URL}/collections`, { headers: authHeaders(false) }),
  get: (id) => fetch(`${EXAM_URL}/collections/${id}`, { headers: authHeaders(false) }),
  create: (data) =>
    fetch(`${EXAM_URL}/collections`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data)
    }),
  update: (id, data) =>
    fetch(`${EXAM_URL}/collections/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(data)
    }),
  remove: (id) =>
    fetch(`${EXAM_URL}/collections/${id}`, { method: 'DELETE', headers: authHeaders(false) })
}

export const badgeApi = {
  list: (userId) => fetch(`${USER_URL}/badges/${userId}`, { headers: authHeaders(false) })
}

export const uploadApi = {
  upload: (file, type, oldUrl = null) => {
    const t = get(token)
    const form = new FormData()
    form.append('file', file)
    form.append('type', type)
    if (oldUrl) form.append('old_url', oldUrl)
    return fetch(`${USER_URL}/upload`, {
      method: 'POST',
      headers: t ? { Authorization: `Bearer ${t}` } : {},
      body: form
    })
  }
}
