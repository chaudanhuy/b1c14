import { HttpError } from './security.js';
export function textField(value, label, max, optional = false) {
  if (optional && value == null) return '';
  if (typeof value !== 'string' || value.length > max || (!optional && !value.trim()))
    throw new HttpError(400, label + ' cần tối đa ' + max + ' ký tự và không được bỏ trống.');
  return value.trim();
}
export function recordId(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value))
    throw new HttpError(400, 'Mã dữ liệu không hợp lệ.');
  return value;
}
export function positiveInt(value) {
  if (!Number.isSafeInteger(value) || value < 1) throw new HttpError(400, 'Dữ liệu số không hợp lệ.');
  return value;
}
export function pageOffset(url) {
  const page = Number(url.searchParams.get('page') || 0);
  if (!Number.isSafeInteger(page) || page < 0 || page > 100000) throw new HttpError(400, 'Trang không hợp lệ.');
  return page * 20;
}
export function resultPage(rows) { return { items: rows.slice(0, 20), has_more: rows.length > 20 }; }
export function conflict(result) {
  if (!result.meta.changes) throw new HttpError(409, 'Nội dung đã thay đổi hoặc không còn quyền truy cập. Hãy tải lại.');
}
export function eventFields(body, member) {
  const title = textField(body.title, 'Tên sự kiện', 160);
  const description = textField(body.description, 'Ghi chú', 2000, true);
  if (!['private', 'all'].includes(body.scope)) throw new HttpError(400, 'Chọn phạm vi sự kiện.');
  if (body.scope === 'all' && member.role !== 'cadre') throw new HttpError(403, 'Chỉ cán sự được tạo sự kiện chung.');
  if (typeof body.target_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(body.target_at))
    throw new HttpError(400, 'Thời gian cần có ngày, giờ và múi giờ.');
  const [year, month, day] = body.target_at.slice(0,10).split('-').map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day)
    throw new HttpError(400, 'Ngày sự kiện không tồn tại.');
  const target = new Date(body.target_at);
  if (!Number.isFinite(+target) || target.getUTCFullYear() < 2024 || target.getUTCFullYear() > 2100)
    throw new HttpError(400, 'Ngày sự kiện cần nằm trong khoảng 2024–2100.');
  return { title, description, scope: body.scope, target_at: target.toISOString() };
}
