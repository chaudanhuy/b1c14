import { requireAuth } from '../../_lib/auth.js';

export async function onRequestDelete({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;

  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id < 1) {
    return Response.json({ error: 'Ảnh không hợp lệ.' }, { status: 400 });
  }

  const image = await env.DB.prepare(`
    SELECT si.id, si.image_key, si.submission_id
    FROM submission_images si
    JOIN task_submissions ts ON ts.id = si.submission_id
    WHERE si.id = ? AND ts.member_id = ?
    LIMIT 1
  `).bind(id, auth.member.id).first();

  if (!image) {
    return Response.json({ error: 'Bạn không có quyền xóa ảnh này.' }, { status: 403 });
  }

  await env.DB.prepare(`DELETE FROM submission_images WHERE id = ?`).bind(id).run();
  await env.UPLOADS.delete(image.image_key).catch(() => {});

  const leftRow = await env.DB.prepare(`SELECT COUNT(*) AS count FROM submission_images WHERE submission_id = ?`).bind(image.submission_id).first();
  const remaining = Number(leftRow?.count || 0);
  if (remaining === 0) {
    await env.DB.prepare(`DELETE FROM task_submissions WHERE id = ?`).bind(image.submission_id).run();
  } else {
    await env.DB.prepare(`UPDATE task_submissions SET updated_at = ? WHERE id = ?`).bind(new Date().toISOString(), image.submission_id).run();
  }

  return Response.json({ ok: true, remaining });
}
