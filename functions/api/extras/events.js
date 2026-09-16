import { requireAuth } from '../../_lib/auth.js';
import { HttpError, readJson, rateLimit } from '../../_lib/security.js';
import { recordId, positiveInt, pageOffset, resultPage, eventFields, conflict } from '../../_lib/extras.js';
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env); if (!auth.ok) return auth.response;
  const url = new URL(request.url), past = url.searchParams.get('period') === 'past';
  const rows = await env.DB.prepare("SELECT e.*, m.name AS owner_name FROM countdown_events e JOIN members m ON m.id = e.owner_id WHERE (e.scope = 'all' OR e.owner_id = ?) AND e.target_at " + (past ? '<=' : '>') + " ? ORDER BY e.target_at " + (past ? 'DESC' : 'ASC') + ", e.id LIMIT 21 OFFSET ?")
    .bind(auth.member.id, new Date().toISOString(), pageOffset(url)).all();
  return Response.json(resultPage((rows.results || []).map(e => ({ ...e, can_edit: e.owner_id === auth.member.id || (e.scope === 'all' && auth.member.role === 'cadre') }))));
}
export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env); if (!auth.ok) return auth.response;
  const limited = await rateLimit(env, 'events:' + auth.member.id, 30, 3600); if (limited) return limited;
  const body = await readJson(request), fields = eventFields(body, auth.member), id = crypto.randomUUID(), now = new Date().toISOString();
  await env.DB.prepare('INSERT INTO countdown_events(id,owner_id,scope,title,description,target_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)')
    .bind(id, auth.member.id, fields.scope, fields.title, fields.description, fields.target_at, now, now).run();
  return Response.json({ ok: true, id });
}
async function editable(env, id, member) {
  const event = await env.DB.prepare("SELECT * FROM countdown_events WHERE id = ? AND (owner_id = ? OR (scope = 'all' AND ? = 1))")
    .bind(id, member.id, member.role === 'cadre' ? 1 : 0).first();
  if (!event) throw new HttpError(404, 'Không tìm thấy sự kiện có thể chỉnh sửa.');
  return event;
}
export async function onRequestPatch({ request, env }) {
  const auth = await requireAuth(request, env); if (!auth.ok) return auth.response;
  const body = await readJson(request), id = recordId(body.id), revision = positiveInt(body.revision);
  const current = await editable(env, id, auth.member), fields = eventFields(body, auth.member);
  if (current.owner_id !== auth.member.id && fields.scope !== current.scope) throw new HttpError(403, 'Chỉ người tạo được đổi phạm vi.');
  const res = await env.DB.prepare("UPDATE countdown_events SET title=?,description=?,scope=?,target_at=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=? AND (owner_id=? OR (scope='all' AND ?=1))")
    .bind(fields.title, fields.description, fields.scope, fields.target_at, new Date().toISOString(), id, revision, auth.member.id, auth.member.role === 'cadre' ? 1 : 0).run();
  conflict(res); return Response.json({ ok: true });
}
export async function onRequestDelete({ request, env }) {
  const auth = await requireAuth(request, env); if (!auth.ok) return auth.response;
  const body = await readJson(request), id = recordId(body.id), revision = positiveInt(body.revision);
  await editable(env, id, auth.member);
  const res = await env.DB.prepare("DELETE FROM countdown_events WHERE id=? AND revision=? AND (owner_id=? OR (scope='all' AND ?=1))")
    .bind(id, revision, auth.member.id, auth.member.role === 'cadre' ? 1 : 0).run();
  conflict(res); return Response.json({ ok: true });
}
