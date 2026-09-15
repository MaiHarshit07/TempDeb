import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

let onSessionExpired = null;
const responseCache = new Map();
const pendingRequests = new Map();

function cachedRequest(key, request, ttl = 3000) {
  const cached = responseCache.get(key);
  if (cached && Date.now() - cached.createdAt < ttl) {
    return Promise.resolve(cached.data);
  }
  if (pendingRequests.has(key)) return pendingRequests.get(key);

  const pending = request()
    .then((data) => {
      responseCache.set(key, { data, createdAt: Date.now() });
      return data;
    })
    .finally(() => pendingRequests.delete(key));
  pendingRequests.set(key, pending);
  return pending;
}

function invalidateCache(prefix) {
  for (const key of responseCache.keys()) {
    if (key.startsWith(prefix)) responseCache.delete(key);
  }
}

export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler;
}

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("debate_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.method?.toLowerCase() === "get") {
    config.headers["Cache-Control"] = "no-cache";
    config.headers.Pragma = "no-cache";
    config.params = { ...config.params, _ts: Date.now() };
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && onSessionExpired) {
      onSessionExpired();
    }
    return Promise.reject(error);
  },
);

export async function fetchTopics(params = {}) {
  return cachedRequest(`topics:${JSON.stringify(params)}`, async () => {
    const response = await api.get("/topics", { params });
    return response.data.data;
  });
}

export async function fetchForYouTopics(params = {}) {
  return cachedRequest(`for-you:${JSON.stringify(params)}`, async () => {
    const response = await api.get("/topics/for-you", { params });
    return response.data.data;
  });
}

export async function fetchTopic(id, { fresh = false } = {}) {
  const key = `topic:${id}`;
  if (fresh) responseCache.delete(key);
  return cachedRequest(
    key,
    async () => {
      const response = await api.get(`/topics/${id}`);
      return response.data.data;
    },
    2000,
  );
}

export async function fetchComments(topicId, stance, commentId) {
  const params = { ...(stance ? { stance } : {}), ...(commentId ? { commentId } : {}) };
  return cachedRequest(
    `comments:${topicId}:${stance || "all"}:${commentId || "root"}`,
    async () => {
      const response = await api.get(`/topics/${topicId}/comments`, { params });
      return response.data.data;
    },
    2000,
  );
}

export async function createComment(topicId, data) {
  const response = await api.post(`/topics/${topicId}/comments`, data);
  invalidateCache(`comments:${topicId}:`);
  responseCache.delete(`topic:${topicId}`);
  return response.data.data;
}

export async function voteOnTopic(topicId, type) {
  const response = await api.post("/votes/topics", { topicId, type });
  responseCache.delete(`topic:${topicId}`);
  invalidateCache("topics:");
  invalidateCache("for-you:");
  return response.data.data;
}

export async function updateComment(commentId, content, topicId) {
  const response = await api.put(`/comments/${commentId}`, { content });
  invalidateCache(`comments:${topicId}:`);
  return response.data.data;
}

export async function deleteComment(commentId, topicId) {
  const response = await api.delete(`/comments/${commentId}`);
  invalidateCache(`comments:${topicId}:`);
  return response.data.data;
}

export async function voteOnComment(commentId, type, topicId) {
  const response = await api.post("/votes/comments", { commentId, type });
  invalidateCache(`comments:${topicId}:`);
  return response.data.data;
}

export async function fetchCategories() {
  return cachedRequest(
    "categories",
    async () => {
      const response = await api.get("/categories");
      return response.data.data;
    },
    60000,
  );
}

export async function createTopic(payload) {
  const response = await api.post("/topics", payload);
  invalidateCache("topics:");
  invalidateCache("for-you:");
  return response.data.data;
}

export async function loginUser(payload) {
  const response = await api.post("/auth/login", payload);
  return response.data.data;
}

export async function registerUser(payload) {
  const response = await api.post("/auth/register", payload);
  return response.data.data;
}

export async function fetchCurrentUser() {
  const response = await api.get("/auth/me");
  return response.data.data;
}

export async function logoutUser() {
  const response = await api.post("/auth/logout");
  return response.data.data;
}

export async function fetchNotifications() {
  return cachedRequest(
    "notifications",
    async () => {
      const response = await api.get("/notifications");
      return response.data.data;
    },
    5000,
  );
}

export async function markNotificationRead(notificationId) {
  const response = await api.patch(`/notifications/${notificationId}/read`);
  invalidateCache("notifications");
  return response.data.data;
}

export async function markAllNotificationsRead() {
  const response = await api.patch("/notifications/read-all");
  invalidateCache("notifications");
  return response.data.data;
}

export async function fetchProfile(username) {
  return cachedRequest(
    `profile:${username}`,
    async () => {
      const response = await api.get(`/users/profile/${username}`);
      return response.data.data;
    },
    10000,
  );
}

export default api;
