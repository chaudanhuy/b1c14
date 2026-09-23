import {
  createSession,
  hashPassword,
  needsPasswordUpgrade,
  publicMember,
  sessionCookie,
  verifyPassword,
} from "../../_lib/auth.js";
import { HttpError, rateLimit, readJson } from "../../_lib/security.js";

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const memberId = Number(body.member_id);
  const password = typeof body.password === "string" ? body.password : "";
  if (
    !Number.isSafeInteger(memberId) ||
    memberId < 1 ||
    !password ||
    password.length > 256
  )
    throw new HttpError(400, "Hãy chọn họ tên và nhập mật khẩu hợp lệ.");
  const limited = await rateLimit(env, `login:member:${memberId}`, 10, 900);
  if (limited) return limited;
  const member = await env.DB.prepare("SELECT * FROM members WHERE id = ?")
    .bind(memberId)
    .first();
  if (
    !member ||
    !(await verifyPassword(
      password,
      member.password_salt,
      member.password_hash,
    ))
  )
    throw new HttpError(401, "Tài khoản hoặc mật khẩu chưa đúng.");
  if (needsPasswordUpgrade(member.password_hash)) {
    const upgraded = await hashPassword(password, member.password_salt);
    // Do not overwrite a password changed by another session while verifying.
    const result = await env.DB.prepare(
      "UPDATE members SET password_hash = ? WHERE id = ? AND password_hash = ?",
    )
      .bind(upgraded, member.id, member.password_hash)
      .run();
    if (!result.meta.changes)
      throw new HttpError(409, "Tài khoản vừa thay đổi. Hãy đăng nhập lại.");
  }
  const token = await createSession(member, env);
  return Response.json(
    { ok: true, member: publicMember(member) },
    { headers: { "Set-Cookie": sessionCookie(token, request) } },
  );
}
