import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'chatflow_session';

function buildExpiredSessionCookie(isProduction: boolean) {
  return {
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProduction,
    path: '/',
    expires: new Date(0),
    maxAge: 0,
  };
}

function clearSessionAndRedirect(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/', request.url));
  response.cookies.set(buildExpiredSessionCookie(process.env.NODE_ENV === 'production'));
  return response;
}

export async function GET(request: NextRequest) {
  return clearSessionAndRedirect(request);
}

export async function POST(request: NextRequest) {
  return clearSessionAndRedirect(request);
}
