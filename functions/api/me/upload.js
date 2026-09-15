import { requireAuth } from "../../_lib/auth.js";
import { MAX_UPLOAD_TOTAL_BYTES, MAX_UPLOAD_FILES } from "../../_lib/utils.js";
import { validateFile } from "../../_lib/files.js";
import { boundedBody, HttpError, rateLimit } from "../../_lib/security.js";
export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;
  if (!env.UPLOADS) throw new HttpError(503, "Chưa cấu hình kho tệp R2.");
  const limited = await rateLimit(env, `upload:${auth.member.id}`, 12, 600);
  if (limited) return limited;
  const type = request.headers.get("Content-Type") || "";
  if (!type.toLowerCase().startsWith("multipart/form-data;"))
    throw new HttpError(415, "Yêu cầu upload không hợp lệ.");
  let form;
  try {
    const body = await boundedBody(
      request,
      MAX_UPLOAD_TOTAL_BYTES + 256 * 1024,
    );
    form = await new Response(body, {
      headers: { "Content-Type": type },
    }).formData();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Không đọc được dữ liệu tải lên.");
  }
  const taskId = Number(form.get("task_id")),
    files = form.getAll("images");
  if (!Number.isSafeInteger(taskId) || taskId < 1)
    throw new HttpError(400, "Hãy chọn nhiệm vụ.");
  if (!files.length || files.length > MAX_UPLOAD_FILES)
    throw new HttpError(400, "Chọn từ 1 đến 10 tệp mỗi lần.");
  if (files.some((f) => !(f instanceof File)))
    throw new HttpError(400, "Tệp không hợp lệ.");
  if (files.reduce((n, f) => n + f.size, 0) > MAX_UPLOAD_TOTAL_BYTES)
    throw new HttpError(413, "Tổng dung lượng mỗi lần gửi tối đa 25 MB.");
  const task = await env.DB.prepare(
    "SELECT id,is_active,due_at FROM tasks WHERE id = ?",
  )
    .bind(taskId)
    .first();
  if (
    !task ||
    !task.is_active ||
    (task.due_at && new Date(task.due_at).getTime() <= Date.now())
  )
    throw new HttpError(409, "Nhiệm vụ đã đóng hoặc hết hạn nhận bài.");
  const records = [];
  for (const file of files) records.push(await validateFile(file));
  const now = new Date().toISOString();
  for (const record of records)
    record.key = `task-${taskId}/${auth.member.unit_code}/${auth.member.id}/${crypto.randomUUID()}.${record.ext}`;
  // Pre-register new objects for recovery if the request is interrupted before DB commit.
  await env.DB.batch(
    records.map((r) =>
      env.DB.prepare(
        "INSERT INTO r2_cleanup(image_key,not_before) VALUES (?,unixepoch()+86400)",
      ).bind(r.key),
    ),
  );
  try {
    for (let i = 0; i < files.length; i++)
      await env.UPLOADS.put(records[i].key, files[i].stream(), {
        httpMetadata: { contentType: records[i].type },
      });
    const statements = [
      env.DB.prepare(
        `INSERT INTO task_submissions(task_id,member_id,unit_code,unit_label,name,name_key,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(task_id,member_id) DO NOTHING`,
      ).bind(
        taskId,
        auth.member.id,
        auth.member.unit_code,
        auth.member.unit_label,
        auth.member.name,
        auth.member.name_key,
        now,
        now,
      ),
    ];
    for (const r of records)
      statements.push(
        env.DB.prepare(
          `INSERT INTO submission_images(submission_id,image_key,image_type,image_name,image_size,created_at)
      VALUES((SELECT id FROM task_submissions WHERE task_id = ? AND member_id = ?),?,?,?,?,?)`,
        ).bind(taskId, auth.member.id, r.key, r.type, r.name, r.size, now),
      );
    for (const r of records)
      statements.push(
        env.DB.prepare("DELETE FROM r2_cleanup WHERE image_key = ?").bind(
          r.key,
        ),
      );
    await env.DB.batch(statements);
  } catch (error) {
    // Never delete an object if the commit outcome is uncertain: first check which keys are live.
    const live = await env.DB.prepare(
      "SELECT image_key FROM submission_images WHERE image_key IN (SELECT value FROM json_each(?))",
    )
      .bind(JSON.stringify(records.map((r) => r.key)))
      .all();
    const saved = new Set((live.results || []).map((r) => r.image_key));
    const unsaved = records.filter((r) => !saved.has(r.key));
    if (unsaved.length) {
      try {
        await env.UPLOADS.delete(unsaved.map((r) => r.key));
        await env.DB.batch(
          unsaved.map((r) =>
            env.DB.prepare("DELETE FROM r2_cleanup WHERE image_key = ?").bind(
              r.key,
            ),
          ),
        );
      } catch {
        /* queued for retry */
      }
    }
    if (saved.size === records.length)
      return Response.json({
        ok: true,
        added: saved.size,
        message: "Đã lưu minh chứng và chuyển sang chờ duyệt.",
      });
    if (String(error).includes("FILE_LIMIT"))
      throw new HttpError(
        409,
        "Mỗi nhiệm vụ lưu tối đa 50 tệp/người. Hãy xóa bớt trước khi thêm.",
      );
    if (
      String(error).includes("TASK_CLOSED") ||
      String(error).includes("FOREIGN KEY")
    )
      throw new HttpError(409, "Nhiệm vụ vừa đóng, hết hạn hoặc đã bị xóa.");
    throw error;
  }
  return Response.json({
    ok: true,
    added: records.length,
    message: `Đã gửi ${records.length} tệp. Bài của bạn đang chờ duyệt.`,
  });
}
