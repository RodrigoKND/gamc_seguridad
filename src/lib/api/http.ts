// Conector HTTP hacia el API (gamc-api). Se ejecuta SOLO en servidor
// (Server Actions / Route Handlers): reconstruye la cabecera Cookie a partir
// de las request cookies del navegador, las reenvía al API y vuelve a
// escribir en el navegador cualquier Set-Cookie que el API devuelva
// (rotación de sesión, logout, refresh). El middleware de Next valida el JWT
// por su cuenta (ver src/lib/auth-session-shared.ts).

import { cookies } from 'next/headers';
import { apiConfig } from '@/lib/env';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

/** Ruta del refresh: rara por diseño — la cookie del refresh solo viaja ahí. */
const REFRESH_PATH = '/api/auth/refresh';

function parseSetCookie(raw: string): { name: string; value: string; options: Record<string, string | number | boolean> } {
  const parts = raw.split(';').map((p) => p.trim());
  const [name, ...valueParts] = parts[0]!.split('=');
  const options: Record<string, string | number | boolean> = {};
  for (const part of parts.slice(1)) {
    const idx = part.indexOf('=');
    if (idx === -1) {
      options[part.toLowerCase()] = true;
      continue;
    }
    const key = part.slice(0, idx).trim().toLowerCase();
    const val = part.slice(idx + 1).trim();
    options[key] = val;
  }
  return { name, value: valueParts.join('='), options };
}

/** Convierte un Set-Cookie del API al formato de Next. Max-Age en el header HTTP siempre está en segundos (RFC 6265). */
export function toResponseCookie(raw: string): { name: string; value: string; options: Record<string, string | number | boolean | Date> } {
  const { name, value, options } = parseSetCookie(raw);
  const out: Record<string, string | number | boolean | Date> = {};

  const path = typeof options.path === 'string' ? options.path : '/';
  if (path) out.path = path;

  if (options['max-age'] !== undefined) {
    const seconds = Number(options['max-age']);
    if (Number.isFinite(seconds)) out.maxAge = Math.max(0, Math.round(seconds));
  }
  if (options.expires !== undefined && out.maxAge === undefined) {
    const t = Date.parse(String(options.expires));
    if (Number.isFinite(t)) out.expires = new Date(Math.max(t, 0));
  }
  if (options.httpOnly === true) out.httpOnly = true;
  if (options.secure === true) out.secure = true;
  if (options.samesite === 'lax') out.sameSite = 'lax';
  if (options.samesite === 'strict') out.sameSite = 'strict';
  if (options.samesite === 'none') out.sameSite = 'none';

  return { name, value, options: out };
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Peticiones que, al responder 401, deben reintentarse tras refrescar (todo menos login/recuperación). */
  refreshOn401?: boolean;
  /** Next.js fetch revalidate: segundos que la respuesta puede cachearse (GET only). 0 = no-store. */
  revalidate?: number;
  /** Permite marcar tag para on-demand revalidation. */
  tags?: string[];
}

async function rawFetch(
  path: string,
  { method = 'GET', body, refreshOn401 = true, revalidate, tags }: RequestOptions,
  cookieHeader: string,
): Promise<Response> {
  const xsrf = (await cookies()).get('gamc_xsrf')?.value;
  const isGet = method === 'GET' && body === undefined;
  const cacheMode = isGet && revalidate !== undefined ? undefined : ('no-store' as const);
  return fetch(`${apiConfig.baseUrl}${path}`, {
    method,
    credentials: 'include',
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...(xsrf && method !== 'GET' ? { 'x-csrf-token': xsrf } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...(cacheMode ? { cache: cacheMode } : {}),
    ...(isGet && revalidate !== undefined ? { next: { revalidate, ...(tags ? { tags } : {}) } } : {}),
  });
}

async function applySetCookies(response: Response): Promise<void> {
  const store = await cookies();
  const setCookies = response.headers.getSetCookie
    ? response.headers.getSetCookie()
    : (response.headers.get('set-cookie') ? [response.headers.get('set-cookie')!] : []);
  for (const raw of setCookies) {
    try {
const { name, value, options } = toResponseCookie(raw);
    if (value === '' && (options.expires instanceof Date || options.maxAge === 0)) {
      store.delete(name);
    } else {
      store.set(name, value, options as Parameters<typeof store.set>[2]);
    }
    } catch {
      // set-cookie inparseable: se ignora (no debe tumbar la petición).
    }
  }
}

async function bodyOf(response: Response): Promise<{ data?: unknown; error?: { code?: string; message?: string; details?: unknown } }> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as { data?: unknown; error?: { code?: string; message?: string; details?: unknown } };
  } catch {
    return {};
  }
}

/**
 * Petición autenticada hacia el API con reintento único de refresh ante 401.
 * TODO: pasar por alto si el API aun no rotó el refresh en la misma request.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const readCookies = async () =>
    (await cookies())
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');

  const attempt = async () => {
    const res = await rawFetch(path, options, await readCookies());
    await applySetCookies(res);
    return res;
  };

  let response = await attempt();
  if (response.status === 401 && options.refreshOn401 !== false && !path.startsWith(REFRESH_PATH)) {
    // Acceso expirado: se rota el refresh token y se reintenta una sola vez.
    const refreshRes = await rawFetch(REFRESH_PATH, { method: 'POST', revalidate: 0 }, await readCookies());
    await applySetCookies(refreshRes);
    if (refreshRes.ok) {
      response = await attempt();
    }
  }

  const payload = await bodyOf(response);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload.error?.code ?? 'API_ERROR',
      payload.error?.message ?? 'El servicio no está disponible. Intente nuevamente.',
      payload.error?.details,
    );
  }

  return payload.data as T;
}