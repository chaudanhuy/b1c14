import { requireAuth } from "../_lib/auth.js";
import { getFileExtension, extensionForMime } from "../_lib/utils.js";
import { disposition, MIME_BY_EXTENSION, safeFilename } from "../_lib/files.js";
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url),
    id = Number(url.searchParams.get("id"));
  if (!Number.isSafeInteger(id) || id < 1)
    return new Response("Bad Request", { status: 400 });
  const row = await env.DB.prepare(
    `SELECT si.*,ts.member_id FROM submission_images si JOIN task_submissions ts ON ts.id = si.submission_id WHERE si.id = ?`,
  )
    .bind(id)
    .first();
  if (!row) return new Response("Not Found", { status: 404 });
  if (auth.member.role !== "cadre" && row.member_id !== auth.member.id)
    return new Response("Forbidden", { status: 403 });
  const meta = await env.UPLOADS.head(row.image_key);
  if (!meta) return new Response("Not Found", { status: 404 });
  const ext =
      getFileExtension(row.image_name) || extensionForMime(row.image_type),
    type = MIME_BY_EXTENSION[ext] || "application/octet-stream";
  const name = safeFilename(row.image_name, `tai-lieu-${id}.${ext || "bin"}`);
  const filename =
    getFileExtension(name) || ext === "bin" ? name : `${name}.${ext}`;
  const inline =
    url.searchParams.get("download") !== "1" &&
    ["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(type);
  const headers = new Headers({
    "Content-Type": type,
    "Content-Disposition": disposition(filename, inline),
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": inline ? "private, no-cache" : "private, no-store",
    Vary: "Cookie",
    ETag: meta.httpEtag,
    "Accept-Ranges": "bytes",
    "Content-Security-Policy":
      type === "application/pdf"
        ? "frame-ancestors 'self'"
        : "default-src 'none'; frame-ancestors 'self'",
  });
  // Always authorize before conditional responses; private files must not survive account switching.
  if (inline && request.headers.get("If-None-Match") === meta.httpEtag)
    return new Response(null, { status: 304, headers });
  let range;
  const requested = request.headers.get("Range"),
    ifRange = request.headers.get("If-Range");
  if (requested && (!ifRange || ifRange === meta.httpEtag)) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(requested);
    if (!match || (!match[1] && !match[2]))
      return new Response(null, {
        status: 416,
        headers: {
          ...Object.fromEntries(headers),
          "Content-Range": `bytes */${meta.size}`,
        },
      });
    const start = match[1]
      ? Number(match[1])
      : Math.max(0, meta.size - Number(match[2]));
    const end =
      match[1] && match[2]
        ? Math.min(Number(match[2]), meta.size - 1)
        : meta.size - 1;
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start > end ||
      start >= meta.size
    )
      return new Response(null, {
        status: 416,
        headers: {
          ...Object.fromEntries(headers),
          "Content-Range": `bytes */${meta.size}`,
        },
      });
    range = { offset: start, length: end - start + 1 };
    headers.set("Content-Range", `bytes ${start}-${end}/${meta.size}`);
  }
  const object = await env.UPLOADS.get(
    row.image_key,
    range ? { range } : undefined,
  );
  if (!object) return new Response("Not Found", { status: 404 });
  headers.set("Content-Length", String(range ? range.length : object.size));
  return new Response(object.body, { status: range ? 206 : 200, headers });
}
