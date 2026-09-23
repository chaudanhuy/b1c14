import {
  checkCsrf,
  cleanupObjects,
  clientIp,
  HttpError,
  rateLimit,
} from "../_lib/security.js";

export async function onRequest(context) {
  const { request, env } = context;
  let response;
  try {
    checkCsrf(request);
    if (!env.DB || !(env.SESSION_SECRET || env.ADMIN_SECRET))
      throw new HttpError(503, "Máy chủ chưa cấu hình DB hoặc SESSION_SECRET.");
    const path = new URL(request.url).pathname;
    if (!["GET", "HEAD"].includes(request.method)) {
      const login = path === "/api/auth/login";
      const limited = await rateLimit(
        env,
        `${login ? "login" : "write"}:ip:${clientIp(request)}`,
        login ? 30 : 120,
        login ? 900 : 60,
      );
      if (limited) response = limited;
    }
    response ||= await context.next();
    if (context.waitUntil && request.method !== "GET") {
      context.waitUntil(
        cleanupObjects(env).catch(() =>
          console.error("R2 cleanup pending; retry on next mutation."),
        ),
      );
    }
  } catch (error) {
    if (!(error instanceof HttpError))
      console.error("API error", error?.message);
    response = Response.json(
      {
        error:
          error instanceof HttpError
            ? error.message
            : "Máy chủ chưa xử lý được yêu cầu. Vui lòng thử lại.",
      },
      { status: error instanceof HttpError ? error.status : 500 },
    );
  }
  // Keep the upgraded socket: cloning it as an ordinary response drops WebSocket state.
  if (response.status === 101 && response.webSocket) return response;
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "same-origin");
  headers.set("X-Frame-Options", "SAMEORIGIN");
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", "no-store");
  if (new URL(request.url).protocol === "https:")
    headers.set("Strict-Transport-Security", "max-age=31536000");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
