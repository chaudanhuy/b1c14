import { requireAuth } from '../_lib/auth.js';
import { cleanText, normalizeText } from '../_lib/utils.js';

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const wantsAll = url.searchParams.get('all') === '1' && auth.member.role === 'cadre';
  const result = await env.DB.prepare(`
    SELECT id, title, title_key, is_active, created_at, updated_at
    FROM tasks
    ${wantsAll ? '' : 'WHERE is_active = 1'}
    ORDER BY is_active DESC, created_at DESC, id DESC
  `).all();

  return Response.json({ tasks: result.results || [] }, {
    headers: { 'Cache-Control': 'no-store' }
  });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;
  if (auth.member.role !== 'cadre') {
    return Response.json({ error: 'Chỉ cán bộ trung đội mới được tạo task.' }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Dữ liệu task không hợp lệ.' }, { status: 400 });
  }

  const title = cleanText(body.title);
  const titleKey = normalizeText(title);
  if (title.length < 3) {
    return Response.json({ error: 'Tên task cần dài ít nhất 3 ký tự.' }, { status: 400 });
  }

  const existing = await env.DB.prepare(`SELECT id FROM tasks WHERE title_key = ? LIMIT 1`).bind(titleKey).first();
  if (existing) {
    return Response.json({ error: 'Task này đã tồn tại.' }, { status: 409 });
  }

  const now = new Date().toISOString();
  const created = await env.DB.prepare(`
    INSERT INTO tasks (title, title_key, is_active, created_at, updated_at)
    VALUES (?, ?, 1, ?, ?)
  `).bind(title, titleKey, now, now).run();

  return Response.json({
    ok: true,
    task: {
      id: created.meta.last_row_id,
      title,
      title_key: titleKey,
      is_active: 1,
      created_at: now,
      updated_at: now
    }
  });
}
