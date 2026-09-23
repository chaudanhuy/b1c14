import { requireCadre } from "../../_lib/auth.js";
import { HttpError, readJson } from "../../_lib/security.js";
export async function onRequestPost({ request, env }) {
  const auth = await requireCadre(request, env);
  if (!auth.ok) return auth.response;
  const body = await readJson(request);
  const id = Number(body.task_id);
  if (!Number.isSafeInteger(id) || id < 1 || ![0, 1].includes(body.is_active))
    throw new HttpError(400, "Nhiệm vụ hoặc trạng thái không hợp lệ.");
  const task = await env.DB.prepare(
    "UPDATE tasks SET is_active = ?, updated_at = ? WHERE id = ? RETURNING *",
  )
    .bind(body.is_active, new Date().toISOString(), id)
    .first();
  if (!task) throw new HttpError(404, "Nhiệm vụ không tồn tại.");
  return Response.json({ ok: true, task });
}
