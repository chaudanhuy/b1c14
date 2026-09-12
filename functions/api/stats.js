export async function onRequestGet({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Database chưa được cấu hình.' }, { status: 500 });

  try {
    const url = new URL(request.url);
    let taskId = Number(url.searchParams.get('task_id'));

    if (!Number.isInteger(taskId) || taskId < 1) {
      const latest = await env.DB.prepare(`
        SELECT id FROM tasks WHERE is_active = 1 ORDER BY created_at DESC, id DESC LIMIT 1
      `).first();
      taskId = Number(latest?.id || 0);
    }

    if (!taskId) {
      return Response.json({ task_id: null, total: 0, squads: { '1': 0, '2': 0, '3': 0 } }, {
        headers: { 'Cache-Control': 'no-store' }
      });
    }

    const result = await env.DB.prepare(`
      SELECT squad, COUNT(*) AS count
      FROM task_submissions
      WHERE task_id = ?
      GROUP BY squad
      ORDER BY squad ASC
    `).bind(taskId).all();

    const squads = { '1': 0, '2': 0, '3': 0 };
    for (const row of result.results || []) squads[String(row.squad)] = Number(row.count) || 0;
    const total = squads['1'] + squads['2'] + squads['3'];

    return Response.json({ task_id: taskId, total, squads }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    console.error('Stats error', error);
    return Response.json({ error: 'Không thể tải thống kê.' }, { status: 500 });
  }
}
