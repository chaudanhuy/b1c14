import { requireAuth } from "../../_lib/auth.js";
import { HttpError } from "../../_lib/security.js";
import { taskRoster, summarize } from "../../_lib/submissions.js";

// Authenticated read-only view. Management and all writes keep their original guards.
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;
  const id = Number(new URL(request.url).searchParams.get("task_id"));
  if (!Number.isSafeInteger(id) || id < 1)
    throw new HttpError(400, "Hãy chọn nhiệm vụ hợp lệ.");
  const task = await env.DB.prepare(
    "SELECT id,title,description,due_at,is_active FROM tasks WHERE id = ?"
  ).bind(id).first();
  if (!task) throw new HttpError(404, "Nhiệm vụ không còn tồn tại.");
  const roster = await taskRoster(env, id);
  const members = roster.map(({ member_id, name, avatar_url, unit_code, unit_label, id,
    image_count, status, updated_at, revision }) => ({
    member_id, name, avatar_url, unit_code, unit_label, id, image_count,
    status, updated_at, revision, can_edit: false,
  }));
  return Response.json({ task, members, stats: summarize(roster) },
    { headers: { "Cache-Control": "no-store" } });
}
