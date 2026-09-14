import { requireCadre } from '../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  const auth = await requireCadre(request, env);
  if (!auth.ok) return auth.response;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Dữ liệu task không hợp lệ.' }, { status: 400 });
  }

  const taskId = Number(body.task_id);
  const isActive = body.is_active ? 1 : 0;
  if (!Number.isInteger(taskId) || taskId < 1) {
    return Response.json({ error: 'Task không hợp lệ.' }, { status: 400 });
  }

  await env.DB.prepare(`
    UPDATE tasks SET is_active = ?, updated_at = ? WHERE id = ?
  `).bind(isActive, new Date().toISOString(), taskId).run();

  const task = await env.DB.prepare(`
    SELECT id, title, title_key, is_active, created_at, updated_at
    FROM tasks WHERE id = ? LIMIT 1
  `).bind(taskId).first();

  return Response.json({ ok: true, task });
}
