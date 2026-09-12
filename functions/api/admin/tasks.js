import { isAdminRequest, unauthorized } from '../../_lib/auth.js';
import { cleanTaskTitle, normalizeText } from '../../_lib/utils.js';

export async function onRequestGet({ request, env }) {
  if (!(await isAdminRequest(request, env.ADMIN_SECRET))) return unauthorized();

  try {
    const result = await env.DB.prepare(`
      SELECT
        t.id,
        t.title,
        t.is_active,
        t.created_at,
        t.updated_at,
        COUNT(DISTINCT s.id) AS people_count,
        COUNT(i.id) AS image_count
      FROM tasks t
      LEFT JOIN task_submissions s ON s.task_id = t.id
      LEFT JOIN submission_images i ON i.submission_id = s.id
      GROUP BY t.id
      ORDER BY t.created_at DESC, t.id DESC
    `).all();

    return Response.json({ tasks: result.results || [] }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    console.error('Admin tasks list error', error);
    return Response.json({ error: 'Không thể tải danh sách task.' }, { status: 500 });
  }
}

export async function onRequestPost({ request, env }) {
  if (!(await isAdminRequest(request, env.ADMIN_SECRET))) return unauthorized();

  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Dữ liệu không hợp lệ.' }, { status: 400 });
  }

  const title = cleanTaskTitle(payload?.title);
  if (title.length < 2 || title.length > 120) {
    return Response.json({ error: 'Tên task phải từ 2 đến 120 ký tự.' }, { status: 400 });
  }

  const titleKey = normalizeText(title);
  const now = new Date().toISOString();

  try {
    await env.DB.prepare(`
      INSERT INTO tasks (title, title_key, is_active, created_at, updated_at)
      VALUES (?, ?, 1, ?, ?)
    `).bind(title, titleKey, now, now).run();

    const task = await env.DB.prepare(`
      SELECT id, title, is_active, created_at, updated_at
      FROM tasks WHERE title_key = ? LIMIT 1
    `).bind(titleKey).first();

    return Response.json({ ok: true, task }, { status: 201 });
  } catch (error) {
    if (String(error?.message || '').toLowerCase().includes('unique')) {
      return Response.json({ error: 'Đã có một task cùng tên.' }, { status: 409 });
    }
    console.error('Create task error', error);
    return Response.json({ error: 'Không thể tạo task.' }, { status: 500 });
  }
}

export async function onRequestPatch({ request, env }) {
  if (!(await isAdminRequest(request, env.ADMIN_SECRET))) return unauthorized();

  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Dữ liệu không hợp lệ.' }, { status: 400 });
  }

  const id = Number(payload?.id);
  const isActive = payload?.is_active === true || payload?.is_active === 1 ? 1 : 0;
  if (!Number.isInteger(id) || id < 1) {
    return Response.json({ error: 'Task không hợp lệ.' }, { status: 400 });
  }

  try {
    const result = await env.DB.prepare(`
      UPDATE tasks SET is_active = ?, updated_at = ? WHERE id = ?
    `).bind(isActive, new Date().toISOString(), id).run();

    if (!result.meta?.changes) return Response.json({ error: 'Không tìm thấy task.' }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    console.error('Toggle task error', error);
    return Response.json({ error: 'Không thể cập nhật trạng thái task.' }, { status: 500 });
  }
}
