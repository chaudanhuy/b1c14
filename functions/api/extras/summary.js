import { requireAuth } from '../../_lib/auth.js';
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env); if (!auth.ok) return auth.response;
  const [mail, events, notices] = await env.DB.batch([
    env.DB.prepare('SELECT COUNT(*) AS count FROM internal_mail_recipients WHERE member_id=? AND deleted_at IS NULL AND read_at IS NULL').bind(auth.member.id),
    env.DB.prepare("SELECT COUNT(*) AS count FROM countdown_events WHERE (scope='all' OR owner_id=?) AND target_at>?").bind(auth.member.id,new Date().toISOString()),
    env.DB.prepare('SELECT COUNT(*) AS count FROM announcements a LEFT JOIN announcement_reads r ON r.announcement_id=a.id AND r.member_id=? WHERE r.revision IS NULL OR r.revision <> a.revision').bind(auth.member.id),
  ]);
  return Response.json({ unread_mail: mail.results[0].count, upcoming_events: events.results[0].count, unread_notices: notices.results[0].count });
}
