import { isAdminRequest, unauthorized } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  if (!(await isAdminRequest(request, env.ADMIN_SECRET))) return unauthorized();
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
