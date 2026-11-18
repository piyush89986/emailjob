import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

export const tokens = {
  get access() { return localStorage.getItem("access_token"); },
  get refresh() { return localStorage.getItem("refresh_token"); },
  set(a: string, r?: string) {
    if (a) localStorage.setItem("access_token", a);
    if (r) localStorage.setItem("refresh_token", r);
  },
  clear() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  },
};

export const getApiBaseUrl = () => {
  return localStorage.getItem("backend_api_url") || import.meta.env.VITE_API_URL || "http://localhost:8000";
};

export const setApiBaseUrl = (url: string) => {
  if (url) localStorage.setItem("backend_api_url", url.trim().replace(/\/+$/, ""));
  else localStorage.removeItem("backend_api_url");
  api.defaults.baseURL = getApiBaseUrl();
};

export const api = axios.create({ baseURL: getApiBaseUrl() });

api.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  cfg.baseURL = getApiBaseUrl();
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
        refreshing ??= axios.post(`${getApiBaseUrl()}/auth/refresh`, { refresh_token: tokens.refresh })
          .then((r) => {
            const acc = r.data.accessToken || r.data.access_token;
            const ref = r.data.refreshToken || r.data.refresh_token;
            tokens.set(acc, ref);
            return acc as string;
          })
          .finally(() => { refreshing = null; });
        const newToken = await refreshing;
        cfg.headers.Authorization = `Bearer ${newToken}`;
        return api(cfg);
      } catch {
        tokens.clear();
        if (window.location.pathname !== "/login" && window.location.pathname !== "/signup") {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(err);
  }
);
