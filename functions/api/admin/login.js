import { createAdminSession, sessionCookie } from '../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_PASSWORD || !env.ADMIN_SECRET) {
    return Response.json({ error: 'Chưa cấu hình ADMIN_PASSWORD/ADMIN_SECRET.' }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Yêu cầu không hợp lệ.' }, { status: 400 });
  }

  if (String(body.password || '') !== String(env.ADMIN_PASSWORD)) {
    return Response.json({ error: 'Mật khẩu không đúng.' }, { status: 401 });
  }

  const token = await createAdminSession(env.ADMIN_SECRET);
  return Response.json({ ok: true }, {
    headers: { 'Set-Cookie': sessionCookie(token, request), 'Cache-Control': 'no-store' }
  });
}
