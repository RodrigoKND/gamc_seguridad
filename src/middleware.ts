import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/auth-session-shared';
import { verifyAccessToken } from '@/lib/auth-token.server';
import { canAccessRoute, ROLE_HOME_ROUTE } from '@/lib/permissions';

const PUBLIC_PATHS = ['/login', '/recuperar'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const session = await verifyAccessToken(request.cookies.get(AUTH_COOKIE_NAME)?.value);

  if (!session) {
    // Si hay refresh token, deja pasar: el Server Action hará refresh silencioso
    // y reescribirá la cookie de acceso sin sacar al usuario a /login
    if (request.cookies.has('gamc_refresh')) {
      return NextResponse.next();
    }
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (!canAccessRoute(session.role, pathname)) {
    const deniedUrl = new URL(ROLE_HOME_ROUTE[session.role], request.url);
    deniedUrl.searchParams.set('denied', pathname);
    return NextResponse.redirect(deniedUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:webp|png|jpg|jpeg|gif|svg|ico|woff2?)$).*)',
  ],
};