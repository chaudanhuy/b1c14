import { requireCadre } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const auth = await requireCadre(request, env);
  if (!auth.ok) return auth.response;

  const taskId = Number(new URL(request.url).searchParams.get('task_id'));
  if (!Number.isInteger(taskId) || taskId < 1) {
    return Response.json({ submissions: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const result = await env.DB.prepare(`
    SELECT
      ts.id,
      ts.task_id,
      ts.member_id,
      ts.unit_code,
      ts.unit_label,
      ts.name,
      ts.created_at,
      ts.updated_at,
      COUNT(si.id) AS image_count
    FROM task_submissions ts
    LEFT JOIN submission_images si ON si.submission_id = ts.id
    WHERE ts.task_id = ?
    GROUP BY ts.id
    ORDER BY
      CASE ts.unit_code
        WHEN 'cadre' THEN 0
        WHEN '1' THEN 1
        WHEN '2' THEN 2
        WHEN '3' THEN 3
        ELSE 9
      END,
      ts.updated_at DESC,
      ts.name COLLATE NOCASE ASC
  `).bind(taskId).all();

  return Response.json({ submissions: result.results || [] }, {
    headers: { 'Cache-Control': 'no-store' }
  });
}
