import { requireCadre } from "../../_lib/auth.js";
import { taskRoster, summarize } from "../../_lib/submissions.js";
import { HttpError } from "../../_lib/security.js";
export async function onRequestGet({ request, env }) {
  const auth = await requireCadre(request, env);
  if (!auth.ok) return auth.response;
  const id = Number(new URL(request.url).searchParams.get("task_id"));
  if (!Number.isSafeInteger(id) || id < 1)
    throw new HttpError(400, "Hãy chọn nhiệm vụ.");
  const task = await env.DB.prepare("SELECT * FROM tasks WHERE id = ?")
    .bind(id)
    .first();
  if (!task) throw new HttpError(404, "Nhiệm vụ không còn tồn tại.");
  const members = await taskRoster(env, id);
  return Response.json({
    task,
    members,
    submissions: members.filter((row) => row.image_count > 0),
    stats: summarize(members),
  });
}
