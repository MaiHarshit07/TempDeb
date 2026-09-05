import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("debate_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function fetchTopics(params = {}) {
  const response = await api.get("/topics", { params });
  return response.data.data;
}

export async function fetchCategories() {
  const response = await api.get("/categories");
  return response.data.data;
}

export async function createTopic(payload) {
  const response = await api.post("/topics", payload);
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

export default api;
