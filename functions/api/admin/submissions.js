import { isAdminRequest, unauthorized } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  if (!(await isAdminRequest(request, env.ADMIN_SECRET))) return unauthorized();

  const taskId = Number(new URL(request.url).searchParams.get('task_id'));
  if (!Number.isInteger(taskId) || taskId < 1) {
    return Response.json({ error: 'Hãy chọn task cần xem.' }, { status: 400 });
  }

  try {
    const result = await env.DB.prepare(`
      SELECT
        s.id,
        s.task_id,
        s.squad,
        s.name,
        s.created_at,
        s.updated_at,
        COUNT(i.id) AS image_count,
        MIN(i.id) AS preview_image_id
      FROM task_submissions s
      LEFT JOIN submission_images i ON i.submission_id = s.id
      WHERE s.task_id = ?
      GROUP BY s.id
      ORDER BY s.squad ASC, s.updated_at DESC, s.name COLLATE NOCASE ASC
    `).bind(taskId).all();

    return Response.json({ submissions: result.results || [] }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    console.error('Admin list error', error);
    return Response.json({ error: 'Không thể tải danh sách.' }, { status: 500 });
  }
}

export async function onRequestDelete({ request, env }) {
  if (!(await isAdminRequest(request, env.ADMIN_SECRET))) return unauthorized();
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id < 1) {
    return Response.json({ error: 'ID không hợp lệ.' }, { status: 400 });
  }

  try {
    const result = await env.DB.prepare(`
      SELECT image_key FROM submission_images WHERE submission_id = ?
    `).bind(id).all();
    const keys = (result.results || []).map(row => row.image_key).filter(Boolean);

    await env.DB.batch([
      env.DB.prepare('DELETE FROM submission_images WHERE submission_id = ?').bind(id),
      env.DB.prepare('DELETE FROM task_submissions WHERE id = ?').bind(id)
    ]);

    await Promise.all(keys.map(key => env.UPLOADS.delete(key).catch(() => {})));
    return Response.json({ ok: true });
  } catch (error) {
    console.error('Delete submission error', error);
    return Response.json({ error: 'Không thể xóa bản nộp.' }, { status: 500 });
  }
}
