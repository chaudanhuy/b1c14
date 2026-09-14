import { requireAuth } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;

  const taskId = Number(new URL(request.url).searchParams.get('task_id'));
  if (!Number.isInteger(taskId) || taskId < 1) {
    return Response.json({ submission: null, images: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const submission = await env.DB.prepare(`
    SELECT id, task_id, member_id, unit_code, unit_label, name, created_at, updated_at
    FROM task_submissions
    WHERE task_id = ? AND member_id = ?
    LIMIT 1
  `).bind(taskId, auth.member.id).first();

  if (!submission) {
    return Response.json({ submission: null, images: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const images = await env.DB.prepare(`
    SELECT id, submission_id, image_name, image_type, image_size, created_at
    FROM submission_images
    WHERE submission_id = ?
    ORDER BY created_at DESC, id DESC
  `).bind(submission.id).all();

  return Response.json({ submission, images: images.results || [] }, {
    headers: { 'Cache-Control': 'no-store' }
  });
}
