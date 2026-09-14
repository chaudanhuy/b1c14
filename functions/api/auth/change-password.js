import { generateSalt, hashPassword, requireAuth, verifyPassword } from '../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Dữ liệu đổi mật khẩu không hợp lệ.' }, { status: 400 });
  }

  const currentPassword = String(body.current_password || '');
  const newPassword = String(body.new_password || '');
  const confirmPassword = String(body.confirm_password || '');

  if (!currentPassword || !newPassword || !confirmPassword) {
    return Response.json({ error: 'Hãy điền đầy đủ các ô mật khẩu.' }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return Response.json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự.' }, { status: 400 });
  }
  if (newPassword !== confirmPassword) {
    return Response.json({ error: 'Mật khẩu xác nhận chưa khớp.' }, { status: 400 });
  }

  const current = await env.DB.prepare(`
    SELECT password_salt, password_hash
    FROM members WHERE id = ? LIMIT 1
  `).bind(auth.member.id).first();

  const valid = current && await verifyPassword(currentPassword, current.password_salt, current.password_hash);
  if (!valid) {
    return Response.json({ error: 'Mật khẩu hiện tại chưa đúng.' }, { status: 401 });
  }

  const salt = generateSalt();
  const hash = await hashPassword(newPassword, salt);
  await env.DB.prepare(`
    UPDATE members
    SET password_salt = ?, password_hash = ?, is_default_password = 0, updated_at = ?
    WHERE id = ?
  `).bind(salt, hash, new Date().toISOString(), auth.member.id).run();

  return Response.json({ ok: true, message: 'Đổi mật khẩu thành công.' });
}
