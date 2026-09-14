const IS_LOCAL_FILE = window.location.protocol === 'file:';
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_FILES = 10;
const MAX_TOTAL_SIZE = 100 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const loginScreen = $('#loginScreen');
const appShell = $('#appShell');
const unitSelect = $('#unitSelect');
const memberSelect = $('#memberSelect');
const passwordInput = $('#passwordInput');
const loginForm = $('#loginForm');
const loginButton = $('#loginButton');
const logoutButton = $('#logoutButton');
const loginMessage = $('#loginMessage');

const sidebar = $('#sidebar');
const sidebarToggle = $('#sidebarToggle');
const sidebarBackdrop = $('#sidebarBackdrop');
const mobileMenuButton = $('#mobileMenuButton');
const managerNav = $('#managerNav');
const managerFeature = $('#managerFeature');
const pageEyebrow = $('#pageEyebrow');
const pageTitle = $('#pageTitle');
const roleBadge = $('#roleBadge');
const topbarName = $('#topbarName');
const sidebarAvatar = $('#sidebarAvatar');
const sidebarUserName = $('#sidebarUserName');
const sidebarUserMeta = $('#sidebarUserMeta');
const accountAvatar = $('#accountAvatar');
const accountName = $('#accountName');
const accountMeta = $('#accountMeta');
const sessionGreeting = $('#sessionGreeting');
const sessionMeta = $('#sessionMeta');
const defaultPasswordBanner = $('#defaultPasswordBanner');

const taskSelect = $('#taskSelect');
const uploadForm = $('#uploadForm');
const imagesInput = $('#imagesInput');
const chooseFilesButton = $('#chooseFilesButton');
const uploadBox = $('#uploadBox');
const uploadTitle = $('#uploadTitle');
const uploadHint = $('#uploadHint');
const previewWrap = $('#previewWrap');
const previewList = $('#previewList');
const previewCount = $('#previewCount');
const previewSize = $('#previewSize');
const submitButton = $('#submitButton');
const uploadMessage = $('#uploadMessage');

const refreshMySubmission = $('#refreshMySubmission');
const mySubmissionMeta = $('#mySubmissionMeta');
const mySubmissionMessage = $('#mySubmissionMessage');
const myImagesGrid = $('#myImagesGrid');

const changePasswordForm = $('#changePasswordForm');
const currentPassword = $('#currentPassword');
const newPassword = $('#newPassword');
const confirmPassword = $('#confirmPassword');
const passwordMessage = $('#passwordMessage');

const countTotal = $('#countTotal');
const countCadre = $('#countCadre');
const count1 = $('#count1');
const count2 = $('#count2');
const count3 = $('#count3');

const cadreTaskSelect = $('#cadreTaskSelect');
const newTaskTitle = $('#newTaskTitle');
const createTaskForm = $('#createTaskForm');
const cadreTaskMessage = $('#cadreTaskMessage');
const refreshCadreButton = $('#refreshCadreButton');
const toggleTaskButton = $('#toggleTaskButton');
const deleteTaskButton = $('#deleteTaskButton');
const exportZipButton = $('#exportZipButton');
const cadreSearchInput = $('#cadreSearchInput');
const cadreSections = $('#cadreSections');
const cadreDashboardMessage = $('#cadreDashboardMessage');
const cadreTotal = $('#cadreTotal');
const cadreCountCadre = $('#cadreCountCadre');
const cadreCount1 = $('#cadreCount1');
const cadreCount2 = $('#cadreCount2');
const cadreCount3 = $('#cadreCount3');
const filterTabs = $$('.filter-tab');

const galleryDialog = $('#galleryDialog');
const closeGalleryButton = $('#closeGalleryButton');
const galleryTitle = $('#galleryTitle');
const galleryMeta = $('#galleryMeta');
const galleryTiles = $('#galleryTiles');
const filePreviewPanel = $('#filePreviewPanel');
const filePreviewName = $('#filePreviewName');
const filePreviewInfo = $('#filePreviewInfo');
const filePreviewStage = $('#filePreviewStage');
const fileOpenLink = $('#fileOpenLink');
const fileDownloadLink = $('#fileDownloadLink');

let roster = [];
let currentMember = null;
let tasks = [];
let cadreTasks = [];
let cadreSubmissions = [];
let currentFilterUnit = 'all';
let previewUrls = [];
let galleryImages = [];
let galleryOwner = null;

const VIEW_META = {
  dashboard: ['TỔNG QUAN', 'Dashboard'],
  submit: ['CÔNG VIỆC', 'Gửi minh chứng'],
  'my-files': ['CÁ NHÂN', 'Tài liệu của tôi'],
  account: ['CÁ NHÂN', 'Tài khoản'],
  manager: ['QUẢN TRỊ', 'Quản lý minh chứng']
};

function escapeHTML(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function showMessage(node, text, type = '') {
  if (!node) return;
  node.className = `form-message ${type}`.trim();
  node.textContent = text || '';
}

function formatBytes(bytes = 0) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('vi-VN');
}

function getFileExtension(name = '') {
  const match = String(name).toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : '';
}

function isImageFile(file) {
  return String(file?.type || file?.image_type || '').startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp'].includes(getFileExtension(file?.name || file?.image_name));
}

function fileKind(file) {
  const ext = getFileExtension(file?.name || file?.image_name || '');
  const type = String(file?.type || file?.image_type || '').toLowerCase();
  if (type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return { key: 'image', label: 'IMAGE' };
  if (type === 'application/pdf' || ext === 'pdf') return { key: 'pdf', label: 'PDF' };
  if (type.includes('word') || type.includes('msword') || ['doc', 'docx'].includes(ext)) return { key: 'word', label: 'WORD' };
  if (type.includes('excel') || type.includes('spreadsheet') || ['xls', 'xlsx'].includes(ext)) return { key: 'excel', label: 'EXCEL' };
  if (type.includes('powerpoint') || type.includes('presentation') || ['ppt', 'pptx'].includes(ext)) return { key: 'powerpoint', label: 'PPT' };
  return { key: 'file', label: (ext || 'FILE').toUpperCase() };
}

function fileUrl(file, download = false) {
  const params = new URLSearchParams({ id: String(file.id) });
  if (file.created_at) params.set('v', String(file.created_at));
  if (download) params.set('download', '1');
  return `/api/image?${params.toString()}`;
}

function setButtonLoading(button, loading, loadingText = 'Đang xử lý...') {
  if (!button) return;
  if (!button.dataset.defaultLabel) button.dataset.defaultLabel = button.textContent;
  button.disabled = loading;
  button.textContent = loading ? loadingText : button.dataset.defaultLabel;
}

function initials(name = '') {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'U';
  return `${words[0][0] || ''}${words.at(-1)?.[0] || ''}`.toUpperCase();
}

function clearPreviewUrls() {
  previewUrls.forEach(url => URL.revokeObjectURL(url));
  previewUrls = [];
}

function clearPreviews() {
  clearPreviewUrls();
  previewList.replaceChildren();
  previewWrap.classList.add('hidden');
  uploadTitle.textContent = 'Kéo thả hoặc chọn tài liệu';
  uploadHint.textContent = 'Ảnh · PDF · Word · Excel · PowerPoint · tối đa 20 MB/tệp';
}

function validateFiles(files) {
  if (!files.length) return 'Bạn chưa chọn tài liệu.';
  if (files.length > MAX_FILES) return `Mỗi lần chỉ chọn tối đa ${MAX_FILES} tài liệu.`;
  let total = 0;
  for (const file of files) {
    const ext = getFileExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(ext)) return `File "${file.name}" không thuộc định dạng được hỗ trợ.`;
    if (file.size > MAX_FILE_SIZE) return `File "${file.name}" vượt quá 20 MB.`;
    total += file.size;
  }
  if (total > MAX_TOTAL_SIZE) return 'Tổng dung lượng tài liệu vượt quá 100 MB.';
  return '';
}

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Có lỗi xảy ra.');
  return data;
}

function showView(name) {
  if (name === 'manager' && currentMember?.role !== 'cadre') name = 'dashboard';
  $$('.app-view').forEach(view => view.classList.toggle('active', view.dataset.viewPanel === name));
  $$('.nav-item[data-view]').forEach(item => item.classList.toggle('active', item.dataset.view === name));
  const [eyebrow, title] = VIEW_META[name] || VIEW_META.dashboard;
  pageEyebrow.textContent = eyebrow;
  pageTitle.textContent = title;
  sidebar.classList.remove('open');
  if (history.replaceState) history.replaceState(null, '', `#${name}`);

  if (name === 'my-files') loadMySubmission().catch(error => showMessage(mySubmissionMessage, error.message, 'error'));
  if (name === 'manager' && currentMember?.role === 'cadre') loadCadreDashboard().catch(error => showMessage(cadreDashboardMessage, error.message, 'error'));
}

function setSessionUI(member) {
  currentMember = member;
  const loggedIn = !!member;
  loginScreen.classList.toggle('hidden', loggedIn);
  appShell.classList.toggle('hidden', !loggedIn);
  managerNav.classList.toggle('hidden', !(loggedIn && member.role === 'cadre'));
  managerFeature.classList.toggle('hidden', !(loggedIn && member.role === 'cadre'));

  if (!loggedIn) {
    $$('.app-view').forEach(view => view.classList.toggle('active', view.dataset.viewPanel === 'dashboard'));
    $$('.nav-item[data-view]').forEach(item => item.classList.toggle('active', item.dataset.view === 'dashboard'));
    return;
  }

  const roleText = member.role === 'cadre' ? 'Quyền quản lý' : 'Học viên';
  const avatarText = initials(member.name);
  roleBadge.textContent = roleText;
  roleBadge.style.color = member.role === 'cadre' ? '#087f79' : '#4353b8';
  roleBadge.style.background = member.role === 'cadre' ? '#dff7f4' : '#ebedff';
  topbarName.textContent = member.name;
  sidebarAvatar.textContent = avatarText;
  sidebarUserName.textContent = member.name;
  sidebarUserMeta.textContent = member.unit_label;
  accountAvatar.textContent = avatarText;
  accountName.textContent = member.name;
  accountMeta.textContent = `${member.unit_label} · ${roleText}`;
  sessionGreeting.textContent = `Xin chào, ${member.name}`;
  sessionMeta.textContent = `${member.unit_label} · Chọn một chức năng trong sidebar để bắt đầu.`;
  defaultPasswordBanner.classList.toggle('hidden', !member.is_default_password);

  const requested = location.hash.replace('#', '');
  showView(VIEW_META[requested] ? requested : 'dashboard');
}

function resetMessages() {
  [loginMessage, uploadMessage, passwordMessage, mySubmissionMessage, cadreTaskMessage, cadreDashboardMessage].forEach(node => showMessage(node, ''));
}

function getGroupMembers(unitCode) {
  return roster.find(group => group.code === unitCode)?.members || [];
}

function populateUnitSelect() {
  unitSelect.innerHTML = '<option value="">Chọn tiểu đội / nhóm</option>';
  for (const group of roster) {
    const option = document.createElement('option');
    option.value = group.code;
    option.textContent = group.label;
    unitSelect.appendChild(option);
  }
}

function populateMemberSelect(unitCode) {
  memberSelect.replaceChildren();
  if (!unitCode) {
    memberSelect.innerHTML = '<option value="">Chọn tiểu đội trước</option>';
    memberSelect.disabled = true;
    return;
  }
  memberSelect.disabled = false;
  const first = document.createElement('option');
  first.value = '';
  first.textContent = 'Chọn họ và tên';
  memberSelect.appendChild(first);
  for (const member of getGroupMembers(unitCode)) {
    const option = document.createElement('option');
    option.value = String(member.id);
    option.textContent = member.name;
    memberSelect.appendChild(option);
  }
}

async function loadRoster() {
  if (IS_LOCAL_FILE) {
    roster = [
      { code: 'cadre', label: 'Cán bộ trung đội', members: [{ id: 1, name: 'Vũ Trọng Thắng' }] },
      { code: '1', label: 'Tiểu đội 1', members: [{ id: 2, name: 'Châu Đan Huy' }] },
      { code: '2', label: 'Tiểu đội 2', members: [{ id: 3, name: 'Thái Thanh Phong' }] },
      { code: '3', label: 'Tiểu đội 3', members: [{ id: 4, name: 'Trần Hoàng Kiên' }] }
    ];
  } else {
    const data = await fetchJSON('/api/roster');
    roster = data.groups || [];
  }
  populateUnitSelect();
}

async function loadSession() {
  if (IS_LOCAL_FILE) return setSessionUI(null);
  const data = await fetchJSON('/api/auth/me').catch(() => ({ authenticated: false }));
  setSessionUI(data.member || null);
  if (data.member) await afterLogin();
}

async function loadTasks(forCadre = false) {
  if (!currentMember) return;
  const url = forCadre && currentMember.role === 'cadre' ? '/api/tasks?all=1' : '/api/tasks';
  const data = await fetchJSON(url);

  if (forCadre) {
    cadreTasks = data.tasks || [];
    renderCadreTaskSelect();
    return;
  }

  tasks = data.tasks || [];
  const activeTasks = tasks.filter(task => Number(task.is_active) === 1);
  taskSelect.replaceChildren();
  if (!activeTasks.length) {
    taskSelect.innerHTML = '<option value="">Hiện chưa có task nào đang mở</option>';
    submitButton.disabled = true;
    return;
  }
  for (const task of activeTasks) {
    const option = document.createElement('option');
    option.value = String(task.id);
    option.textContent = task.title;
    taskSelect.appendChild(option);
  }
  submitButton.disabled = false;
}

function renderCadreTaskSelect() {
  const oldValue = cadreTaskSelect.value;
  cadreTaskSelect.replaceChildren();
  if (!cadreTasks.length) {
    cadreTaskSelect.innerHTML = '<option value="">Chưa có task</option>';
    updateCadreToggleButton();
    return;
  }
  for (const task of cadreTasks) {
    const option = document.createElement('option');
    option.value = String(task.id);
    option.textContent = `${task.title}${Number(task.is_active) ? '' : ' · đã đóng'}`;
    cadreTaskSelect.appendChild(option);
  }
  if (cadreTasks.some(task => String(task.id) === oldValue)) cadreTaskSelect.value = oldValue;
  updateCadreToggleButton();
}

async function loadStats(taskId = Number(taskSelect.value || cadreTaskSelect.value)) {
  const statEls = [countTotal, countCadre, count1, count2, count3, cadreTotal, cadreCountCadre, cadreCount1, cadreCount2, cadreCount3];
  if (!taskId) {
    statEls.forEach(el => { if (el) el.textContent = '0'; });
    return;
  }
  const data = await fetchJSON(`/api/stats?task_id=${encodeURIComponent(taskId)}`);
  countTotal.textContent = String(data.total ?? 0);
  countCadre.textContent = String(data.counts?.cadre ?? 0);
  count1.textContent = String(data.counts?.['1'] ?? 0);
  count2.textContent = String(data.counts?.['2'] ?? 0);
  count3.textContent = String(data.counts?.['3'] ?? 0);
  cadreTotal.textContent = String(data.total ?? 0);
  cadreCountCadre.textContent = String(data.counts?.cadre ?? 0);
  cadreCount1.textContent = String(data.counts?.['1'] ?? 0);
  cadreCount2.textContent = String(data.counts?.['2'] ?? 0);
  cadreCount3.textContent = String(data.counts?.['3'] ?? 0);
}

function renderSelectedFiles() {
  const files = [...imagesInput.files];
  const error = validateFiles(files);
  clearPreviews();
  if (error) {
    if (files.length) showMessage(uploadMessage, error, 'error');
    return;
  }
  if (!files.length) return;
  showMessage(uploadMessage, '');

  const total = files.reduce((sum, file) => sum + file.size, 0);
  previewCount.textContent = `${files.length} tài liệu đã chọn`;
  previewSize.textContent = formatBytes(total);

  for (const file of files) {
    const kind = fileKind(file);
    const card = document.createElement('div');
    card.className = 'preview-item';
    if (isImageFile(file)) {
      const url = URL.createObjectURL(file);
      previewUrls.push(url);
      card.innerHTML = `<img src="${url}" alt="${escapeHTML(file.name)}"><div class="preview-meta"><strong>${escapeHTML(file.name)}</strong><small>${formatBytes(file.size)}</small></div>`;
    } else {
      card.innerHTML = `<div class="file-preview-placeholder"><span>${kind.label}</span></div><div class="preview-meta"><strong>${escapeHTML(file.name)}</strong><small>${formatBytes(file.size)}</small></div>`;
    }
    previewList.appendChild(card);
  }
  uploadTitle.textContent = `${files.length} tài liệu đã sẵn sàng`;
  uploadHint.textContent = 'Bạn có thể chọn lại nếu muốn thay đổi danh sách.';
  previewWrap.classList.remove('hidden');
}

function createFileTile(file, options = {}) {
  const kind = fileKind(file);
  const article = document.createElement('article');
  article.className = 'file-tile';
  const name = file.image_name || file.name || 'Tài liệu';
  const info = [formatBytes(file.image_size || file.size || 0), formatDate(file.created_at)].filter(Boolean).join(' · ');
  article.innerHTML = `
    <button class="file-tile-main" type="button" data-file-open="${file.id}">
      <span class="file-icon ${kind.key}">${kind.label}</span>
      <span class="file-tile-name" title="${escapeHTML(name)}">${escapeHTML(name)}</span>
    </button>
    <div class="file-tile-meta">
      <span class="file-tile-info">${escapeHTML(info || kind.label)}</span>
      <div class="file-tile-actions">
        <button class="file-action primary" type="button" data-file-open="${file.id}">${kind.key === 'image' ? 'Xem' : 'Chi tiết'}</button>
        <a class="file-action" href="${fileUrl(file, true)}">Tải xuống</a>
        ${options.allowDelete ? `<button class="file-action danger" type="button" data-file-delete="${file.id}">Xóa</button>` : ''}
      </div>
    </div>`;
  return article;
}

async function loadMySubmission() {
  if (!currentMember) return;
  const taskId = Number(taskSelect.value);
  if (!taskId) {
    mySubmissionMeta.textContent = 'Chưa có task đang mở.';
    myImagesGrid.className = 'file-tiles empty-state';
    myImagesGrid.innerHTML = '<div class="empty-box"><strong>Chưa chọn được task.</strong><span>Khi có task đang mở, tài liệu của bạn sẽ hiển thị ở đây.</span></div>';
    return;
  }

  showMessage(mySubmissionMessage, 'Đang tải danh sách tài liệu...');
  const data = await fetchJSON(`/api/me/submission?task_id=${encodeURIComponent(taskId)}`);
  const task = tasks.find(item => Number(item.id) === taskId) || cadreTasks.find(item => Number(item.id) === taskId);
  mySubmissionMeta.textContent = task ? `Task: ${task.title}` : 'Hồ sơ hiện tại';

  const files = data.images || [];
  if (!data.submission || !files.length) {
    myImagesGrid.className = 'file-tiles empty-state';
    myImagesGrid.innerHTML = '<div class="empty-box"><strong>Chưa có tài liệu trong task này.</strong><span>Tài liệu sau khi gửi sẽ xuất hiện tại đây.</span></div>';
    showMessage(mySubmissionMessage, '');
    return;
  }

  myImagesGrid.className = 'file-tiles';
  myImagesGrid.replaceChildren();
  files.forEach(file => myImagesGrid.appendChild(createFileTile(file, { allowDelete: true })));
  showMessage(mySubmissionMessage, `${files.length} tài liệu · bấm vào một ô để xem chi tiết.`);
}

async function afterLogin() {
  resetMessages();
  await loadTasks(false);
  await Promise.all([loadStats(Number(taskSelect.value)), loadMySubmission()]);
  if (currentMember?.role === 'cadre') {
    await loadTasks(true);
    await loadCadreDashboard();
  }
}

async function loadCadreDashboard() {
  if (currentMember?.role !== 'cadre') return;
  if (!cadreTasks.length) {
    cadreSections.innerHTML = '<div class="empty-box"><strong>Chưa có task nào.</strong><span>Hãy tạo task mới để bắt đầu thống kê.</span></div>';
    await loadStats(0);
    return;
  }
  if (!cadreTaskSelect.value) cadreTaskSelect.value = String(cadreTasks[0].id);
  updateCadreToggleButton();
  await Promise.all([loadStats(Number(cadreTaskSelect.value)), fetchCadreSubmissions()]);
}

function updateCadreToggleButton() {
  const task = cadreTasks.find(item => String(item.id) === String(cadreTaskSelect.value));
  const disabled = !task;
  toggleTaskButton.disabled = disabled;
  deleteTaskButton.disabled = disabled;
  exportZipButton.disabled = disabled;
  if (task) toggleTaskButton.textContent = Number(task.is_active) ? 'Đóng nhận bài' : 'Mở nhận bài';
}

async function fetchCadreSubmissions() {
  const taskId = Number(cadreTaskSelect.value);
  if (!taskId) return;
  showMessage(cadreDashboardMessage, 'Đang tải danh sách nộp bài...');
  const data = await fetchJSON(`/api/cadre/submissions?task_id=${encodeURIComponent(taskId)}`);
  cadreSubmissions = data.submissions || [];
  renderCadreSections();
  const task = cadreTasks.find(item => Number(item.id) === taskId);
  showMessage(cadreDashboardMessage, task ? `Task: ${task.title} · ${cadreSubmissions.length} người đã nộp` : '');
}

function renderCadreSections() {
  const sections = [
    { code: 'cadre', label: 'Cán bộ trung đội' },
    { code: '1', label: 'Tiểu đội 1' },
    { code: '2', label: 'Tiểu đội 2' },
    { code: '3', label: 'Tiểu đội 3' }
  ];
  const search = cadreSearchInput.value.trim().toLowerCase();
  cadreSections.replaceChildren();
  let shown = 0;

  for (const section of sections) {
    if (currentFilterUnit !== 'all' && currentFilterUnit !== section.code) continue;
    const items = cadreSubmissions.filter(item => item.unit_code === section.code && (!search || item.name.toLowerCase().includes(search)));
    const card = document.createElement('section');
    card.className = 'section-card';
    card.innerHTML = `<div class="section-head"><h3>${section.label}</h3><span>${items.length} người đã nộp</span></div><div class="section-grid"></div>`;
    const grid = card.querySelector('.section-grid');

    if (!items.length) {
      grid.innerHTML = '<div class="empty-box"><strong>Chưa có bản nộp.</strong><span>Khi có người nộp, dữ liệu sẽ xuất hiện ở đây.</span></div>';
    } else {
      shown += items.length;
      for (const item of items) {
        const article = document.createElement('article');
        article.className = 'person-card';
        article.innerHTML = `<strong>${escapeHTML(item.name)}</strong><div class="person-meta"><div>${Number(item.image_count) || 0} tài liệu</div><div>Cập nhật: ${escapeHTML(formatDate(item.updated_at))}</div></div><button class="soft-button" type="button">Xem tài liệu</button>`;
        article.querySelector('button').addEventListener('click', () => openGallery(item));
        grid.appendChild(article);
      }
    }
    cadreSections.appendChild(card);
  }

  if (!shown && cadreSubmissions.length) showMessage(cadreDashboardMessage, 'Không tìm thấy kết quả khớp bộ lọc hiện tại.', 'error');
}

function resetFilePreview() {
  filePreviewPanel.classList.add('hidden');
  filePreviewStage.replaceChildren();
  filePreviewName.textContent = 'Tài liệu';
  filePreviewInfo.textContent = '';
  fileOpenLink.removeAttribute('href');
  fileDownloadLink.removeAttribute('href');
}

function renderGalleryTiles() {
  galleryTiles.replaceChildren();
  if (!galleryImages.length) {
    galleryTiles.innerHTML = '<div class="empty-box"><strong>Chưa có tài liệu.</strong><span>Người này chưa gửi file trong task hiện tại.</span></div>';
    return;
  }
  galleryImages.forEach(file => galleryTiles.appendChild(createFileTile(file)));
}

async function openGallery(item) {
  galleryOwner = item;
  galleryImages = [];
  galleryTitle.textContent = item.name;
  galleryMeta.textContent = `${item.unit_label} · đang tải danh sách tài liệu...`;
  galleryTiles.innerHTML = '<div class="empty-box"><strong>Đang tải...</strong><span>Chỉ tải danh sách trước, nội dung file sẽ tải khi bạn bấm xem.</span></div>';
  resetFilePreview();
  galleryDialog.showModal();
  try {
    const data = await fetchJSON(`/api/cadre/images?submission_id=${encodeURIComponent(item.id)}`);
    galleryImages = data.images || [];
    galleryMeta.textContent = `${item.unit_label} · ${galleryImages.length} tài liệu · chế độ Tiles`;
    renderGalleryTiles();
  } catch (error) {
    galleryMeta.textContent = error.message || 'Không thể tải tài liệu.';
  }
}

function openPersonalFile(file) {
  galleryOwner = { name: 'Tài liệu của tôi', unit_label: currentMember?.unit_label || '' };
  galleryImages = [file];
  galleryTitle.textContent = 'Tài liệu của tôi';
  galleryMeta.textContent = `${currentMember?.unit_label || ''} · 1 tài liệu`;
  renderGalleryTiles();
  resetFilePreview();
  galleryDialog.showModal();
  selectGalleryFile(file);
}

function selectGalleryFile(file) {
  if (!file) return;
  const kind = fileKind(file);
  const name = file.image_name || 'Tài liệu';
  filePreviewPanel.classList.remove('hidden');
  filePreviewName.textContent = name;
  filePreviewInfo.textContent = `${kind.label} · ${formatBytes(file.image_size || 0)}${file.created_at ? ` · ${formatDate(file.created_at)}` : ''}`;
  fileOpenLink.href = fileUrl(file, false);
  fileDownloadLink.href = fileUrl(file, true);
  filePreviewStage.replaceChildren();

  if (kind.key === 'image') {
    const img = document.createElement('img');
    img.alt = name;
    img.decoding = 'async';
    img.src = fileUrl(file, false);
    filePreviewStage.appendChild(img);
  } else {
    const message = document.createElement('div');
    message.className = 'preview-message';
    if (kind.key === 'pdf') {
      message.innerHTML = '<strong>PDF sẵn sàng.</strong><br>Bấm “Mở file” để xem PDF trong tab riêng hoặc “Tải xuống” để lưu đúng định dạng.';
    } else {
      message.innerHTML = `<span class="file-icon ${kind.key}" style="margin:0 auto 14px">${kind.label}</span><strong>${kind.label} sẵn sàng.</strong><br>Trình duyệt không hiển thị trực tiếp định dạng Office. Hãy dùng “Tải xuống” để mở bằng ứng dụng tương ứng.`;
    }
    filePreviewStage.appendChild(message);
  }
  filePreviewPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* Navigation */
$$('[data-go-view]').forEach(button => button.addEventListener('click', () => showView(button.dataset.goView)));
$$('.nav-item[data-view]').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
$('[data-nav-target="dashboard"]')?.addEventListener('click', event => { event.preventDefault(); showView('dashboard'); });
sidebarToggle.addEventListener('click', () => {
  document.body.classList.toggle('sidebar-collapsed');
  localStorage.setItem('sidebar-collapsed', document.body.classList.contains('sidebar-collapsed') ? '1' : '0');
});
mobileMenuButton.addEventListener('click', () => sidebar.classList.add('open'));
sidebarBackdrop.addEventListener('click', () => sidebar.classList.remove('open'));
if (localStorage.getItem('sidebar-collapsed') === '1') document.body.classList.add('sidebar-collapsed');

/* Auth */
unitSelect.addEventListener('change', () => populateMemberSelect(unitSelect.value));
loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (IS_LOCAL_FILE) return showMessage(loginMessage, 'Bản local chỉ dùng để xem giao diện. Hãy chạy trên Cloudflare để đăng nhập thật.', 'error');
  const memberId = Number(memberSelect.value);
  const password = passwordInput.value;
  if (!unitSelect.value) return showMessage(loginMessage, 'Hãy chọn tiểu đội / nhóm.', 'error');
  if (!memberId) return showMessage(loginMessage, 'Hãy chọn họ tên.', 'error');
  if (!password) return showMessage(loginMessage, 'Hãy nhập mật khẩu.', 'error');

  setButtonLoading(loginButton, true, 'Đang đăng nhập...');
  showMessage(loginMessage, 'Đang xác thực tài khoản...');
  try {
    const data = await fetchJSON('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId, password })
    });
    setSessionUI(data.member);
    passwordInput.value = '';
    await afterLogin();
  } catch (error) {
    showMessage(loginMessage, error.message || 'Đăng nhập thất bại.', 'error');
  } finally {
    setButtonLoading(loginButton, false);
  }
});

logoutButton.addEventListener('click', async () => {
  if (!IS_LOCAL_FILE) await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  currentMember = null;
  tasks = [];
  cadreTasks = [];
  cadreSubmissions = [];
  clearPreviews();
  setSessionUI(null);
  taskSelect.innerHTML = '<option value="">Đăng nhập để xem task</option>';
  cadreTaskSelect.innerHTML = '<option value="">Đăng nhập để xem task</option>';
  cadreSections.replaceChildren();
  unitSelect.value = '';
  populateMemberSelect('');
  passwordInput.value = '';
  showMessage(loginMessage, 'Đã đăng xuất.', 'success');
  history.replaceState?.(null, '', location.pathname);
});

/* Upload */
chooseFilesButton.addEventListener('click', event => { event.preventDefault(); imagesInput.click(); });
imagesInput.addEventListener('change', renderSelectedFiles);
['dragenter', 'dragover'].forEach(type => uploadBox.addEventListener(type, event => { event.preventDefault(); uploadBox.classList.add('dragover'); }));
['dragleave', 'drop'].forEach(type => uploadBox.addEventListener(type, event => { event.preventDefault(); uploadBox.classList.remove('dragover'); }));
uploadBox.addEventListener('drop', event => {
  const files = [...(event.dataTransfer.files || [])].slice(0, MAX_FILES);
  if (!files.length) return;
  const dt = new DataTransfer();
  files.forEach(file => dt.items.add(file));
  imagesInput.files = dt.files;
  renderSelectedFiles();
});

taskSelect.addEventListener('change', async () => {
  await Promise.all([loadStats(Number(taskSelect.value)), loadMySubmission()]);
});
refreshMySubmission.addEventListener('click', () => loadMySubmission().catch(error => showMessage(mySubmissionMessage, error.message, 'error')));

uploadForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (IS_LOCAL_FILE) return showMessage(uploadMessage, 'Bản local không thể gửi dữ liệu thật.', 'error');
  const files = [...imagesInput.files];
  const error = validateFiles(files);
  if (!taskSelect.value) return showMessage(uploadMessage, 'Hãy chọn task cần minh chứng.', 'error');
  if (error) return showMessage(uploadMessage, error, 'error');

  const body = new FormData();
  body.append('task_id', taskSelect.value);
  files.forEach(file => body.append('images', file));
  setButtonLoading(submitButton, true, 'Đang gửi...');
  showMessage(uploadMessage, `Đang tải ${files.length} tài liệu lên hệ thống...`);
  try {
    const data = await fetchJSON('/api/me/upload', { method: 'POST', body });
    showMessage(uploadMessage, data.message || 'Đã gửi minh chứng.', 'success');
    imagesInput.value = '';
    clearPreviews();
    await Promise.all([loadStats(Number(taskSelect.value)), loadMySubmission()]);
    if (currentMember?.role === 'cadre') await fetchCadreSubmissions();
  } catch (error) {
    showMessage(uploadMessage, error.message || 'Không thể gửi minh chứng.', 'error');
  } finally {
    setButtonLoading(submitButton, false);
  }
});

myImagesGrid.addEventListener('click', async event => {
  const openButton = event.target.closest('[data-file-open]');
  if (openButton) {
    const id = Number(openButton.dataset.fileOpen);
    const taskId = Number(taskSelect.value);
    if (!id || !taskId) return;
    try {
      const data = await fetchJSON(`/api/me/submission?task_id=${encodeURIComponent(taskId)}`);
      const file = (data.images || []).find(item => Number(item.id) === id);
      if (file) openPersonalFile(file);
    } catch (error) {
      showMessage(mySubmissionMessage, error.message, 'error');
    }
    return;
  }

  const deleteButton = event.target.closest('[data-file-delete]');
  if (!deleteButton) return;
  const imageId = Number(deleteButton.dataset.fileDelete);
  if (!imageId || !confirm('Bạn muốn xóa tài liệu này khỏi hồ sơ của mình?')) return;
  deleteButton.disabled = true;
  try {
    const data = await fetchJSON(`/api/me/images?id=${encodeURIComponent(imageId)}`, { method: 'DELETE' });
    showMessage(mySubmissionMessage, data.remaining === 0 ? 'Đã xóa tài liệu cuối cùng trong task này.' : 'Đã xóa tài liệu thành công.', 'success');
    await Promise.all([loadStats(Number(taskSelect.value)), loadMySubmission()]);
    if (currentMember?.role === 'cadre') await fetchCadreSubmissions();
  } catch (error) {
    showMessage(mySubmissionMessage, error.message || 'Không thể xóa tài liệu.', 'error');
    deleteButton.disabled = false;
  }
});

/* Account */
changePasswordForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (IS_LOCAL_FILE) return showMessage(passwordMessage, 'Bản local không hỗ trợ đổi mật khẩu.', 'error');
  const button = changePasswordForm.querySelector('button[type="submit"]');
  setButtonLoading(button, true, 'Đang đổi...');
  try {
    const data = await fetchJSON('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: currentPassword.value, new_password: newPassword.value, confirm_password: confirmPassword.value })
    });
    showMessage(passwordMessage, data.message || 'Đổi mật khẩu thành công.', 'success');
    currentPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
    if (currentMember) currentMember.is_default_password = false;
    defaultPasswordBanner.classList.add('hidden');
  } catch (error) {
    showMessage(passwordMessage, error.message || 'Không thể đổi mật khẩu.', 'error');
  } finally {
    setButtonLoading(button, false);
  }
});

/* Manager */
createTaskForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!newTaskTitle.value.trim()) return showMessage(cadreTaskMessage, 'Hãy nhập tên task mới.', 'error');
  const button = createTaskForm.querySelector('button');
  setButtonLoading(button, true, 'Đang tạo...');
  try {
    const data = await fetchJSON('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTaskTitle.value })
    });
    showMessage(cadreTaskMessage, `Đã tạo task: ${data.task.title}`, 'success');
    newTaskTitle.value = '';
    await Promise.all([loadTasks(false), loadTasks(true)]);
    cadreTaskSelect.value = String(data.task.id);
    if ([...taskSelect.options].some(option => option.value === String(data.task.id))) taskSelect.value = String(data.task.id);
    await loadCadreDashboard();
  } catch (error) {
    showMessage(cadreTaskMessage, error.message || 'Không thể tạo task.', 'error');
  } finally {
    setButtonLoading(button, false);
  }
});

cadreTaskSelect.addEventListener('change', async () => { updateCadreToggleButton(); await loadCadreDashboard(); });
refreshCadreButton.addEventListener('click', () => loadCadreDashboard().catch(error => showMessage(cadreDashboardMessage, error.message, 'error')));

toggleTaskButton.addEventListener('click', async () => {
  const task = cadreTasks.find(item => String(item.id) === String(cadreTaskSelect.value));
  if (!task) return;
  const next = Number(task.is_active) ? 0 : 1;
  setButtonLoading(toggleTaskButton, true, next ? 'Đang mở...' : 'Đang đóng...');
  try {
    const data = await fetchJSON('/api/cadre/toggle-task', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task_id: task.id, is_active: next })
    });
    showMessage(cadreTaskMessage, `${next ? 'Đã mở' : 'Đã đóng'} task: ${data.task.title}`, 'success');
    await Promise.all([loadTasks(false), loadTasks(true)]);
    cadreTaskSelect.value = String(task.id);
    await loadCadreDashboard();
  } catch (error) {
    showMessage(cadreTaskMessage, error.message || 'Không thể đổi trạng thái task.', 'error');
  } finally {
    setButtonLoading(toggleTaskButton, false);
  }
});

deleteTaskButton.addEventListener('click', async () => {
  const task = cadreTasks.find(item => String(item.id) === String(cadreTaskSelect.value));
  if (!task) return;
  if (!confirm(`Xóa task "${task.title}"?\n\nToàn bộ tài liệu trong task này sẽ bị xóa vĩnh viễn.`)) return;
  if (!confirm(`XÁC NHẬN LẦN CUỐI\n\nTask: ${task.title}\n\nSau thao tác này không thể khôi phục.`)) return;

  setButtonLoading(deleteTaskButton, true, 'Đang xóa...');
  showMessage(cadreTaskMessage, 'Đang xóa task và toàn bộ tài liệu...');
  try {
    const data = await fetchJSON(`/api/cadre/delete-task?task_id=${encodeURIComponent(task.id)}`, { method: 'DELETE' });
    showMessage(cadreTaskMessage, `Đã xóa "${data.deleted_task}" và ${data.deleted_images} tài liệu.`, 'success');
    await Promise.all([loadTasks(false), loadTasks(true)]);
    await loadCadreDashboard();
    await loadMySubmission();
  } catch (error) {
    showMessage(cadreTaskMessage, error.message || 'Không thể xóa task.', 'error');
  } finally {
    setButtonLoading(deleteTaskButton, false);
  }
});

exportZipButton.addEventListener('click', () => {
  const taskId = Number(cadreTaskSelect.value);
  if (!taskId) return;
  window.location.href = `/api/cadre/export?task_id=${encodeURIComponent(taskId)}`;
});

filterTabs.forEach(button => button.addEventListener('click', () => {
  currentFilterUnit = button.dataset.unit;
  filterTabs.forEach(tab => tab.classList.toggle('active', tab === button));
  renderCadreSections();
}));
cadreSearchInput.addEventListener('input', renderCadreSections);

/* Explorer dialog */
galleryTiles.addEventListener('click', event => {
  const button = event.target.closest('[data-file-open]');
  if (!button) return;
  const file = galleryImages.find(item => Number(item.id) === Number(button.dataset.fileOpen));
  if (file) selectGalleryFile(file);
});
closeGalleryButton.addEventListener('click', () => galleryDialog.close());
galleryDialog.addEventListener('click', event => {
  const rect = galleryDialog.getBoundingClientRect();
  const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  if (outside) galleryDialog.close();
});

window.addEventListener('beforeunload', clearPreviewUrls);

async function init() {
  try {
    await loadRoster();
  } catch (error) {
    showMessage(loginMessage, error.message || 'Không tải được danh sách tài khoản.', 'error');
  }
  await loadSession();
}

init();
