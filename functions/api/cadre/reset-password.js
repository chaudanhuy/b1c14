import {
  generateSalt, hashPassword, verifyPassword, requireAuth, hasPasswordResetAccess,
} from "../../_lib/auth.js";
import { HttpError, readJson, rateLimit } from "../../_lib/security.js";

async function requireOwner(request, env) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth;
  if (!hasPasswordResetAccess(auth.member))
    throw new HttpError(403, "Chỉ Châu Đan Huy được đặt lại mật khẩu thành viên.");
  return auth;
}

export async function onRequestGet({ request, env }) {
  const auth = await requireOwner(request, env);
  if (!auth.ok) return auth.response;
  const rows = await env.DB.prepare(
    "SELECT id, name, unit_label FROM members WHERE id <> ? ORDER BY unit_code, display_order, name",
  ).bind(auth.member.id).all();
  return Response.json({ members: rows.results || [] }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireOwner(request, env);
  if (!auth.ok) return auth.response;
  const limited = await rateLimit(env, `reset-password:${auth.member.id}`, 10, 900);
  if (limited) return limited;
  const body = await readJson(request);
  const id = body.member_id;
  const current = body.current_password;
  if (!Number.isSafeInteger(id) || id < 1 || typeof current !== "string"
      || !current.length || current.length > 256)
    throw new HttpError(400, "Chọn thành viên và nhập mật khẩu hiện tại của bạn.");
  if (id === auth.member.id)
    throw new HttpError(400, "Để đổi mật khẩu của bạn, dùng phần Đổi mật khẩu.");
  const owner = await env.DB.prepare("SELECT * FROM members WHERE id = ?")
    .bind(auth.member.id).first();
  if (!owner || owner.session_version !== auth.member.session_version
      || !hasPasswordResetAccess(owner))
    throw new HttpError(403, "Quyền hoặc phiên đăng nhập vừa thay đổi. Hãy đăng nhập lại.");
  if (!(await verifyPassword(current, owner.password_salt, owner.password_hash)))
    throw new HttpError(401, "Mật khẩu xác nhận của Châu Đan Huy chưa đúng.");
  const member = await env.DB.prepare("SELECT id, name, unit_label, session_version FROM members WHERE id = ?")
    .bind(id).first();
  if (!member) throw new HttpError(404, "Không tìm thấy thành viên.");
  // 144 random bits, returned only in this response. Store only the salted hash.
  const temporaryPassword = generateSalt(18);
  const salt = generateSalt();
  const hash = await hashPassword(temporaryPassword, salt);
  const result = await env.DB.prepare(`
    UPDATE members SET password_salt = ?, password_hash = ?,
      is_default_password = 1, must_change_password = 1,
      session_version = session_version + 1, updated_at = ?
    WHERE id = ? AND session_version = ?
      AND EXISTS (SELECT 1 FROM members owner WHERE owner.id = ?
        AND owner.session_version = ? AND owner.password_hash = ?
        AND owner.name_key = 'chau dan huy' AND owner.unit_code = '1'
        AND owner.can_manage = 1 AND owner.must_change_password = 0)
  `).bind(salt, hash, new Date().toISOString(), id, member.session_version,
    owner.id, owner.session_version, owner.password_hash).run();
  if (!result.meta.changes)
    throw new HttpError(409, "Tài khoản hoặc quyền vừa thay đổi. Hãy tải lại và thử lại.");
  return Response.json({
    ok: true,
    member: { id: member.id, name: member.name, unit_label: member.unit_label },
    temporary_password: temporaryPassword,
    message: "Đã đặt lại mật khẩu và thu hồi các phiên đăng nhập cũ.",
  }, { headers: { "Cache-Control": "no-store" } });
}
