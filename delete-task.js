import { requireCadre } from "../../_lib/auth.js";

export async function onRequestDelete({ request, env }) {
  const auth = await requireCadre(request, env);
  if (!auth.ok) return auth.response;

  if (!env.DB || !env.UPLOADS) {
    return Response.json(
      { error: "Máy chủ chưa được cấu hình DB/R2." },
      { status: 500 },
    );
  }

  const taskId = Number(new URL(request.url).searchParams.get("task_id"));

  if (!Number.isInteger(taskId) || taskId < 1) {
    return Response.json({ error: "Task không hợp lệ." }, { status: 400 });
  }

  const task = await env.DB.prepare(
    `
    SELECT id, title
    FROM tasks
    WHERE id = ?
    LIMIT 1
  `,
  )
    .bind(taskId)
    .first();

  if (!task) {
    return Response.json({ error: "Không tìm thấy task." }, { status: 404 });
  }

  try {
    // Lấy toàn bộ key ảnh của task trước khi xóa database.
    const imageRows = await env.DB.prepare(
      `
      SELECT si.image_key
      FROM submission_images si
      JOIN task_submissions ts
        ON ts.id = si.submission_id
      WHERE ts.task_id = ?
    `,
    )
      .bind(taskId)
      .all();

    const keys = (imageRows.results || [])
      .map((row) => row.image_key)
      .filter(Boolean);

    // Xóa ảnh thật khỏi R2.
    // R2 hỗ trợ xóa nhiều key; chia nhỏ để an toàn.
    for (let i = 0; i < keys.length; i += 1000) {
      const chunk = keys.slice(i, i + 1000);

      if (chunk.length === 1) {
        await env.UPLOADS.delete(chunk[0]);
      } else if (chunk.length > 1) {
        await env.UPLOADS.delete(chunk);
      }
    }

    // Sau khi R2 đã xóa thành công mới xóa dữ liệu trong D1.
    await env.DB.batch([
      env.DB.prepare(
        `
        DELETE FROM submission_images
        WHERE submission_id IN (
          SELECT id
          FROM task_submissions
          WHERE task_id = ?
        )
      `,
      ).bind(taskId),

      env.DB.prepare(
        `
        DELETE FROM task_submissions
        WHERE task_id = ?
      `,
      ).bind(taskId),

      env.DB.prepare(
        `
        DELETE FROM tasks
        WHERE id = ?
      `,
      ).bind(taskId),
    ]);

    return Response.json({
      ok: true,
      deleted_task: task.title,
      deleted_images: keys.length,
    });
  } catch (error) {
    console.error("Delete task error:", error);

    return Response.json(
      {
        error:
          "Không thể xóa hoàn toàn task. Dữ liệu được giữ lại để tránh mất đồng bộ.",
      },
      { status: 500 },
    );
  }
}
