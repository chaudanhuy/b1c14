import { requireAuth } from '../../_lib/auth.js';
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_SUBMISSION,
  MAX_UPLOAD_FILES,
  MAX_UPLOAD_TOTAL_BYTES,
  extensionForMime
} from '../../_lib/utils.js';

async function ensureTaskActive(env, taskId) {
  return env.DB.prepare(`SELECT id, title, is_active FROM tasks WHERE id = ? LIMIT 1`).bind(taskId).first();
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;

  if (!env.DB || !env.UPLOADS) {
    return Response.json({ error: 'Máy chủ chưa được cấu hình DB/R2.' }, { status: 500 });
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: 'Không đọc được dữ liệu gửi lên.' }, { status: 400 });
  }

  const taskId = Number(form.get('task_id'));
  const files = form.getAll('images').filter(Boolean);

  if (!Number.isInteger(taskId) || taskId < 1) {
    return Response.json({ error: 'Task không hợp lệ.' }, { status: 400 });
  }
  if (!files.length) {
    return Response.json({ error: 'Bạn chưa chọn ảnh minh chứng.' }, { status: 400 });
  }
  if (files.length > MAX_UPLOAD_FILES) {
    return Response.json({ error: `Mỗi lần chỉ được tải tối đa ${MAX_UPLOAD_FILES} ảnh.` }, { status: 400 });
  }

  const task = await ensureTaskActive(env, taskId);
  if (!task || !Number(task.is_active)) {
    return Response.json({ error: 'Task này đang đóng nhận bài hoặc không tồn tại.' }, { status: 400 });
  }

  let totalSize = 0;
  for (const file of files) {
    if (!(file instanceof File)) {
      return Response.json({ error: 'Có file không hợp lệ.' }, { status: 400 });
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return Response.json({ error: `File "${file.name}" không đúng định dạng PNG/JPG/WEBP.` }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return Response.json({ error: `Ảnh "${file.name}" vượt quá 8 MB.` }, { status: 400 });
    }
    totalSize += file.size;
  }
  if (totalSize > MAX_UPLOAD_TOTAL_BYTES) {
    return Response.json({ error: 'Tổng dung lượng ảnh vượt quá 50 MB.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  let submission = await env.DB.prepare(`
    SELECT id FROM task_submissions
    WHERE task_id = ? AND member_id = ?
    LIMIT 1
  `).bind(taskId, auth.member.id).first();

  if (!submission) {
    const created = await env.DB.prepare(`
      INSERT INTO task_submissions (task_id, member_id, unit_code, unit_label, name, name_key, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      taskId,
      auth.member.id,
      auth.member.unit_code,
      auth.member.unit_label,
      auth.member.name,
      auth.member.name_key,
      now,
      now
    ).run();
    submission = { id: created.meta.last_row_id };
  }

  const countRow = await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM submission_images WHERE submission_id = ?
  `).bind(submission.id).first();
  const currentCount = Number(countRow?.count || 0);
  if (currentCount + files.length > MAX_IMAGES_PER_SUBMISSION) {
    return Response.json({ error: `Mỗi người chỉ lưu tối đa ${MAX_IMAGES_PER_SUBMISSION} ảnh cho một task.` }, { status: 400 });
  }

  let added = 0;
  for (const file of files) {
    const ext = extensionForMime(file.type);
    const objectKey = `task-${taskId}/${auth.member.unit_code}/${auth.member.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const bytes = await file.arrayBuffer();
    await env.UPLOADS.put(objectKey, bytes, {
      httpMetadata: { contentType: file.type }
    });
    await env.DB.prepare(`
      INSERT INTO submission_images (submission_id, image_key, image_type, image_name, image_size, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(submission.id, objectKey, file.type, file.name || 'minh-chung', file.size || 0, now).run();
    added++;
  }

  await env.DB.prepare(`
    UPDATE task_submissions SET updated_at = ? WHERE id = ?
  `).bind(now, submission.id).run();

  return Response.json({
    ok: true,
    added,
    image_count: currentCount + added,
    message: `Đã thêm ${added} ảnh vào hồ sơ của bạn.`
  });
}
