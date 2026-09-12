export const UNIT_ORDER = ['cadre', '1', '2', '3'];
export const UNIT_LABELS = {
  cadre: 'Cán bộ trung đội',
  '1': 'Tiểu đội 1',
  '2': 'Tiểu đội 2',
  '3': 'Tiểu đội 3'
};

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

export function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export function extensionForMime(type) {
  if (type === 'image/png') return 'png';
  if (type === 'image/jpeg') return 'jpg';
  if (type === 'image/webp') return 'webp';
  return 'bin';
}

export function getUnitLabel(unitCode) {
  return UNIT_LABELS[unitCode] || 'Khác';
}

export function isCadreCode(unitCode) {
  return unitCode === 'cadre';
}

export const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_UPLOAD_FILES = 10;
export const MAX_UPLOAD_TOTAL_BYTES = 50 * 1024 * 1024;
export const MAX_IMAGES_PER_SUBMISSION = 50;
