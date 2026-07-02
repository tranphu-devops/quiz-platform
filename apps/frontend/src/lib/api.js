import { token } from '$lib/stores/auth'
import { get } from 'svelte/store'
import { getClientPubKey, decryptIfNeeded } from '$lib/crypto'

const EXAM_URL = import.meta.env.PUBLIC_EXAM_URL ?? '/api/exams'
const SUB_URL = import.meta.env.PUBLIC_SUBMISSION_URL ?? '/api/submissions'
const USER_URL = import.meta.env.PUBLIC_USER_URL ?? '/api/users'
const INTERACTION_URL = import.meta.env.PUBLIC_INTERACTION_URL ?? '/api/interactions'

function authHeaders(json = true) {
  const t = get(token)
  const headers = {}
  if (json) headers['Content-Type'] = 'application/json'
  if (t) headers['Authorization'] = `Bearer ${t}`
  return headers
}

// Drop-in replacement for fetch that:
//  1. Adds X-Client-Pubkey header when encryption is configured
//  2. Wraps response.json() to auto-decrypt { iv, data } envelopes
async function apiFetch(url, options = {}) {
  const pubkey = await getClientPubKey()
  const opts = pubkey
    ? { ...options, headers: { ...options.headers, 'X-Client-Pubkey': pubkey } }
    : options

  const res = await fetch(url, opts)

  if (!pubkey) return res

  return {
    ok: res.ok,
    status: res.status,
    headers: res.headers,
    json: async () => decryptIfNeeded(await res.json()),
    text: () => res.text(),
    blob: () => res.blob()
  }
}

export const examApi = {
  list: () => apiFetch(`${EXAM_URL}/exams`, { headers: authHeaders(false) }),
  listByCreator: (creatorId) => apiFetch(`${EXAM_URL}/exams?creator_id=${creatorId}`, { headers: authHeaders(false) }),
  get: (id) => apiFetch(`${EXAM_URL}/exams/${id}`, { headers: authHeaders(false) }),
  getPreview: (id) => apiFetch(`${EXAM_URL}/exams/${id}?preview=true`, { headers: authHeaders(false) }),
  create: (data) =>
    apiFetch(`${EXAM_URL}/exams`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data)
    }),
  update: (id, data) =>
    apiFetch(`${EXAM_URL}/exams/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(data)
    }),
  remove: (id) =>
    apiFetch(`${EXAM_URL}/exams/${id}`, { method: 'DELETE', headers: authHeaders(false) }),
  addQuestion: (examId, data) =>
    apiFetch(`${EXAM_URL}/exams/${examId}/questions`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data)
    }),
  updateQuestion: (examId, qid, data) =>
    apiFetch(`${EXAM_URL}/exams/${examId}/questions/${qid}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(data)
    }),
  removeQuestion: (examId, qid) =>
    apiFetch(`${EXAM_URL}/exams/${examId}/questions/${qid}`, {
      method: 'DELETE',
      headers: authHeaders(false)
    })
}

export const submissionApi = {
  start: (exam_id) =>
    apiFetch(`${SUB_URL}/submissions/start`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ exam_id })
    }),
  saveProgress: (id, answers, sessionId = null) =>
    apiFetch(`${SUB_URL}/submissions/${id}/progress`, {
      method: 'PUT',
      headers: { ...authHeaders(), ...(sessionId ? { 'x-exam-session': sessionId } : {}) },
      body: JSON.stringify({ answers })
    }),
  submitById: (id, answers, sessionId = null) =>
    apiFetch(`${SUB_URL}/submissions/${id}/submit`, {
      method: 'POST',
      headers: { ...authHeaders(), ...(sessionId ? { 'x-exam-session': sessionId } : {}) },
      body: JSON.stringify({ answers })
    }),
  submit: (data) =>
    apiFetch(`${SUB_URL}/submissions`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data)
    }),
  getActive: (exam_id) =>
    apiFetch(`${SUB_URL}/submissions/active?exam_id=${exam_id}`, { headers: authHeaders(false) }),
  get: (id) => apiFetch(`${SUB_URL}/submissions/${id}`, { headers: authHeaders(false) }),
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return apiFetch(`${SUB_URL}/submissions?${qs}`, { headers: authHeaders(false) })
  }
}

export const userApi = {
  getProfile: (id) => apiFetch(`${USER_URL}/${id}`, { headers: authHeaders(false) }),
  getPublicProfile: (userId) => apiFetch(`${USER_URL}/public/profile/${userId}`),
  updateProfile: (id, data) =>
    apiFetch(`${USER_URL}/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(data)
    }),
  adminListUsers: () => apiFetch(`${USER_URL}/admin/users`, { headers: authHeaders(false) }),
  adminUpdateRole: (id, role) =>
    apiFetch(`${USER_URL}/admin/users/${id}/role`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ role })
    }),
  adminUpdateCredits: (id, credits) =>
    apiFetch(`${USER_URL}/admin/users/${id}/credits`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ credits })
    }),
  upgradeToTeacher: () =>
    apiFetch(`${USER_URL}/upgrade-to-teacher`, {
      method: 'POST',
      headers: authHeaders(false)
    }),
  getPublicSettings: () => apiFetch(`${USER_URL}/public/settings`),
  getSettings: () => apiFetch(`${USER_URL}/admin/settings`, { headers: authHeaders(false) }),
  updateSettings: (data) =>
    apiFetch(`${USER_URL}/admin/settings`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(data)
    })
}

export const collectionApi = {
  list: () => apiFetch(`${EXAM_URL}/collections`, { headers: authHeaders(false) }),
  get: (id) => apiFetch(`${EXAM_URL}/collections/${id}`, { headers: authHeaders(false) }),
  create: (data) =>
    apiFetch(`${EXAM_URL}/collections`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data)
    }),
  update: (id, data) =>
    apiFetch(`${EXAM_URL}/collections/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(data)
    }),
  remove: (id) =>
    apiFetch(`${EXAM_URL}/collections/${id}`, { method: 'DELETE', headers: authHeaders(false) })
}

export const badgeApi = {
  list: (userId) => apiFetch(`${USER_URL}/badges/${userId}`, { headers: authHeaders(false) })
}

export const commentApi = {
  // aggregate like/comment counts + caller's like state
  summary: (examId) =>
    apiFetch(`${INTERACTION_URL}/exams/${examId}/summary`, { headers: authHeaders(false) }),
  list: (examId, page = 1) =>
    apiFetch(`${INTERACTION_URL}/exams/${examId}/comments?page=${page}`, { headers: authHeaders(false) }),
  create: (examId, content) =>
    apiFetch(`${INTERACTION_URL}/exams/${examId}/comments`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ content })
    }),
  update: (id, content) =>
    apiFetch(`${INTERACTION_URL}/comments/${id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ content })
    }),
  remove: (id) =>
    apiFetch(`${INTERACTION_URL}/comments/${id}`, { method: 'DELETE', headers: authHeaders(false) })
}

export const likeApi = {
  toggle: (examId) =>
    apiFetch(`${INTERACTION_URL}/exams/${examId}/like`, { method: 'POST', headers: authHeaders(false) })
}

export const reportApi = {
  create: (examId, category, description) =>
    apiFetch(`${INTERACTION_URL}/exams/${examId}/reports`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ category, description })
    }),
  mine: () => apiFetch(`${INTERACTION_URL}/reports/mine`, { headers: authHeaders(false) }),
  inbox: (status = null) => {
    const qs = status ? `?status=${status}` : ''
    return apiFetch(`${INTERACTION_URL}/reports/inbox${qs}`, { headers: authHeaders(false) })
  },
  inboxCount: () => apiFetch(`${INTERACTION_URL}/reports/inbox/count`, { headers: authHeaders(false) }),
  respond: (id, response, status = 'resolved') =>
    apiFetch(`${INTERACTION_URL}/reports/${id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ response, status })
    })
}

export const uploadApi = {
  upload: (file, type, oldUrl = null) => {
    const t = get(token)
    const form = new FormData()
    form.append('file', file)
    form.append('type', type)
    if (oldUrl) form.append('old_url', oldUrl)
    return apiFetch(`${USER_URL}/upload`, {
      method: 'POST',
      headers: t ? { Authorization: `Bearer ${t}` } : {},
      body: form
    })
  }
}
