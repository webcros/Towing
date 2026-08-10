import { NextResponse, type NextRequest } from 'next/server';

/**
 * Realm-prefixed session cookies (§4.1 — separate web realms). Two realms
 * share this one Next app under the locked guiding decision (Admin Ops is
 * `/admin/*` routes here, not a new app) — the middleware branches on path
 * prefix instead of running two separate middlewares, and each realm's cookie
 * is checked only against its own routes so neither can authenticate the
 * other's pages.
 */
const SESSION_COOKIE = 'fleet_session';
const ADMIN_SESSION_COOKIE = 'admin_session';

function redirectTo(request: NextRequest, pathname: string, preserveNext = false): NextResponse {
  const url = request.nextUrl.clone();
  const from = url.pathname;
  url.pathname = pathname;
  url.search = '';
  if (preserveNext && from !== '/') url.searchParams.set('next', from);
  return NextResponse.redirect(url);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/admin' || pathname === '/admin/login' || pathname.startsWith('/admin/')) {
    const hasSession = request.cookies.has(ADMIN_SESSION_COOKIE);
    const isLogin = pathname === '/admin/login';

    if (!hasSession && !isLogin) return redirectTo(request, '/admin/login', true);
    if (hasSession && isLogin) return redirectTo(request, '/admin/drivers');
    return NextResponse.next();
  }

  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isLogin = pathname === '/login';

  if (!hasSession && !isLogin) return redirectTo(request, '/login', true);
  if (hasSession && isLogin) return redirectTo(request, '/');
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
