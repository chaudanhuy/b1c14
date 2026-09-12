const encoder = new TextEncoder();

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function stringToBase64Url(value) {
  return bytesToBase64Url(encoder.encode(value));
}

async function importKey(secret, usage) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usage
  );
}

async function signValue(value, secret) {
  const key = await importKey(secret, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

async function verifySignature(value, signature, secret) {
  try {
    const key = await importKey(secret, ['verify']);
    const normalized = signature.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return crypto.subtle.verify('HMAC', key, bytes, encoder.encode(value));
  } catch {
    return false;
  }
}

function parseCookies(request) {
  const header = request.headers.get('Cookie') || '';
  return Object.fromEntries(
    header.split(';').map(part => part.trim()).filter(Boolean).map(part => {
      const index = part.indexOf('=');
      if (index === -1) return [part, ''];
      return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
    })
  );
}

export async function createAdminSession(secret, hours = 12) {
  const payload = {
    role: 'admin',
    exp: Math.floor(Date.now() / 1000) + (hours * 60 * 60)
  };
  const body = stringToBase64Url(JSON.stringify(payload));
  const signature = await signValue(body, secret);
  return `${body}.${signature}`;
}

export async function isAdminRequest(request, secret) {
  if (!secret) return false;
  const token = parseCookies(request).admin_session;
  if (!token) return false;
  const [body, signature] = token.split('.');
  if (!body || !signature) return false;
  if (!(await verifySignature(body, signature, secret))) return false;

  try {
    const normalized = body.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
    const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), char => char.charCodeAt(0))));
    return payload.role === 'admin' && Number(payload.exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function sessionCookie(token, request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `admin_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${secure}`;
}

export function clearSessionCookie(request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `admin_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export function unauthorized() {
  return Response.json({ error: 'Bạn chưa đăng nhập khu vực cán bộ.' }, { status: 401 });
}
