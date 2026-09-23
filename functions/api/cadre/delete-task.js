import { requireCadre } from "../../_lib/auth.js";
import { HttpError } from "../../_lib/security.js";
export async function onRequestDelete({ request, env }) {
  const auth = await requireCadre(request, env);
  if (!auth.ok) return auth.response;
  const id = Number(new URL(request.url).searchParams.get("task_id"));
  if (!Number.isSafeInteger(id) || id < 1)
    throw new HttpError(400, "Nhiệm vụ không hợp lệ.");
  // Cascades and deletion triggers enqueue R2 cleanup in the same transaction.
  // A failed R2 delete can be retried; it never leaves a live DB row pointing to a deleted file.
  const task = await env.DB.prepare(
    "DELETE FROM tasks WHERE id = ? RETURNING title",
  )
    .bind(id)
    .first();
  if (!task) throw new HttpError(404, "Nhiệm vụ không tồn tại.");
  return Response.json({
    ok: true,
    deleted_task: task.title,
    message: "Đã xóa nhiệm vụ. Tệp lưu trữ được dọn tự động.",
  });
}
