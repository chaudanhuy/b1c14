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

export function getFileExtension(filename = '') {
  const match = String(filename)
    .toLowerCase()
    .match(/\.([a-z0-9]+)$/);

  return match ? match[1] : '';
}

export function extensionForMime(type) {
  const map = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',

    'application/pdf': 'pdf',

    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',

    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',

    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx'
  };

  return map[type] || 'bin';
}

export function getUnitLabel(unitCode) {
  return UNIT_LABELS[unitCode] || 'Khác';
}

export function isCadreCode(unitCode) {
  return unitCode === 'cadre';
}

export const ALLOWED_FILE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',

  'application/pdf',

  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
]);

export const ALLOWED_FILE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'webp',
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx'
]);

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_UPLOAD_FILES = 10;
export const MAX_UPLOAD_TOTAL_BYTES = 100 * 1024 * 1024;
export const MAX_FILES_PER_SUBMISSION = 50;