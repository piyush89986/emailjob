import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

export const tokens = {
  get access() { return localStorage.getItem("access_token"); },
  get refresh() { return localStorage.getItem("refresh_token"); },
  set(a: string, r?: string) { localStorage.setItem("access_token", a); if (r) localStorage.setItem("refresh_token", r); },
  clear() { localStorage.removeItem("access_token"); localStorage.removeItem("refresh_token"); },
};

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000" });

api.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  if (tokens.access) cfg.headers.Authorization = `Bearer ${tokens.access}`;
  return cfg;
});

let refreshing: Promise<string> | null = null;
api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const cfg = err.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (err.response?.status === 401 && cfg && !cfg._retry && tokens.refresh) {
      cfg._retry = true;
      try {
        refreshing ??= axios.post(`${api.defaults.baseURL}/auth/refresh`, { refresh_token: tokens.refresh })
          .then((r) => { tokens.set(r.data.access_token, r.data.refresh_token); return r.data.access_token as string; })
          .finally(() => { refreshing = null; });
        cfg.headers.Authorization = `Bearer ${await refreshing}`;
        return api(cfg);
      } catch { tokens.clear(); window.location.href = "/login"; }
    }
    return Promise.reject(err);
  }
);
