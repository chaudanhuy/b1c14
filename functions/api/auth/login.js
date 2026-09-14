import { createSession, hasManagementAccess, sessionCookie, verifyPassword } from '../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Dữ liệu đăng nhập không hợp lệ.' }, { status: 400 });
  }

  const memberId = Number(body.member_id);
  const password = String(body.password || '');

  if (!Number.isInteger(memberId) || memberId < 1) {
    return Response.json({ error: 'Bạn chưa chọn đúng họ tên.' }, { status: 400 });
  }
  if (password.length < 1) {
    return Response.json({ error: 'Bạn chưa nhập mật khẩu.' }, { status: 400 });
  }

  const member = await env.DB.prepare(`
  SELECT
    id,
    unit_code,
    unit_label,
    name,
    name_key,
    password_salt,
    password_hash,
    is_default_password,
    can_manage
    FROM members WHERE id = ? LIMIT 1
  `).bind(memberId).first();

  if (!member) {
    return Response.json({ error: 'Không tìm thấy tài khoản đã chọn.' }, { status: 404 });
  }

  const ok = await verifyPassword(password, member.password_salt, member.password_hash);
  if (!ok) {
    return Response.json({ error: 'Mật khẩu chưa đúng.' }, { status: 401 });
  }

  // Đồng bộ quyền vào D1 khi tài khoản thuộc danh sách quản lý nhưng database cũ chưa có can_manage = 1.
  if (hasManagementAccess(member) && Number(member.can_manage) !== 1) {
    await env.DB.prepare(`
      UPDATE members
      SET can_manage = 1, updated_at = datetime('now')
      WHERE id = ?
    `).bind(member.id).run();
    member.can_manage = 1;
  }

  const token = await createSession(member, env);
  return new Response(JSON.stringify({
    ok: true,
    member: {
      id: member.id,
      unit_code: member.unit_code,
      unit_label: member.unit_label,
      name: member.name,
      role: hasManagementAccess(member) ? 'cadre' : 'member',
      is_default_password: !!member.is_default_password
    }
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': sessionCookie(token, request)
    }
  });
}
