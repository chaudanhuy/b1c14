export async function taskRoster(env, taskId) {
  const result = await env.DB.prepare(
    `
    SELECT m.id AS member_id, m.name, m.avatar_url, m.unit_code, m.unit_label, s.id, s.task_id,
      s.created_at, s.updated_at, s.revision, s.review_note, s.reviewed_at,
      r.name AS reviewer_name, COALESCE(f.file_count,0) AS image_count,
      CASE WHEN COALESCE(f.file_count,0) = 0 THEN 'not_submitted' ELSE s.status END AS status
    FROM members m
    LEFT JOIN task_submissions s ON s.member_id = m.id AND s.task_id = ?
    LEFT JOIN members r ON r.id = s.reviewed_by
    LEFT JOIN (SELECT submission_id, COUNT(*) AS file_count FROM submission_images
      WHERE submission_id IN (SELECT id FROM task_submissions WHERE task_id = ?)
      GROUP BY submission_id) f ON f.submission_id = s.id
    ORDER BY CASE m.unit_code WHEN 'cadre' THEN 0 ELSE CAST(m.unit_code AS INTEGER) END, m.display_order, m.name
  `,
  )
    .bind(taskId, taskId)
    .all();
  return result.results || [];
}
export function summarize(rows) {
  const stats = {
    total_members: rows.length,
    submitted: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
    not_submitted: 0,
    units: {},
  };
  for (const row of rows) {
    const unit = (stats.units[row.unit_code] ||= {
      total: 0,
      submitted: 0,
      approved: 0,
    });
    unit.total++;
    const status = Number(row.image_count) > 0
      ? (["approved", "pending", "rejected"].includes(row.status) ? row.status : "pending")
      : "not_submitted";
    stats[status]++;
    if (status !== "not_submitted") {
      stats.submitted++;
      unit.submitted++;
    }
    if (status === "approved") unit.approved++;
  }
  return stats;
}
