import {
  createSession,
  generateSalt,
  hashPassword,
  requireAuth,
  sessionCookie,
  verifyPassword,
} from "../../_lib/auth.js";
import { HttpError, rateLimit, readJson } from "../../_lib/security.js";
export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;
  const limited = await rateLimit(env, `password:${auth.member.id}`, 6, 900);
  if (limited) return limited;
  const body = await readJson(request);
  const currentPassword =
    typeof body.current_password === "string" ? body.current_password : "";
  const password =
    typeof body.new_password === "string" ? body.new_password : "";
  if (
    !currentPassword ||
    currentPassword.length > 256 ||
    password.length < 8 ||
    password.length > 256
  )
    throw new HttpError(400, "Mật khẩu mới cần từ 8 đến 256 ký tự.");
  if (password !== body.confirm_password)
    throw new HttpError(400, "Mật khẩu xác nhận chưa khớp.");
  if (password === currentPassword || password === "12345678")
    throw new HttpError(400, "Hãy chọn mật khẩu khác, khó đoán hơn.");
  const member = await env.DB.prepare("SELECT * FROM members WHERE id = ?")
    .bind(auth.member.id)
    .first();
  if (
    !member ||
    !(await verifyPassword(
      currentPassword,
      member.password_salt,
      member.password_hash,
    ))
  )
    throw new HttpError(401, "Mật khẩu hiện tại chưa đúng.");
  const salt = generateSalt();
  const hash = await hashPassword(password, salt);
  const result = await env.DB.prepare(
    `UPDATE members SET password_salt = ?, password_hash = ?, is_default_password = 0,
    session_version = session_version + 1, updated_at = ? WHERE id = ? AND password_hash = ? AND session_version = ?`,
  )
    .bind(
      salt,
      hash,
      new Date().toISOString(),
      member.id,
      member.password_hash,
      auth.member.session_version,
    )
    .run();
  if (!result.meta.changes)
    throw new HttpError(409, "Tài khoản vừa thay đổi. Hãy đăng nhập lại.");
  member.session_version += 1;
  const token = await createSession(member, env);
  return Response.json(
    { ok: true, message: "Đã đổi mật khẩu và đăng xuất các phiên khác." },
    { headers: { "Set-Cookie": sessionCookie(token, request) } },
  );
}
