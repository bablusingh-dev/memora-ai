import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
  const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:5000';

  // Acquire Clerk JWT token from server-side session
  let token: string | null = null;
  try {
    const authObj = await auth();
    token = await authObj.getToken();
  } catch (e) {
    // not signed in
  }

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch (e) {
    // empty body
  }

  // memorybookId must be provided in the request body when using the /api/chat fallback route
  const memorybookId = body?.memorybookId as string | undefined;
  if (!memorybookId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memorybookId)) {
    return NextResponse.json(
      { error: 'memorybookId is required and must be a valid UUID.' },
      { status: 400 }
    );
  }

  const targetUrl = `${backendUrl}/api/v1/memorybooks/${memorybookId}/chat`;

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    return new NextResponse(res.body, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'text/plain; charset=utf-8',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to proxy chat request' }, { status: 500 });
  }
}
