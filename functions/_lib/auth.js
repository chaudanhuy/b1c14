const encoder = new TextEncoder();
const decoder = new TextDecoder();
const COOKIE_NAME = 'th_session';

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function importHmacKey(secret, usage) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usage
  );
}

async function signValue(value, secret) {
  const key = await importHmacKey(secret, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

async function verifyValue(value, signature, secret) {
  try {
    const key = await importHmacKey(secret, ['verify']);
    const signatureBytes = base64UrlToBytes(signature);
    return await crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(value));
  } catch {
    return false;
  }
}

function parseCookies(request) {
  const header = request.headers.get('Cookie') || '';
  return Object.fromEntries(
    header
      .split(';')
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const index = part.indexOf('=');
        if (index === -1) return [part, ''];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

export function getSessionSecret(env) {
  return env.SESSION_SECRET || env.ADMIN_SECRET || '';
}

export async function createSession(member, env, hours = 24 * 14) {
  const secret = getSessionSecret(env);
  if (!secret) throw new Error('Thiếu SESSION_SECRET hoặc ADMIN_SECRET trên Cloudflare.');
  const payload = {
    member_id: Number(member.id),
    unit_code: member.unit_code,
    role: Number(member.can_manage) === 1 ? 'cadre' : 'member',
    exp: Math.floor(Date.now() / 1000) + (hours * 60 * 60)
  };
  const body = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await signValue(body, secret);
  return `${body}.${signature}`;
}

export function sessionCookie(token, request, maxAge = 60 * 60 * 24 * 14) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

export function clearSessionCookie(request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export async function getSessionPayload(request, env) {
  const token = parseCookies(request)[COOKIE_NAME];
  const secret = getSessionSecret(env);
  if (!token || !secret) return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  if (!(await verifyValue(body, signature, secret))) return null;

  try {
    const payload = JSON.parse(decoder.decode(base64UrlToBytes(body)));
    if (!payload?.member_id || Number(payload.exp) <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getAuthenticatedMember(request, env) {
  const payload = await getSessionPayload(request, env);
  if (!payload) return null;
  const member = await env.DB.prepare(`
    SELECT
      id,
      unit_code,
      unit_label,
      name,
      name_key,
      is_default_password,
      can_manage,
      updated_at
    FROM members
    WHERE id = ?
    LIMIT 1
  `).bind(payload.member_id).first();
  if (!member) return null;
  return {
    ...member,
    role: Number(member.can_manage) === 1 ? 'cadre' : 'member'
  };
}

export async function requireAuth(request, env) {
  const member = await getAuthenticatedMember(request, env);
  if (!member) {
    return { ok: false, response: Response.json({ error: 'Bạn chưa xác thực tài khoản.' }, { status: 401 }) };
  }
  return { ok: true, member };
}

export async function requireCadre(request, env) {
  const result = await requireAuth(request, env);
  if (!result.ok) return result;
  if (result.member.role !== 'cadre') {
    return { ok: false, response: Response.json({ error: 'Chức năng này chỉ dành cho cán bộ trung đội.' }, { status: 403 }) };
  }
  return result;
}

export async function hashPassword(password, salt) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`${salt}|${password}`));
  return bytesToBase64Url(new Uint8Array(digest));
}

export async function verifyPassword(password, salt, expectedHash) {
  const hashed = await hashPassword(password, salt);
  return hashed === expectedHash;
}

export function generateSalt(length = 16) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return bytesToBase64Url(bytes);
}
