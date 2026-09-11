import { isAdminRequest, unauthorized } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  if (!(await isAdminRequest(request, env.ADMIN_SECRET))) return unauthorized();

  try {
    const result = await env.DB.prepare(`
      SELECT id, squad, name, image_type, image_name, image_size, created_at, updated_at
      FROM submissions
      ORDER BY squad ASC, updated_at DESC, name COLLATE NOCASE ASC
    `).all();

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
    const item = await env.DB.prepare('SELECT image_key FROM submissions WHERE id = ? LIMIT 1').bind(id).first();
    if (!item) return Response.json({ error: 'Không tìm thấy bản nộp.' }, { status: 404 });

    await env.DB.prepare('DELETE FROM submissions WHERE id = ?').bind(id).run();
    if (item.image_key) await env.UPLOADS.delete(item.image_key).catch(() => {});
    return Response.json({ ok: true });
  } catch (error) {
    console.error('Delete error', error);
    return Response.json({ error: 'Không thể xóa bản nộp.' }, { status: 500 });
  }
}
