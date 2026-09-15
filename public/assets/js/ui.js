export const $ = (s) => document.querySelector(s);
export const $$ = (s) => [...document.querySelectorAll(s)];
export const escapeHTML = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
export const normalize = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
export const initials = (s) =>
  String(s || "")
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((x) => x[0] || "")
    .join("")
    .toUpperCase();
export const formatBytes = (n) =>
  n >= 1048576
    ? `${(n / 1048576).toFixed(1)} MB`
    : n >= 1024
      ? `${Math.round(n / 1024)} KB`
      : `${n || 0} B`;
export function dateValue(s) {
  return s
    ? new Date(/Z$|[+-]\d\d:\d\d$/.test(s) ? s : s.replace(" ", "T") + "Z")
    : null;
}
export function formatDate(s, short = false) {
  const d = dateValue(s);
  return !d || Number.isNaN(+d)
    ? "—"
    : d.toLocaleString(
        "vi-VN",
        short
          ? {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            }
          : {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            },
      );
}
export const STATUS = {
  not_submitted: "Chưa nộp",
  pending: "Chờ duyệt",
  approved: "Đạt",
  rejected: "Cần nộp lại",
};
export const badge = (s) =>
  `<span class="badge ${Object.hasOwn(STATUS, s) ? s : "not_submitted"}">${STATUS[s] || STATUS.not_submitted}</span>`;
const paths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  "check-square":
    '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="m8 12 3 3 5-6"/>',
  upload:
    '<path d="M12 16V3m-5 5 5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  download:
    '<path d="M12 3v13m-5-5 5 5 5-5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  folder:
    '<path d="M3 7V5a2 2 0 0 1 2-2h4l3 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3a4 4 0 0 1 0 8"/><circle cx="9" cy="7" r="4"/>',
  settings:
    '<path d="m10 3-1 3-3-1-2 3 2 2-2 2 2 4 3-1 1 3h4l1-3 3 1 2-4-2-2 2-2-2-3-3 1-1-3Z"/><circle cx="12" cy="10.5" r="2.5"/>',
  logout:
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5M21 12H9"/>',
  panel: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
  moon: '<path d="M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z"/>',
  "arrow-right": '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  shield:
    '<path d="M12 3 3 7v5c0 5 9 10 9 10s9-5 9-10V7l-9-4Z"/><path d="m8 12 3 3 5-6"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  activity: '<path d="M3 13h4l3-8 4 14 3-6h4"/>',
  layers: '<path d="m12 3-9 5 9 5 9-5-9-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/>',
  search: '<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>',
  refresh:
    '<path d="M20 7v5h-5M4 17v-5h5M5.5 7a7.5 7.5 0 0 1 12.4-2L20 8M4 16l2.1 3A7.5 7.5 0 0 0 18.5 17"/>',
  camera:
    '<path d="m8 5 2-2h4l2 2h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4Z"/><circle cx="12" cy="13" r="4"/>',
  cloud:
    '<path d="M6 18a5 5 0 0 1-1-9 7 7 0 0 1 14-1 5 5 0 0 1-1 10M12 21V11m-4 4 4-4 4 4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.2"/>',
  edit: '<path d="m15 4 5 5M4 20l5-1L20 8a3.5 3.5 0 0 0-5-5L4 14v6Z"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  sheet: '<path d="M14 2H5v20h14V7l-5-5Zm0 0v5h5M8 12h8m-8 4h8m-4-6v8"/>',
  file: '<path d="M14 2H5v20h14V7l-5-5Zm0 0v5h5M8 12h8m-8 4h5"/>',
  rotate: '<path d="M3 7h5V2M4 7a9 9 0 1 1-1 10"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
};
export function icon(name) {
  return `<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.file}</svg>`;
}
export function hydrateIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((el) => {
    el.innerHTML = icon(el.dataset.icon);
  });
}
export function empty(title, message, action = "") {
  return `<div class="empty-state">${icon("folder")}<b>${escapeHTML(title)}</b><p>${escapeHTML(message)}</p>${action}</div>`;
}
export function skeleton(node, count = 3, kind = "line") {
  node.setAttribute("aria-busy", "true");
  node.innerHTML = `<span class="sr-only">Đang tải…</span>${Array.from({ length: count }, () => `<div class="skeleton ${kind}" aria-hidden="true"></div>`).join("")}`;
}
export function loaded(node, html) {
  node.removeAttribute("aria-busy");
  node.innerHTML = html;
}
export function toast(message, type = "success") {
  const node = document.createElement("div");
  node.className = `toast ${type}`;
  node.setAttribute("role", type === "error" ? "alert" : "status");
  node.innerHTML = `${icon(type === "error" ? "info" : type === "info" ? "info" : "check")}<p>${escapeHTML(message)}</p><button class="icon-button" aria-label="Đóng thông báo">${icon("x")}</button>`;
  $("#toasts").append(node);
  node.querySelector("button").onclick = () => node.remove();
  while ($("#toasts").children.length > 4)
    $("#toasts").firstElementChild.remove();
  setTimeout(() => node.remove(), type === "error" ? 12000 : 6500);
}
export async function busy(button, work, label = "Đang xử lý…") {
  const html = button.innerHTML;
  button.disabled = true;
  button.innerHTML = escapeHTML(label);
  button.setAttribute("aria-busy", "true");
  try {
    return await work();
  } finally {
    button.innerHTML = html;
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
}
let dialogResolve = null,
  dialogAction = null,
  dialogBusy = false;
export function modal({
  title,
  description = "",
  fields = "",
  submit = "Xác nhận",
  danger = false,
  onSubmit = async () => true,
}) {
  const dialog = $("#actionDialog");
  if (dialog.open) return Promise.resolve(false);
  $("#dialogTitle").textContent = title;
  $("#dialogDescription").textContent = description;
  $("#dialogFields").innerHTML = fields;
  $("#dialogError").textContent = "";
  $("#dialogSubmit").textContent = submit;
  $("#dialogSubmit").className = `button ${danger ? "danger" : "primary"}`;
  dialogAction = onSubmit;
  dialog.showModal();
  requestAnimationFrame(() =>
    (
      $("#dialogFields").querySelector("input,textarea,select") ||
      $('[data-close="actionDialog"]')
    ).focus(),
  );
  return new Promise((resolve) => {
    dialogResolve = resolve;
  });
}
export function setupUi() {
  hydrateIcons();
  document.addEventListener("click", (event) => {
    const close = event.target.closest("[data-close]");
    if (close) {
      const dialog = document.getElementById(close.dataset.close);
      if (dialog.id === "actionDialog" && dialogBusy) return;
      dialog.close();
    }
    const show = event.target.closest("[data-password-toggle]");
    if (show) {
      const input = document.getElementById(show.dataset.passwordToggle);
      input.type = input.type === "password" ? "text" : "password";
      show.setAttribute(
        "aria-label",
        input.type === "password" ? "Hiện mật khẩu" : "Ẩn mật khẩu",
      );
    }
  });
  $("#dialogForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (dialogBusy) return;
    dialogBusy = true;
    $("#dialogError").textContent = "";
    try {
      const data = Object.fromEntries(new FormData(event.target));
      const result = await busy($("#dialogSubmit"), () => dialogAction(data));
      const resolve = dialogResolve;
      dialogResolve = null;
      dialogBusy = false;
      $("#actionDialog").close();
      resolve?.(result ?? true);
    } catch (error) {
      $("#dialogError").textContent = error.message;
      dialogBusy = false;
    }
  });
  $("#actionDialog").addEventListener("cancel", (event) => {
    if (dialogBusy) event.preventDefault();
  });
  $("#actionDialog").addEventListener("close", () => {
    dialogResolve?.(false);
    dialogResolve = null;
    dialogAction = null;
  });
}
