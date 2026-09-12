import { requireAuth } from '../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;

  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id < 1) {
    return new Response('Bad Request', { status: 400 });
  }

  const row = await env.DB.prepare(`
    SELECT si.image_key, si.image_type, ts.member_id
    FROM submission_images si
    JOIN task_submissions ts ON ts.id = si.submission_id
    WHERE si.id = ?
    LIMIT 1
  `).bind(id).first();

  if (!row) return new Response('Not Found', { status: 404 });
  if (auth.member.role !== 'cadre' && Number(row.member_id) !== Number(auth.member.id)) {
    return new Response('Forbidden', { status: 403 });
  }

  const object = await env.UPLOADS.get(row.image_key);
  if (!object) return new Response('Not Found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Content-Type', row.image_type || headers.get('Content-Type') || 'application/octet-stream');
  headers.set('Cache-Control', 'private, max-age=86400, immutable');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(object.body, { headers });
}
