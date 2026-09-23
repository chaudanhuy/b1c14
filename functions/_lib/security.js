import { getSessionSecret } from "./auth.js";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function checkCsrf(request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("Origin");
  const site = request.headers.get("Sec-Fetch-Site");
  if (
    origin !== new URL(request.url).origin ||
    (site && site !== "same-origin" && site !== "none") ||
    request.headers.get("X-Requested-With") !== "B1C14"
  ) {
    throw new HttpError(
      403,
      "Yêu cầu không cùng nguồn. Hãy tải lại trang và thử lại.",
    );
  }
}

// Read a bounded stream before JSON/formData parsing; do not trust Content-Length.
export async function boundedBody(request, maxBytes) {
  if (Number(request.headers.get("Content-Length")) > maxBytes)
    throw new HttpError(413, "Dữ liệu gửi lên vượt dung lượng cho phép.");
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new HttpError(413, "Dữ liệu gửi lên vượt dung lượng cho phép.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  // Blob avoids an extra full-size concatenation while parsing multipart bodies.
  return new Blob(chunks);
}

export async function readJson(request) {
  if (
    !request.headers
      .get("Content-Type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new HttpError(415, "Yêu cầu phải dùng JSON.");
  try {
    const body = await boundedBody(request, 32 * 1024);
    const value = JSON.parse(await new Response(body).text());
    if (!value || Array.isArray(value) || typeof value !== "object")
      throw new Error();
    return value;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Dữ liệu gửi lên không hợp lệ.");
  }
}

export async function rateLimit(env, key, limit, seconds) {
  const now = Math.floor(Date.now() / 1000);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSessionSecret(env)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(
    await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(key)),
  );
  const bucket = Array.from(digest, (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  const row = await env.DB.prepare(
    `
    INSERT INTO rate_limits (bucket, count, expires_at) VALUES (?, 1, ?)
    ON CONFLICT(bucket) DO UPDATE SET
      count = CASE WHEN expires_at <= ? THEN 1 ELSE count + 1 END,
      expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END
    WHERE expires_at <= ? OR count < ?
    RETURNING count, expires_at
  `,
  )
    .bind(bucket, now + seconds, now, now, now, limit)
    .first();
  if (!row) {
    const current = await env.DB.prepare(
      "SELECT expires_at FROM rate_limits WHERE bucket = ?",
    )
      .bind(bucket)
      .first();
    return Response.json(
      { error: "Bạn thao tác quá nhanh. Vui lòng đợi một chút rồi thử lại." },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.max(1, (current?.expires_at || now + seconds) - now),
          ),
        },
      },
    );
  }
  return null;
}

export function clientIp(request) {
  // CF-Connecting-IP is supplied by Cloudflare, never use an arbitrary X-Forwarded-For.
  return request.headers.get("CF-Connecting-IP") || "local";
}

export async function cleanupObjects(env, limit = 25) {
  if (!env.UPLOADS) return;
  const rows = await env.DB.prepare(
    "SELECT image_key FROM r2_cleanup WHERE not_before <= unixepoch() ORDER BY not_before LIMIT ?",
  )
    .bind(limit)
    .all();
  const keys = (rows.results || []).map((row) => row.image_key);
  if (keys.length) {
    await env.UPLOADS.delete(keys);
    await env.DB.batch(
      keys.map((key) =>
        env.DB.prepare("DELETE FROM r2_cleanup WHERE image_key = ?").bind(key),
      ),
    );
  }
  await env.DB.prepare(
    "DELETE FROM rate_limits WHERE bucket IN (SELECT bucket FROM rate_limits WHERE expires_at < unixepoch() LIMIT 100)",
  ).run();
}
