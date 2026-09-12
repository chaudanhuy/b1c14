import { isAdminRequest, unauthorized } from '../../_lib/auth.js';
import { createZipStream, sanitizeZipSegment } from '../../_lib/zip.js';
import { extensionForMime } from '../../_lib/utils.js';

export async function onRequestGet({ request, env }) {
  if (!(await isAdminRequest(request, env.ADMIN_SECRET))) return unauthorized();
  if (!env.UPLOADS) return Response.json({ error: 'R2 chưa được cấu hình.' }, { status: 500 });

  const taskId = Number(new URL(request.url).searchParams.get('task_id'));
  if (!Number.isInteger(taskId) || taskId < 1) {
    return Response.json({ error: 'Task không hợp lệ.' }, { status: 400 });
  }

  try {
    const task = await env.DB.prepare('SELECT id, title FROM tasks WHERE id = ? LIMIT 1').bind(taskId).first();
    if (!task) return Response.json({ error: 'Không tìm thấy task.' }, { status: 404 });

    const rows = await env.DB.prepare(`
      SELECT
        s.id AS submission_id,
        s.squad,
        s.name,
        i.id AS image_id,
        i.image_key,
        i.image_type,
        i.image_name,
        i.created_at
      FROM task_submissions s
      JOIN submission_images i ON i.submission_id = s.id
      WHERE s.task_id = ?
      ORDER BY s.squad ASC, s.name COLLATE NOCASE ASC, i.created_at ASC, i.id ASC
    `).bind(taskId).all();

    const root = sanitizeZipSegment(task.title, `Task-${taskId}`);
    const directories = [
      `${root}/`,
      `${root}/Tiểu đội 1/`,
      `${root}/Tiểu đội 2/`,
      `${root}/Tiểu đội 3/`
    ];

    const personDirs = new Set();
    const counters = new Map();
    const files = [];

    for (const row of rows.results || []) {
      const person = sanitizeZipSegment(row.name, `hoc-vien-${row.submission_id}`);
      const personDir = `${root}/Tiểu đội ${row.squad}/${person}/`;
      if (!personDirs.has(personDir)) {
        personDirs.add(personDir);
        directories.push(personDir);
      }

      const count = (counters.get(row.submission_id) || 0) + 1;
      counters.set(row.submission_id, count);
      const extension = extensionForMime(row.image_type);
      const original = sanitizeZipSegment(row.image_name || `minh-chung.${extension}`, `minh-chung.${extension}`);
      const hasExtension = /\.[a-zA-Z0-9]{1,8}$/.test(original);
      const filename = `${String(count).padStart(2, '0')}-${hasExtension ? original : `${original}.${extension}`}`;

      files.push({
        path: `${personDir}${filename}`,
        date: row.created_at,
        getObject: () => env.UPLOADS.get(row.image_key)
      });
    }

    const stream = createZipStream({ directories, files });
    const downloadName = `${root}.zip`;
    const asciiFallback = `task-${taskId}.zip`;

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('Export ZIP error', error);
    return Response.json({ error: 'Không thể tạo file ZIP.' }, { status: 500 });
  }
}
