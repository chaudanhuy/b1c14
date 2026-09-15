import { requireAuth } from "../_lib/auth.js";
import { taskRoster, summarize } from "../_lib/submissions.js";
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;
  const id = Number(new URL(request.url).searchParams.get("task_id"));
  if (!Number.isSafeInteger(id) || id < 1)
    return Response.json({ total: 0, counts: {} });
  const stats = summarize(await taskRoster(env, id));
  return Response.json({
    total: stats.submitted,
    counts: Object.fromEntries(
      Object.entries(stats.units).map(([code, s]) => [code, s.submitted]),
    ),
    stats,
  });
}
