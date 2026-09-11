export async function onRequestGet({ env }) {
  if (!env.DB) return Response.json({ error: 'Database chưa được cấu hình.' }, { status: 500 });

  try {
    const result = await env.DB.prepare(`
      SELECT squad, COUNT(*) AS count
      FROM submissions
      GROUP BY squad
      ORDER BY squad ASC
    `).all();

    const squads = { '1': 0, '2': 0, '3': 0 };
    for (const row of result.results || []) squads[String(row.squad)] = Number(row.count) || 0;
    const total = squads['1'] + squads['2'] + squads['3'];

    return Response.json({ total, squads }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    console.error('Stats error', error);
    return Response.json({ error: 'Không thể tải thống kê.' }, { status: 500 });
  }
}
