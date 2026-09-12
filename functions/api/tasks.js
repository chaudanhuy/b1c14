export async function onRequestGet({ env }) {
  if (!env.DB) return Response.json({ error: 'Database chưa được cấu hình.' }, { status: 500 });

  try {
    const result = await env.DB.prepare(`
      SELECT id, title, created_at
      FROM tasks
      WHERE is_active = 1
      ORDER BY created_at DESC, id DESC
    `).all();

    return Response.json({ tasks: result.results || [] }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    console.error('Tasks error', error);
    return Response.json({ error: 'Không thể tải danh sách task.' }, { status: 500 });
  }
}
