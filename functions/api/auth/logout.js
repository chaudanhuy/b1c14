import { clearSessionCookie, getAuthenticatedMember } from "../../_lib/auth.js";
export async function onRequestPost({ request, env }) {
  const member = await getAuthenticatedMember(request, env);
  if (member)
    await env.DB.prepare(
      "UPDATE members SET session_version = session_version + 1 WHERE id = ?",
    )
      .bind(member.id)
      .run();
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": clearSessionCookie(request) } },
  );
}
