import { AxiosInstance } from '../lib/Axios.instance';

// Team Chat — same /api/chat/* endpoints the web Chat page uses (auth is the
// same Bearer token this app already sends on every request).
export const ChatAPI = {
  // ── chats ──
  getGroups: () => AxiosInstance.get('/chat/groups'),
  createGroup: (data) => AxiosInstance.post('/chat/groups', data), // { type:'DIRECT'|'GROUP', name?, memberIds }
  updateGroup: (id, data) => AxiosInstance.patch(`/chat/groups/${id}`, data), // { name } | { avatar }
  deleteGroup: (id, forEveryone) => AxiosInstance.delete(`/chat/groups/${id}${forEveryone ? '?forEveryone=1' : ''}`),

  // ── members ──
  addMembers: (id, memberIds) => AxiosInstance.post(`/chat/groups/${id}/members`, { memberIds }),
  removeMember: (id, userId) => AxiosInstance.delete(`/chat/groups/${id}/members`, { data: { userId } }),
  changeRole: (id, userId, role) => AxiosInstance.patch(`/chat/groups/${id}/members`, { userId, role }),

  // ── messages ──
  getMessages: (id, limit = 100) => AxiosInstance.get(`/chat/groups/${id}/messages?limit=${limit}`),
  sendMessage: (id, data) => AxiosInstance.post(`/chat/groups/${id}/messages`, data),
  typing: (id, stopped = false) => AxiosInstance.post(`/chat/groups/${id}/typing`, { stopped }),
  editMessage: (mid, content) => AxiosInstance.patch(`/chat/messages/${mid}/edit`, { content }),
  deleteMessage: (mid, forEveryone) => AxiosInstance.delete(`/chat/messages/${mid}${forEveryone ? '?forEveryone=1' : ''}`),
  react: (mid, emoji) => AxiosInstance.post(`/chat/messages/${mid}/react`, { emoji }),
  unreact: (mid) => AxiosInstance.delete(`/chat/messages/${mid}/react`),
  togglePin: (mid) => AxiosInstance.post(`/chat/messages/${mid}/pin`),
  forward: (mid, groupIds) => AxiosInstance.post(`/chat/messages/${mid}/forward`, { groupIds }),
  search: (q) => AxiosInstance.get(`/chat/search?q=${encodeURIComponent(q)}`),

  // ── misc ──
  upload: (dataUrl, resourceType) => AxiosInstance.post('/upload', { dataUrl, folder: 'chat-attachments', ...(resourceType ? { resourceType } : {}) }),
  unread: () => AxiosInstance.get('/chat/unread'),
  heartbeat: () => AxiosInstance.post('/users/heartbeat'),
  getUsers: () => AxiosInstance.get('/users/by-role?roles=EMPLOYEE,MANAGER,TELECALLER,MARKETING_EXECUTIVE,ADMIN,SUPER_ADMIN'),
};

// "Online" if pinged within the last 60s (same rule as web).
export function presenceLabel(lastActiveAt) {
  if (!lastActiveAt) return '';
  const diff = Date.now() - new Date(lastActiveAt).getTime();
  if (diff < 60000) return 'Online';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `Last seen ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Last seen ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Last seen yesterday';
  if (days < 7) return `Last seen ${days}d ago`;
  return `Last seen ${new Date(lastActiveAt).toLocaleDateString('en-IN')}`;
}
export const isOnline = (lastActiveAt) => presenceLabel(lastActiveAt) === 'Online';
export const initialsOf = (name) => (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

// Tiny pub/sub so the Chat tab badge updates instantly when the chat list
// (or a conversation) learns a new unread total, instead of waiting for the poll.
const listeners = new Set();
export const unreadBus = {
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  emit(n) { listeners.forEach(fn => fn(n)); },
};
