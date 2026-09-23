import { requireAuth } from "../../_lib/auth.js";
import { HttpError } from "../../_lib/security.js";
export async function onRequestDelete({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isSafeInteger(id) || id < 1)
    throw new HttpError(400, "Tệp không hợp lệ.");
  const row = await env.DB.prepare(
    `DELETE FROM submission_images WHERE id = ? AND submission_id IN (
    SELECT s.id FROM task_submissions s JOIN tasks t ON t.id = s.task_id WHERE s.member_id = ?
    AND t.is_active = 1 AND (t.due_at IS NULL OR julianday(t.due_at) > julianday('now'))
  ) RETURNING submission_id`,
  )
    .bind(id, auth.member.id)
    .first();
  if (!row)
    throw new HttpError(
      409,
      "Không thể xóa: tệp không thuộc bạn, đã bị xóa, hoặc nhiệm vụ đã đóng/hết hạn.",
    );
  const remaining = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM submission_images WHERE submission_id = ?",
  )
    .bind(row.submission_id)
    .first();
  return Response.json({ ok: true, remaining: remaining.count });
}
