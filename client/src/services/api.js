const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');
const TOKEN_KEY = 'satyanet_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/**
 * Resolves a media URL returned by the API (e.g. "/uploads/xyz.mp4") into a
 * fully-qualified URL the browser can load, regardless of API/client origin.
 */
export function resolveMediaUrl(url) {
  if (!url) return null;
  return url.startsWith('http') ? url : `${API_ORIGIN}${url}`;
}

async function request(path, { method = 'GET', body, auth = false, isForm = false } = {}) {
  const headers = {};
  if (!isForm) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    // FormData sets its own Content-Type (with boundary) - never JSON.stringify it.
    body: isForm ? body : body ? JSON.stringify(body) : undefined
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message = (data && data.error) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

export const api = {
  // Auth
  signup: (payload) => request('/auth/signup', { method: 'POST', body: payload }),
  verifyOtp: (payload) => request('/auth/verify-otp', { method: 'POST', body: payload }),
  resendOtp: (payload) => request('/auth/resend-otp', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  me: () => request('/auth/me', { auth: true }),

  // Posts
  createPost: (formData) => request('/posts', { method: 'POST', body: formData, auth: true, isForm: true }),
  getTimeline: (params = '') => request(`/posts${params}`, { auth: !!getToken() }),
  getMyPosts: () => request('/posts/mine', { auth: true }),
  getPost: (id) => request(`/posts/${id}`, { auth: !!getToken() }),
  deletePost: (id) => request(`/posts/${id}`, { method: 'DELETE', auth: true }),
  toggleLike: (id) => request(`/posts/${id}/like`, { method: 'POST', auth: true }),
  getComments: (id) => request(`/posts/${id}/comments`),
  addComment: (id, payload) => request(`/posts/${id}/comments`, { method: 'POST', body: payload, auth: true }),
  sharePost: (id) => request(`/posts/${id}/share`, { method: 'POST', auth: !!getToken() }),

  // Users / profiles
  getProfile: (id) => request(`/users/${id}`, { auth: true }),

  // Reports
  createReport: (payload) => request('/reports', { method: 'POST', body: payload, auth: true }),
  getReportQueue: () => request('/reports', { auth: true }),
  updateReport: (id, payload) => request(`/reports/${id}`, { method: 'PATCH', body: payload, auth: true }),

  // Appeals
  createAppeal: (payload) => request('/appeals', { method: 'POST', body: payload, auth: true }),
  getMyAppeals: () => request('/appeals/mine', { auth: true }),
  getAppealQueue: () => request('/appeals', { auth: true }),
  resolveAppeal: (id, payload) => request(`/appeals/${id}`, { method: 'PATCH', body: payload, auth: true }),

  // Admin
  searchUsers: (query) => request(`/admin/users?query=${encodeURIComponent(query)}`, { auth: true }),
  setUserRole: (id, role) => request(`/admin/users/${id}/role`, { method: 'PATCH', body: { role }, auth: true }),
  setPostStatus: (id, status) => request(`/admin/posts/${id}/status`, { method: 'PATCH', body: { status }, auth: true }),
  getAuditLog: (params = '') => request(`/admin/audit-log${params}`, { auth: true }),

  // Notifications
  getNotifications: () => request('/notifications', { auth: true }),
  getUnreadNotificationCount: () => request('/notifications/unread-count', { auth: true }),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'PATCH', auth: true }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'PATCH', auth: true }),

  // Messages
  getConversations: () => request('/messages/conversations', { auth: true }),
  getConversationWith: (userId) => request(`/messages/with/${userId}`, { auth: true }),
  sendMessage: (conversationId, payload) =>
    request(`/messages/conversations/${conversationId}/messages`, { method: 'POST', body: payload, auth: true })
};

