import { isAdminRequest, unauthorized } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  if (!(await isAdminRequest(request, env.ADMIN_SECRET))) return unauthorized();
  const submissionId = Number(new URL(request.url).searchParams.get('submission_id'));
  if (!Number.isInteger(submissionId) || submissionId < 1) {
    return Response.json({ error: 'Bản nộp không hợp lệ.' }, { status: 400 });
  }

  try {
    const result = await env.DB.prepare(`
      SELECT id, submission_id, image_type, image_name, image_size, created_at
      FROM submission_images
      WHERE submission_id = ?
      ORDER BY created_at ASC, id ASC
    `).bind(submissionId).all();

    return Response.json({ images: result.results || [] }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    console.error('Images list error', error);
    return Response.json({ error: 'Không thể tải danh sách ảnh.' }, { status: 500 });
  }
}

export async function onRequestDelete({ request, env }) {
  if (!(await isAdminRequest(request, env.ADMIN_SECRET))) return unauthorized();
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id < 1) {
    return Response.json({ error: 'Ảnh không hợp lệ.' }, { status: 400 });
  }

  try {
    const image = await env.DB.prepare(`
      SELECT id, submission_id, image_key FROM submission_images WHERE id = ? LIMIT 1
    `).bind(id).first();
    if (!image) return Response.json({ error: 'Không tìm thấy ảnh.' }, { status: 404 });

    await env.DB.prepare('DELETE FROM submission_images WHERE id = ?').bind(id).run();
    await env.UPLOADS.delete(image.image_key).catch(() => {});

    const countRow = await env.DB.prepare(`
      SELECT COUNT(*) AS count FROM submission_images WHERE submission_id = ?
    `).bind(image.submission_id).first();

    const remaining = Number(countRow?.count || 0);
    if (remaining === 0) {
      await env.DB.prepare('DELETE FROM task_submissions WHERE id = ?').bind(image.submission_id).run();
    } else {
      await env.DB.prepare(`
        UPDATE task_submissions SET updated_at = ? WHERE id = ?
      `).bind(new Date().toISOString(), image.submission_id).run();
    }

    return Response.json({ ok: true, remaining });
  } catch (error) {
    console.error('Delete image error', error);
    return Response.json({ error: 'Không thể xóa ảnh.' }, { status: 500 });
  }
}
