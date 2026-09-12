import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_SUBMISSION,
  MAX_UPLOAD_FILES,
  MAX_UPLOAD_TOTAL_BYTES,
  cleanName,
  extensionForMime,
  normalizeName
} from '../_lib/utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.DB || !env.UPLOADS) {
    return Response.json({ error: 'Máy chủ chưa được cấu hình D1/R2.' }, { status: 500 });
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 });
  }

  const taskId = Number(form.get('task_id'));
  const squad = Number(form.get('squad'));
  const name = cleanName(form.get('name'));
  const images = form.getAll('images').filter(item => item instanceof File && item.size > 0);

  if (!Number.isInteger(taskId) || taskId < 1) {
    return Response.json({ error: 'Hãy chọn task cần nộp minh chứng.' }, { status: 400 });
  }
  if (![1, 2, 3].includes(squad)) {
    return Response.json({ error: 'Tiểu đội không hợp lệ.' }, { status: 400 });
  }
  if (name.length < 2 || name.length > 80) {
    return Response.json({ error: 'Họ tên phải từ 2 đến 80 ký tự.' }, { status: 400 });
  }
  if (!images.length) {
    return Response.json({ error: 'Bạn chưa chọn ảnh minh chứng.' }, { status: 400 });
  }
  if (images.length > MAX_UPLOAD_FILES) {
    return Response.json({ error: `Mỗi lần chỉ nên tải tối đa ${MAX_UPLOAD_FILES} ảnh.` }, { status: 400 });
  }

  let totalBytes = 0;
  for (const image of images) {
    if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
      return Response.json({ error: 'Chỉ nhận ảnh PNG, JPG/JPEG hoặc WEBP.' }, { status: 400 });
    }
    if (image.size > MAX_IMAGE_BYTES) {
      return Response.json({ error: `Ảnh "${image.name}" vượt quá giới hạn 8 MB.` }, { status: 413 });
    }
    totalBytes += image.size;
  }
  if (totalBytes > MAX_UPLOAD_TOTAL_BYTES) {
    return Response.json({ error: 'Tổng dung lượng ảnh trong một lần gửi vượt quá 50 MB.' }, { status: 413 });
  }

  const task = await env.DB.prepare('SELECT id, title FROM tasks WHERE id = ? AND is_active = 1 LIMIT 1')
    .bind(taskId).first();
  if (!task) {
    return Response.json({ error: 'Task này không tồn tại hoặc đã đóng nhận bài.' }, { status: 400 });
  }

  const nameKey = normalizeName(name);
  const now = new Date().toISOString();

  try {
    let submission = await env.DB.prepare(`
      SELECT id FROM task_submissions
      WHERE task_id = ? AND squad = ? AND name_key = ?
      LIMIT 1
    `).bind(taskId, squad, nameKey).first();

    let created = false;
    if (!submission) {
      await env.DB.prepare(`
        INSERT INTO task_submissions (task_id, squad, name, name_key, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(taskId, squad, name, nameKey, now, now).run();

      submission = await env.DB.prepare(`
        SELECT id FROM task_submissions
        WHERE task_id = ? AND squad = ? AND name_key = ?
        LIMIT 1
      `).bind(taskId, squad, nameKey).first();
      created = true;
    }

    const existingCountRow = await env.DB.prepare(`
      SELECT COUNT(*) AS count FROM submission_images WHERE submission_id = ?
    `).bind(submission.id).first();
    const existingCount = Number(existingCountRow?.count || 0);
    if (existingCount + images.length > MAX_IMAGES_PER_SUBMISSION) {
      if (created) await env.DB.prepare('DELETE FROM task_submissions WHERE id = ?').bind(submission.id).run();
      return Response.json({ error: `Mỗi người tối đa ${MAX_IMAGES_PER_SUBMISSION} ảnh cho một task.` }, { status: 400 });
    }

    const uploaded = [];
    try {
      for (const image of images) {
        const extension = extensionForMime(image.type);
        const key = `tasks/${taskId}/squad-${squad}/submission-${submission.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
        await env.UPLOADS.put(key, image.stream(), {
          httpMetadata: { contentType: image.type },
          customMetadata: {
            taskId: String(taskId),
            squad: String(squad),
            uploader: name.slice(0, 80)
          }
        });
        uploaded.push({ key, image });
      }

      const statements = uploaded.map(({ key, image }) => env.DB.prepare(`
        INSERT INTO submission_images (submission_id, image_key, image_type, image_name, image_size, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        submission.id,
        key,
        image.type,
        String(image.name || 'minh-chung').slice(0, 180),
        image.size,
        now
      ));

      statements.push(env.DB.prepare(`
        UPDATE task_submissions SET name = ?, updated_at = ? WHERE id = ?
      `).bind(name, now, submission.id));

      await env.DB.batch(statements);
    } catch (error) {
      await Promise.all(uploaded.map(item => env.UPLOADS.delete(item.key).catch(() => {})));
      if (created) await env.DB.prepare('DELETE FROM task_submissions WHERE id = ?').bind(submission.id).run().catch(() => {});
      throw error;
    }

    return Response.json({
      ok: true,
      created,
      added: images.length,
      image_count: existingCount + images.length
    }, { status: created ? 201 : 200 });
  } catch (error) {
    console.error('Submit error', error);
    return Response.json({ error: 'Không thể lưu minh chứng. Hãy thử lại.' }, { status: 500 });
  }
}

export function onRequest() {
  return new Response('Method Not Allowed', { status: 405 });
}
