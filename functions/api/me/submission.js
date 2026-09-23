import { requireAuth } from "../../_lib/auth.js";
import { HttpError } from "../../_lib/security.js";
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;
  const id = Number(new URL(request.url).searchParams.get("task_id"));
  if (!Number.isSafeInteger(id) || id < 1)
    throw new HttpError(400, "Hãy chọn nhiệm vụ.");
  const submission = await env.DB.prepare(
    `SELECT s.*, m.name AS reviewer_name FROM task_submissions s LEFT JOIN members m ON m.id = s.reviewed_by WHERE s.task_id = ? AND s.member_id = ?`,
  )
    .bind(id, auth.member.id)
    .first();
  if (!submission)
    return Response.json({ submission: null, images: [], history: [] });
  const results = await env.DB.batch([
    env.DB.prepare(
      "SELECT id,submission_id,image_name,image_type,image_size,created_at FROM submission_images WHERE submission_id = ? ORDER BY id DESC",
    ).bind(submission.id),
    env.DB.prepare(
      "SELECT h.status,h.note,h.created_at,m.name AS reviewer_name FROM review_history h LEFT JOIN members m ON m.id = h.reviewer_id WHERE h.submission_id = ? ORDER BY h.id DESC LIMIT 20",
    ).bind(submission.id),
  ]);
  return Response.json({
    submission,
    images: results[0].results || [],
    history: results[1].results || [],
  });
}
