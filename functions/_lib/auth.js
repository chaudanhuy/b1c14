const encoder = new TextEncoder();
const decoder = new TextDecoder();
const COOKIE_NAME = "th_session";

export function hasManagementAccess(member) {
  return Number(member?.can_manage) === 1;
}

// Fixed account identity from the existing roster; never trust a name sent by the browser.
export function hasPasswordResetAccess(member) {
  return member?.name_key === "chau dan huy" && member?.unit_code === "1"
    && hasManagementAccess(member) && !member.must_change_password;
}

export function publicMember(member) {
  return {
    id: member.id,
    unit_code: member.unit_code,
    unit_label: member.unit_label,
    name: member.name,
    avatar_url: member.avatar_url || null,
    role: hasManagementAccess(member) ? "cadre" : "member",
    is_default_password: !!member.is_default_password,
    must_change_password: !!member.must_change_password,
    can_reset_password: hasPasswordResetAccess(member),
  };
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function importHmacKey(secret, usage) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usage,
  );
}

async function signValue(value, secret) {
  const key = await importHmacKey(secret, ["sign"]);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

async function verifyValue(value, signature, secret) {
  try {
    const key = await importHmacKey(secret, ["verify"]);
    const signatureBytes = base64UrlToBytes(signature);
    return await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      encoder.encode(value),
    );
  } catch {
    return false;
  }
}

function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        try {
          return [
            part.slice(0, index),
            decodeURIComponent(part.slice(index + 1)),
          ];
        } catch {
          return [part.slice(0, index), ""];
        }
      }),
  );
}

export function getSessionSecret(env) {
  return env.SESSION_SECRET || env.ADMIN_SECRET || "";
}

export async function createSession(member, env, hours = 24 * 14) {
  const secret = getSessionSecret(env);
  if (!secret)
    throw new Error("Thiếu SESSION_SECRET hoặc ADMIN_SECRET trên Cloudflare.");
  const payload = {
    member_id: Number(member.id),
    sv: Number(member.session_version || 0),
    v: 5,
    exp: Math.floor(Date.now() / 1000) + hours * 60 * 60,
  };
  const body = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await signValue(body, secret);
  return `${body}.${signature}`;
}

export function sessionCookie(token, request, maxAge = 60 * 60 * 24 * 14) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

export function clearSessionCookie(request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export async function getSessionPayload(request, env) {
  const token = parseCookies(request)[COOKIE_NAME];
  const secret = getSessionSecret(env);
  if (!token || token.length > 2048 || !secret || token.split(".").length !== 2)
    return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  if (!(await verifyValue(body, signature, secret))) return null;

  try {
    const payload = JSON.parse(decoder.decode(base64UrlToBytes(body)));
    if (
      payload?.v !== 5 ||
      !Number.isSafeInteger(payload.member_id) ||
      payload.member_id < 1 ||
      !Number.isSafeInteger(payload.sv) ||
      !Number.isSafeInteger(payload.exp) ||
      payload.exp <= Math.floor(Date.now() / 1000)
    )
      return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getAuthenticatedMember(request, env) {
  const payload = await getSessionPayload(request, env);
  if (!payload) return null;
  const member = await env.DB.prepare(
    `
    SELECT
      id,
      unit_code,
      unit_label,
      name,
      name_key,
      is_default_password,
      must_change_password,
      can_manage,
      session_version,
      avatar_url,
      updated_at
    FROM members
    WHERE id = ?
    LIMIT 1
  `,
  )
    .bind(payload.member_id)
    .first();
  if (!member || member.session_version !== payload.sv) return null;
  return {
    ...member,
    role: hasManagementAccess(member) ? "cadre" : "member",
  };
}

export async function requireAuth(request, env) {
  const member = await getAuthenticatedMember(request, env);
  if (!member) {
    return {
      ok: false,
      response: Response.json(
        {
          error: "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.",
          code: "AUTH_REQUIRED",
        },
        { status: 401 },
      ),
    };
  }
  const path = new URL(request.url).pathname.replace(/\/+$/, "");
  if (member.must_change_password && ![
    "/api/auth/change-password", "/api/auth/logout",
  ].includes(path)) {
    return {
      ok: false,
      response: Response.json({
        error: "Bạn cần đổi mật khẩu tạm trước khi sử dụng các chức năng khác.",
        code: "PASSWORD_CHANGE_REQUIRED",
      }, { status: 403 }),
    };
  }
  return { ok: true, member };
}

export async function requireCadre(request, env) {
  const result = await requireAuth(request, env);
  if (!result.ok) return result;
  if (result.member.role !== "cadre") {
    return {
      ok: false,
      response: Response.json(
        { error: "Chức năng này chỉ dành cho cán bộ trung đội." },
        { status: 403 },
      ),
    };
  }
  return result;
}

const PASSWORD_ITERATIONS = 100000;

export function needsPasswordUpgrade(hash) {
  return !String(hash).startsWith("pbkdf2-sha256$");
}

export async function hashPassword(
  password,
  salt,
  iterations = PASSWORD_ITERATIONS,
) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations },
    key,
    256,
  );
  return `pbkdf2-sha256$${iterations}$${bytesToBase64Url(new Uint8Array(bits))}`;
}

export async function verifyPassword(password, salt, expectedHash) {
  let hashed;
  if (String(expectedHash).startsWith("pbkdf2-sha256$")) {
    const parts = expectedHash.split("$");
    const iterations = Number(parts[1]);
    if (
      parts.length !== 3 ||
      !Number.isInteger(iterations) ||
      iterations < 10000 ||
      iterations > PASSWORD_ITERATIONS
    )
      return false;
    hashed = await hashPassword(password, salt, iterations);
  } else {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(`${salt}|${password}`),
    );
    hashed = bytesToBase64Url(new Uint8Array(digest));
  }
  // Avoid an early-exit string comparison on the derived hash.
  const key = await importHmacKey(salt, ["sign", "verify"]);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(hashed),
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    encoder.encode(String(expectedHash)),
  );
}

export function generateSalt(length = 16) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return bytesToBase64Url(bytes);
}
