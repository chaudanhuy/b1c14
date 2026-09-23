import { requireCadre } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const auth = await requireCadre(request, env);
  if (!auth.ok) return auth.response;

  const submissionId = Number(
    new URL(request.url).searchParams.get("submission_id"),
  );
  if (!Number.isInteger(submissionId) || submissionId < 1) {
    return Response.json({ error: "Bản nộp không hợp lệ." }, { status: 400 });
  }

  const result = await env.DB.prepare(
    `
    SELECT id, submission_id, image_name, image_type, image_size, created_at
    FROM submission_images
    WHERE submission_id = ?
    ORDER BY created_at ASC, id ASC
  `,
  )
    .bind(submissionId)
    .all();

  return Response.json(
    { images: result.results || [] },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
