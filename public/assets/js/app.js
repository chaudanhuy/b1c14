import {
  $,
  $$,
  escapeHTML as h,
  normalize,
  initials,
  formatBytes,
  formatDate,
  dateValue,
  icon,
  empty,
  skeleton,
  loaded,
  toast,
  busy,
  modal,
  setupUi,
} from "./ui.js";
import {
  fileKind,
  fileIcon,
  fileTile,
  validateSelection,
  compressImage,
  openPreview,
  setupPreview,
} from "./files.js";

import { createJourney, createExtras } from "./extras.js";
import { createCommunity } from "./community.js";
import { readRoute, savedRoute, rememberRoute, forgetRoute, copyTaskLink, renderTaskChart } from "./task-sharing.js";
import { avatarMarkup, renderOwnAvatar, setupAvatar } from "./avatar.js";
import { createSmartClass } from "./smart-class.js";
const initialRoute = readRoute(location.href);
let pendingRoute = initialRoute?.taskId || initialRoute?.invalid
  ? initialRoute : savedRoute() || initialRoute;
rememberRoute(pendingRoute);

// Quy ước hiển thị: có ít nhất một tệp là hoàn thành.
// Không cập nhật trạng thái trong D1 và không gọi API kiểm duyệt.
const STATUS = { not_submitted: "Chưa nộp", approved: "Hoàn thành" };
function badge(status) {
  const key = status === "approved" ? "approved" : "not_submitted";
  return `<span class="badge ${key}">${STATUS[key]}</span>`;
}
function submissionStatus(record) {
  return Number(record?.file_count ?? record?.image_count ?? 0) > 0
    ? "approved"
    : "not_submitted";
}

const JOURNEY_START = Date.parse("2024-09-08T00:00:00+07:00");
const JOURNEY_END = Date.parse("2028-08-01T00:00:00+07:00");
async function updateJourney() {
  let now = Date.now();
  try {
    const res = await fetch(location.href, { method: "HEAD" });
    const dateHeader = res.headers.get("Date");
    if (dateHeader) now = new Date(dateHeader).getTime();
  } catch (e) {}

  const day = 86400000;
  const percent = Math.max(0, Math.min(100,
    ((now - JOURNEY_START) / (JOURNEY_END - JOURNEY_START)) * 100));
  const elapsed = Math.max(0, Math.floor((now - JOURNEY_START) / day));
  const remaining = Math.max(0, Math.ceil((JOURNEY_END - now) / day));
  const label = percent.toLocaleString("vi-VN", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }) + "%";
  $("#journeyPercent").textContent = label;
  $("#journeyFill").style.width = percent + "%";
  $("#journeyBar").setAttribute("aria-valuenow", percent.toFixed(2));
  $("#journeyBar").setAttribute("aria-valuetext", label + " hành trình đã hoàn thành");
  $("#journeyElapsed").textContent = elapsed.toLocaleString("vi-VN");
  $("#journeyRemaining").textContent = remaining.toLocaleString("vi-VN");
  $("#journeyMessage").textContent = now < JOURNEY_START
    ? "Hành trình đang chờ ngày bắt đầu."
    : now >= JOURNEY_END
      ? "Đã chạm mốc tốt nghiệp. Một hành trình mới đang đón bạn!"
      : "Từng ngày nỗ lực đều đưa bạn gần hơn với đích đến.";
}
function setupJourney() {
  window.setInterval(() => {
    if (state.member && state.view === "journey" && !document.hidden)
      updateJourney();
  }, 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.member && state.view === "journey")
      updateJourney();
  });
}

const state = {
  member: null,
  tasks: [],
  view: "dashboard",
  roster: [],
  epoch: 0,
  selected: [],
  uploading: false,
  myFiles: [],
  members: [],
  gallery: [],
  selectedReviews: new Set(),
  managerTask: null,
  sharedTask: null,
  sharedTaskId: null,
  sharedMembers: [],
  selectionTaskId: null,
};
const requests = new Map(),
  metadataCache = new Map();
const VIEWS = {
  dashboard: "Tổng quan",
  tasks: "Nhiệm vụ của tôi",
  submit: "Gửi minh chứng",
  files: "Tài liệu của tôi",
  manager: "Quản lý minh chứng",
  shared: "Minh chứng đơn vị",
  account: "Tài khoản",
  journey: "Hành trình",
  more: "Thêm",
  "smart-class": "Smart Class", "lqa-message": "LQA-Message", leaderboard: "Bảng xếp hạng",
  links: "Liên kết nhanh", notices: "Bảng thông báo", mail: "Hộp thư", events: "Đếm ngược sự kiện",
};
const extraViews = new Set(["more","lqa-message","links","notices","mail","events"]);
const smartClass = createSmartClass({api, getMember: () => state.member});
const journey = createJourney({api, getMember: () => state.member});
const community = createCommunity({ api, getMember: () => state.member });
const extras = createExtras({ getView: () => state.view, navigate: view => showView(view), onSummary: updateNotificationBell, community, api, getMember: () => state.member, isActive: () => extraViews.has(state.view) && !!state.member && !state.member.must_change_password });
const safeRun = (fn) =>
  Promise.resolve()
    .then(fn)
    .catch((error) => {
      if (error.name !== "AbortError") toast(error.message, "error");
    });
function message(id, text, error = false) {
  const node = $(id);
  node.textContent = text;
  node.classList.toggle("error", error);
}
function isExpired(task) {
  return !!task?.due_at && +dateValue(task.due_at) <= Date.now();
}
function canSubmit(task) {
  return !!task?.is_active && !isExpired(task);
}
function taskById(id) {
  return state.tasks.find((t) => Number(t.id) === Number(id));
}
function selectedTask(select) {
  return taskById($(select).value);
}
function deadline(task) {
  return `<span class="deadline ${isExpired(task) ? "overdue" : ""}">${icon("clock")}${task.due_at ? `${isExpired(task) ? "Hết hạn: " : "Hạn: "}${formatDate(task.due_at, true)}` : "Không có hạn chót"}</span>`;
}
function abortRequests() {
  for (const request of requests.values()) request.abort();
  requests.clear();
}
async function api(url, { body, method = "GET", signal, ...options } = {}) {
  const epoch = state.epoch;
  const headers = new Headers(options.headers || {});
  if (method !== "GET" && method !== "HEAD")
    headers.set("X-Requested-With", "B1C14");
  if (body && !(body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }
  let response;
  try {
    response = await fetch(url, {
      ...options,
      method,
      body,
      headers,
      signal,
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.");
  }
  const data = await response.json().catch(() => ({}));
  // A delayed request from an old account must not expire or overwrite the new session.
  if (epoch !== state.epoch) throw new DOMException("Session changed", "AbortError");
  if (!response.ok) {
    if (data.code === "AUTH_REQUIRED") expireSession();
    if (data.code === "PASSWORD_CHANGE_REQUIRED" && state.member) {
      state.member.must_change_password = true;
      showView("account", { load: false });
      updatePasswordRequirement();
    }
    throw new Error(data.error || `Yêu cầu thất bại (${response.status}).`);
  }
  return data;
}
async function latest(channel, work, apply) {
  requests.get(channel)?.abort();
  const controller = new AbortController();
  requests.set(channel, controller);
  const epoch = state.epoch;
  try {
    const data = await work(controller.signal);
    if (
      epoch !== state.epoch ||
      controller.signal.aborted ||
      requests.get(channel) !== controller
    )
      return;
    apply(data);
  } finally {
    if (requests.get(channel) === controller) requests.delete(channel);
  }
}
function clearSelected() {
  state.selectionTaskId = null;
  state.selected.forEach((r) => {
    if (r.url) URL.revokeObjectURL(r.url);
  });
  state.selected = [];
  $("#fileInput").value = "";
  renderSelected();
}
function expireSession({ preserveRoute = true } = {}) {
  if (preserveRoute) {
    pendingRoute = readRoute(location.href) || pendingRoute;
    rememberRoute(pendingRoute);
  } else {
    pendingRoute = null;
    forgetRoute();
    history.replaceState(null, "", location.pathname + "#dashboard");
  }
  state.epoch++;
  smartClass.reset();
  journey.reset();
  extras.reset();
  community.reset();
  abortRequests();
  metadataCache.clear();
  clearSelected();
  clearPasswordReset();
  $("#resetMemberSelect").replaceChildren();
  $("#passwordResetPanel").hidden = true;
  $("#passwordForm").reset();
  $("#dialogFields").replaceChildren();
  state.member = null;
  state.tasks = [];
  state.members = [];
  state.managerTask = null;
  state.sharedTask = null;
  state.sharedTaskId = null;
  state.sharedMembers = [];
  state.myFiles = [];
  state.gallery = [];
  state.selectedReviews.clear();
  $$("dialog[open]").forEach((d) => d.close());
  $("#myFilesGrid").replaceChildren();
  $("#galleryFiles").replaceChildren();
  $("#membersBody").replaceChildren();
  $("#sharedMembersBody").replaceChildren();
  $("#managerTaskChart").replaceChildren();
  updateNotificationBell(null);
  $("#appShell").hidden = true;
  $("#loginScreen").hidden = false;
  closeMenu(false);
  safeRun(loadRoster);
}
function setTheme(theme) {
  try {
    localStorage.setItem("b1-theme", theme);
  } catch {}
  document.documentElement.dataset.theme = theme;
  $("#themeSelect").value = theme;
  updateThemeButtons();
}
function updateThemeButtons() {
  const pref = document.documentElement.dataset.theme || "system";
  const dark =
    pref === "dark" ||
    (pref === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  $$("[data-theme-cycle]").forEach((b) => {
    b.innerHTML = icon(dark ? "moon" : "sun");
    b.setAttribute(
      "aria-label",
      dark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối",
    );
  });
}
const isMobile = () => matchMedia("(max-width: 768px)").matches;
function closeMenu(focus = true) {
  const wasOpen = $("#sidebar").classList.contains("open");
  $("#sidebar").classList.remove("open");
  $("#sidebarBackdrop").hidden = true;
  $(".main-shell").inert = false;
  $(".bottom-nav").inert = false;
  $("#sidebar").inert = isMobile();
  document.body.style.overflow = "";
  $("#menuButton").setAttribute(
    "aria-expanded",
    String(
      !isMobile() && !document.documentElement.classList.contains("collapsed"),
    ),
  );
  if (focus && wasOpen) $("#menuButton").focus();
}
function openMenu() {
  if (!isMobile()) {
    document.documentElement.classList.toggle("collapsed");
    try {
      localStorage.setItem(
        "b1-sidebar",
        document.documentElement.classList.contains("collapsed")
          ? "collapsed"
          : "open",
      );
    } catch {}
    $("#menuButton").setAttribute(
      "aria-expanded",
      String(!document.documentElement.classList.contains("collapsed")),
    );
    return;
  }
  $("#sidebar").inert = false;
  $("#sidebar").classList.add("open");
  $("#sidebarBackdrop").hidden = false;
  $(".main-shell").inert = true;
  $(".bottom-nav").inert = true;
  document.body.style.overflow = "hidden";
  $("#menuButton").setAttribute("aria-expanded", "true");
  $("#closeMenu").focus();
}
function showView(view, { load = true, updateUrl = true, replace = false, extrasScreen = "hub" } = {}) {
  if (!state.member) return;
  if (
    !Object.hasOwn(VIEWS, view) ||
    (view === "manager" && state.member.role !== "cadre")
  )
    view = "dashboard";
  if (state.member.must_change_password) view = "account";
  if (view !== "account") clearPasswordReset();
  state.view = view;
  if (extraViews.has(view)) extras.open(view === "more" ? extrasScreen : view);
  else extras.close();
  if (view === "smart-class") smartClass.open(); else smartClass.close();
  if (view === "journey" || view === "leaderboard") journey.open(view); else journey.close();
  if (view === "journey") updateJourney();
  $$("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== (extraViews.has(view) ? "more" : view)));
  $$("[data-view]").forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  $("#pageTitle").textContent = VIEWS[view];
  document.title = `${VIEWS[view]} · ĐH31LQA`;
  closeMenu(false);
  if (updateUrl) {
    const url = new URL(location.href);
    url.searchParams.delete("redirect_to");
    url.searchParams.delete("task_id");
    if (view === "shared" && (state.sharedTaskId || $("#sharedTask").value))
      url.searchParams.set("task_id", state.sharedTaskId || $("#sharedTask").value);
    url.hash = view;
    if (url.href !== location.href) history[replace ? "replaceState" : "pushState"](null, "", url);
  }
  $("#mainContent").focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "instant" });
  if (load) {
    if (view === "account" && state.member.can_reset_password && !state.member.must_change_password)
      safeRun(loadResetMembers);
    if (view === "files") safeRun(() => loadMyFiles());
    else if (view === "manager") safeRun(loadManager);
    else if (view === "shared") safeRun(() => loadShared());
    else if (view === "tasks" || view === "dashboard") safeRun(loadTasks);
  }
}
function activate(member) {
  state.epoch++;
  state.member = member;
  $("#loginScreen").hidden = true;
  $("#appShell").hidden = false;
  $$("[data-member-name]").forEach((n) => (n.textContent = member.name));
  $$("[data-member-unit]").forEach((n) => (n.textContent = member.unit_label));
  renderOwnAvatar(member);
  $$("[data-manager-only]").forEach(
    (n) => (n.hidden = member.role !== "cadre"),
  );
  $("#accountRole").textContent =
    member.role === "cadre" ? "Quyền quản lý" : "Học viên";
  updatePasswordRequirement();
  $("#passwordResetPanel").hidden = !member.can_reset_password || member.must_change_password;
  $("#greeting").textContent =
    `Chào ${member.name.split(" ").slice(-2).join(" ")}!`;
  $("#todayLabel").textContent = new Date().toLocaleDateString("vi-VN", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
  $("#themeSelect").value = document.documentElement.dataset.theme || "system";
  closeMenu(false);
}
async function loadRoster() {
  const retryBtn = document.getElementById("retryLogin");
  if (retryBtn) retryBtn.hidden = true;
  try {
    const data = await api("/api/roster");
    state.roster = data.groups || [];
    message("#loginMessage", "");
  } catch (error) {
    if (retryBtn) retryBtn.hidden = false;
    message("#loginMessage", error.message, true);
  }
}
function fillTasks(node, tasks, label) {
  const old = node.value;
  node.innerHTML = tasks.length
    ? tasks
        .map(
          (t) =>
            `<option value="${t.id}">${h(t.title)}${!t.is_active ? " · Đã đóng" : isExpired(t) ? " · Hết hạn" : ""}</option>`,
        )
        .join("")
    : `<option value="">${label}</option>`;
  if (tasks.some((t) => String(t.id) === old)) node.value = old;
}
async function loadTasks() {
  if (!state.member || state.member.must_change_password) return;
  if (!state.tasks.length) {
    skeleton($("#dashboardStats"), 4, "tile");
    skeleton($("#taskList"), 4, "tile");
  }
  try {
    await latest(
      "tasks",
      (signal) =>
        api("/api/tasks?all=1", {
          signal,
        }),
      (data) => {
        const previousUpload = $("#uploadTask").value;
        state.tasks = data.tasks || [];
        fillTasks(
          $("#uploadTask"),
          state.tasks.filter((t) => t.is_active),
          "Chưa có nhiệm vụ đang mở",
        );
        fillTasks(
          $("#filesTask"),
          state.tasks.filter((t) => t.is_active || t.file_count),
          "Chưa có nhiệm vụ",
        );
        fillTasks($("#managerTask"), state.tasks, "Chưa có nhiệm vụ");
        fillTasks($("#sharedTask"), state.tasks, "Chưa có nhiệm vụ");
        if (
          previousUpload &&
          previousUpload !== $("#uploadTask").value &&
          state.selected.length &&
          !state.uploading
        ) {
          clearSelected();
          toast(
            "Nhiệm vụ vừa thay đổi hoặc đóng. Hãy chọn lại tệp cho nhiệm vụ tiếp theo.",
            "info",
          );
        }
        renderDashboard();
        renderTasks();
        renderUploadTask();
        $("#navTaskCount").textContent = state.tasks.filter(
          (t) => t.is_active && submissionStatus(t) !== "approved",
        ).length;
      },
    );
  } catch (error) {
    if (error.name !== "AbortError" && !state.tasks.length) {
      loaded(
        $("#dashboardStats"),
        empty(
          "Chưa tải được nhiệm vụ",
          error.message,
          '<button class="button soft" data-refresh="tasks">Thử lại</button>',
        ),
      );
      loaded($("#taskList"), empty("Chưa tải được nhiệm vụ", error.message));
      $("#completionLabel").textContent = "Chưa có dữ liệu";
    }
    throw error;
  }
}
function renderDashboard() {
  const tasks = state.tasks.filter((t) => t.is_active),
    approved = tasks.filter((t) => submissionStatus(t) === "approved").length,
    missing = tasks.filter(
      (t) => submissionStatus(t) === "not_submitted",
    ).length;
  const cards = [
    [
      "Nhiệm vụ đang mở",
      tasks.length,
      "Trong không gian của bạn",
      "layers",
      "indigo",
    ],
    [
      "Đã hoàn thành",
      approved,
      "Đã có minh chứng",
      "check-square",
      "teal",
    ],
    ["Tệp đã gửi", tasks.reduce((sum, t) => sum + Number(t.file_count || 0), 0), "Trong nhiệm vụ đang mở", "folder", "amber"],
    ["Cần thực hiện", missing, "Chưa có minh chứng", "activity", "rose"],
  ];
  loaded(
    $("#dashboardStats"),
    cards
      .map(
        ([title, note, detail, symbol, color]) =>
          `<article class="stat-card"><div class="stat-head"><span>${title}</span><span class="surface-icon ${color}">${icon(symbol)}</span></div><b class="stat-number">${note}</b><small>${detail}</small></article>`,
      )
      .join(""),
  );
  const percent = tasks.length
    ? Math.round((100 * approved) / tasks.length)
    : 0;
  $("#completionRing").style.setProperty("--value", percent);
  $("#completionPercent").textContent = percent + "%";
  $("#completionLabel").textContent = tasks.length
    ? `${approved}/${tasks.length} nhiệm vụ đã hoàn thành`
    : "Chưa có nhiệm vụ đang mở";
  const next = tasks
    .filter((t) => submissionStatus(t) === "not_submitted")
    .sort(
      (a, b) =>
        (+dateValue(a.due_at) || Infinity) - (+dateValue(b.due_at) || Infinity),
    )
    .slice(0, 3);
  $("#upcomingList").innerHTML = next.length
    ? next
        .map(
          (t, i) =>
            `<div class="upcoming-item"><span>${String(i + 1).padStart(2, "0")}</span><div><b title="${h(t.title)}">${h(t.title)}</b><small>${t.due_at ? formatDate(t.due_at, true) : "Chưa đặt hạn chót"}</small></div><button class="icon-button" data-task-action="${t.id}" data-task-view="${canSubmit(t) ? "submit" : "files"}" aria-label="Mở nhiệm vụ ${h(t.title)}">${icon("arrow-right")}</button></div>`,
        )
        .join("")
    : '<div class="empty-state compact"><b>Bạn đã cập nhật đủ bài nộp</b><p>Các nhiệm vụ đang mở đều đã có minh chứng.</p></div>';
}
function renderTasks() {
  const search = normalize($("#taskSearch").value),
    status = $("#taskStatus").value,
    deadlineFilter = $("#taskDeadline").value;
  const tasks = state.tasks.filter(
    (t) =>
      (t.is_active || t.file_count || deadlineFilter === "archive") &&
      normalize(t.title + " " + t.description).includes(search) &&
      (status === "all" ||
        (status === "incomplete"
          ? submissionStatus(t) !== "approved"
          : submissionStatus(t) === status)) &&
      (deadlineFilter === "all" ||
        (deadlineFilter === "archive" && !t.is_active) ||
        (deadlineFilter === "overdue" && isExpired(t)) ||
        (deadlineFilter === "soon" &&
          t.is_active &&
          t.due_at &&
          !isExpired(t) &&
          +dateValue(t.due_at) < Date.now() + 3 * 86400000)),
  );
  tasks.sort(
    (a, b) =>
      (+dateValue(a.due_at) || Infinity) - (+dateValue(b.due_at) || Infinity),
  );
  $("#taskSummary").textContent = `${tasks.length} nhiệm vụ phù hợp`;
  loaded(
    $("#taskList"),
    tasks.length
      ? tasks
          .map(
            (t) =>
              `<article class="task-card"><div class="task-card-top">${badge(submissionStatus(t))}${!t.is_active ? '<span class="muted"><small>Đã đóng</small></span>' : deadline(t)}</div><h2>${h(t.title)}</h2>${t.description ? `<p>${h(t.description)}</p>` : ""}<div class="task-card-footer"><small>${t.file_count ? `${t.file_count} tệp đã gửi` : "Chưa có minh chứng"}</small><div class="action-row"><button class="button ghost small" data-open-shared="${t.id}">Xem cả đơn vị</button>${t.file_count ? `<button class="button ghost small" data-task-action="${t.id}" data-task-view="files">Xem bài</button>` : ""}${canSubmit(t) ? `<button class="button soft small" data-task-action="${t.id}" data-task-view="submit">${t.file_count ? "Bổ sung" : "Gửi minh chứng"} ${icon("arrow-right")}</button>` : ""}</div></div></article>`,
          )
          .join("")
      : empty("Không có nhiệm vụ phù hợp", "Thử thay đổi từ khóa hoặc bộ lọc."),
  );
}
function renderUploadTask() {
  const task = selectedTask("#uploadTask");
  if (state.selected.length && state.selectionTaskId !== Number(task?.id) && !state.uploading) {
    clearSelected();
    toast("Đã đổi nhiệm vụ. Hãy chọn lại tệp để tránh gửi nhầm.", "info");
  }
  $("#uploadTaskInfo").innerHTML = task
    ? `${badge(submissionStatus(task))} ${deadline(task)}${task.description ? `<p>${h(task.description)}</p>` : ""}${!canSubmit(task) ? '<p class="danger-text">Nhiệm vụ đã đóng hoặc hết hạn nhận bài.</p>' : ""}`
    : "";
  $("#submitButton").disabled = !canSubmit(task) || state.uploading;
  $("#dropZone").setAttribute(
    "aria-disabled",
    String(!canSubmit(task) || state.uploading),
  );
}
function renderSelected() {
  $("#selectedWrap").hidden = !state.selected.length;
  $("#selectedSummary").textContent =
    `${state.selected.length} tệp · ${formatBytes(state.selected.reduce((n, r) => n + r.file.size, 0))}`;
  $("#selectedFiles").innerHTML = state.selected
    .map(
      (r) =>
        `<div class="selected-item">${r.url ? `<img src="${r.url}" alt="${h(r.file.name)}" data-preview-selected="${r.id}" tabindex="0" role="button" aria-label="Xem trước ${h(r.file.name)}">` : fileIcon(r.file)}<span class="selected-item-info"><b title="${h(r.file.name)}">${h(r.file.name)}</b><small>${formatBytes(r.file.size)}</small></span><div class="action-row"><button type="button" class="icon-button" data-replace-selected="${r.id}" aria-label="Thay tệp ${h(r.file.name)}">${icon("edit")}</button><button type="button" class="icon-button danger-text" data-remove-selected="${r.id}" aria-label="Bỏ chọn ${h(r.file.name)}">${icon("x")}</button></div></div>`,
    )
    .join("");
}
function addFiles(files, replaceId = null) {
  if (state.uploading) return;
  files = [...files];
  if (!files.length) return;
  const next = replaceId
    ? state.selected
        .filter((r) => r.id !== replaceId)
        .map((r) => r.file)
        .concat(files)
    : state.selected.map((r) => r.file).concat(files);
  const error = validateSelection(next);
  if (error) {
    toast(error, "error");
    return;
  }
  if (replaceId) {
    const old = state.selected.find((r) => r.id === replaceId);
    if (old?.url) URL.revokeObjectURL(old.url);
    state.selected = state.selected.filter((r) => r.id !== replaceId);
  }
  state.selectionTaskId = Number($("#uploadTask").value);
  for (const file of files)
    state.selected.push({
      id: crypto.randomUUID(),
      file,
      url: fileKind(file).key === "image" ? URL.createObjectURL(file) : null,
    });
  renderSelected();
  message("#uploadMessage", "");
}
function uploadProgress(value, label) {
  $("#uploadProgressWrap").hidden = false;
  $("#uploadProgress").value = value;
  $("#uploadProgressValue").textContent = Math.round(value) + "%";
  $("#uploadProgressLabel").textContent = label;
}
function sendUpload(body) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/me/upload");
    xhr.setRequestHeader("X-Requested-With", "B1C14");
    xhr.responseType = "json";
    xhr.timeout = 180000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = (100 * e.loaded) / e.total;
        uploadProgress(
          percent,
          percent === 100
            ? "Máy chủ đang kiểm tra và lưu tệp…"
            : "Đang tải minh chứng lên…",
        );
      }
    };
    xhr.onload = () => {
      const data = xhr.response || {};
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else {
        if (data.code === "AUTH_REQUIRED") expireSession();
    if (data.code === "PASSWORD_CHANGE_REQUIRED" && state.member) {
      state.member.must_change_password = true;
      showView("account", { load: false });
      updatePasswordRequirement();
    }
        reject(
          new Error(
            data.error ||
              "Chưa lưu được tệp. Hãy kiểm tra Tài liệu của tôi trước khi gửi lại.",
          ),
        );
      }
    };
    xhr.onerror = () =>
      reject(
        new Error(
          "Mất kết nối khi gửi. Kiểm tra Tài liệu của tôi trước khi thử lại để tránh gửi trùng.",
        ),
      );
    xhr.ontimeout = () =>
      reject(
        new Error("Chờ quá lâu. Kiểm tra Tài liệu của tôi trước khi gửi lại."),
      );
    xhr.send(body);
  });
}
async function upload(event) {
  event.preventDefault();
  if (state.uploading) return;
  const task = selectedTask("#uploadTask");
  if (!canSubmit(task)) {
    toast("Nhiệm vụ không còn nhận bài.", "error");
    return;
  }
  if (!state.selected.length) {
    toast("Hãy chọn ít nhất một tệp.", "error");
    return;
  }
  const epoch = state.epoch;
  state.uploading = true;
  $("#uploadFields").disabled = true;
  $("#logoutButton").disabled = true;
  message("#uploadMessage", "");
  try {
    await busy(
      $("#submitButton"),
      async () => {
        const body = new FormData();
        body.append("task_id", task.id);
        let savings = 0;
        for (let i = 0; i < state.selected.length; i++) {
          const original = state.selected[i].file;
          uploadProgress(
            0,
            `Đang chuẩn bị tệp ${i + 1}/${state.selected.length}…`,
          );
          const file = $("#compressImages").checked
            ? await compressImage(original)
            : original;
          savings += original.size - file.size;
          body.append("images", file);
        }
        const data = await sendUpload(body);
        if (epoch !== state.epoch) return;
        clearSelected();
        metadataCache.clear();
        uploadProgress(100, "Đã lưu minh chứng");
        // Chỉ ghi nhận sau HTTP thành công; cập nhật ngay trước khi tải lại dữ liệu.
        task.file_count = Number(task.file_count || 0) + Math.max(1, Number(data.added || 0));
        renderDashboard();
        renderTasks();
        renderUploadTask();
        $("#navTaskCount").textContent = state.tasks.filter(
          (t) => t.is_active && submissionStatus(t) !== "approved",
        ).length;
        message(
          "#uploadMessage",
          "Đã gửi minh chứng. Nhiệm vụ đã hoàn thành." +
            (savings ? ` Đã giảm ${formatBytes(savings)} nhờ nén ảnh.` : ""),
        );
        toast("Đã gửi minh chứng. Nhiệm vụ đã hoàn thành.");
        $("#filesTask").value = String(task.id);
        await loadTasks();
      },
      "Đang gửi minh chứng…",
    );
  } catch (error) {
    if (epoch === state.epoch) {
      message("#uploadMessage", error.message, true);
      toast(error.message, "error");
      $("#uploadProgressLabel").textContent = "Gửi chưa hoàn tất";
    }
  } finally {
    state.uploading = false;
    $("#uploadFields").disabled = false;
    $("#logoutButton").disabled = false;
    renderUploadTask();
  }
}
async function loadMyFiles(force = false) {
  requests.get("files")?.abort();
  const id = Number($("#filesTask").value);
  state.myFiles = [];
  $("#submissionStatus").replaceChildren();
  $("#reviewHistory").replaceChildren();
  $("#myFileCount").textContent = "";
  if (!id) {
    loaded(
      $("#myFilesGrid"),
      empty(
        "Chưa có tài liệu",
        "Khi có nhiệm vụ, bạn có thể gửi minh chứng tại mục Gửi minh chứng.",
      ),
    );
    return;
  }
  skeleton($("#myFilesGrid"), 4, "tile");
  const key = `me:${state.member.id}:${id}`,
    cached = metadataCache.get(key);
  try {
    await latest(
      "files",
      (signal) =>
        !force && cached && Date.now() - cached.at < 15000
          ? Promise.resolve(cached.data)
          : api(`/api/me/submission?task_id=${id}`, { signal }),
      (data) => {
        if (Number($("#filesTask").value) !== id) return;
        metadataCache.set(key, { data, at: Date.now() });
        state.myFiles = data.images || [];
        $("#myFileCount").textContent = `${state.myFiles.length} tệp`;
        loaded(
          $("#myFilesGrid"),
          state.myFiles.length
            ? state.myFiles
                .map((f) => fileTile(f, canSubmit(taskById(id))))
                .join("")
            : empty(
                "Chưa gửi minh chứng",
                "Thêm tệp vào nhiệm vụ để bắt đầu.",
                '<button class="button soft" data-task-action="' +
                  id +
                  '" data-task-view="submit">Gửi minh chứng</button>',
              ),
        );
        const submission = data.submission;
        $("#submissionStatus").innerHTML =
          submission && state.myFiles.length
            ? `<div class="submission-banner">${badge(submissionStatus({ file_count: state.myFiles.length }))}<span class="muted">Cập nhật ${formatDate(submission.updated_at)}</span></div>`
            : "";
        $("#reviewHistory").replaceChildren();
      },
    );
  } catch (error) {
    if (error.name !== "AbortError")
      loaded(
        $("#myFilesGrid"),
        empty(
          "Chưa tải được tài liệu",
          error.message,
          '<button class="button soft" data-refresh="files">Thử lại</button>',
        ),
      );
    throw error;
  }
}
async function removeFile(id) {
  const file = state.myFiles.find((f) => f.id === id);
  if (!file) return;
  const result = await modal({
    title: "Xóa tài liệu này?",
    description: `${file.image_name}\nNếu xóa tệp cuối cùng, nhiệm vụ sẽ trở về Chưa nộp.`,
    submit: "Xóa tài liệu",
    danger: true,
    onSubmit: () => api(`/api/me/images?id=${id}`, { method: "DELETE" }),
  });
  if (result) {
    metadataCache.clear();
    toast("Đã xóa tài liệu.");
    await Promise.all([loadTasks(), loadMyFiles(true)]);
  }
}
async function loadManager() {
  requests.get("manager")?.abort();
  $("#managerTaskChart").replaceChildren();
  $("#copyManagerTask").disabled = true;
  if (state.member?.role !== "cadre" || state.member.must_change_password) return;
  const id = Number($("#managerTask").value);
  state.selectedReviews.clear();
  state.members = [];
  renderBulk();
  state.managerTask = null;
  [
    "editTaskButton",
    "toggleTaskButton",
    "deleteTaskButton",
    "exportExcel",
    "exportZip",
  ].forEach((key) => ($("#" + key).disabled = !id));
  if (!id) {
    $("#membersBody").innerHTML =
      `<tr><td colspan="5">${empty("Chưa có nhiệm vụ", "Tạo nhiệm vụ đầu tiên để bắt đầu theo dõi.")}</td></tr>`;
    $("#managerStats").replaceChildren();
    $("#unitOverview").replaceChildren();
    $("#managerTaskMeta").textContent = "";
    $("#memberSummary").textContent = "";
    return;
  }
  $("#membersBody").innerHTML =
    '<tr><td colspan="5"><div class="skeleton line" aria-label="Đang tải thành viên"></div><div class="skeleton line"></div><div class="skeleton line"></div></td></tr>';
  $("#membersBody").setAttribute("aria-busy", "true");
  skeleton($("#unitOverview"), 4, "line");
  try {
    await latest(
      "manager",
      (signal) =>
        Promise.all([
          api(`/api/cadre/submissions?task_id=${id}`, { signal }),
          api("/api/cadre/dashboard", { signal }),
        ]),
      ([data, overview]) => {
        if (Number($("#managerTask").value) !== id) return;
        state.members = data.members || [];
        state.managerTask = data.task;
        $("#copyManagerTask").disabled = false;
        renderTaskChart($("#managerTaskChart"), data.stats);
        const stats = {
          approved: state.members.filter((m) => submissionStatus(m) === "approved").length,
          not_submitted: state.members.filter((m) => submissionStatus(m) === "not_submitted").length,
        };
        $("#managerTaskMeta").innerHTML =
          `${data.task.is_active ? '<span class="badge approved">Đang mở</span>' : '<span class="badge not_submitted">Đã đóng</span>'} <span class="deadline">${data.task.due_at ? "Hạn chót: " + formatDate(data.task.due_at) : "Chưa đặt hạn chót"}</span>`;
        $("#toggleTaskButton").textContent = data.task.is_active
          ? "Đóng nhận bài"
          : "Mở nhận bài";
        $("#managerStats").innerHTML = [
          ["Hoàn thành", stats.approved, "green"],
          ["Chưa nộp", stats.not_submitted, ""],
        ]
          .map(
            ([label, n, color]) =>
              `<div class="mini-stat ${color}"><b>${n}</b><small>${label}</small></div>`,
          )
          .join("");
        loaded(
          $("#unitOverview"),
          overview.units.length
            ? overview.units
                .map((u) => {
                  const percent = u.expected
                    ? Math.round((100 * u.submitted) / u.expected)
                    : 0;
                  return `<article class="unit-card"><b>${h(u.unit_label)}</b><div><span>${u.submitted}/${u.expected} lượt hoàn thành</span><strong>${percent}%</strong></div><progress max="100" value="${percent}" aria-label="Tiến độ ${h(u.unit_label)}"></progress><small>Tất cả nhiệm vụ đang mở</small></article>`;
                })
                .join("")
            : empty(
                "Chưa có tiến độ chung",
                "Thống kê xuất hiện khi có nhiệm vụ đang mở.",
              ),
        );
        renderMembers();
      },
    );
  } catch (error) {
    if (error.name !== "AbortError") {
      loaded($("#unitOverview"), empty("Chưa tải được tiến độ", error.message));
      $("#membersBody").removeAttribute("aria-busy");
      $("#membersBody").innerHTML =
        `<tr><td colspan="5">${empty("Chưa tải được danh sách", error.message, '<button class="button soft" data-refresh="manager">Thử lại</button>')}</td></tr>`;
    }
    throw error;
  }
}
function filteredMembers() {
  const search = normalize($("#memberSearch").value),
    unit = $("#memberUnit").value,
    status = $("#memberStatus").value;
  return state.members.filter(
    (m) =>
      normalize(m.name).includes(search) &&
      (unit === "all" || m.unit_code === unit) &&
      (status === "all" || submissionStatus(m) === status),
  );
}
function renderMembers() {
  const members = filteredMembers();
  loaded(
    $("#membersBody"),
    members.length
      ? members
          .map(
            (m) =>
              `<tr><td><div class="member-cell"><span class="avatar">${avatarMarkup(m)}</span><span><b>${h(m.name)}</b><small>${h(m.unit_label)}</small></span></div></td><td><span class="muted">${h(m.unit_label)}</span></td><td>${badge(submissionStatus(m))}</td><td class="muted">${m.image_count ? formatDate(m.updated_at, true) : "—"}</td><td class="align-right">${m.image_count ? `<button class="button soft small" data-open-submission="${m.id}">${icon("folder")}${m.image_count} tệp</button>` : '<span class="muted">Chưa có tệp</span>'}</td></tr>`,
          )
          .join("")
      : `<tr><td colspan="5">${empty("Không tìm thấy thành viên", "Thử đổi từ khóa hoặc bộ lọc.")}</td></tr>`,
  );
  $("#memberSummary").textContent =
    `${members.length}/${state.members.length} thành viên`;
  renderBulk();
}
function renderBulk() {
  state.selectedReviews.clear();
}
async function review(status) {
  // Giữ tên hàm để tương thích, không thực hiện kiểm duyệt từ frontend.
  return;
}
async function gallery(id, shared = false) {
  const member = (shared ? state.sharedMembers : state.members).find((m) => m.id === id);
  if (!member) return;
  const dialog = $("#galleryDialog");
  $("#galleryTitle").textContent = member.name;
  $("#galleryMeta").textContent =
    `${member.unit_label} · ${member.image_count} tệp · ${STATUS[submissionStatus(member)]}`;
  state.gallery = [];
  skeleton($("#galleryFiles"), 4, "tile");
  if (!dialog.open) dialog.showModal();
  const key = `gallery:${state.member.id}:${id}:${member.revision}`,
    cached = metadataCache.get(key);
  try {
    await latest(
      "gallery",
      (signal) =>
        cached && Date.now() - cached.at < 15000
          ? Promise.resolve(cached.data)
          : api(`/api/${shared ? "tasks/files" : "cadre/images"}?submission_id=${id}`, { signal }),
      (data) => {
        if (!dialog.open) return;
        metadataCache.set(key, { data, at: Date.now() });
        state.gallery = data.images || [];
        loaded(
          $("#galleryFiles"),
          state.gallery.length
            ? state.gallery.map((f) => fileTile(f)).join("")
            : empty(
                "Chưa có tệp",
                "Hồ sơ vừa được thay đổi. Hãy làm mới danh sách.",
              ),
        );
      },
    );
  } catch (error) {
    if (error.name !== "AbortError")
      loaded($("#galleryFiles"), empty("Chưa tải được tệp", error.message));
    throw error;
  }
}

function updateNotificationBell(data) {
  const count = Math.max(0, Number(data?.unread_notices) || 0);
  $("#notificationBadge").hidden = !count;
  $("#notificationBadge").textContent = count > 99 ? "99+" : String(count);
  $("#notificationBell").setAttribute("aria-label",
    count ? "Bảng thông báo: " + count + " thông báo chưa đọc" : "Bảng thông báo");
  $("#notificationBell").title = count ? count + " thông báo chưa đọc" : "Bảng thông báo";
}
async function enterApplication(member) {
  const route = pendingRoute || readRoute(location.href);
  pendingRoute = route;
  activate(member);
  const epoch = state.epoch;
  showView(member.must_change_password ? "account" : "dashboard", { load: false, updateUrl: false });
  if (member.must_change_password) { rememberRoute(route); return; }
  await loadTasks();
  if (epoch !== state.epoch) return;
  await applyRoute(route || { view: document.body.dataset.entry === "manager" && member.role === "cadre" ? "manager" : "dashboard" }, { replace: true });
  pendingRoute = null;
}
async function applyRoute(route, options = {}) {
  if (!state.member || state.member.must_change_password) return;
  if (route?.invalid) {
    forgetRoute();
    toast("Liên kết nhiệm vụ không hợp lệ.", "error");
    showView("tasks", { ...options, load: false });
    return;
  }
  if (route?.taskId) {
    rememberRoute(route);
    await openSharedTask(route.taskId, options);
    forgetRoute();
  } else showView(route?.view || "dashboard", options);
}
async function openSharedTask(id, options = {}) {
  state.sharedTaskId = id || null;
  $("#sharedTask").value = String(id || "");
  showView("shared", { ...options, load: false });
  await loadShared(id);
}
async function loadShared(requestedId) {
  if (!state.member || state.member.must_change_password) return;
  requests.get("shared")?.abort();
  const id = requestedId || Number($("#sharedTask").value) || state.sharedTaskId;
  state.sharedTaskId = id || null;
  state.sharedTask = null;
  state.sharedMembers = [];
  $("#sharedTaskTitle").textContent = "";
  $("#sharedTaskMeta").replaceChildren();
  $("#sharedTaskDescription").textContent = "";
  $("#sharedSummary").textContent = "";
  for (const key of ["copySharedTask", "sharedSubmit", "sharedMyFiles"]) $("#" + key).disabled = true;
  const tbody = $("#sharedMembersBody");
  if (!id) {
    loaded(tbody, '<tr><td colspan="5">' + empty("Chưa có nhiệm vụ", "Danh sách xuất hiện khi có nhiệm vụ được tạo.") + '</td></tr>');
    return;
  }
  loaded(tbody, '<tr><td colspan="5"><div class="skeleton line"></div><div class="skeleton line"></div></td></tr>');
  tbody.setAttribute("aria-busy", "true");
  try {
    await latest("shared", signal => api("/api/tasks/shared?task_id=" + id, { signal }), data => {
      if (state.sharedTaskId !== id) return;
      state.sharedTask = data.task;
      state.sharedMembers = data.members || [];
      $("#sharedTaskTitle").textContent = data.task.title;
      $("#sharedTaskMeta").innerHTML = deadline(data.task) + (!data.task.is_active ? ' <span class="badge not_submitted">Đã đóng</span>' : "");
      $("#sharedTaskDescription").textContent = data.task.description || "";
      $("#copySharedTask").disabled = false;
      $("#sharedSubmit").disabled = !canSubmit(data.task);
      $("#sharedMyFiles").disabled = !taskById(id)?.file_count && !data.task.is_active;
      renderSharedMembers();
    });
  } catch (error) {
    if (error.name !== "AbortError" && state.sharedTaskId === id)
      loaded(tbody, '<tr><td colspan="5">' + empty("Chưa mở được nhiệm vụ", error.message,
        '<button class="button soft" data-refresh="shared">Thử lại</button>') + '</td></tr>');
    throw error;
  }
}
function renderSharedMembers() {
  const search = normalize($("#sharedSearch").value), unit = $("#sharedUnit").value, status = $("#sharedStatus").value;
  const members = state.sharedMembers.filter(m => normalize(m.name).includes(search)
    && (unit === "all" || m.unit_code === unit)
    && (status === "all" || submissionStatus(m) === status));
  loaded($("#sharedMembersBody"), members.length ? members.map(m =>
    '<tr><td><div class="member-cell"><span class="avatar">' + avatarMarkup(m) +
    '</span><span><b>' + h(m.name) + (m.member_id === state.member?.id ? " (Bạn)" : "") +
    '</b><small>' + h(m.unit_label) + '</small></span></div></td><td class="muted">' +
    h(m.unit_label) + '</td><td>' + badge(submissionStatus(m)) + '</td><td class="muted">' +
    (m.image_count ? formatDate(m.updated_at, true) : "—") + '</td><td class="align-right">' +
    (m.image_count ? '<button class="button soft small" data-open-shared-submission="' + Number(m.id) +
    '">' + icon("folder") + Number(m.image_count) + ' tệp</button>' : '<span class="muted">Chưa có tệp</span>') +
    '</td></tr>').join("") : '<tr><td colspan="5">' + empty("Không có thành viên phù hợp", "Thử đổi từ khóa hoặc bộ lọc.") + '</td></tr>');
  $("#sharedSummary").textContent = members.length + "/" + state.sharedMembers.length + " thành viên · Chỉ xem và tải xuống";
}

function localDateInput(value) {
  const d = dateValue(value);
  if (!d) return "";
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
async function editTask(existing = null) {
  const result = await modal({
    title: existing ? "Chỉnh sửa nhiệm vụ" : "Tạo nhiệm vụ mới",
    description:
      "Thành viên có thể gửi hoặc sửa minh chứng khi nhiệm vụ đang mở và chưa quá hạn.",
    submit: existing ? "Lưu thay đổi" : "Tạo nhiệm vụ",
    fields: `<label class="field"><span>Tên nhiệm vụ</span><input name="title" minlength="3" maxlength="180" required value="${h(existing?.title || "")}" placeholder="Ví dụ: Báo cáo sinh hoạt tuần"></label><label class="field"><span>Yêu cầu / mô tả</span><textarea name="description" maxlength="2000" placeholder="Nêu rõ tài liệu cần nộp…">${h(existing?.description || "")}</textarea></label><label class="field"><span>Hạn chót (giờ trên thiết bị của bạn)</span><input name="due_at" type="datetime-local" value="${localDateInput(existing?.due_at)}"><small class="muted">Để trống nếu không giới hạn thời gian.</small></label>`,
    onSubmit: (fields) =>
      api("/api/tasks", {
        method: "POST",
        body: {
          title: fields.title,
          description: fields.description,
          due_at: existing && fields.due_at === localDateInput(existing.due_at)
            ? existing.due_at
            : fields.due_at ? new Date(fields.due_at).toISOString() : null,
          ...(existing ? { task_id: existing.id } : {}),
        },
      }),
  });
  if (result) {
    toast(existing ? "Đã cập nhật nhiệm vụ." : "Đã tạo nhiệm vụ.");
    await loadTasks();
    $("#managerTask").value = result.task.id;
    await loadManager();
  }
}
async function toggleTask() {
  const task = state.managerTask;
  if (!task) return;
  const result = await modal({
    title: task.is_active ? "Đóng nhận minh chứng?" : "Mở lại nhiệm vụ?",
    description: task.is_active
      ? "Thành viên vẫn xem được bài cũ nhưng không thể thêm hoặc xóa tệp."
      : isExpired(task)
        ? "Nhiệm vụ đã hết hạn. Bạn cần sửa hạn chót để nhận thêm bài."
        : "Thành viên có thể tiếp tục gửi minh chứng.",
    submit: task.is_active ? "Đóng nhận bài" : "Mở nhiệm vụ",
    onSubmit: () =>
      api("/api/cadre/toggle-task", {
        method: "POST",
        body: { task_id: task.id, is_active: task.is_active ? 0 : 1 },
      }),
  });
  if (result) {
    toast(result.task.is_active ? "Đã mở nhiệm vụ." : "Đã đóng nhận bài.");
    await loadTasks();
    await loadManager();
  }
}
async function deleteTask() {
  const task = state.managerTask;
  if (!task) return;
  const result = await modal({
    title: "Xóa nhiệm vụ và minh chứng?",
    description: `Thao tác này xóa “${task.title}” cùng tất cả bài nộp. Không thể hoàn tác trong ứng dụng.`,
    submit: "Xóa vĩnh viễn",
    danger: true,
    fields:
      '<label class="field"><span>Nhập XÓA để xác nhận</span><input name="confirmation" autocomplete="off" required placeholder="XÓA"></label>',
    onSubmit: (fields) => {
      if (fields.confirmation !== "XÓA")
        throw new Error("Hãy nhập đúng XÓA để xác nhận.");
      return api(`/api/cadre/delete-task?task_id=${task.id}`, {
        method: "DELETE",
      });
    },
  });
  if (result) {
    metadataCache.clear();
    toast(result.message);
    await loadTasks();
    await loadManager();
  }
}
async function exportTask(format, button) {
  const task = state.managerTask;
  if (!task) return;
  await busy(
    button,
    async () => {
      // Direct navigation streams large ZIPs without buffering the whole archive in JS memory.
      const anchor = document.createElement("a");
      anchor.href = `/api/cadre/${format === "excel" ? "export-excel" : "export"}?task_id=${task.id}`;
      anchor.target = "_blank";
      anchor.rel = "noopener";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      toast(
        "Đã yêu cầu tải xuống. Nếu chưa có tệp, kiểm tra tab vừa mở.",
        "info",
      );
    },
    "Đang xuất…",
  );
}
function updatePasswordRequirement() {
  community.sync();
  $("#notificationBell").disabled = !!state.member?.must_change_password;
  if (!state.member?.must_change_password) void extras.refreshSummary();
  const required = !!state.member?.must_change_password;
  $("#defaultPasswordBanner").hidden = !required && !state.member?.is_default_password;
  $("#defaultPasswordBanner p").textContent = required
    ? "Bạn đang dùng mật khẩu tạm. Hãy đổi mật khẩu trước khi tiếp tục."
    : "Bạn đang dùng mật khẩu mặc định. Hãy đổi để bảo vệ tài khoản.";
}
function clearPasswordReset() {
  $("#resetTemporaryPassword").value = "";
  $("#resetPasswordTarget").textContent = "";
  $("#resetPasswordResult").hidden = true;
}
async function loadResetMembers() {
  if (!state.member?.can_reset_password || state.member.must_change_password) return;
  const epoch = state.epoch;
  const select = $("#resetMemberSelect");
  select.disabled = true;
  $("#resetPasswordButton").disabled = true;
  message("#resetPasswordMessage", "Đang tải danh sách…");
  try {
    const data = await api("/api/cadre/reset-password");
    if (epoch !== state.epoch || !state.member?.can_reset_password) return;
    select.innerHTML = '<option value="">Chọn thành viên…</option>' + data.members.map(
      (m) => `<option value="${m.id}">${h(m.name)} · ${h(m.unit_label)}</option>`,
    ).join("");
    select.disabled = false;
    $("#resetPasswordButton").disabled = !data.members.length;
    message("#resetPasswordMessage", "");
  } catch (error) {
    if (epoch === state.epoch) message("#resetPasswordMessage", error.message, true);
  }
}
async function resetMemberPassword(event) {
  event.preventDefault();
  if (!state.member?.can_reset_password || state.member.must_change_password) return;
  const select = $("#resetMemberSelect");
  const id = Number(select.value);
  if (!id) return;
  const epoch = state.epoch;
  clearPasswordReset();
  const result = await modal({
    title: "Đặt lại mật khẩu thành viên?",
    description: `${select.selectedOptions[0].textContent}. Các phiên đăng nhập cũ của người này sẽ bị thu hồi.`,
    submit: "Tạo mật khẩu tạm",
    fields: '<label class="field"><span>Mật khẩu hiện tại của Châu Đan Huy</span><input name="current_password" type="password" autocomplete="current-password" maxlength="256" required /></label>',
    onSubmit: async (fields) => {
      try {
        return await api("/api/cadre/reset-password", {
          method: "POST", body: { member_id: id, current_password: fields.current_password },
        });
      } finally {
        const input = $("#dialogFields [name=current_password]");
        if (input) input.value = "";
        fields.current_password = "";
      }
    },
  });
  if (!result || epoch !== state.epoch || !state.member?.can_reset_password) return;
  // Discard any delayed result if the owner has left the account screen.
  if (state.view !== "account") return;
  $("#resetPasswordTarget").textContent = `Đã đặt lại: ${result.member.name} · ${result.member.unit_label}`;
  $("#resetTemporaryPassword").value = result.temporary_password;
  $("#resetPasswordResult").hidden = false;
  message("#resetPasswordMessage", result.message);
  $("#resetTemporaryPassword").focus();
}

function bind() {
  setupUi();
  setupPreview();
  setupAvatar({api, getMember: () => state.member, onChange: avatar_url => {
    if (!state.member) return;
    state.member.avatar_url = avatar_url;
    renderOwnAvatar(state.member);
    for (const member of [...state.members, ...state.sharedMembers])
      if (Number(member.member_id) === state.member.id) member.avatar_url = avatar_url;
    renderMembers();renderSharedMembers();
  }});
  setupJourney();
  $("#notificationBell").onclick = () => showView("notices");
  $("#copyManagerTask").onclick = () => safeRun(() => state.managerTask && copyTaskLink(state.managerTask.id));
  $("#copySharedTask").onclick = () => safeRun(() => state.sharedTask && copyTaskLink(state.sharedTask.id));
  $("#sharedTask").onchange = () => safeRun(() => openSharedTask(Number($("#sharedTask").value)));
  for (const id of ["sharedSearch", "sharedUnit", "sharedStatus"])
    $("#" + id).addEventListener(id === "sharedSearch" ? "input" : "change", renderSharedMembers);
  $("#sharedSubmit").onclick = () => {
    if (!state.sharedTask || !canSubmit(state.sharedTask)) return;
    $("#uploadTask").value = String(state.sharedTask.id);
    renderUploadTask();
    showView("submit");
  };
  $("#sharedMyFiles").onclick = () => {
    if (!state.sharedTask) return;
    $("#filesTask").value = String(state.sharedTask.id);
    showView("files");
  };
  let routeQueued = false;
  const routeChanged = () => {
    if (routeQueued) return;
    routeQueued = true;
    queueMicrotask(() => {
      routeQueued = false;
      const route = readRoute(location.href);
      if (!state.member || state.member.must_change_password) {
        pendingRoute = route; rememberRoute(route);
        if (state.member) showView("account", { updateUrl: false });
        return;
      }
      safeRun(() => applyRoute(route, { updateUrl: false }));
    });
  };
  window.addEventListener("popstate", routeChanged);
  window.addEventListener("hashchange", routeChanged);
  $("#passwordResetForm").onsubmit = (event) => {
    event.preventDefault();
    return safeRun(() => resetMemberPassword(event));
  };
  $("#dismissTemporaryPassword").onclick = clearPasswordReset;
  $("#copyTemporaryPassword").onclick = () => safeRun(async () => {
    const input = $("#resetTemporaryPassword");
    if (!input.value) return;
    try {
      await navigator.clipboard.writeText(input.value);
      toast("Đã sao chép mật khẩu tạm.");
    } catch {
      input.focus(); input.select();
      toast("Hãy sao chép phần mật khẩu đang được chọn.", "info");
    }
  });
  $("#actionDialog").addEventListener("close", () => {
    const input = $("#dialogFields [name=current_password]");
    if (input) input.value = "";
  });
  updateThemeButtons();
  try {
    if (localStorage.getItem("b1-sidebar") === "collapsed")
      document.documentElement.classList.add("collapsed");
  } catch {}
  $("#themeSelect").onchange = (e) => setTheme(e.target.value);
  matchMedia("(prefers-color-scheme: dark)").addEventListener(
    "change",
    updateThemeButtons,
  );
  $("#menuButton").onclick = openMenu;
  $("#bottomMenu").onclick = openMenu;
  $("#closeMenu").onclick = () => closeMenu();
  $("#sidebarBackdrop").onclick = () => closeMenu();
  window.addEventListener("resize", () => closeMenu(false));
  document.addEventListener("keydown", (e) => {
    if ($("#sidebar").classList.contains("open")) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeMenu();
      }
      if (e.key === "Tab") {
        const nodes = [...$("#sidebar").querySelectorAll("a,button")].filter(
          (n) => !n.hidden && n.getClientRects().length,
        );
        const first = nodes[0],
          last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    const image = e.target.closest("[data-preview-selected]");
    if (image && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      image.click();
    }
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest("a[data-view]")) event.preventDefault();
    return safeRun(async () => {
      const target = event.target;
      if (target.closest("[data-theme-cycle]")) {
        const pref = document.documentElement.dataset.theme;
        setTheme(
          pref === "dark" ||
            (pref === "system" &&
              matchMedia("(prefers-color-scheme: dark)").matches)
            ? "light"
            : "dark",
        );
        return;
      }
      const shared = target.closest("[data-open-shared]");
      if (shared) { await openSharedTask(Number(shared.dataset.openShared)); return; }
      const nav = target.closest("[data-view]");
      if (nav) {
        event.preventDefault();
        showView(nav.dataset.view);
        return;
      }
      const action = target.closest("[data-task-action]");
      if (action) {
        const view = action.dataset.taskView,
          id = action.dataset.taskAction;
        $("#" + (view === "files" ? "filesTask" : "uploadTask")).value = id;
        renderUploadTask();
        showView(view);
        return;
      }
      const refresh = target.closest("[data-refresh]");
      if (refresh) {
        await busy(
          refresh,
          async () => {
            if (refresh.dataset.refresh === "shared") {
              await loadTasks();
              await loadShared();
            } else if (refresh.dataset.refresh === "files") await loadMyFiles(true);
            else if (refresh.dataset.refresh === "manager") {
              await loadTasks();
              await loadManager();
            } else await loadTasks();
          },
          "Đang tải…",
        );
        return;
      }
      const remove = target.closest("[data-remove-selected]");
      if (remove && !state.uploading) {
        const r = state.selected.find(
          (f) => f.id === remove.dataset.removeSelected,
        );
        if (r?.url) URL.revokeObjectURL(r.url);
        state.selected = state.selected.filter((f) => f !== r);
        renderSelected();
        return;
      }
      const replace = target.closest("[data-replace-selected]");
      if (replace && !state.uploading) {
        $("#replaceInput").dataset.replaceId = replace.dataset.replaceSelected;
        $("#replaceInput").click();
        return;
      }
      const selected = target.closest("[data-preview-selected]");
      if (selected) {
        const r = state.selected.find(
          (f) => f.id === selected.dataset.previewSelected,
        );
        if (r)
          openPreview({
            name: r.file.name,
            size: r.file.size,
            url: r.url,
            type: r.file.type,
          });
        return;
      }
      const fileButton = target.closest("[data-file-open]");
      if (fileButton) {
        const fromGallery = !!fileButton.closest("#galleryDialog");
        const file = (fromGallery ? state.gallery : state.myFiles).find(
          (f) => f.id === Number(fileButton.dataset.fileOpen),
        );
        if (file) openPreview(file);
        return;
      }
      const removeUploaded = target.closest("[data-file-delete]");
      if (removeUploaded) {
        await removeFile(Number(removeUploaded.dataset.fileDelete));
        return;
      }
      const cross = target.closest("[data-open-shared-submission]");
      if (cross) { await gallery(Number(cross.dataset.openSharedSubmission), true); return; }
      const open = target.closest("[data-open-submission]");
      if (open) await gallery(Number(open.dataset.openSubmission));
    });
  });

  $("#retryLogin").onclick = () => safeRun(loadRoster);
  $("#loginForm").onsubmit = async (event) => {
    event.preventDefault();
    message("#loginMessage", "");

    const normalizeName = (name) => {
      return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").trim();
    };
    
    const inputName = normalizeName($("#usernameInput").value);
    let matchedMemberId = null;
    
    for (const group of state.roster) {
      for (const member of group.members) {
        if (normalizeName(member.name) === inputName) {
          matchedMemberId = member.id;
          break;
        }
      }
      if (matchedMemberId) break;
    }

    if (!matchedMemberId) {
      message("#loginMessage", "Không tìm thấy tên tài khoản này trong hệ thống.", true);
      return;
    }

    try {
      await busy(
        $("#loginButton"),
        async () => {
          const data = await api("/api/auth/login", {
            method: "POST",
            body: {
              member_id: matchedMemberId,
              password: $("#passwordInput").value,
            },
          });
          $("#passwordInput").value = "";
          await enterApplication(data.member);
        },
        "Đang đăng nhập…",
      );
    } catch (error) {
      message("#loginMessage", error.message, true);
      if (state.member) toast(error.message, "error");
    }
  };
  $("#logoutButton").onclick = () =>
    safeRun(async () => {
      if (state.uploading) return;
      await busy(
        $("#logoutButton"),
        async () => {
          await api("/api/auth/logout", { method: "POST" });
          expireSession({ preserveRoute: false });
        },
        "Đang đăng xuất…",
      );
    });
  $("#uploadForm").onsubmit = upload;
  $("#uploadTask").onchange = renderUploadTask;
  const choose = () => {
    if (canSubmit(selectedTask("#uploadTask")) && !state.uploading)
      $("#fileInput").click();
    else toast("Hãy chọn nhiệm vụ còn nhận bài.", "info");
  };
  $("#dropZone").onclick = choose;
  $("#dropZone").onkeydown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose();
    }
  };
  ["dragenter", "dragover"].forEach((name) =>
    $("#dropZone").addEventListener(name, (e) => {
      e.preventDefault();
      if (!state.uploading) $("#dropZone").classList.add("dragover");
    }),
  );
  ["dragleave", "drop"].forEach((name) =>
    $("#dropZone").addEventListener(name, (e) => {
      e.preventDefault();
      $("#dropZone").classList.remove("dragover");
    }),
  );
  $("#dropZone").addEventListener("drop", (e) => {
    if (canSubmit(selectedTask("#uploadTask"))) addFiles(e.dataTransfer.files);
  });
  document.addEventListener("dragover", (e) => e.preventDefault());
  document.addEventListener("drop", (e) => e.preventDefault());
  $("#fileInput").onchange = (e) => {
    addFiles(e.target.files);
    e.target.value = "";
  };
  $("#cameraButton").onclick = () => $("#cameraInput").click();
  $("#cameraInput").onchange = (e) => {
    addFiles(e.target.files);
    e.target.value = "";
  };
  $("#replaceInput").onchange = (e) => {
    addFiles(e.target.files, e.target.dataset.replaceId);
    e.target.value = "";
  };
  $("#clearSelected").onclick = clearSelected;
  $("#filesTask").onchange = () => safeRun(() => loadMyFiles());
  ["taskSearch", "taskStatus", "taskDeadline"].forEach((id) =>
    $("#" + id).addEventListener(
      id === "taskSearch" ? "input" : "change",
      renderTasks,
    ),
  );
  ["memberSearch", "memberUnit", "memberStatus"].forEach((id) =>
    $("#" + id).addEventListener(
      id === "memberSearch" ? "input" : "change",
      renderMembers,
    ),
  );
  $("#managerTask").onchange = () => safeRun(loadManager);
  $("#newTaskButton").onclick = () => safeRun(() => editTask());
  $("#editTaskButton").onclick = () =>
    safeRun(() => state.managerTask && editTask(state.managerTask));
  $("#toggleTaskButton").onclick = () => safeRun(toggleTask);
  $("#deleteTaskButton").onclick = () => safeRun(deleteTask);
  $("#exportExcel").onclick = () =>
    safeRun(() => exportTask("excel", $("#exportExcel")));
  $("#exportZip").onclick = () =>
    safeRun(() => exportTask("zip", $("#exportZip")));
  $("#galleryDialog").addEventListener("close", () => {
    requests.get("gallery")?.abort();
    state.gallery = [];
    $("#galleryFiles").replaceChildren();
  });
  $("#passwordForm").onsubmit = async (e) => {
    e.preventDefault();
    const button = e.target.querySelector('[type="submit"]');
    message("#passwordMessage", "");
    try {
      await busy(
        button,
        async () => {
          const data = await api("/api/auth/change-password", {
            method: "POST",
            body: {
              current_password: $("#currentPassword").value,
              new_password: $("#newPassword").value,
              confirm_password: $("#confirmPassword").value,
            },
          });
          e.target.reset();
          state.member.is_default_password = false;
          state.member.must_change_password = false;
          if (data.member) state.member = data.member;
          community.reset();
          community.sync();
          $("#passwordResetPanel").hidden = !state.member.can_reset_password;
          if (pendingRoute?.taskId) {
            await loadTasks();
            await applyRoute(pendingRoute, { replace: true });
            pendingRoute = null;
          } else safeRun(loadTasks);
          $("#notificationBell").disabled = false;
          void extras.refreshSummary();
          if (state.member.can_reset_password) safeRun(loadResetMembers);
          $("#defaultPasswordBanner").hidden = true;
          message("#passwordMessage", data.message);
          toast(data.message);
        },
        "Đang lưu…",
      );
    } catch (error) {
      message("#passwordMessage", error.message, true);
    }
  };
  window.addEventListener("pagehide", (event) => {
    clearPasswordReset();
    if (!event.persisted)
      state.selected.forEach((r) => r.url && URL.revokeObjectURL(r.url));
  });
}
async function init() {
  bind();
  if (location.protocol === "file:") {
    message(
      "#loginMessage",
      "Ứng dụng cần chạy qua Cloudflare Pages hoặc máy chủ phát triển. Mở trực tiếp HTML sẽ không kết nối được tài khoản và dữ liệu.",
      true,
    );
    return;
  }
  try {
    const data = await api("/api/auth/me");
    if (data.member) {
      await enterApplication(data.member);
    } else await loadRoster();
  } catch (error) {
    if (state.member) {
      toast(error.message, "error");
    } else {
      await loadRoster();
      message("#loginMessage", error.message, true);
    }
  }
}
init();
