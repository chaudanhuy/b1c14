import { requireCadre } from "../../_lib/auth.js";
import { HttpError, rateLimit, readJson } from "../../_lib/security.js";
export async function onRequestPost({ request, env }) {
  const auth = await requireCadre(request, env);
  if (!auth.ok) return auth.response;
  const limited = await rateLimit(env, `review:${auth.member.id}`, 30, 60);
  if (limited) return limited;
  const body = await readJson(request);
  if (!["approved", "rejected"].includes(body.status))
    throw new HttpError(400, "Trạng thái duyệt không hợp lệ.");
  const note = String(body.note || "").trim();
  if (note.length > 1000 || (body.status === "rejected" && !note))
    throw new HttpError(
      400,
      "Hãy nhập lý do cần nộp lại (tối đa 1.000 ký tự).",
    );
  const items = body.items;
  if (
    !Array.isArray(items) ||
    !items.length ||
    items.length > 50 ||
    items.some(
      (x) =>
        !Number.isSafeInteger(x.id) ||
        x.id < 1 ||
        !Number.isSafeInteger(x.revision) ||
        x.revision < 1,
    )
  )
    throw new HttpError(400, "Chọn từ 1 đến 50 bài nộp hợp lệ.");
  if (new Set(items.map((x) => x.id)).size !== items.length)
    throw new HttpError(400, "Danh sách bài nộp bị trùng.");
  // One atomic statement + audit trigger. Revision prevents stale approvals after an upload/delete/other review.
  const result = await env.DB.prepare(
    `UPDATE task_submissions
    SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = ?, revision = revision + 1
    WHERE status = 'pending' AND EXISTS (SELECT 1 FROM submission_images WHERE submission_id = task_submissions.id)
      AND EXISTS (SELECT 1 FROM json_each(?) j WHERE json_extract(j.value,'$.id') = task_submissions.id AND json_extract(j.value,'$.revision') = task_submissions.revision)
    RETURNING id, status, revision
  `,
  )
    .bind(
      body.status,
      note,
      auth.member.id,
      new Date().toISOString(),
      JSON.stringify(items),
    )
    .all();
  const reviewed = result.results || [];
  const ids = new Set(reviewed.map((x) => x.id));
  const skipped = items.filter((x) => !ids.has(x.id)).map((x) => x.id);
  return Response.json({
    ok: true,
    reviewed,
    skipped,
    message: `Đã xử lý ${reviewed.length} bài.${skipped.length ? ` ${skipped.length} bài đã thay đổi; hãy tải lại để kiểm tra.` : ""}`,
  });
}
