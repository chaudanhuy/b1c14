import { requireCadre } from '../../_lib/auth.js';
import { createZipStream, sanitizeZipSegment } from '../../_lib/zip.js';
import { UNIT_LABELS, UNIT_ORDER, extensionForMime, getFileExtension } from '../../_lib/utils.js';

export async function onRequestGet({ request, env }) {
  const auth = await requireCadre(request, env);
  if (!auth.ok) return auth.response;

  const taskId = Number(new URL(request.url).searchParams.get('task_id'));
  if (!Number.isInteger(taskId) || taskId < 1) {
    return Response.json({ error: 'Task không hợp lệ.' }, { status: 400 });
  }

  const task = await env.DB.prepare(`SELECT id, title FROM tasks WHERE id = ? LIMIT 1`).bind(taskId).first();
  if (!task) {
    return Response.json({ error: 'Không tìm thấy task.' }, { status: 404 });
  }

  const rows = await env.DB.prepare(`
    SELECT
      ts.unit_code,
      ts.name,
      si.image_key,
      si.image_type,
      si.image_name,
      si.created_at
    FROM task_submissions ts
    JOIN submission_images si ON si.submission_id = ts.id
    WHERE ts.task_id = ?
    ORDER BY
      CASE ts.unit_code
        WHEN 'cadre' THEN 0
        WHEN '1' THEN 1
        WHEN '2' THEN 2
        WHEN '3' THEN 3
        ELSE 9
      END,
      ts.name COLLATE NOCASE ASC,
      si.created_at ASC,
      si.id ASC
  `).bind(taskId).all();

  const root = sanitizeZipSegment(task.title);
  const directories = [];
  for (const code of UNIT_ORDER) {
    directories.push(`${root}/${sanitizeZipSegment(UNIT_LABELS[code])}`);
  }

  const counters = new Map();
  const personDirectories = new Set();
  const files = [];

  for (const row of rows.results || []) {
    const unitDir = sanitizeZipSegment(UNIT_LABELS[row.unit_code] || row.unit_code);
    const nameDir = sanitizeZipSegment(row.name);
    const personDir = `${root}/${unitDir}/${nameDir}`;
    if (!personDirectories.has(personDir)) {
      personDirectories.add(personDir);
      directories.push(personDir);
    }
    const key = `${row.unit_code}|${row.name}`;
    const index = (counters.get(key) || 0) + 1;
    counters.set(key, index);
    const originalName = String(row.image_name || 'minh-chung');
    const originalExt = getFileExtension(originalName);
    const ext = originalExt || extensionForMime(row.image_type) || 'bin';
    const baseName = sanitizeZipSegment(originalName.replace(/\.[^.]+$/, ''));
    files.push({
      path: `${personDir}/${String(index).padStart(2, '0')}-${baseName}.${ext}`,
      date: row.created_at,
      getObject: () => env.UPLOADS.get(row.image_key)
    });
  }

  const stream = createZipStream({ directories, files });
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(root)}.zip`,
      'Cache-Control': 'no-store'
    }
  });
}
