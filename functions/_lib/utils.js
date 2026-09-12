export function normalizeText(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export const normalizeName = normalizeText;

export function cleanName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export function cleanTaskTitle(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export function extensionForMime(type) {
  if (type === 'image/png') return 'png';
  if (type === 'image/jpeg') return 'jpg';
  if (type === 'image/webp') return 'webp';
  return 'bin';
}

export const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_UPLOAD_FILES = 10;
export const MAX_UPLOAD_TOTAL_BYTES = 50 * 1024 * 1024;
export const MAX_IMAGES_PER_SUBMISSION = 50;
