import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, cleanName, extensionForMime, normalizeName } from '../_lib/utils.js';

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

  const squad = Number(form.get('squad'));
  const name = cleanName(form.get('name'));
  const image = form.get('image');

  if (![1, 2, 3].includes(squad)) {
    return Response.json({ error: 'Tiểu đội không hợp lệ.' }, { status: 400 });
  }
  if (name.length < 2 || name.length > 80) {
    return Response.json({ error: 'Họ tên phải từ 2 đến 80 ký tự.' }, { status: 400 });
  }
  if (!(image instanceof File) || image.size === 0) {
    return Response.json({ error: 'Bạn chưa chọn ảnh minh chứng.' }, { status: 400 });
  }
  if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
    return Response.json({ error: 'Chỉ nhận ảnh PNG, JPG/JPEG hoặc WEBP.' }, { status: 400 });
  }
  if (image.size > MAX_IMAGE_BYTES) {
    return Response.json({ error: 'Ảnh vượt quá giới hạn 8 MB.' }, { status: 413 });
  }

  const nameKey = normalizeName(name);
  const existing = await env.DB.prepare(
    'SELECT id, image_key FROM submissions WHERE squad = ? AND name_key = ? LIMIT 1'
  ).bind(squad, nameKey).first();

  const extension = extensionForMime(image.type);
  const newKey = `submissions/squad-${squad}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

  try {
    await env.UPLOADS.put(newKey, image.stream(), {
      httpMetadata: { contentType: image.type },
      customMetadata: { squad: String(squad), uploader: name.slice(0, 80) }
    });

    const now = new Date().toISOString();
    if (existing) {
      await env.DB.prepare(`
        UPDATE submissions
        SET name = ?, image_key = ?, image_type = ?, image_name = ?, image_size = ?, updated_at = ?
        WHERE id = ?
      `).bind(name, newKey, image.type, image.name.slice(0, 160), image.size, now, existing.id).run();

      if (existing.image_key && existing.image_key !== newKey) {
        await env.UPLOADS.delete(existing.image_key).catch(() => {});
      }

      return Response.json({ ok: true, replaced: true });
    }

    await env.DB.prepare(`
      INSERT INTO submissions (squad, name, name_key, image_key, image_type, image_name, image_size, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(squad, name, nameKey, newKey, image.type, image.name.slice(0, 160), image.size, now, now).run();

    return Response.json({ ok: true, replaced: false }, { status: 201 });
  } catch (error) {
    await env.UPLOADS.delete(newKey).catch(() => {});
    console.error('Submit error', error);
    return Response.json({ error: 'Không thể lưu minh chứng. Hãy thử lại.' }, { status: 500 });
  }
}

export function onRequest() {
  return new Response('Method Not Allowed', { status: 405 });
}
