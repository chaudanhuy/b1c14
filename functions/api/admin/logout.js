import { clearSessionCookie } from '../../_lib/auth.js';

export async function onRequestPost({ request }) {
  return Response.json({ ok: true }, {
    headers: { 'Set-Cookie': clearSessionCookie(request), 'Cache-Control': 'no-store' }
  });
}
