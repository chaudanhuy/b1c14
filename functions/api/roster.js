import { UNIT_ORDER, UNIT_LABELS } from '../_lib/utils.js';

export async function onRequestGet({ env }) {
  const rows = await env.DB.prepare(`
    SELECT id, unit_code, unit_label, name, display_order
    FROM members
    ORDER BY
      CASE unit_code
        WHEN 'cadre' THEN 0
        WHEN '1' THEN 1
        WHEN '2' THEN 2
        WHEN '3' THEN 3
        ELSE 9
      END,
      display_order ASC,
      name COLLATE NOCASE ASC
  `).all();

  const groups = UNIT_ORDER.map(code => ({
    code,
    label: UNIT_LABELS[code],
    members: []
  }));
  const map = Object.fromEntries(groups.map(group => [group.code, group]));
  for (const row of rows.results || []) {
    if (!map[row.unit_code]) continue;
    map[row.unit_code].members.push({
      id: row.id,
      name: row.name,
      unit_code: row.unit_code,
      unit_label: row.unit_label
    });
  }

  return Response.json({ groups });
}
