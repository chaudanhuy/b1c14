import { requireAuth } from '../../_lib/auth.js';
import { HttpError, readJson, rateLimit } from '../../_lib/security.js';
import { textField, recordId, positiveInt, pageOffset, resultPage } from '../../_lib/extras.js';

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env); if (!auth.ok) return auth.response;
  const me = auth.member.id, url = new URL(request.url);
  if (url.searchParams.get('recipients') === '1') {
    const rows = await env.DB.prepare('SELECT id, name, unit_label FROM members WHERE id <> ? ORDER BY unit_code, display_order, name').bind(me).all();
    return Response.json({ members: rows.results || [] });
  }
  if (url.searchParams.has('id')) {
    const id = recordId(url.searchParams.get('id'));
    const row = await env.DB.prepare(`SELECT m.*, s.name AS sender_name, s.unit_label AS sender_unit, r.read_at,
      CASE WHEN m.sender_id = ? THEN 1 ELSE 0 END AS is_sender
      FROM internal_mail m JOIN members s ON s.id = m.sender_id
      LEFT JOIN internal_mail_recipients r ON r.mail_id = m.id AND r.member_id = ?
      WHERE m.id = ? AND ((m.sender_id = ? AND m.sent_deleted_at IS NULL) OR (r.member_id = ? AND r.deleted_at IS NULL))`)
      .bind(me, me, id, me, me).first();
    if (!row) throw new HttpError(404, 'Không tìm thấy thư.');
    const recipients = await env.DB.prepare(`SELECT u.id, u.name, u.unit_label, r.read_at FROM internal_mail_recipients r
      JOIN members u ON u.id = r.member_id WHERE r.mail_id = ? AND (? = 1 OR r.member_id = ?)`)
      .bind(id, row.is_sender, me).all();
    return Response.json({ mail: row, recipients: recipients.results || [] });
  }
  const box = url.searchParams.get('box') || 'inbox';
  if (!['inbox', 'sent'].includes(box)) throw new HttpError(400, 'Hộp thư không hợp lệ.');
  const rows = box === 'sent'
    ? await env.DB.prepare(`SELECT m.id, m.subject, m.created_at, m.audience, u.name AS sender_name,
      (SELECT COUNT(*) FROM internal_mail_recipients r WHERE r.mail_id = m.id) AS recipient_count,
      (SELECT COUNT(*) FROM internal_mail_recipients r WHERE r.mail_id = m.id AND r.read_at IS NOT NULL) AS read_count,
      (SELECT u2.name FROM internal_mail_recipients r JOIN members u2 ON u2.id=r.member_id WHERE r.mail_id=m.id LIMIT 1) AS recipient_name
      FROM internal_mail m JOIN members u ON u.id = m.sender_id
      WHERE m.sender_id = ? AND m.sent_deleted_at IS NULL ORDER BY m.created_at DESC, m.id DESC LIMIT 21 OFFSET ?`)
      .bind(me, pageOffset(url)).all()
    : await env.DB.prepare(`SELECT m.id, m.subject, m.created_at, m.audience, u.name AS sender_name, u.unit_label AS sender_unit, r.read_at
      FROM internal_mail_recipients r JOIN internal_mail m ON m.id = r.mail_id JOIN members u ON u.id = m.sender_id
      WHERE r.member_id = ? AND r.deleted_at IS NULL ORDER BY m.created_at DESC, m.id DESC LIMIT 21 OFFSET ?`)
      .bind(me, pageOffset(url)).all();
  return Response.json(resultPage(rows.results || []));
}
export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env); if (!auth.ok) return auth.response;
  const limited = await rateLimit(env, 'mail-send:' + auth.member.id, 20, 3600); if (limited) return limited;
  const body = await readJson(request);
  const id = recordId(body.id), subject = textField(body.subject, 'Tiêu đề', 160), content = textField(body.body, 'Nội dung', 8000);
  if (!['person', 'all'].includes(body.audience)) throw new HttpError(400, 'Chọn người nhận hoặc toàn bộ.');
  let recipient = null;
  if (body.audience === 'person') {
    recipient = positiveInt(body.recipient_id);
    if (recipient === auth.member.id) throw new HttpError(400, 'Hãy chọn một thành viên khác.');
    if (!(await env.DB.prepare('SELECT id FROM members WHERE id = ?').bind(recipient).first()))
      throw new HttpError(400, 'Người nhận không còn tồn tại.');
  }
  const existing = await env.DB.prepare('SELECT sender_id, subject, body, audience FROM internal_mail WHERE id = ?').bind(id).first();
  if (existing) {
    const target = recipient == null || await env.DB.prepare('SELECT member_id FROM internal_mail_recipients WHERE mail_id = ? AND member_id = ?').bind(id, recipient).first();
    if (existing.sender_id !== auth.member.id || existing.subject !== subject || existing.body !== content || existing.audience !== body.audience || !target)
      throw new HttpError(409, 'Yêu cầu gửi đã thay đổi. Hãy quay lại để soạn thư mới.');
    return Response.json({ ok: true, id, message: 'Thư này đã được gửi thành công trước đó.' });
  }
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO internal_mail(id,sender_id,audience,subject,body,created_at) VALUES(?,?,?,?,?,?)').bind(id, auth.member.id, body.audience, subject, content, now),
    env.DB.prepare('INSERT INTO internal_mail_recipients(mail_id, member_id) SELECT ?, id FROM members WHERE id <> ? ' + (recipient == null ? '' : 'AND id = ?'))
      .bind(...(recipient == null ? [id, auth.member.id] : [id, auth.member.id, recipient])),
  ]);
  return Response.json({ ok: true, id, message: 'Đã gửi thư.' });
}
export async function onRequestPatch({ request, env }) {
  const auth = await requireAuth(request, env); if (!auth.ok) return auth.response;
  const body = await readJson(request), id = recordId(body.id);
  if (body.action !== 'read') throw new HttpError(400, 'Thao tác không hợp lệ.');
  const res = await env.DB.prepare('UPDATE internal_mail_recipients SET read_at = COALESCE(read_at, ?) WHERE mail_id = ? AND member_id = ? AND deleted_at IS NULL')
    .bind(new Date().toISOString(), id, auth.member.id).run();
  if (!res.meta.changes) throw new HttpError(404, 'Không tìm thấy thư.');
  return Response.json({ ok: true });
}
export async function onRequestDelete({ request, env }) {
  const auth = await requireAuth(request, env); if (!auth.ok) return auth.response;
  const body = await readJson(request), id = recordId(body.id);
  if (!['inbox','sent'].includes(body.box)) throw new HttpError(400, 'Hộp thư không hợp lệ.');
  const res = body.box === 'sent'
    ? await env.DB.prepare('UPDATE internal_mail SET sent_deleted_at = ? WHERE id = ? AND sender_id = ? AND sent_deleted_at IS NULL').bind(new Date().toISOString(), id, auth.member.id).run()
    : await env.DB.prepare('UPDATE internal_mail_recipients SET deleted_at = ? WHERE mail_id = ? AND member_id = ? AND deleted_at IS NULL').bind(new Date().toISOString(), id, auth.member.id).run();
  if (!res.meta.changes) throw new HttpError(404, 'Không tìm thấy thư.');
  return Response.json({ ok: true, message: 'Đã xóa thư khỏi hộp thư của bạn.' });
}
