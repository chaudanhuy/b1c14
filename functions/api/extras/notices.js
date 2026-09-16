import { requireAuth, requireCadre } from '../../_lib/auth.js';
import { HttpError, readJson, rateLimit } from '../../_lib/security.js';
import { textField, recordId, positiveInt, pageOffset, resultPage, conflict } from '../../_lib/extras.js';
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env); if (!auth.ok) return auth.response;
  const rows = await env.DB.prepare(`SELECT a.*, m.name AS author_name,
    CASE WHEN r.revision=a.revision THEN 1 ELSE 0 END AS is_read
    FROM announcements a JOIN members m ON m.id=a.author_id
    LEFT JOIN announcement_reads r ON r.announcement_id=a.id AND r.member_id=?
    ORDER BY a.pinned DESC, a.created_at DESC, a.id DESC LIMIT 21 OFFSET ?`)
    .bind(auth.member.id, pageOffset(new URL(request.url))).all();
  return Response.json(resultPage(rows.results || []));
}
function fields(body) {
  if (typeof body.pinned !== 'boolean') throw new HttpError(400, 'Trạng thái ghim không hợp lệ.');
  return [textField(body.title, 'Tiêu đề', 160), textField(body.body, 'Nội dung', 8000), body.pinned ? 1 : 0];
}
export async function onRequestPost({ request, env }) {
  const auth = await requireCadre(request, env); if (!auth.ok) return auth.response;
  const limited = await rateLimit(env, 'notices:' + auth.member.id, 20, 3600); if (limited) return limited;
  const body = await readJson(request), values = fields(body), id = crypto.randomUUID(), now = new Date().toISOString();
  await env.DB.prepare('INSERT INTO announcements(id,author_id,title,body,pinned,created_at,updated_at) VALUES(?,?,?,?,?,?,?)')
    .bind(id, auth.member.id, ...values, now, now).run();
  return Response.json({ ok: true, id });
}
export async function onRequestPatch({ request, env }) {
  const auth = await requireAuth(request, env); if (!auth.ok) return auth.response;
  const body = await readJson(request), id = recordId(body.id), revision = positiveInt(body.revision);
  if (body.action === 'read') {
    const res = await env.DB.prepare(`INSERT INTO announcement_reads(announcement_id,member_id,revision,read_at)
      SELECT id, ?, revision, ? FROM announcements WHERE id=? AND revision=?
      ON CONFLICT(announcement_id,member_id) DO UPDATE SET revision=excluded.revision,read_at=excluded.read_at`)
      .bind(auth.member.id, new Date().toISOString(), id, revision).run();
    conflict(res); return Response.json({ ok: true });
  }
  if (body.action !== 'edit') throw new HttpError(400, 'Thao tác không hợp lệ.');
  if (auth.member.role !== 'cadre') throw new HttpError(403, 'Chỉ cán sự được chỉnh sửa thông báo.');
  const res = await env.DB.prepare('UPDATE announcements SET title=?,body=?,pinned=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=?')
    .bind(...fields(body), new Date().toISOString(), id, revision).run();
  conflict(res); return Response.json({ ok: true });
}
export async function onRequestDelete({ request, env }) {
  const auth = await requireCadre(request, env); if (!auth.ok) return auth.response;
  const body = await readJson(request), id = recordId(body.id), revision = positiveInt(body.revision);
  conflict(await env.DB.prepare('DELETE FROM announcements WHERE id=? AND revision=?').bind(id, revision).run());
  return Response.json({ ok: true });
}
