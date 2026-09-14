import { requireAuth } from '../_lib/auth.js';
import { extensionForMime, getFileExtension } from '../_lib/utils.js';

const MIME_BY_EXTENSION = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
};

function resolveContentType(row, objectHeaders) {
  const stored = String(row.image_type || '').trim();
  if (stored && stored !== 'application/octet-stream') return stored;
  const ext = getFileExtension(row.image_name || '');
  return MIME_BY_EXTENSION[ext] || objectHeaders.get('Content-Type') || 'application/octet-stream';
}

function safeFilename(row) {
  const original = String(row.image_name || '').trim();
  if (original) return original.replace(/[\r\n]/g, ' ');
  const ext = extensionForMime(row.image_type || '') || 'bin';
  return `tai-lieu-${row.id}.${ext}`;
}

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const id = Number(url.searchParams.get('id'));
  const forceDownload = url.searchParams.get('download') === '1';

  if (!Number.isInteger(id) || id < 1) {
    return new Response('Bad Request', { status: 400 });
  }

  const row = await env.DB.prepare(`
    SELECT
      si.id,
      si.image_key,
      si.image_type,
      si.image_name,
      si.image_size,
      si.created_at,
      ts.member_id
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

  const filename = safeFilename(row);
  const contentType = resolveContentType(row, headers);
  headers.set('Content-Type', contentType);
  headers.set('Content-Length', String(row.image_size || object.size || 0));
  headers.set('Content-Disposition', `${forceDownload ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(filename)}`);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Cache-Control', forceDownload ? 'private, no-store' : 'private, max-age=86400, immutable');
  if (object.httpEtag) headers.set('ETag', object.httpEtag);

  return new Response(object.body, { headers });
}
