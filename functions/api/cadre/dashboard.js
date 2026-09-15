import { requireCadre } from "../../_lib/auth.js";
export async function onRequestGet({ request, env }) {
  const auth = await requireCadre(request, env);
  if (!auth.ok) return auth.response;
  const result = await env.DB.prepare(
    `
    SELECT m.unit_code, m.unit_label, COUNT(*) AS expected,
      SUM(CASE WHEN f.submission_id IS NOT NULL THEN 1 ELSE 0 END) AS submitted,
      SUM(CASE WHEN f.submission_id IS NOT NULL AND s.status = 'approved' THEN 1 ELSE 0 END) AS approved,
      SUM(CASE WHEN f.submission_id IS NOT NULL AND s.status = 'pending' THEN 1 ELSE 0 END) AS pending
    FROM members m CROSS JOIN tasks t
    LEFT JOIN task_submissions s ON s.member_id = m.id AND s.task_id = t.id
    LEFT JOIN (SELECT DISTINCT submission_id FROM submission_images) f ON f.submission_id = s.id
    WHERE t.is_active = 1 GROUP BY m.unit_code
  `,
  ).all();
  return Response.json({ units: result.results || [] });
}
