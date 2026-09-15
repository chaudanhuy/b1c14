import { requireAuth, requireCadre } from "../_lib/auth.js";
import { cleanText, normalizeText } from "../_lib/utils.js";
import { HttpError, readJson } from "../_lib/security.js";

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;
  const wantsAll =
    new URL(request.url).searchParams.get("all") === "1" &&
    auth.member.role === "cadre";
  const result = await env.DB.prepare(
    `
    SELECT t.*, s.id AS submission_id, COALESCE(f.file_count,0) AS file_count,
      CASE WHEN COALESCE(f.file_count,0) = 0 THEN 'not_submitted' ELSE s.status END AS status,
      s.review_note, s.reviewed_at, s.updated_at AS submitted_at, s.revision
    FROM tasks t
    LEFT JOIN task_submissions s ON s.task_id = t.id AND s.member_id = ?
    LEFT JOIN (SELECT submission_id, COUNT(*) AS file_count FROM submission_images GROUP BY submission_id) f ON f.submission_id = s.id
    ${wantsAll ? "" : "WHERE t.is_active = 1 OR COALESCE(f.file_count,0) > 0"}
    ORDER BY t.is_active DESC, t.created_at DESC, t.id DESC
  `,
  )
    .bind(auth.member.id)
    .all();
  return Response.json({ tasks: result.results || [] });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireCadre(request, env);
  if (!auth.ok) return auth.response;
  const body = await readJson(request);
  const title = cleanText(body.title);
  const description = String(body.description || "").trim();
  if (title.length < 3 || title.length > 180 || description.length > 2000)
    throw new HttpError(
      400,
      "Tên nhiệm vụ cần 3–180 ký tự; mô tả tối đa 2.000 ký tự.",
    );
  let due = null;
  if (body.due_at) {
    const date = new Date(body.due_at);
    if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now())
      throw new HttpError(
        400,
        "Hạn chót cần là một thời điểm trong tương lai.",
      );
    due = date.toISOString();
  }
  const titleKey = normalizeText(title);
  const now = new Date().toISOString();
  let task;
  if (body.task_id !== undefined) {
    const id = Number(body.task_id);
    if (!Number.isSafeInteger(id) || id < 1)
      throw new HttpError(400, "Nhiệm vụ không hợp lệ.");
    const existing = await env.DB.prepare(
      "SELECT id FROM tasks WHERE title_key = ? AND id <> ?",
    )
      .bind(titleKey, id)
      .first();
    if (existing) throw new HttpError(409, "Tên nhiệm vụ đã tồn tại.");
    task = await env.DB.prepare(
      `UPDATE tasks SET title = ?, title_key = ?, description = ?, due_at = ?, updated_at = ? WHERE id = ? RETURNING *`,
    )
      .bind(title, titleKey, description, due, now, id)
      .first();
    if (!task) throw new HttpError(404, "Không tìm thấy nhiệm vụ.");
  } else {
    const existing = await env.DB.prepare(
      "SELECT id FROM tasks WHERE title_key = ?",
    )
      .bind(titleKey)
      .first();
    if (existing) throw new HttpError(409, "Tên nhiệm vụ đã tồn tại.");
    try {
      task = await env.DB.prepare(
        `INSERT INTO tasks(title,title_key,description,due_at,is_active,created_at,updated_at) VALUES(?,?,?,?,1,?,?) RETURNING *`,
      )
        .bind(title, titleKey, description, due, now, now)
        .first();
    } catch (error) {
      if (String(error).includes("UNIQUE"))
        throw new HttpError(409, "Tên nhiệm vụ đã tồn tại.");
      throw error;
    }
  }
  return Response.json({ ok: true, task });
}
