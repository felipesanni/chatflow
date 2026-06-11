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

function clearSessionResponse() {
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(buildExpiredSessionCookie(process.env.NODE_ENV === 'production'));
  return response;
}

export async function GET(_request: NextRequest) {
  return clearSessionResponse();
}

export async function POST(_request: NextRequest) {
  return clearSessionResponse();
}
