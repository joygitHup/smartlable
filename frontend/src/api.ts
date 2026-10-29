// 统一请求封装：携带 Bearer Token，便捷 JSON/错误处理
const TOKEN_KEY = 'aa_token';
const USER_KEY = 'aa_user';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t);
}
export function getStoredUser(): any {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}
export function setStoredUser(u: any) {
  localStorage.setItem(USER_KEY, JSON.stringify(u));
}
export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export interface ApiError extends Error {
  status: number;
  detail?: string;
}

export async function api<T = any>(
  path: string,
  options: { method?: string; body?: any; isForm?: boolean } = {}
): Promise<T> {
  const { method = 'GET', body, isForm } = options;
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Token ${token}`;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

  const res = await fetch(`/api/v1${path}`, {
    method,
    headers,
    body: isForm ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data: any = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    // 401 未认证：清理本地凭证并广播登出事件（由 AuthContext 统一跳转登录页）
    if (res.status === 401) {
      clearAuth();
      emitAuth();
    }
    const err = new Error(data?.error || data?.message || data?.detail || `请求失败 (${res.status})`) as ApiError;
    err.status = res.status;
    err.detail = typeof data === 'string' ? data : data?.error;
    throw err;
  }
  return data as T;
}

// ---- 新模块统一 envelope {code,message,data} 解包 ----
interface Envelope<T> {
  code: number;
  message: string;
  data: T;
}

export interface Paged<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 解包 {code,message,data}，返回 data 字段。 */
export async function fetchData<T = any>(
  path: string,
  options: { method?: string; body?: any; isForm?: boolean } = {}
): Promise<T> {
  const res = await api<Envelope<T>>(path, options);
  return (res as Envelope<T>)?.data as T;
}

/** 解包分页 envelope，返回 {list,total,page,pageSize}。 */
export async function fetchList<T = any>(
  path: string,
  options: { method?: string; body?: any; isForm?: boolean } = {}
): Promise<Paged<T>> {
  const data = await fetchData<Paged<T>>(path, options);
  return data || { list: [], total: 0, page: 1, pageSize: 20 };
}

// ---- 事件总线（供侧边栏等感知登录登出） ----
export const authEvents = new EventTarget();
export function emitAuth() {
  authEvents.dispatchEvent(new Event('change'));
}