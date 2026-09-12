import { isAdminRequest, unauthorized } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  if (!(await isAdminRequest(request, env.ADMIN_SECRET))) return unauthorized();
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id < 1) return new Response('Bad Request', { status: 400 });

  try {
    const row = await env.DB.prepare(`
      SELECT image_key, image_type FROM submission_images WHERE id = ? LIMIT 1
    `).bind(id).first();
    if (!row) return new Response('Not Found', { status: 404 });

    const object = await env.UPLOADS.get(row.image_key);
    if (!object) return new Response('Not Found', { status: 404 });

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('Content-Type', row.image_type || headers.get('Content-Type') || 'application/octet-stream');
    headers.set('Cache-Control', 'private, max-age=60');
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(object.body, { headers });
  } catch (error) {
    console.error('Image error', error);
    return new Response('Server Error', { status: 500 });
  }
}
