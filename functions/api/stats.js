import { requireAuth } from '../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;

  const taskId = Number(new URL(request.url).searchParams.get('task_id'));
  if (!Number.isInteger(taskId) || taskId < 1) {
    return Response.json({ total: 0, counts: { cadre: 0, '1': 0, '2': 0, '3': 0 } }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  }

  const result = await env.DB.prepare(`
    SELECT unit_code, COUNT(*) AS count
    FROM task_submissions
    WHERE task_id = ?
    GROUP BY unit_code
  `).bind(taskId).all();

  const counts = { cadre: 0, '1': 0, '2': 0, '3': 0 };
  let total = 0;
  for (const row of result.results || []) {
    counts[row.unit_code] = Number(row.count || 0);
    total += Number(row.count || 0);
  }

  return Response.json({ total, counts }, {
    headers: { 'Cache-Control': 'no-store' }
  });
}
