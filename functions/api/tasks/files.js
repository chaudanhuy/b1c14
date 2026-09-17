import { requireAuth } from "../../_lib/auth.js";
import { HttpError } from "../../_lib/security.js";

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;
  const id = Number(new URL(request.url).searchParams.get("submission_id"));
  if (!Number.isSafeInteger(id) || id < 1)
    throw new HttpError(400, "Bài nộp không hợp lệ.");
  const submission = await env.DB.prepare(
    "SELECT s.id,s.task_id FROM task_submissions s JOIN tasks t ON t.id=s.task_id WHERE s.id=?"
  ).bind(id).first();
  if (!submission) throw new HttpError(404, "Bài nộp không còn tồn tại.");
  const result = await env.DB.prepare(
    "SELECT id,submission_id,image_name,image_type,image_size,created_at FROM submission_images WHERE submission_id=? ORDER BY created_at,id"
  ).bind(id).all();
  return Response.json({ submission, images: result.results || [], can_edit: false },
    { headers: { "Cache-Control": "no-store" } });
}
