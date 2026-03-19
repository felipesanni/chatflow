import { NextRequest, NextResponse } from 'next/server';

const API_TARGET = process.env.API_PROXY_TARGET ?? 'http://api:3333/api';

async function proxy(request: NextRequest, params: { path: string[] }) {
  const targetUrl = `${API_TARGET}/${params.path.join('/')}${request.nextUrl.search}`;
  const headers = new Headers(request.headers);
  headers.delete('host');

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text(),
    redirect: 'manual',
  });

  const body = request.method === 'HEAD' ? null : await response.arrayBuffer();
  const nextResponse = new NextResponse(body, {
    status: response.status,
  });

  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'set-cookie') {
      nextResponse.headers.set(key, value);
    }
  });

  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    nextResponse.headers.set('set-cookie', setCookie);
  }

  return nextResponse;
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, await context.params);
}

export async function HEAD(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, await context.params);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, await context.params);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, await context.params);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, await context.params);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, await context.params);
}
