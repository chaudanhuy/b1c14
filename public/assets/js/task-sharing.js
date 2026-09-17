import { escapeHTML as h, modal, toast } from "./ui.js";

const views = new Set(["dashboard", "tasks", "submit", "files", "manager", "shared", "account", "journey", "more"]);
const entryPaths = new Set(["/", "/index", "/index.html", "/admin", "/admin.html"]);
export const REDIRECT_KEY = "b1-redirect-to";
export function taskId(value) {
  return /^[1-9]\d*$/.test(String(value)) && Number.isSafeInteger(Number(value))
    ? Number(value) : null;
}
export function readRoute(value, origin = location.origin, depth = 0) {
  let url;
  try { url = new URL(value, origin); } catch { return null; }
  if (url.origin !== origin || !entryPaths.has(url.pathname) || url.username || url.password) return null;
  const hashId = /^#task-(.+)$/.exec(url.hash)?.[1];
  if (url.searchParams.has("task_id") || hashId) {
    const id = taskId(url.searchParams.get("task_id") ?? hashId);
    return id ? { view: "shared", taskId: id } : { invalid: true };
  }
  if (!depth && url.searchParams.has("redirect_to"))
    return readRoute(url.searchParams.get("redirect_to"), origin, 1);
  const view = url.hash.slice(1);
  return views.has(view) ? { view } : null;
}
export function sharePath(id) {
  if (!taskId(id)) throw new Error("Hãy chọn một nhiệm vụ hợp lệ.");
  return "/?task_id=" + Number(id) + "#shared";
}
export function rememberRoute(route) {
  if (!route?.taskId) return;
  try { sessionStorage.setItem(REDIRECT_KEY, sharePath(route.taskId)); } catch {}
}
export function savedRoute() {
  try { return readRoute(sessionStorage.getItem(REDIRECT_KEY) || ""); } catch { return null; }
}
export function forgetRoute() {
  try { sessionStorage.removeItem(REDIRECT_KEY); } catch {}
}
export async function copyTaskLink(id) {
  const url = new URL(sharePath(id), location.origin).href;
  try {
    await navigator.clipboard.writeText(url);
    toast("Đã sao chép liên kết vào bộ nhớ tạm");
  } catch {
    // Clipboard may be unavailable or denied; show the exact link without claiming success.
    void modal({
      title: "Sao chép liên kết nhiệm vụ",
      description: "Trình duyệt chưa cho phép sao chép tự động. Chọn liên kết và nhấn Ctrl + C.",
      fields: '<label class="field"><span>Liên kết</span><input id="taskLinkFallback" readonly value="' + h(url) + '"></label>',
      submit: "Đóng",
    });
    const input = document.getElementById("taskLinkFallback");
    input?.focus(); input?.select();
  }
}
export function chartData(stats = {}) {
  const parts = [
    ["approved", "Đã nộp", "--green"],
    ["pending", "Chờ duyệt", "--amber"],
    ["rejected", "Cần chỉnh sửa", "--red"],
    ["not_submitted", "Chưa nộp", "--muted"],
  ].map(([key, label, color]) => ({
    key, label, color, count: Number.isSafeInteger(stats[key]) && stats[key] > 0 ? stats[key] : 0,
  }));
  const total = parts.reduce((n, p) => n + p.count, 0);
  return { parts, total, submitted: total - parts[3].count };
}
export function renderTaskChart(node, stats) {
  const { parts, total, submitted } = chartData(stats);
  const percent = total ? Math.round(submitted / total * 100) : 0;
  let angle = 0;
  const stops = parts.filter(p => p.count).map(p => {
    const start = angle;
    angle += p.count / total * 360;
    return "var(" + p.color + ") " + start + "deg " + angle + "deg";
  });
  node.innerHTML = '<figure class="task-chart" aria-label="Thống kê minh chứng theo thành viên">' +
    '<div class="completion-ring task-donut" role="img" aria-label="' + h(submitted + "/" + total + " thành viên đã nộp") +
    '"><span><b>' + percent + '%</b><small>đã nộp minh chứng</small></span></div>' +
    '<figcaption><h3>' + submitted + "/" + total + ' thành viên đã nộp</h3><ul class="task-chart-legend">' +
    parts.map(p => '<li><span class="task-chart-dot" style="background:var(' + p.color + ')"></span><span>' + p.label +
      '</span><strong>' + p.count + '</strong><small class="muted">' +
      (total ? (p.count / total * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) : "0") + '%</small></li>').join("") +
    '</ul><p class="muted"><small>Mỗi thành viên được tính một lần. Có tệp là hoàn thành; Chờ duyệt/Cần chỉnh sửa là trạng thái lưu trong dữ liệu, không chặn nộp bài.</small></p>' +
    (!total ? '<p class="muted">Chưa có thành viên để thống kê.</p>' : '') + '</figcaption></figure>';
  node.querySelector(".task-donut").style.background = stops.length
    ? "conic-gradient(" + stops.join(",") + ")" : "var(--line)";
}
