import { requireAuth } from '../../_lib/auth.js';

import {
  ALLOWED_FILE_TYPES,
  ALLOWED_FILE_EXTENSIONS,
  MAX_FILE_BYTES,
  MAX_FILES_PER_SUBMISSION,
  MAX_UPLOAD_FILES,
  MAX_UPLOAD_TOTAL_BYTES,
  extensionForMime,
  getFileExtension
} from '../../_lib/utils.js';

async function ensureTaskActive(env, taskId) {
  return env.DB.prepare(`
    SELECT id, title, is_active
    FROM tasks
    WHERE id = ?
    LIMIT 1
  `).bind(taskId).first();
}

function isAllowedFile(file) {
  const extension = getFileExtension(file.name);

  return (
    ALLOWED_FILE_TYPES.has(file.type) ||
    ALLOWED_FILE_EXTENSIONS.has(extension)
  );
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);

  if (!auth.ok) {
    return auth.response;
  }

  if (!env.DB || !env.UPLOADS) {
    return Response.json(
      { error: 'Máy chủ chưa được cấu hình DB/R2.' },
      { status: 500 }
    );
  }

  let form;

  try {
    form = await request.formData();
  } catch {
    return Response.json(
      { error: 'Không đọc được dữ liệu gửi lên.' },
      { status: 400 }
    );
  }

  const taskId = Number(form.get('task_id'));

  // Giữ tên field "images" để tương thích code cũ.
  const files = form
    .getAll('images')
    .filter(Boolean);

  if (!Number.isInteger(taskId) || taskId < 1) {
    return Response.json(
      { error: 'Task không hợp lệ.' },
      { status: 400 }
    );
  }

  if (!files.length) {
    return Response.json(
      { error: 'Bạn chưa chọn tài liệu.' },
      { status: 400 }
    );
  }

  if (files.length > MAX_UPLOAD_FILES) {
    return Response.json(
      {
        error:
          `Mỗi lần chỉ được tải tối đa ${MAX_UPLOAD_FILES} tài liệu.`
      },
      { status: 400 }
    );
  }

  const task = await ensureTaskActive(
    env,
    taskId
  );

  if (!task || !Number(task.is_active)) {
    return Response.json(
      {
        error:
          'Task này đang đóng nhận bài hoặc không tồn tại.'
      },
      { status: 400 }
    );
  }

  let totalSize = 0;

  for (const file of files) {
    if (!(file instanceof File)) {
      return Response.json(
        { error: 'Có tệp không hợp lệ.' },
        { status: 400 }
      );
    }

    if (!isAllowedFile(file)) {
      return Response.json(
        {
          error:
            `File "${file.name}" không thuộc định dạng được hỗ trợ.`
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_BYTES) {
      return Response.json(
        {
          error:
            `File "${file.name}" vượt quá 20 MB.`
        },
        { status: 400 }
      );
    }

    totalSize += file.size;
  }

  if (totalSize > MAX_UPLOAD_TOTAL_BYTES) {
    return Response.json(
      {
        error:
          'Tổng dung lượng tài liệu vượt quá 100 MB.'
      },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();

  let submission =
    await env.DB.prepare(`
      SELECT id
      FROM task_submissions
      WHERE task_id = ?
        AND member_id = ?
      LIMIT 1
    `)
      .bind(
        taskId,
        auth.member.id
      )
      .first();

  if (!submission) {
    const created =
      await env.DB.prepare(`
        INSERT INTO task_submissions (
          task_id,
          member_id,
          unit_code,
          unit_label,
          name,
          name_key,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
        .bind(
          taskId,
          auth.member.id,
          auth.member.unit_code,
          auth.member.unit_label,
          auth.member.name,
          auth.member.name_key,
          now,
          now
        )
        .run();

    submission = {
      id: created.meta.last_row_id
    };
  }

  const countRow =
    await env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM submission_images
      WHERE submission_id = ?
    `)
      .bind(submission.id)
      .first();

  const currentCount =
    Number(countRow?.count || 0);

  if (
    currentCount + files.length >
    MAX_FILES_PER_SUBMISSION
  ) {
    return Response.json(
      {
        error:
          `Mỗi người chỉ lưu tối đa ${MAX_FILES_PER_SUBMISSION} tài liệu cho một task.`
      },
      { status: 400 }
    );
  }

  let added = 0;

  for (const file of files) {
    const originalExtension =
      getFileExtension(file.name);

    const ext =
      ALLOWED_FILE_EXTENSIONS.has(
        originalExtension
      )
        ? originalExtension
        : extensionForMime(file.type);

    const objectKey =
      `task-${taskId}/` +
      `${auth.member.unit_code}/` +
      `${auth.member.id}/` +
      `${Date.now()}-` +
      `${crypto.randomUUID()}.${ext}`;

    const bytes =
      await file.arrayBuffer();

    await env.UPLOADS.put(
      objectKey,
      bytes,
      {
        httpMetadata: {
          contentType:
            file.type ||
            'application/octet-stream'
        }
      }
    );

    await env.DB.prepare(`
      INSERT INTO submission_images (
        submission_id,
        image_key,
        image_type,
        image_name,
        image_size,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `)
      .bind(
        submission.id,
        objectKey,
        file.type ||
          'application/octet-stream',
        file.name ||
          'tai-lieu',
        file.size || 0,
        now
      )
      .run();

    added++;
  }

  await env.DB.prepare(`
    UPDATE task_submissions
    SET updated_at = ?
    WHERE id = ?
  `)
    .bind(
      now,
      submission.id
    )
    .run();

  return Response.json({
    ok: true,
    added,
    image_count:
      currentCount + added,
    message:
      `Đã thêm ${added} tài liệu vào hồ sơ của bạn.`
  });
}