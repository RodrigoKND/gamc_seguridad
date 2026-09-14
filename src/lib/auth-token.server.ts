import 'server-only';

import { jwtVerify } from 'jose';
import { serverConfig } from '@/lib/env';
import type { AuthenticatedUser } from '@/features/auth/types';

// Verificación del JWT de acceso — SOLO servidor (middleware Edge y Server
// Actions/Route Handlers de Node). `import 'server-only'` de arriba hace que
// Next.js falle el build si este módulo terminara en un bundle de cliente,
// para que el secreto nunca pueda viajar al navegador ni siquiera por error.
//
// A propósito NO hay fallback a un secreto por defecto: si JWT_SECRET falta o
// es débil, esto revienta fuerte y temprano (primera request) en vez de dejar
// silenciosamente que cualquiera con el código fuente pueda forjar tokens de
// super_admin — ver incidente del secreto de respaldo hardcodeado que existía
// acá antes.

const MIN_SECRET_LENGTH = 32;

function loadSecret(): Uint8Array {
  const raw = serverConfig.authSecret;
  if (!raw || raw.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET ausente o demasiado corto (mínimo ${MIN_SECRET_LENGTH} caracteres, hoy: ${raw.length}). ` +
        'Debe ser IDÉNTICO — carácter por carácter — al JWT_SECRET del backend ' +
        '(Backend/gamc-backend/.env). Generar uno nuevo con: ' +
        'node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))" ' +
        'y copiarlo IGUAL en ambos .env (nunca uses el placeholder de .env.example).',
    );
  }
  return new TextEncoder().encode(raw);
}

const secret = loadSecret();
const ISSUER = 'gamc-api';

interface SessionClaims {
  sub?: string;
  tipo?: 'user' | 'guardia';
  rol?: string;
  ident?: string;
  nombre?: string;
}

/**
 * Verifica el JWT de acceso (jose, HS256, mismo secret que el API). Vale en
 * middleware (edge) y en código de servidor Node. Devuelve null si falta,
 * expiró o firmó otra llave — un secreto mal configurado SIEMPRE se traduce
 * en "nadie puede entrar", nunca en "cualquiera puede entrar".
 */
export async function verifyAccessToken(raw: string | undefined | null): Promise<AuthenticatedUser | null> {
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify(raw, secret, { issuer: ISSUER });
    const claims = payload as SessionClaims;
    const role = claims.rol as AuthenticatedUser['role'];
    if (!role || !['super_admin', 'admin', 'operador_monitoreo'].includes(role)) return null;
    if (!claims.sub) return null;
    return {
      id: claims.sub,
      name: claims.nombre ?? claims.ident ?? 'Usuario',
      identifier: claims.ident ?? '',
      role,
    };
  } catch {
    return null;
  }
}
